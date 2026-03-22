// api/generate-image.js
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

// Безопасно экранируем текст для SVG
function escapeSvg(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Разбиваем длинный текст на строки
function wrapText(text, maxLen = 22) {
  const words = text.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxLen) {
      if (current) lines.push(current.trim())
      current = word
    } else {
      current = (current + ' ' + word).trim()
    }
  }
  if (current) lines.push(current.trim())
  return lines.slice(0, 3) // максимум 3 строки
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })

    // Проверяем подписку
    const { data: user } = await supabase
      .from('users')
      .select('subscription_active, subscription_until')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!requireSubscription(user, res)) return

    // Парсим multipart форму
    const { fields, files } = await parseForm(req)

    const headline = fields.headline?.[0] || fields.headline || ''
    const description = fields.description?.[0] || fields.description || fields.productDesc?.[0] || ''
    const promptText = fields.prompt?.[0] || fields.prompt || ''
    const referenceImage = files.reference_image?.[0] || files.reference_image

    // Строим промпт для DALL-E
    const finalPrompt = promptText
      ? `${promptText}. Premium commercial photography, no text, no logos, clean composition.`
      : `Professional advertisement photo for: ${description}. Premium lifestyle, high-end lighting, minimalist style, no text, no logos.`

    let bgBuffer

    if (referenceImage) {
      // Есть референс — используем DALL-E 2 edit
      const imageBuffer = fs.readFileSync(referenceImage.filepath)

      // Конвертируем в PNG и делаем квадратным для DALL-E
      const pngBuffer = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: 'cover' })
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

    // Строим SVG оверлей с текстом
    const headlineLines = headline ? wrapText(headline.toUpperCase(), 20) : []
    const lineHeight = 72
    const textBlockHeight = headlineLines.length * lineHeight
    const textY = 1024 - 80 - textBlockHeight

    const headlineSvg = headlineLines.map((line, i) => `
      <text
        x="512"
        y="${textY + i * lineHeight}"
        font-family="Arial, sans-serif"
        font-size="58"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        filter="url(#shadow)"
      >${escapeSvg(line)}</text>
    `).join('')

    const svgOverlay = Buffer.from(`
      <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
            <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.65" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.8"/>
          </filter>
        </defs>

        ${headlineLines.length > 0 ? `
          <rect x="0" y="${textY - 40}" width="1024" height="${textBlockHeight + 120}"
            fill="url(#grad)" />
          ${headlineSvg}
        ` : ''}
      </svg>
    `)

    // Собираем финальную картинку через Sharp
    const finalBuffer = await sharp(bgBuffer)
      .resize(1024, 1024, { fit: 'cover' })
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .jpeg({ quality: 92 })
      .toBuffer()

    const imageBase64 = finalBuffer.toString('base64')

    res.status(200).json({
      imageBase64,
      mimeType: 'image/jpeg',
      mode: referenceImage ? 'edit' : 'generate'
    })

  } catch (error) {
    console.error('generate-image error:', error)
    res.status(500).json({ error: error.message || 'Failed to generate image' })
  }
}
