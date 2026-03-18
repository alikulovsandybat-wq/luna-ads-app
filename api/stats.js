// api/stats.js
import { createClient } from '@supabase/supabase-js'
import { getTgUserId, requireSubscription } from './_subscription.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user } = await supabase
      .from('users')
      .select('fb_access_token, fb_ad_account_id, subscription_active, subscription_until')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!requireSubscription(user, res)) return
    if (!user?.fb_access_token) return res.status(401).json({ error: 'No Facebook token' })

    const days = parseInt(req.query.days || '7')
    const since = getDateBefore(days)
    const until = getDateBefore(0)

    // ── Fetch 1: Total summary stats ──
    const summaryUrl = `https://graph.facebook.com/v18.0/${user.fb_ad_account_id}/insights?` + new URLSearchParams({
      fields: 'spend,impressions,reach,clicks,actions',
      time_range: JSON.stringify({ since, until }),
      access_token: user.fb_access_token
    })

    // ── Fetch 2: Daily breakdown for chart ──
    const dailyUrl = `https://graph.facebook.com/v18.0/${user.fb_ad_account_id}/insights?` + new URLSearchParams({
      fields: 'spend,impressions,reach,clicks',
      time_range: JSON.stringify({ since, until }),
      time_increment: '1',
      access_token: user.fb_access_token
    })

    // ── Fetch 3: Platform breakdown (Facebook vs Instagram) ──
    const platformUrl = `https://graph.facebook.com/v18.0/${user.fb_ad_account_id}/insights?` + new URLSearchParams({
      fields: 'impressions,reach,spend',
      time_range: JSON.stringify({ since, until }),
      breakdowns: 'publisher_platform',
      access_token: user.fb_access_token
    })

    const [summaryRes, dailyRes, platformRes] = await Promise.all([
      fetch(summaryUrl),
      fetch(dailyUrl),
      fetch(platformUrl)
    ])

    const [summaryData, dailyData, platformData] = await Promise.all([
      summaryRes.json(),
      dailyRes.json(),
      platformRes.json()
    ])

    // ── Process summary ──
    const insight = summaryData.data?.[0] || {}
    const leads = insight.actions?.find(a => a.action_type === 'lead')?.value || 0
    const spend = parseFloat(insight.spend || 0).toFixed(2)
    const impressions = parseInt(insight.impressions || 0)
    const reach = parseInt(insight.reach || 0)
    const clicks = parseInt(insight.clicks || 0)
    const cpl = leads > 0 ? (parseFloat(spend) / leads).toFixed(2) : '0.00'

    // ── Process daily chart data ──
    const daily = (dailyData.data || []).map(d => ({
      date: d.date_start,
      impressions: parseInt(d.impressions || 0),
      reach: parseInt(d.reach || 0),
      clicks: parseInt(d.clicks || 0),
      spend: parseFloat(d.spend || 0)
    }))

    // ── Process platform breakdown ──
    const platforms = (platformData.data || []).map(d => ({
      platform: formatPlatform(d.publisher_platform),
      impressions: parseInt(d.impressions || 0),
      reach: parseInt(d.reach || 0),
      spend: parseFloat(d.spend || 0).toFixed(2)
    }))

    res.json({
      spend,
      leads: parseInt(leads),
      cpl,
      impressions: impressions.toLocaleString('ru-RU'),
      reach: reach.toLocaleString('ru-RU'),
      clicks: clicks.toLocaleString('ru-RU'),
      currency: '$',
      daily,
      platforms
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
}

function formatPlatform(key) {
  const map = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    audience_network: 'Audience Network',
    messenger: 'Messenger'
  }
  return map[key] || key || 'Unknown'
}

function getDateBefore(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}
