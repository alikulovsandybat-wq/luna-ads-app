import { OpenAI } from 'openai'
import { getTgUserId, requireSubscription } from './_subscription.js'
import { createClient } from '@supabase/supabase-js'
import { IncomingForm } from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// ── Шаблоны с точными именами элементов из Creatomate ────────────────────────
const TEMPLATES = {
  saas: {
    id: '363107a3-5653-4c00-a495-7402e2b8d0d0',
    buildModifications: (imageUrl, headline, bodyText, cta) => ({
      'Background_Image': imageUrl,
      'Headline': headline || '',
      'Subheadline': bodyText || '',
      'CTA_Text': cta || 'Learn More'
    })
  },
  premium: {
    id: '87e4c15b-8675-4cf3-a7e0-5b6a73a237ee',
    buildModifications: (imageUrl, headline, bodyText, cta) => ({
      'Background_Image': imageUrl,
      'Headline': headline || '',
      'Subheadline': bodyText || '',
      'CTA_Text': cta || 'Get Started'
    })
  },
  ecommerce: {
    id: '91caeced-efb9-46c4-84aa-2bc949adbe4f',
    buildModifications: (imageUrl, headline, bodyText, cta) => ({
      'Background_Image': imageUrl,
      'Headline': headline || '',
      'Subheadline': bodyText || '',
      'CTA_Text': cta || 'Shop Now'
    })
  },
  universal: {
    id: '3fed1e6c-d623-4999-9d18-ec86aa12880a',
    buildModifications: (imageUrl, headline, bodyText, cta) => ({
      'Background_Image': imageUrl,
      'Headline': headline || '',
      'Subheadline': bodyText || '',
      'CTA_Text': cta || 'Learn More'
    })
  }
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ multiples: false })
    form.parse(req, (err, fields, files) => {
      if (err) reject(err)
      else resolve({ fields, files })
    })
  })
}

async function uploadToImgBB(buffer) {
  const formData = new FormData()
  formData.append('image', buffer.toString('base64'))
  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
    { method: 'POST', body: formData }
  )
  const data = await res.json()
  if (!data?.data?.display_url) throw new Error('ImgBB upload failed: ' + JSON.stringify(data))
  return data.data.display_url
}

async function renderWithCreatomate(templateId, modifications) {
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
      modifications: modifications
    })
  })

  const data = await res.json()
  if (!res.ok) throw new Error('Creatomate API error: ' + JSON.stringify(data))

  const renderId = Array.isArray(data) ? data[0]?.id : data?.id
  if (!renderId) throw new Error('No render ID')

  // Polling
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const statusRes = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      headers: { 'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}` }
    })
    const status = await statusRes.json()
    if (status.status === 'succeeded') return status.url
    if (status.status === 'failed') throw new Error('Render failed: ' + status.error_message)
  }
  throw new Error('Creatomate render timeout')
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user } = await supabase.from('users').select('*').eq('tg_user_id', tgUserId).single()
    if (!requireSubscription(user, res)) return

    const { fields, files } = await parseForm(req)

    const description = fields.description?.[0] || fields.productDesc?.[0] || ''
    const headline = fields.headline?.[0] || ''
    const bodyText = fields.text?.[0] || ''
    const ctaText = fields.cta?.[0] || '' // Тот самый CTA из ИИ
    const promptText = fields.prompt?.[0] || ''
    const adCategory = fields.adCategory?.[0] || 'universal'
    const referenceImage = files.reference_image?.[0]

    const template = TEMPLATES[adCategory] || TEMPLATES.universal

    let imageBuffer
    const dallePrompt = promptText || `Professional advertisement photo for: ${description}. Premium quality.`

    if (referenceImage) {
      // Прямое чтение файла БЕЗ SHARP
      const rawBuffer = fs.readFileSync(referenceImage.filepath)
      const formData = new FormData()
      formData.append('model', 'dall-e-2')
      formData.append('prompt', dallePrompt)
      formData.append('image', new Blob([rawBuffer], { type: 'image/png' }), 'ref.png')
      
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
        response_format: 'b64_json'
      })
      imageBuffer = Buffer.from(aiResponse.data[0].b64_json, 'base64')
    }

    const imageUrl = await uploadToImgBB(imageBuffer)
    
    // Передаем ctaText в модификации!
    const modifications = template.buildModifications(imageUrl, headline, bodyText, ctaText)

    const bannerUrl = await renderWithCreatomate(template.id, modifications)
    const bannerRes = await fetch(bannerUrl)
    const finalBuffer = Buffer.from(await bannerRes.arrayBuffer())

    res.status(200).json({
      imageBase64: finalBuffer.toString('base64'),
      mimeType: 'image/jpeg'
    })

  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: error.message })
  }
}
