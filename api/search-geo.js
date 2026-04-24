import { getTgUserId } from './_subscription.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const { q } = req.query
  if (!q || q.length < 2) return res.json([])

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user } = await supabase
      .from('users')
      .select('fb_access_token')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!user?.fb_access_token) return res.status(401).json({ error: 'No FB token' })

    const url = `https://graph.facebook.com/v18.0/search?` + new URLSearchParams({
      type: 'adgeolocation',
      q: q,
      location_types: '["city"]',
      access_token: user.fb_access_token
    })

    const fbRes = await fetch(url)
    const data = await fbRes.json()

    if (data.error) throw new Error(data.error.message)

    res.json(data.data || [])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}