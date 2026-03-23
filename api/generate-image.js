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

// ── Шаблоны с точными именами элементов из Creatomate ────────────────────────
const TEMPLATES = {
  saas: {
    id: '363107a3-5653-4c00-a495-7402e2b8d0d0',
    name: 'Blank template',
    keywords: ['saas', 'технологи', 'software', 'приложени', 'сервис', 'платформ',
      'автомобил', 'машин', 'авто', 'car', 'vehicle',
      'бизнес', 'business', 'b2b', 'компани', 'агентств'],
    buildModifications: (imageUrl, headline, bodyText, cta) => ({
      'Image': imageUrl,
      'Headline': headline || '',
      'Text-6J6': bodyText || '',   // текст тела объявления
      'Text-HPB': '',               // можно использовать для CTA
    })
  },
  premium: {
    id: '87e4c15b-8675-4cf3-a7e0-5b6a73a237ee',
    name: 'Text Squash',
    keywords: ['премиум', 'premium', 'люкс', 'luxury', 'обучени', 'курс', 'course',
      'психолог', 'коуч', 'coach', 'блогер', 'blogger', 'эксперт', 'expert',
      'тренинг', 'consulting', 'консультац', 'наставник',
      'недвижимост', 'real estate', 'квартир', 'дом'],
    buildModifications: (imageUrl, headline, bodyText, cta) => ({
      'Background-Image': imageUrl,
      'Text-1': headline || '',      // главный заголовок
      'Text-2': bodyText || '',      // подзаголовок
      'Text-3': cta || '',           // дата/доп инфо
      'Text-4': '',                  // сайт
    })
  },
  ecommerce: {
    id: '91caeced-efb9-46c4-84aa-2bc949adbe4f',
    name: 'Flip Product Hero',
    keywords: ['одежд', 'fashion', 'косметик', 'beauty', 'магазин', 'shop', 'store',
      'товар', 'продукт', 'product', 'бренд', 'brand', 'обувь', 'shoes',
      'аксессуар', 'украшени', 'jewelry', 'парфюм', 'perfume'],
    buildModifications: (imageUrl, headline, bodyText, cta) => ({
      'Product Image': imageUrl,
      'Caption': headline || '',
      'Call To Action': cta || bodyText || 'Узнать больше',
    })
  },
  universal: {
    id: 'e4229ace-5156-42e8-a024-d257beec9559',
    name: 'Minimalistic Product Hero',
    keywords: [],
    buildModifications: (imageUrl, headline, bodyText, cta) => ({
      'Product-Image': imageUrl,      // главное фото продукта
      'Background-Image': imageUrl,   // тот же фон (Creatomate размоет сам)
      'CTA': cta || headline || 'Shop Now',
    })
  }
}

function detectTemplate(description) {
  if (!description) return TEMPLATES.universal
  const text = description.toLowerCase()
  for (const [, template] of Object.entries(TEMPLATES)) {
    if (template.keywords.length === 0) continue
    if (template.keywords.some(kw => text.includes(kw))) return template
  }
  return TEMPLATES.universal
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

// Загружаем фото на ImgBB чтобы получить публичный URL для Creatomate
async function uploadToImgBB(buffer) {
  const formData = new FormData()
  formData.append('image', buffer.toString('base64'))
  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
    { method: 'POST', body: formData }
  )
  const data = await res.json()
  if (!data?.data?.display_url) throw new Error('ImgBB upload failed: ' + JSON.stringify(data))
  return data.data.display_url // прямая ссылка на файл, не страница
}

// Рендерим баннер через Creatomate и ждём результата
async function renderWithCreatomate(templateId, modifications) {
  console.log('Creatomate render start, template:', templateId)
  console.log('Modifications:', JSON.stringify(modifications))

  const res = await fetch('https://api.creatomate.com/v1/renders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      template_id: templateId,
      output_format: 'jpg',
      frame: 'last',
      modifications
    })
  })

  const data = await res.json()
  if (!res.ok) throw new Error('Creatomate API error: ' + JSON.stringify(data))

  const renderId = Array.isArray(data) ? data[0]?.id : data?.id
  if (!renderId) throw new Error('No render ID: ' + JSON.stringify(data))

  console.log('Render ID:', renderId)

  // Polling — ждём завершения рендера (макс 90 сек)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000))

    const statusRes = await fetch(
      `https://api.creatomate.com/v1/renders/${renderId}`,
      { headers: { 'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}` } }
    )
    const status = await statusRes.json()
    console.log(`Render status [${i}]:`, status.status)

    if (status.status === 'succeeded') return status.url
    if (status.status === 'failed') throw new Error('Render failed: ' + status.error_message)
  }

  throw new Error('Creatomate render timeout after 90s')
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

    const description    = fields.description?.[0]  || fields.productDesc?.[0] || ''
    const headline       = fields.headline?.[0]      || ''
    const bodyText       = fields.text?.[0]          || ''
    const promptText     = fields.prompt?.[0]        || ''
    const adCategory     = fields.adCategory?.[0]    || 'universal'
    const referenceImage = files.reference_image?.[0]

    // Используем категорию выбранную пользователем
    const template = TEMPLATES[adCategory] || TEMPLATES.universal
    console.log(`Template: ${template.name}, category: ${adCategory}`)

    // 2. Генерируем фото через DALL-E
    let imageBuffer

    const dallePrompt = promptText
      ? `${promptText}. Professional commercial photography. No text, no logos, no watermarks.`
      : `Professional advertisement photo for: ${description}. Premium quality, clean composition. No text, no logos.`

    if (referenceImage) {
      const rawBuffer = fs.readFileSync(referenceImage.filepath)
      const pngBuffer = await sharp(rawBuffer)
        .resize(1024, 1024, { fit: 'cover' })
        .ensureAlpha()
        .png()
        .toBuffer()

      const formData = new FormData()
      formData.append('model', 'dall-e-2')
      formData.append('prompt', dallePrompt)
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
      imageBuffer = Buffer.from(b64, 'base64')
    } else {
      const aiResponse = await openai.images.generate({
        model: 'dall-e-3',
        prompt: dallePrompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      })
      const b64 = aiResponse.data?.[0]?.b64_json
      if (!b64) throw new Error('DALL-E generation failed')
      imageBuffer = Buffer.from(b64, 'base64')
    }

    // 3. Загружаем фото на ImgBB
    const imageUrl = await uploadToImgBB(imageBuffer)
    console.log('Image uploaded to ImgBB:', imageUrl)

    // 4. Строим modifications для конкретного шаблона
    const modifications = template.buildModifications(imageUrl, headline, bodyText, '')

    // 5. Рендерим через Creatomate
    const bannerUrl = await renderWithCreatomate(template.id, modifications)
    console.log('Banner ready:', bannerUrl)

    // 6. Скачиваем готовый баннер
    const bannerRes = await fetch(bannerUrl)
    const bannerBuffer = Buffer.from(await bannerRes.arrayBuffer())

    res.status(200).json({
      imageBase64: bannerBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      mode: referenceImage ? 'edit' : 'generate',
      template: template.name
    })

  } catch (error) {
    console.error('generate-image error:', error)
    res.status(500).json({ error: error.message || 'Failed to generate image' })
  }
}
