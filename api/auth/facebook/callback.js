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
    // Exchange code for token
    const tokenRes = await fetch('https://graph.facebook.com/v18.0/oauth/access_token?' + new URLSearchParams({
      client_id: process.env.FB_APP_ID,
      client_secret: process.env.FB_APP_SECRET,
      redirect_uri: `${process.env.APP_URL}/api/auth/facebook/callback`,
      code
    }))
    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // Get ad account
    const accountsRes = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name&access_token=${accessToken}`
    )
    const accountsData = await accountsRes.json()
    const adAccountId = accountsData.data?.[0]?.id

    // Save to Supabase
    await supabase.from('users').upsert({
      tg_user_id: tgUserId,
      fb_access_token: accessToken,
      fb_ad_account_id: adAccountId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tg_user_id' })

    // Redirect back to the mini app. The frontend handles fb_token on any route.
    res.redirect(`${process.env.FRONTEND_URL}/?fb_token=ok`)
  } catch (e) {
    console.error(e)
    res.status(500).send('Auth error')
  }
}
