// api/launch.js
import { createClient } from '@supabase/supabase-js'
import { getTgUserId, requireSubscription } from './_subscription.js'
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

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })
    const { data: user } = await supabase
      .from('users')
      .select('fb_access_token, fb_ad_account_id, subscription_active, subscription_until')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!requireSubscription(user, res)) return

    if (!user?.fb_access_token) return res.status(401).json({ error: 'No token' })

    // Parse form data
    const { fields, files } = await parseForm(req)
    const budget = fields.budget?.[0] || '10'
    const geo = fields.geo?.[0] || 'Kazakhstan'
    const ageMin = fields.ageMin?.[0] || '18'
    const ageMax = fields.ageMax?.[0] || '65'
    const headline = fields.headline?.[0] || ''
    const text = fields.text?.[0] || ''
    const ctaType = fields.ctaType?.[0] || 'MESSAGE_PAGE'
    const whatsappNumber = fields.whatsappNumber?.[0] || ''
    const token = user.fb_access_token
    const adAccountId = user.fb_ad_account_id

    if (ctaType === 'WHATSAPP_MESSAGE' && !normalizePhone(whatsappNumber)) {
      return res.status(400).json({ error: 'WhatsApp number required' })
    }

    // ── Step 1: Create Campaign ──
    const campaignRes = await fbPost(`/${adAccountId}/campaigns`, token, {
      name: `Luna Ads — ${headline.slice(0, 30)} — ${new Date().toLocaleDateString('ru')}`,
      objective: 'OUTCOME_LEADS',
      status: 'ACTIVE',
      special_ad_categories: []
    })
    const campaignId = campaignRes.id
    if (!campaignId) throw new Error(`Campaign error: ${JSON.stringify(campaignRes)}`)

    // ── Step 2: Create Ad Set ──
    const targeting = {
      geo_locations: { countries: [geoToCountry(geo)], cities: [{ key: geo }] },
      age_min: parseInt(ageMin),
      age_max: parseInt(ageMax),
    }

    const adSetRes = await fbPost(`/${adAccountId}/adsets`, token, {
      name: `Группа — ${geo} ${ageMin}-${ageMax}`,
      campaign_id: campaignId,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LEAD_GENERATION',
      daily_budget: Math.round(parseFloat(budget) * 100), // cents
      targeting,
      status: 'ACTIVE'
    })
    const adSetId = adSetRes.id
    if (!adSetId) throw new Error(`AdSet error: ${JSON.stringify(adSetRes)}`)

    // ── Step 3: Upload image (if provided) ──
    let imageHash = null
    const imageFile = files.image?.[0]
    if (imageFile) {
      const imageData = fs.readFileSync(imageFile.filepath)
      const base64 = imageData.toString('base64')
      const imgRes = await fbPost(`/${adAccountId}/adimages`, token, {
        bytes: base64
      })
      imageHash = Object.values(imgRes.images || {})[0]?.hash
    }

    // ── Step 4: Create Ad Creative ──
    const creativeBody = {
      name: `Креатив — ${headline.slice(0, 20)}`,
      object_story_spec: {
        page_id: process.env.FB_PAGE_ID || await getPageId(token),
        link_data: {
          message: text,
          name: headline,
          link: process.env.APP_URL || 'https://t.me/marketologluna_bot',
          call_to_action: buildCallToAction(ctaType, whatsappNumber),
          ...(imageHash ? { image_hash: imageHash } : {})
        }
      }
    }

    const creativeRes = await fbPost(`/${adAccountId}/adcreatives`, token, creativeBody)
    const creativeId = creativeRes.id
    if (!creativeId) throw new Error(`Creative error: ${JSON.stringify(creativeRes)}`)

    // ── Step 5: Create Ad ──
    const adRes = await fbPost(`/${adAccountId}/ads`, token, {
      name: headline,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'ACTIVE'
    })

    if (!adRes.id) throw new Error(`Ad error: ${JSON.stringify(adRes)}`)

    // Save to Supabase for history
    await supabase.from('campaigns').insert({
      tg_user_id: tgUserId,
      fb_campaign_id: campaignId,
      fb_adset_id: adSetId,
      fb_ad_id: adRes.id,
      name: headline,
      budget: parseFloat(budget),
      geo,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    })

    res.json({ success: true, campaignId, adId: adRes.id })
  } catch (e) {
    console.error('Launch error:', e)
    res.status(500).json({ error: e.message })
  }
}

// ── Helpers ──

async function fbPost(path, token, body) {
  const res = await fetch(`https://graph.facebook.com/v18.0${path}?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

async function getPageId(token) {
  const res = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${token}`)
  const data = await res.json()
  return data.data?.[0]?.id
}

function buildCallToAction(ctaType, whatsappNumber) {
  if (ctaType === 'WHATSAPP_MESSAGE') {
    return { type: 'WHATSAPP_MESSAGE', value: { phone_number: normalizePhone(whatsappNumber) } }
  }

  return { type: 'MESSAGE_PAGE' }
}

function normalizePhone(value) {
  return String(value || '').replace(/[^+\d]/g, '')
}

function geoToCountry(geo) {
  const map = { 'Алматы': 'KZ', 'Астана': 'KZ', 'Казахстан': 'KZ', 'Россия': 'RU', 'Москва': 'RU' }
  return map[geo] || 'KZ'
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
