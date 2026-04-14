// api/launch.js — запуск рекламы через Make.com webhook
// Make уже одобрен Meta, поэтому нам не нужно своё приложение Meta
import { createClient } from '@supabase/supabase-js'
import { getTgUserId, requireSubscription, checkEndpointRateLimit } from './_subscription.js'
import { IncomingForm } from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  if (!checkEndpointRateLimit(req, res, 'launch')) return

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user } = await supabase
      .from('users')
      .select('fb_access_token, fb_ad_account_id, subscription_active, subscription_until')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!requireSubscription(user, res)) return
    if (!user?.fb_access_token) return res.status(401).json({ error: 'Facebook не подключён. Пожалуйста, переподключите аккаунт.' })
    if (!user?.fb_ad_account_id) return res.status(400).json({ error: 'Рекламный аккаунт не найден. Переподключите Facebook.' })

    // Парсим форму
    const { fields, files } = await parseForm(req)
    const budget     = fields.budget?.[0] || '10'
    const geo        = fields.geo?.[0] || 'KZ'
    const ageMin     = fields.ageMin?.[0] || '18'
    const ageMax     = fields.ageMax?.[0] || '45'
    const headline   = fields.headline?.[0] || ''
    const text       = fields.text?.[0] || ''
    const ctaType    = fields.ctaType?.[0] || 'MESSAGE_PAGE'
    const whatsappNumber = fields.whatsappNumber?.[0] || ''
    const ctaUrl     = fields.ctaUrl?.[0] || ''

    let geoObj = null
    try { geoObj = JSON.parse(fields.geoObj?.[0] || 'null') } catch {}

    let interests = []
    try {
      const raw = fields.interests?.[0] || ''
      interests = raw ? JSON.parse(raw) : []
    } catch {
      interests = (fields.interests?.[0] || '').split(',').map(s => s.trim()).filter(Boolean)
    }

    // Валидация
    if (!headline) return res.status(400).json({ error: 'Заголовок обязателен' })
    if (ctaType === 'WHATSAPP_MESSAGE' && !whatsappNumber) {
      return res.status(400).json({ error: 'Укажите номер WhatsApp' })
    }
    if ((ctaType === 'TELEGRAM' || ctaType === 'LEARN_MORE') && !ctaUrl) {
      return res.status(400).json({ error: 'Укажите ссылку' })
    }

    // Картинка → base64 для передачи в Make
    let imageBase64 = null
    let imageMime = null
    const imageFile = files.image?.[0]
    if (imageFile) {
      const buf = fs.readFileSync(imageFile.filepath)
      imageBase64 = buf.toString('base64')
      imageMime = imageFile.mimetype || 'image/jpeg'
    }

    // Строим payload для Make webhook
    const makePayload = {
      // Данные пользователя
      fb_access_token:  user.fb_access_token,
      fb_ad_account_id: user.fb_ad_account_id,

      // Параметры кампании
      campaign_name: `Luna Ads — ${headline.slice(0, 30)} — ${new Date().toLocaleDateString('ru')}`,
      objective: 'OUTCOME_LEADS',      // лидогенерация — правильная цель

      // Параметры группы
      adset_name: `${geoObj?.display || geo} | ${ageMin}-${ageMax}`,
      daily_budget_cents: Math.round(parseFloat(budget) * 100),
      age_min: parseInt(ageMin),
      age_max: parseInt(ageMax),
      geo_locations: buildGeoLocations(geoObj, geo),
      interests,

      // Креатив
      headline,
      body_text: text,
      cta_type: ctaType,
      cta_link: ctaType === 'WHATSAPP_MESSAGE'
        ? `https://wa.me/${normalizePhone(whatsappNumber)}`
        : ctaUrl || process.env.APP_URL || 'https://t.me/marketologluna_bot',

      // Картинка
      image_base64: imageBase64,
      image_mime:   imageMime,

      // Мета-данные
      tg_user_id: tgUserId,
      launched_at: new Date().toISOString(),
    }

    // Отправляем в Make webhook
    const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL
    if (!makeWebhookUrl) {
      return res.status(500).json({ error: 'MAKE_WEBHOOK_URL не настроен. Добавьте переменную в Vercel.' })
    }

    const makeRes = await fetch(makeWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload)
    })

    // Make возвращает "Accepted" или JSON
    const makeBody = await makeRes.text()
    let makeData = {}
    try { makeData = JSON.parse(makeBody) } catch {}

    if (!makeRes.ok) {
      console.error('Make webhook error:', makeRes.status, makeBody)
      return res.status(502).json({ error: `Make.com error: ${makeRes.status} — ${makeBody}` })
    }

    // Сохраняем в Supabase (без fb_campaign_id — он придёт позже от Make)
    const { error: dbError } = await supabase.from('campaigns').insert({
      tg_user_id:   tgUserId,
      fb_campaign_id: makeData.campaign_id || null,
      fb_adset_id:  makeData.adset_id || null,
      fb_ad_id:     makeData.ad_id || null,
      name:         headline,
      budget:       parseFloat(budget),
      geo:          geoObj?.display || geo,
      status:       'PENDING',   // Make обработает и обновит до ACTIVE
      created_at:   new Date().toISOString()
    })

    if (dbError) console.warn('Supabase insert warning:', dbError)

    return res.json({
      success: true,
      message: 'Реклама передана на запуск. Кампания появится в Facebook в течение нескольких минут.',
      makeResponse: makeData
    })

  } catch (e) {
    console.error('Launch error:', e)
    res.status(500).json({ error: e.message })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildGeoLocations(geoObj, geoFallback) {
  if (geoObj?.key) {
    if (geoObj.type === 'city')   return { cities:   [{ key: geoObj.key }] }
    if (geoObj.type === 'region') return { regions:  [{ key: geoObj.key }] }
    return { countries: [geoObj.country_code || geoObj.key] }
  }
  const map = {
    'KZ': 'KZ', 'Казахстан': 'KZ', 'Kazakhstan': 'KZ',
    'RU': 'RU', 'Россия': 'RU',    'Russia': 'RU',
    'UZ': 'UZ', 'Узбекистан': 'UZ',
    'US': 'US', 'США': 'US',
  }
  return { countries: [map[geoFallback] || 'KZ'] }
}

function normalizePhone(value) {
  return String(value || '').replace(/[^+\d]/g, '')
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ multiples: false, maxFileSize: 20 * 1024 * 1024 })
    form.parse(req, (err, fields, files) => {
      if (err) reject(err)
      else resolve({ fields, files })
    })
  })
}
