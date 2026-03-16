// api/campaign-detail.js
import { createClient } from '@supabase/supabase-js'
import { getTgUserId, requireSubscription } from './_subscription.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const campaignId = req.query.id
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

    const campaignUrl = `https://graph.facebook.com/v18.0/${campaignId}?` + new URLSearchParams({
      fields: 'id,name,status,objective,created_time,insights{spend,impressions,clicks,ctr,cpc,actions}',
      access_token: token
    })

    const campaignRes = await fetch(campaignUrl)
    const campaignData = await campaignRes.json()
    if (campaignData.error) return res.status(400).json({ error: campaignData.error.message })

    const insight = campaignData.insights?.data?.[0] || {}
    const leads = getActionValue(insight.actions, 'lead')
    const spend = parseFloat(insight.spend || 0)
    const cpl = leads > 0 ? (spend / leads) : 0

    const metrics = {
      spend: `$${spend.toFixed(2)}`,
      leads: parseInt(leads),
      cpl: `$${cpl.toFixed(2)}`,
      impressions: formatNumber(insight.impressions),
      clicks: formatNumber(insight.clicks),
      ctr: insight.ctr ? `${parseFloat(insight.ctr).toFixed(2)}%` : '0%'
    }

    const adsetUrl = `https://graph.facebook.com/v18.0/${campaignId}/adsets?` + new URLSearchParams({
      fields: 'id,name,daily_budget,targeting',
      limit: 1,
      access_token: token
    })
    const adsetRes = await fetch(adsetUrl)
    const adsetData = await adsetRes.json()
    const adset = adsetData.data?.[0]

    const insightsUrl = `https://graph.facebook.com/v18.0/${campaignId}/insights?` + new URLSearchParams({
      fields: 'date_start,spend,actions,impressions,clicks',
      time_increment: 1,
      date_preset: 'last_30d',
      access_token: token
    })
    const insightsRes = await fetch(insightsUrl)
    const insightsData = await insightsRes.json()
    const timeline = (insightsData.data || []).map((row) => {
      const dayLeads = getActionValue(row.actions, 'lead')
      const daySpend = parseFloat(row.spend || 0)
      const dayCpl = dayLeads > 0 ? (daySpend / dayLeads) : 0
      return {
        date: row.date_start,
        spend: `$${daySpend.toFixed(2)}`,
        leads: parseInt(dayLeads),
        cpl: `$${dayCpl.toFixed(2)}`
      }
    })

    res.json({
      campaign: {
        id: campaignData.id,
        name: campaignData.name,
        status: campaignData.status,
        objective: campaignData.objective,
        createdTime: formatDate(campaignData.created_time),
        metrics
      },
      adset: adset ? {
        id: adset.id,
        budget: adset.daily_budget ? (parseInt(adset.daily_budget) / 100).toFixed(2) : '',
        geo: adset.targeting?.geo_locations?.cities?.[0]?.name || adset.targeting?.geo_locations?.countries?.[0] || '',
        ageMin: adset.targeting?.age_min || '18',
        ageMax: adset.targeting?.age_max || '45',
        interests: (adset.targeting?.interests || []).map(i => i.name).join(', ')
      } : null,
      insights: timeline
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
}

function getActionValue(actions, type) {
  if (!Array.isArray(actions)) return 0
  return actions.find(a => a.action_type === type)?.value || 0
}

function formatNumber(value) {
  if (!value) return '0'
  const number = parseInt(value)
  return Number.isNaN(number) ? String(value) : number.toLocaleString('en-US')
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}
