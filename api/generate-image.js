// api/generate-image.js
import { createClient } from '@supabase/supabase-js'
import { getTgUserId, requireSubscription } from './_subscription.js'
import { IncomingForm } from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function buildPrompt({ prompt, description, headline, text, geo, hasReference }) {
  const basePrompt = prompt?.trim()

  if (basePrompt) {
    return `${basePrompt}. Это рекламный креатив для Facebook/Instagram Ads. Без логотипов конкурентов, без мелкого нечитаемого текста, визуально чисто, современно, premium quality.`
  }

  return [
    'Создай продающий рекламный креатив для Facebook/Instagram Ads.',
    `Продукт или услуга: ${description || 'товар или услуга'}.`,
    `Гео: ${geo || 'Казахстан'}.`,
    headline ? `Заголовок объявления: ${headline}.` : '',
    text ? `Смысл оффера: ${text}.` : '',
    hasReference
      ? 'Используй загруженное изображение как референс по стилю и композиции, но улучши качество, свет, чистоту кадра и рекламную подачу.'
      : 'Сделай изображение с нуля в рекламном стиле: clean composition, premium lighting, realistic product focus.',
    'Формат квадратный, высокая детализация, без водяных знаков, без лишних надписей на изображении.'
  ].filter(Boolean).join(' ')
}

async function fetchWithTimeout(url, options, timeoutMs = 60000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ multiples: false })
    form.parse(req, (err, fields, files) => {
      if (err) reject(err)
      else resolve({ fields, files })
    })
  })
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user } = await supabase
      .from('users')
      .select('subscription_active, subscription_until')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!requireSubscription(user, res)) return

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is missing in Vercel' })
    }

    const { fields, files } = await parseForm(req)
    const prompt = fields.prompt?.[0] || ''
    const description = fields.description?.[0] || ''
    const headline = fields.headline?.[0] || ''
    const text = fields.text?.[0] || ''
    const geo = fields.geo?.[0] || ''
    const referenceImage = files.reference_image?.[0]

    if (!prompt && !description) {
      return res.status(400).json({ error: 'Prompt or description is required' })
    }

    const finalPrompt = buildPrompt({
      prompt,
      description,
      headline,
      text,
      geo,
      hasReference: Boolean(referenceImage)
    })

    let openAiRes

    if (referenceImage) {
      const buffer = fs.readFileSync(referenceImage.filepath)
      const formData = new FormData()
      formData.append('model', 'gpt-image-1')
      formData.append('prompt', finalPrompt)
      formData.append('size', '1024x1024')
      formData.append('output_format', 'png')
      formData.append(
        'image[]',
        new Blob([buffer], { type: referenceImage.mimetype || 'image/png' }),
        referenceImage.originalFilename || 'reference.png'
      )

      openAiRes = await fetchWithTimeout('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: formData
      })
    } else {
      openAiRes = await fetchWithTimeout('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: finalPrompt,
          size: '1024x1024',
          output_format: 'png'
        })
      })
    }

    const data = await openAiRes.json()

    if (!openAiRes.ok) {
      return res.status(500).json({
        error: data?.error?.message || 'Image generation failed',
        details: data
      })
    }

    const imageBase64 = data?.data?.[0]?.b64_json
    if (!imageBase64) {
      return res.status(500).json({ error: 'OpenAI did not return an image' })
    }

    return res.json({
      imageBase64,
      mimeType: 'image/png',
      revisedPrompt: data?.data?.[0]?.revised_prompt || finalPrompt,
      mode: referenceImage ? 'edit' : 'generate'
    })
  } catch (error) {
    console.error('Image generation error:', error)

    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Image generation timed out after 60 seconds' })
    }

    return res.status(500).json({ error: error.message || 'Image generation failed' })
  }
}
