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

    const days = parseInt(req.query.days || '30')
    
    // Метрики согласно ТЗ: Reach, Impressions, CTR, CPC, CPA, Leads, Spend
    const fields = [
      'spend',
      'impressions',
      'reach',
      'inline_link_clicks',
      'ctr',
      'cpc',
      'cpm',
      'cpp',
      'actions',
      'cost_per_action_type',
      'account_currency'
    ].join(',')

    const url = `https://graph.facebook.com/v18.0/${user.fb_ad_account_id}/insights?` + new URLSearchParams({
      fields: fields,
      date_preset: `last_${days}d`,
      access_token: user.fb_access_token
    })

    const dailyUrl = `https://graph.facebook.com/v18.0/${user.fb_ad_account_id}/insights?` + new URLSearchParams({
      fields: 'spend,impressions,reach,inline_link_clicks',
      date_preset: `last_${days}d`,
      time_increment: '1',
      access_token: user.fb_access_token
    })

    const platformUrl = `https://graph.facebook.com/v18.0/${user.fb_ad_account_id}/insights?` + new URLSearchParams({
      fields: 'impressions,reach,spend',
      date_preset: `last_${days}d`,
      breakdowns: 'publisher_platform',
      access_token: user.fb_access_token
    })

    const [summaryRes, dailyRes, platformRes] = await Promise.all([
      fetch(url),
      fetch(dailyUrl),
      fetch(platformUrl)
    ])

    const [summaryData, dailyData, platformData] = await Promise.all([
      summaryRes.json(),
      dailyRes.json(),
      platformRes.json()
    ])

    if (summaryData.error) throw new Error(summaryData.error.message)

    const insight = summaryData.data?.[0] || {}
    
    // Универсальный поиск лидов/конверсий
    const actions = insight.actions || []
    const leads = actions.find(a => a.action_type === 'lead')?.value || 
                  actions.find(a => a.action_type === 'onsite_conversion.messaging_first_reply')?.value || 0

    const spend = parseFloat(insight.spend || 0)
    const currency = insight.account_currency === 'KZT' ? '₸' : '$'
    const cpa = leads > 0 ? (spend / leads).toFixed(2) : '0.00'

    const daily = (dailyData.data || []).map(d => ({
      date: d.date_start,
      impressions: parseInt(d.impressions || 0),
      reach: parseInt(d.reach || 0),
      clicks: parseInt(d.inline_link_clicks || 0),
      spend: parseFloat(d.spend || 0)
    }))

    const platforms = (platformData.data || []).map(d => ({
      platform: d.publisher_platform === 'facebook' ? 'Facebook' : 
                d.publisher_platform === 'instagram' ? 'Instagram' : 
                d.publisher_platform === 'messenger' ? 'Messenger' : d.publisher_platform,
      impressions: parseInt(d.impressions || 0),
      reach: parseInt(d.reach || 0),
      spend: parseFloat(d.spend || 0).toFixed(2)
    }))

    res.json({
      spend: spend.toFixed(2),
      leads: parseInt(leads),
      cpa: cpa, 
      cpl: cpa, 
      impressions: parseInt(insight.impressions || 0).toLocaleString('ru-RU'),
      reach: parseInt(insight.reach || 0).toLocaleString('ru-RU'),
      clicks: parseInt(insight.inline_link_clicks || 0).toLocaleString('ru-RU'),
      ctr: insight.ctr ? (parseFloat(insight.ctr) * 100).toFixed(2) + '%' : '0%',
      cpc: insight.cpc ? parseFloat(insight.cpc).toFixed(2) : '0.00',
      cpm: insight.cpm ? parseFloat(insight.cpm).toFixed(2) : '0.00',
      currency: currency,
      daily,
      platforms
    })

  } catch (e) {
    console.error('Stats error:', e)
    res.status(500).json({ error: 'Server error: ' + e.message })
  }
}