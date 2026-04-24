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

    // Расширенные поля Insights API согласно ТЗ
    const fields = 'id,name,status,objective,created_time,insights{spend,impressions,reach,inline_link_clicks,ctr,cpc,actions}'
    const campaignUrl = `https://graph.facebook.com/v18.0/${campaignId}?fields=${fields}&access_token=${token}`

    const campaignRes = await fetch(campaignUrl)
    const campaignData = await campaignRes.json()
    if (campaignData.error) return res.status(400).json({ error: campaignData.error.message })

    const insight = campaignData.insights?.data?.[0] || {}
    
    // Извлекаем лиды (универсальный поиск)
    const leads = insight.actions?.find(a => a.action_type === 'lead')?.value || 
                  insight.actions?.find(a => a.action_type === 'onsite_conversion.messaging_first_reply')?.value || 0
    
    const spend = parseFloat(insight.spend || 0)
    const cpa = leads > 0 ? (spend / leads).toFixed(2) : '0.00'

    const metrics = {
      spend: `$${spend.toFixed(2)}`,
      leads: parseInt(leads),
      cpa: `$${cpa}`,
      impressions: parseInt(insight.impressions || 0).toLocaleString('ru-RU'),
      reach: parseInt(insight.reach || 0).toLocaleString('ru-RU'),
      clicks: parseInt(insight.inline_link_clicks || 0).toLocaleString('ru-RU'),
      ctr: insight.ctr ? (parseFloat(insight.ctr) * 100).toFixed(2) + '%' : '0%',
      cpc: insight.cpc ? `$${parseFloat(insight.cpc).toFixed(2)}` : '$0.00'
    }

    const adsetUrl = `https://graph.facebook.com/v18.0/${campaignId}/adsets?fields=id,name,daily_budget,targeting&limit=1&access_token=${token}`
    const adsetRes = await fetch(adsetUrl)
    const adsetData = await adsetRes.json()
    const adset = adsetData.data?.[0]

    const insightsUrl = `https://graph.facebook.com/v18.0/${campaignId}/insights?fields=date_start,spend,actions,impressions,inline_link_clicks&time_increment=1&date_preset=last_30d&access_token=${token}`
    const insightsRes = await fetch(insightsUrl)
    const insightsData = await insightsRes.json()
    
    const timeline = (insightsData.data || []).map((row) => {
      const dayLeads = row.actions?.find(a => a.action_type === 'lead')?.value || 
                       row.actions?.find(a => a.action_type === 'onsite_conversion.messaging_first_reply')?.value || 0
      const daySpend = parseFloat(row.spend || 0)
      return {
        date: row.date_start,
        spend: `$${daySpend.toFixed(2)}`,
        leads: parseInt(dayLeads),
        cpl: dayLeads > 0 ? `$${(daySpend / dayLeads).toFixed(2)}` : '—'
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

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}