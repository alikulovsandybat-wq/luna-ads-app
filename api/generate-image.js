import { OpenAI } from 'openai';
import { getTgUserId, requireSubscription } from './_subscription.js';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import formidable from 'formidable';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Вспомогательная функция для парсинга FormData на Vercel
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      // formidable возвращает массивы — берём первый элемент
      const flat = {};
      for (const key in fields) {
        flat[key] = Array.isArray(fields[key]) ? fields[key][0] : fields[key];
      }
      resolve({ fields: flat, files });
    });
  });
}

// Экранируем спецсимволы XML, чтобы SVG не ломался
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const config = {
  api: {
    bodyParser: false, // ВАЖНО: отключаем встроенный парсер, используем formidable
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const userId = getTgUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('tg_userid', userId)
      .single();

    if (!requireSubscription(user, res)) return;

    // ✅ ФИХ #1: Правильно парсим FormData через formidable
    const { fields } = await parseForm(req);
    const { headline, productDesc, prompt, ctaText } = fields;

    // 1. Генерируем чистую картинку без текста
    const finalPrompt =
      prompt ||
      `Premium lifestyle photography for ${productDesc}. High-end lighting, minimalist style, no text, no watermarks, no logos.`;

    const aiResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: finalPrompt,
      n: 1,
      size: '1024x1024',
    });

    // 2. Загружаем картинку в буфер
    const rawImageUrl = aiResponse.data[0].url;
    const imageResponse = await fetch(rawImageUrl);
    const bgBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // ✅ ФИХ #2: <defs> идёт ПЕРВЫМ внутри <svg>, ДО любого использования градиента
    // ✅ ФИХ #3: Экранируем XML-спецсимволы в тексте
    const safeHeadline = escapeXml(headline);
    const safeCtaText = escapeXml(ctaText);

    const svgOverlay = Buffer.from(`
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
      <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.72" />
    </linearGradient>
  </defs>

  <!-- Градиентная подложка снизу -->
  <rect x="0" y="700" width="1024" height="324" fill="url(#grad)" />

  ${safeHeadline ? `
  <!-- Заголовок -->
  <text
    x="512"
    y="880"
    font-family="Arial, Helvetica, sans-serif"
    font-size="62"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
  >${safeHeadline.toUpperCase()}</text>
  ` : ''}

  ${safeCtaText ? `
  <!-- CTA кнопка -->
  <rect x="312" y="930" width="400" height="54" rx="27" fill="#7c5cfc" />
  <text
    x="512"
    y="957"
    font-family="Arial, Helvetica, sans-serif"
    font-size="22"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
  >${safeCtaText.toUpperCase()}</text>
  ` : ''}
</svg>
`);

    // 3. Собираем финальное изображение через Sharp
    const finalBuffer = await sharp(bgBuffer)
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .png({ quality: 95 }) // ✅ ФИХ #4: PNG чтобы совпадало с data:image/png в base64
      .toBuffer();

    const base64Image = `data:image/png;base64,${finalBuffer.toString('base64')}`;

    // Логируем
    await supabase
      .from('ai_logs')
      .insert({ user_id: user.id, type: 'pro_sharp_gen' });

    res.status(200).json({ url: base64Image });
  } catch (error) {
    console.error('Sharp processing error:', error);
    return res.status(500).json({ error: 'Failed to assemble creative', details: error.message });
  }
}
