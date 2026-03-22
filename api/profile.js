// api/profile.js
import { createClient } from '@supabase/supabase-js'
import { getTgUserId } from './_subscription.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user, error } = await supabase
      .from('users')
      .select('tg_user_id, fb_name, fb_email, fb_ad_account_id, fb_ad_accounts, subscription_active, subscription_until, plan')
      .eq('tg_user_id', tgUserId)
      .single()

    if (error || !user) return res.status(404).json({ error: 'User not found' })

    // Парсим список аккаунтов если он строка
    let adAccounts = []
    try {
      adAccounts = typeof user.fb_ad_accounts === 'string'
        ? JSON.parse(user.fb_ad_accounts)
        : (user.fb_ad_accounts || [])
    } catch {}

    res.json({
      name: user.fb_name || 'Пользователь',
      email: user.fb_email || null,
      tg_user_id: user.tg_user_id,
      ad_account_id: user.fb_ad_account_id,
      ad_accounts: adAccounts,
      plan: user.plan || 'autopilot',
      subscription_active: user.subscription_active,
      plan_expires: user.subscription_until || null,
    })

  } catch (e) {
    console.error('Profile error:', e)
    res.status(500).json({ error: 'Server error' })
  }
}
