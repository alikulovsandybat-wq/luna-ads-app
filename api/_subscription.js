export function getTgUserId(req) {
  try {
    const tgData = req.headers['x-tg-data']
    if (!tgData) return process.env.NODE_ENV === 'production' ? null : 'dev'
    const params = new URLSearchParams(tgData)
    const user = JSON.parse(params.get('user') || '{}')
    return String(user.id || '')
  } catch {
    return process.env.NODE_ENV === 'production' ? null : 'dev'
  }
}

export function isSubscriptionActive(user) {
  if (!user?.subscription_active) return false
  if (!user.subscription_until) return true
  const until = new Date(user.subscription_until)
  if (Number.isNaN(until.getTime())) return false
  return until.getTime() > Date.now()
}

export function requireSubscription(user, res) {
  if (isSubscriptionActive(user)) return true
  res.status(402).json({ error: 'Subscription required' })
  return false
}
