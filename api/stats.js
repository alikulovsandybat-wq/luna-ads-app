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

    const days = req.query.days || '7'
    const since = getDateBefore(parseInt(days))
    const until = getDateBefore(0)

    const url = `https://graph.facebook.com/v18.0/${user.fb_ad_account_id}/insights?` + new URLSearchParams({
      fields: 'spend,impressions,actions',
      time_range: JSON.stringify({ since, until }),
      access_token: user.fb_access_token
    })

    const fbRes = await fetch(url)
    const fbData = await fbRes.json()

    const insight = fbData.data?.[0] || {}
    const leads = insight.actions?.find(a => a.action_type === 'lead')?.value || 0
    const spend = parseFloat(insight.spend || 0).toFixed(2)
    const impressions = parseInt(insight.impressions || 0).toLocaleString('ru-RU')
    const cpl = leads > 0 ? (parseFloat(spend) / leads).toFixed(2) : '0.00'

    res.json({ spend, leads: parseInt(leads), cpl, impressions, currency: '$' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
}

function getDateBefore(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}
