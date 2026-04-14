import { createClient } from '@supabase/supabase-js'
import { getTgUserId, requireSubscription, checkEndpointRateLimit } from './_subscription.js'
import { IncomingForm } from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ multiples: false, maxFileSize: 20 * 1024 * 1024 })
    form.parse(req, (err, fields, files) => {
      if (err) reject(err)
      else resolve({ fields, files })
    })
  })
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  if (!checkEndpointRateLimit(req, res, 'photoroom')) return

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
    const imageFile = files.image?.[0]
    if (!imageFile) return res.status(400).json({ error: 'No image provided' })

    const mode = fields.mode?.[0] || 'remove_bg' // remove_bg | beautify | full

    const apiKey = process.env.PHOTOROOM_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'PHOTOROOM_API_KEY not configured' })

    const imageBuffer = fs.readFileSync(imageFile.filepath)
    const formData = new FormData()
    formData.append('imageFile', new Blob([imageBuffer], { type: imageFile.mimetype || 'image/jpeg' }), 'image.jpg')

    // Параметры в зависимости от режима
    if (mode === 'remove_bg') {
      // Только убираем фон — прозрачный PNG
      formData.append('removeBackground', 'true')
      formData.append('outputSize', 'input')
    } else if (mode === 'beautify') {
      // Убираем фон + улучшаем + белый фон
      formData.append('removeBackground', 'true')
      formData.append('background.color', 'ffffff')
      formData.append('outputSize', '1000x1000')
      formData.append('padding', '0.1')
      formData.append('shadow.mode', 'ai.soft')
    } else if (mode === 'full') {
      // Убираем фон + beautify + генерим AI фон для рекламы
      formData.append('removeBackground', 'true')
      formData.append('outputSize', '1080x1080')
      formData.append('padding', '0.15')
      formData.append('shadow.mode', 'ai.soft')
      formData.append('background.prompt', fields.bgPrompt?.[0] || 'studio product photography, clean gradient background, professional advertising')
    }

    const photoroomRes = await fetch('https://image-api.photoroom.com/v2/edit', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        // HD режим для высокого качества
        'pr-hd-background-removal': 'auto'
      },
      body: formData
    })

    if (!photoroomRes.ok) {
      const errText = await photoroomRes.text()
      console.error('Photoroom error:', photoroomRes.status, errText)
      return res.status(502).json({ error: `Photoroom API error: ${photoroomRes.status}` })
    }

    // Получаем изображение и отдаём как base64
    const resultBuffer = Buffer.from(await photoroomRes.arrayBuffer())
    const contentType = photoroomRes.headers.get('content-type') || 'image/png'
    const base64 = resultBuffer.toString('base64')

    return res.status(200).json({
      imageBase64: base64,
      mimeType: contentType,
      dataUrl: `data:${contentType};base64,${base64}`
    })

  } catch (error) {
    console.error('photoroom handler error:', error)
    res.status(500).json({ error: error.message })
  }
}
