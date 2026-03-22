// api/generate-image.js
// Бэкенд генерирует ЧИСТУЮ картинку без текста.
// Текст накладывается на фронте через Canvas — это надёжнее на Vercel serverless.

import { OpenAI } from 'openai'
import { getTgUserId, requireSubscription } from './_subscription.js'
import { createClient } from '@supabase/supabase-js'
import { IncomingForm } from 'formidable'
import fs from 'fs'
import sharp from 'sharp'

export const config = { api: { bodyParser: false } }

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

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
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user } = await supabase
      .from('users')
      .select('subscription_active, subscription_until')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!requireSubscription(user, res)) return

    const { fields, files } = await parseForm(req)

    const description = fields.description?.[0] || fields.productDesc?.[0] || ''
    const promptText  = fields.prompt?.[0] || ''
    const referenceImage = files.reference_image?.[0]

    // Строим промпт — просим ЧИСТУЮ картинку без текста
    const finalPrompt = promptText
      ? `${promptText}. Premium commercial photography. No text, no logos, no watermarks.`
      : `Professional advertisement photo for: ${description}. Premium lifestyle, high-end lighting, minimalist style. No text, no logos, no watermarks.`

    let bgBuffer

    if (referenceImage) {
      // Есть референс — используем DALL-E 2 edit
      const imageBuffer = fs.readFileSync(referenceImage.filepath)

      // ВАЖНО: DALL-E 2 edit требует PNG с альфа-каналом (RGBA)
      const pngBuffer = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: 'cover' })
        .ensureAlpha()
        .png()
        .toBuffer()

      const formData = new FormData()
      formData.append('model', 'dall-e-2')
      formData.append('prompt', finalPrompt)
      formData.append('n', '1')
      formData.append('size', '1024x1024')
      formData.append('response_format', 'b64_json')
      formData.append('image', new Blob([pngBuffer], { type: 'image/png' }), 'ref.png')

      const editRes = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: formData
      })
      const editData = await editRes.json()
      const b64 = editData?.data?.[0]?.b64_json
      if (!b64) throw new Error(editData?.error?.message || 'DALL-E edit failed')
      bgBuffer = Buffer.from(b64, 'base64')

    } else {
      // Нет референса — генерируем с нуля через DALL-E 3
      const aiResponse = await openai.images.generate({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      })
      const b64 = aiResponse.data?.[0]?.b64_json
      if (!b64) throw new Error('DALL-E generation failed')
      bgBuffer = Buffer.from(b64, 'base64')
    }

    // Просто ресайзим через Sharp — БЕЗ SVG и БЕЗ текста
    // Текст накладывает фронт через Canvas
    const finalBuffer = await sharp(bgBuffer)
      .resize(1024, 1024, { fit: 'cover' })
      .jpeg({ quality: 92 })
      .toBuffer()

    res.status(200).json({
      imageBase64: finalBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      mode: referenceImage ? 'edit' : 'generate'
    })

  } catch (error) {
    console.error('generate-image error:', error)
    res.status(500).json({ error: error.message || 'Failed to generate image' })
  }
}
