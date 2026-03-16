// api/campaign-update.js
import { createClient } from '@supabase/supabase-js'
import { getTgUserId, requireSubscription } from './_subscription.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { campaignId, status, budget, geo, ageMin, ageMax, interests } = req.body || {}

    if (!campaignId) return res.status(400).json({ error: 'Missing campaign id' })

    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })
    const { data: user } = await supabase
      .from('users')
      .select('fb_access_token, fb_ad_account_id, subscription_active, subscription_until')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!requireSubscription(user, res)) return

    if (!user?.fb_access_token) return res.status(401).json({ error: 'No token' })

    const token = user.fb_access_token

    if (status) {
      await fbPost(`/${campaignId}`, token, { status })
    }

    const adsetId = await getAdsetId(campaignId, token)
    if (!adsetId) return res.status(400).json({ error: 'Ad set not found' })

    const updates = {}
    const targeting = {}

    if (budget) {
      const amount = parseFloat(budget)
      if (!Number.isNaN(amount)) updates.daily_budget = Math.round(amount * 100)
    }

    if (geo || ageMin || ageMax || interests) {
      targeting.geo_locations = { countries: [geoToCountry(geo || 'Казахстан')], cities: geo ? [{ key: geo }] : [] }
      targeting.age_min = parseInt(ageMin || '18')
      targeting.age_max = parseInt(ageMax || '45')

      const interestObjects = await resolveInterests(interests, token)
      if (interestObjects.length) targeting.interests = interestObjects

      updates.targeting = targeting
    }

    if (status) {
      await fbPost(`/${adsetId}`, token, { status })
    }

    if (Object.keys(updates).length) {
      await fbPost(`/${adsetId}`, token, updates)
    }

    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
}

async function getAdsetId(campaignId, token) {
  const url = `https://graph.facebook.com/v18.0/${campaignId}/adsets?` + new URLSearchParams({
    fields: 'id',
    limit: 1,
    access_token: token
  })
  const res = await fetch(url)
  const data = await res.json()
  return data.data?.[0]?.id
}

async function resolveInterests(raw, token) {
  if (!raw) return []
  const list = raw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5)
  if (!list.length) return []

  const results = []
  for (const name of list) {
    const url = `https://graph.facebook.com/v18.0/search?` + new URLSearchParams({
      type: 'adinterest',
      q: name,
      limit: 1,
      access_token: token
    })
    const res = await fetch(url)
    const data = await res.json()
    const interest = data.data?.[0]
    if (interest?.id) results.push({ id: interest.id })
  }

  return results
}

async function fbPost(path, token, body) {
  const res = await fetch(`https://graph.facebook.com/v18.0${path}?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

function geoToCountry(geo) {
  const map = { 'Алматы': 'KZ', 'Астана': 'KZ', 'Казахстан': 'KZ', 'Россия': 'RU', 'Москва': 'RU' }
  return map[geo] || 'KZ'
}
