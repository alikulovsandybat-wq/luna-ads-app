// api/_subscription.js
export function getTgUserId(req) {
  // 1. Пытаемся взять стандартные TG-данные (работает внутри TG WebApp)
  const tgData = req.headers['x-tg-data'];
  if (tgData) {
    // Твоя текущая логика парсинга tgData (initData)
    // ...
    // Например, const parsed = parseInitData(tgData); return parsed.user?.id;
  }

  // 2. ФОЛЛБЕК ДЛЯ БРАУЗЕРА: Берем tgUserId из простого заголовка
  // Мы будем отправлять lunda_tg_userid, который запомнили в LocalStorage
  const simpleTgUserId = req.headers['x-tg-userid'];
  if (simpleTgUserId) {
    // ОЧЕНЬ ВАЖНО: Мы должны доверять этому ID только если у нас
    // есть в базе Supabase fb_token для этого tgUserId.
    return simpleTgUserId; 
  }

  return null;
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
