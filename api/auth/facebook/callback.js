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
      return res.status(400).send('Facebook auth failed: ' + (tokenData.error?.message || 'No access token'))
    }

    // 2. Получаем данные пользователя FB
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,email&access_token=${accessToken}`
    )
    const meData = await meRes.json()

    // 3. Получаем рекламные аккаунты
    const accountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`
    )
    const accountsData = await accountsRes.json()
    const adAccounts = accountsData.data || []
    
    // Выбираем первый АКТИВНЫЙ аккаунт (status 1 = ACTIVE)
    const activeAccount = adAccounts.find(acc => acc.account_status === 1) || adAccounts[0]
    const primaryAdAccountId = activeAccount?.id || null

    // 4. Сохраняем в Supabase
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

    // 5. Показываем страницу-мост
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'tvoymarketolog_bot'
    const appUrl = `https://t.me/${botUsername}/app?startapp=fb_token_ok`
    
    res.setHeader('Content-Type', 'text/html')
    
    // Если аккаунтов нет вообще, предупреждаем пользователя
    const statusEmoji = primaryAdAccountId ? '✅' : '⚠️'
    const statusTitle = primaryAdAccountId ? 'Почти готово!' : 'Аккаунты не найдены'
    const statusText = primaryAdAccountId 
      ? 'Facebook успешно подключен. Теперь вернитесь в Telegram, чтобы продолжить работу.'
      : 'Facebook подключен, но мы не нашли активных рекламных аккаунтов. Убедитесь, что у вас создан рекламный кабинет в Meta.'

    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Luna Ads — авторизация</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F9FAFB; }
    .box { text-align: center; padding: 32px; background: white; border-radius: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.05); max-width: 320px; width: 90%; }
    .emoji { font-size: 64px; margin-bottom: 16px; }
    h2 { color: #111; margin: 0 0 8px; font-size: 22px; }
    p { color: #666; margin: 0 0 24px; line-height: 1.4; }
    .btn { display: inline-block; background: #007AFF; color: white; padding: 14px 28px; border-radius: 14px; text-decoration: none; font-weight: 600; transition: background 0.2s; }
    .btn:active { background: #0056B3; }
  </style>
</head>
<body>
  <div class="box">
    <div class="emoji">${statusEmoji}</div>
    <h2>${statusTitle}</h2>
    <p>${statusText}</p>
    <a href="${appUrl}" class="btn">Вернуться в Luna Ads</a>
  </div>
  <script>
    ${primaryAdAccountId ? `
    setTimeout(() => {
      window.location.href = "${appUrl}";
    }, 2000);
    ` : ''}
  </script>
</body>
</html>`)

  } catch (e) {
    console.error('Callback error:', e)
    res.status(500).send('Auth error: ' + e.message)
  }
}
