// api/auth/facebook/callback.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  const { code, state: tgUserId } = req.query

  if (!code) return res.status(400).send('No code')

  try {
    // 1. Меняем code на токен
    const tokenRes = await fetch('https://graph.facebook.com/v18.0/oauth/access_token?' + new URLSearchParams({
      client_id: process.env.FB_APP_ID,
      client_secret: process.env.FB_APP_SECRET,
      redirect_uri: `${process.env.APP_URL}/api/auth/facebook/callback`,
      code
    }))
    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('No access token:', tokenData)
      return res.status(400).send('Facebook auth failed')
    }

    // 2. Получаем данные пользователя FB
    const meRes = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${accessToken}`
    )
    const meData = await meRes.json()

    // 3. Получаем ВСЕ рекламные аккаунты
    const accountsRes = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
    )
    const accountsData = await accountsRes.json()
    const adAccounts = accountsData.data || []
    const primaryAdAccountId = adAccounts[0]?.id || null

    // 4. Сохраняем в Supabase — токен + все аккаунты
    await supabase.from('users').upsert({
      tg_user_id: String(tgUserId),
      fb_access_token: accessToken,
      fb_ad_account_id: primaryAdAccountId,
      fb_user_id: meData.id,
      fb_name: meData.name,
      fb_email: meData.email || null,
      fb_ad_accounts: JSON.stringify(adAccounts), // все аккаунты для выбора
      subscription_active: true, // даём trial при первом входе
      updated_at: new Date().toISOString()
    }, { onConflict: 'tg_user_id' })

    // 5. Редиректим обратно во фронт — передаём fb_token=ok И tgUserId
    // Фронт сохранит оба в localStorage
    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL
    res.redirect(`${frontendUrl}/?fb_token=ok&tg_user_id=${encodeURIComponent(tgUserId)}`)

  } catch (e) {
    console.error('Callback error:', e)
    res.status(500).send('Auth error')
  }
}
