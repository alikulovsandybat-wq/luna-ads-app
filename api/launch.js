import { createClient } from '@supabase/supabase-js'
import { getTgUserId, requireSubscription, checkUsageLimits } from './_subscription.js'
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
      .select('*')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!requireSubscription(user, res)) return
    
    try {
      await checkUsageLimits(user, 'campaign', supabase)
    } catch (limitError) {
      return res.status(403).json({ error: limitError.message })
    }

    if (!user?.fb_access_token) return res.status(401).json({ error: 'No token' })

    const { fields, files } = await parseForm(req)
    
    const budget = fields.budget?.[0] || '10'
    const geo = fields.geo?.[0] || 'KZ'
    const ageMin = fields.ageMin?.[0] || '18'
    const ageMax = fields.ageMax?.[0] || '65'
    const headline = fields.headline?.[0] || ''
    const text = fields.text?.[0] || ''
    const ctaType = fields.ctaType?.[0] || 'MESSAGE_PAGE'
    const whatsappNumber = fields.whatsappNumber?.[0] || ''
    const ctaUrl = fields.ctaUrl?.[0] || ''
    
    const geoData = JSON.parse(fields.geoData?.[0] || '{}')

    let interests = []
    const interestsRaw = fields.interests?.[0] || ''
    if (interestsRaw) {
      try {
        interests = JSON.parse(interestsRaw)
      } catch {
        interests = interestsRaw.split(',').map(s => s.trim()).filter(Boolean)
      }
    }

    const token = user.fb_access_token
    const adAccountId = user.fb_ad_account_id

    if (!adAccountId) {
      return res.status(400).json({ error: 'No ad account ID. Please reconnect Facebook.' })
    }

    if (ctaType === 'WHATSAPP_MESSAGE' && !normalizePhone(whatsappNumber)) {
      return res.status(400).json({ error: 'WhatsApp number required' })
    }

    const campaignRes = await fbPost(`/${adAccountId}/campaigns`, token, {
      name: `Luna Ads — ${headline.slice(0, 30)} — ${new Date().toLocaleDateString('ru')}`,
      objective: 'OUTCOME_TRAFFIC',
      status: 'ACTIVE',
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false
    })

    if (!campaignRes.id) {
      return res.status(400).json({ error: `FB Campaign Error: ${campaignRes.error?.message || 'Unknown error'}` })
    }
    const campaignId = campaignRes.id

    let interestTargeting = []
    if (interests.length > 0) {
      interestTargeting = await resolveInterests(interests, token)
    }

    const targeting = {
      age_min: parseInt(ageMin),
      age_max: parseInt(ageMax),
      targeting_automation: { advantage_audience: 0 }
    }

    if (geoData.key) {
      targeting.geo_locations = {
        cities: [{ key: geoData.key, radius: 20, distance_unit: 'kilometer' }]
      }
    } else {
      targeting.geo_locations = { countries: [geoToCountry(geo)] }
    }

    if (interestTargeting.length > 0) {
      targeting.interests = interestTargeting.map(i => ({ id: i.id, name: i.name }))
    }

    const adSetRes = await fbPost(`/${adAccountId}/adsets`, token, {
      name: `Группа — ${geoData.name || geo} ${ageMin}-${ageMax}`,
      campaign_id: campaignId,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      daily_budget: Math.round(parseFloat(budget) * 100),
      targeting,
      status: 'ACTIVE'
    })

    if (!adSetRes.id) {
      return res.status(400).json({ error: `FB AdSet Error: ${adSetRes.error?.message || 'Unknown error'}` })
    }
    const adSetId = adSetRes.id

    let imageHash = null
    const imageFile = files.image?.[0]
    if (imageFile) {
      const imageData = fs.readFileSync(imageFile.filepath)
      const base64 = imageData.toString('base64')
      const imgRes = await fbPost(`/${adAccountId}/adimages`, token, { bytes: base64 })
      imageHash = Object.values(imgRes.images || {})[0]?.hash
    }

    const pageId = process.env.FB_PAGE_ID || await getPageId(token)
    if (!pageId) return res.status(400).json({ error: 'Could not find Facebook Page.' })

    const creativeRes = await fbPost(`/${adAccountId}/adcreatives`, token, {
      name: `Креатив — ${headline.slice(0, 20)}`,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          message: text,
          name: headline,
          link: process.env.APP_URL || 'https://t.me/marketologluna_bot',
          call_to_action: buildCallToAction(ctaType, whatsappNumber, ctaUrl),
          ...(imageHash ? { image_hash: imageHash } : {})
        }
      }
    })

    if (!creativeRes.id) {
      return res.status(400).json({ error: `FB Creative Error: ${creativeRes.error?.message}` })
    }

    const adRes = await fbPost(`/${adAccountId}/ads`, token, {
      name: headline,
      adset_id: adSetId,
      creative: { creative_id: creativeRes.id },
      status: 'ACTIVE'
    })

    if (!adRes.id) {
      return res.status(400).json({ error: `FB Ad Error: ${adRes.error?.message}` })
    }

    await supabase.from('campaigns').insert({
      tg_user_id: tgUserId,
      fb_campaign_id: campaignId,
      fb_adset_id: adSetId,
      fb_ad_id: adRes.id,
      name: headline,
      budget: parseFloat(budget),
      geo: geoData.name || geo,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    })

    res.json({ success: true, campaignId, adId: adRes.id })
  } catch (e) {
    console.error('Launch error:', e)
    res.status(500).json({ error: e.message })
  }
}

async function fbPost(path, token, body) {
  const res = await fetch(`https://graph.facebook.com/v18.0${path}?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

async function resolveInterests(interests, token) {
  const resolved = []
  for (const interest of interests) {
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/search?type=adinterest&q=${encodeURIComponent(interest)}&access_token=${token}`)
      const data = await res.json()
      const match = data.data?.[0]
      if (match?.id) resolved.push({ id: match.id, name: match.name })
    } catch (e) {}
  }
  return resolved
}

async function getPageId(token) {
  const res = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${token}`)
  const data = await res.json()
  return data.data?.[0]?.id || null
}

function buildCallToAction(ctaType, whatsappNumber, ctaUrl) {
  if (ctaType === 'WHATSAPP_MESSAGE') {
    return { type: 'WHATSAPP_MESSAGE', value: { phone_number: normalizePhone(whatsappNumber) } }
  }
  if (ctaType === 'TELEGRAM' || ctaType === 'LEARN_MORE') {
    return { type: 'LEARN_MORE', value: { link: ctaUrl } }
  }
  return { type: 'MESSAGE_PAGE' }
}

function normalizePhone(value) {
  return String(value || '').replace(/[^+\d]/g, '')
}

function geoToCountry(geo) {
  const map = { 'Алматы': 'KZ', 'Астана': 'KZ', 'Казахстан': 'KZ', 'KZ': 'KZ', 'Russia': 'RU', 'RU': 'RU' }
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