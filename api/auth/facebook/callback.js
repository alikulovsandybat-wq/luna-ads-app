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
    const tokenRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token?' + new URLSearchParams({
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
      `https://graph.facebook.com/v21.0/me?fields=id,name,email&access_token=${accessToken}`
    )
    const meData = await meRes.json()

    // 3. Получаем ВСЕ рекламные аккаунты
    const accountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
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
      fb_ad_accounts: JSON.stringify(adAccounts),
      subscription_active: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tg_user_id' })

    // 5. Показываем страницу-мост которая сама закрывается и открывает Telegram
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'tvoymarketolog_bot'
    res.setHeader('Content-Type', 'text/html')
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Luna Ads — авторизация</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F9FAFB; }
    .box { text-align: center; padding: 32px; }
    .emoji { font-size: 48px; }
    h2 { color: #111; margin: 16px 0 8px; }
    p { color: #666; margin: 0 0 24px; }
    a { display: inline-block; background: #007AFF; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="box">
    <div class="emoji">✅</div>
    <h2>Facebook подключён!</h2>
    <p>Возвращаемся в Luna Ads...</p>
    <a href="https://t.me/${botUsername}/app">Открыть Luna Ads</a>
  </div>
  <script>
    // Пробуем автоматически вернуть в Telegram
    setTimeout(() => {
      window.location.href = 'https://t.me/${botUsername}/app';
    }, 1500);
  </script>
</body>
</html>`)

  } catch (e) {
    console.error('Callback error:', e)
    res.status(500).send('Auth error')
  }
}
