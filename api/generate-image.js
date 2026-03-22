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

      // Конвертируем в PNG с альфа-каналом (RGBA) — DALL-E 2 edit требует именно это
      const pngBuffer = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: 'cover' })
        .ensureAlpha() // добавляем альфа-канал → RGBA
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

    // Если есть заголовок — накладываем через SVG с явным XML заголовком
    // Sharp на Vercel умеет рендерить SVG если правильно передать XML
    let compositeOps = []

    if (headline && headline.trim()) {
      const headlineLines = wrapText(headline.toUpperCase(), 22)
      const lineHeight = 68
      const totalTextH = headlineLines.length * lineHeight
      const startY = 1024 - totalTextH - 60

      const textRows = headlineLines.map((line, i) =>
        `<text x="512" y="${startY + i * lineHeight + 50}"
          font-size="56" font-weight="bold"
          fill="white" text-anchor="middle"
          stroke="#000" stroke-width="4" paint-order="stroke fill"
        >${escapeSvg(line)}</text>`
      ).join('\n')

      const svgText = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#000" stop-opacity="0"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0.6"/>
          </linearGradient>
        </defs>
        <rect x="0" y="${startY - 20}" width="1024" height="${totalTextH + 80}" fill="url(#g)"/>
        ${textRows}
      </svg>`

      compositeOps.push({ input: Buffer.from(svgText), top: 0, left: 0 })
    }

    // Собираем финальную картинку через Sharp
    const finalBuffer = await sharp(bgBuffer)
      .resize(1024, 1024, { fit: 'cover' })
      .composite(compositeOps)
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
