import { createClient } from '@supabase/supabase-js';
import { getTgUserId, requireSubscription } from './_subscription.js';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import sharp from 'sharp';

export const config = { api: { bodyParser: false } };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function buildPrompt({ prompt, description, hasReference }) {
  const product = prompt?.trim() || description || 'premium product';
  const instruction = hasReference 
    ? "Enhance this reference: improve lighting, make it professional commercial shot." 
    : "Create a minimalist commercial photo of the product.";

  return `${instruction} Subject: ${product}. Style: Quiet luxury, minimalist, premium quality, professional lighting. Background: Blurred aesthetic bokeh. CRITICAL: No text or logos on image. Leave space at top and bottom.`;
}

async function fetchWithTimeout(url, options, timeoutMs = 70000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timeoutId); }
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ multiples: false });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err); else resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const tgUserId = getTgUserId(req);
    const { data: user } = await supabase.from('users').select('subscription_active').eq('tg_user_id', tgUserId).single();
    if (!requireSubscription(user, res)) return;

    const { fields, files } = await parseForm(req);
    const headline = fields.headline?.[0] || '';
    const buttonText = fields.text?.[0] || 'УЗНАТЬ БОЛЬШЕ';
    const referenceImage = files.reference_image?.[0];

    const finalPrompt = buildPrompt({
      prompt: fields.prompt?.[0],
      description: fields.description?.[0],
      hasReference: Boolean(referenceImage)
    });

    let openAiRes;
    const authHeader = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` };

    // ГЕНЕРАЦИЯ КАРТИНКИ
    if (referenceImage) {
      const buffer = fs.readFileSync(referenceImage.filepath);
      const formData = new FormData();
      formData.append('model', 'dall-e-2'); 
      formData.append('prompt', finalPrompt);
      formData.append('n', '1');
      formData.append('size', '1024x1024');
      formData.append('response_format', 'b64_json');
      formData.append('image', new Blob([buffer], { type: 'image/png' }), 'ref.png');

      openAiRes = await fetchWithTimeout('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: authHeader,
        body: formData
      });
    } else {
      openAiRes = await fetchWithTimeout('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: finalPrompt,
          n: 1, // Всегда 1 для экономии и стабильности
          size: '1024x1024',
          response_format: 'b64_json'
        })
      });
    }

    const data = await openAiRes.json();
    const base64FromAi = data?.data?.[0]?.b64_json;
    if (!base64FromAi) throw new Error(data?.error?.message || 'OpenAI failed');

    // ГРАФИЧЕСКАЯ СБОРКА ЧЕРЕЗ SHARP (Наложение текста)
    const bgBuffer = Buffer.from(base64FromAi, 'base64');
    
    // Генерируем SVG оверлей только если есть текст
    const svgOverlay = Buffer.from(`
      <svg width="1024" height="1024">
        ${headline ? `
          <rect x="0" y="0" width="1024" height="160" fill="rgba(0,0,0,0.5)" />
          <text x="512" y="95" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="white" text-anchor="middle">${headline.toUpperCase()}</text>
        ` : ''}
        
        <rect x="312" y="860" width="400" height="90" rx="15" fill="#1a1a1a" stroke="#D4AF37" stroke-width="4" />
        <text x="512" y="918" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="white" text-anchor="middle">${buttonText.toUpperCase()}</text>
      </svg>
    `);

    const finalBuffer = await sharp(bgBuffer)
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();

    // Возвращаем результат в формате, который понимает наш обновленный CreateAd.jsx
    return res.json({
      images: [{
        imageBase64: finalBuffer.toString('base64'),
        mimeType: 'image/jpeg'
      }],
      revisedPrompt: data?.data?.[0]?.revised_prompt,
      mode: referenceImage ? 'edit' : 'generate'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
