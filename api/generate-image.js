import { OpenAI } from 'openai';
import { getTgUserId, requireSubscription } from './_subscription.js';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp'; // Убедись, что sharp установлен в package.json

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const userId = getTgUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: user } = await supabase.from('users').select('*').eq('tg_userid', userId).single();
    if (!requireSubscription(user, res)) return;

    // ВАЖНО: productDesc и headline — это наши УТП из скриншота
    const { headline, productDesc, prompt, ctaText } = req.body;

    // 1. Генерируем "чистую" картинку (без текста, чтобы он не был кривым)
    // ИИ должен создать только "элитный" фон и объект
    const finalPrompt = prompt || `Premium lifestyle photography for ${productDesc}. High-end lighting, minimalist style, no text.`;
    const aiResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024",
    });

    // 2. ЗАГРУЖАЕМ КАРТИНКУ В БУФЕР (как в оригинале)
    const rawImageUrl = aiResponse.data[0].url;
    const imageResponse = await fetch(rawImageUrl);
    const bgBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // 3. СОЗДАЕМ SVG ОВЕРЛЕЙ (с текстом и дизайном)
    // Мы используем sans-serif для совместимости с Serverless средой (Linux)
    const svgOverlay = Buffer.from(`
      <svg width="1024" height="1024">
        <rect x="0" y="800" width="1024" height="224" fill="url(#grad)" />
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
            <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.6" />
          </linearGradient>
        </defs>
        
        <text x="512" y="920" font-family="sans-serif" font-size="64" font-weight="bold" fill="white" text-anchor="middle">
          ${headline ? headline.toUpperCase() : ''}
        </text>

        ${ctaText ? `
          <rect x="312" y="960" width="400" height="40" rx="20" fill="#7c5cfc" />
          <text x="512" y="985" font-family="sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">
            ${ctaText.toUpperCase()}
          </text>
        ` : ''}
      </svg>
    `);

    // 4. СБОРКА ЧЕРЕЗ SHARP (тот самый код, который я вернула)
    const finalBuffer = await sharp(bgBuffer)
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .jpeg({ quality: 95 })
      .toBuffer();

    // Конвертируем в Base64 для моментального отображения на фронте
    const base64Image = `data:image/png;base64,${finalBuffer.toString('base64')}`;

    // Логируем
    await supabase.from('ai_logs').insert({ user_id: user.id, type: 'pro_sharp_gen' });

    res.status(200).json({ url: base64Image });

  } catch (error) {
    console.error('Sharp processing error:', error);
    return res.status(500).json({ error: 'Failed to assemble creative' });
  }
}
