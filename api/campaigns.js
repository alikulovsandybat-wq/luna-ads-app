// api/campaigns.js
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

    if (!user?.fb_access_token) return res.status(401).json({ error: 'No token' })

    // Get campaigns with insights
    const url = `https://graph.facebook.com/v18.0/${user.fb_ad_account_id}/campaigns?` + new URLSearchParams({
      fields: 'id,name,status,created_time,daily_budget,insights{spend,actions,impressions}',
      limit: 20,
      access_token: user.fb_access_token
    })

    const fbRes = await fetch(url)
    const fbData = await fbRes.json()

    if (fbData.error) return res.status(400).json({ error: fbData.error.message })

    const campaigns = (fbData.data || []).map(c => {
      const insight = c.insights?.data?.[0] || {}
      const leads = insight.actions?.find(a => a.action_type === 'lead')?.value || 0
      const spend = parseFloat(insight.spend || 0).toFixed(2)
      const cpl = leads > 0 ? (parseFloat(spend) / leads).toFixed(2) : '0.00'
      const budget = c.daily_budget ? (parseInt(c.daily_budget) / 100).toFixed(1) : '0.0'

      // Format date dd/mm/yyyy
      const date = new Date(c.created_time)
      const formatted = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`

      return {
        id: c.id,
        name: c.name,
        active: c.status === 'ACTIVE',
        date: formatted,
        spend: `$${spend}`,
        leads: parseInt(leads),
        cpl: `$${cpl}`,
        budget: `$${budget}`
      }
    })

    res.json({ campaigns })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
}
