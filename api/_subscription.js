import crypto from 'crypto'

// ── Rate Limiting (in-memory, сбрасывается при рестарте serverless) ───────────
const rateLimitMap = new Map()

function checkRateLimit(key, maxRequests = 10, windowMs = 60_000) {
  const now = Date.now()
  const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs }

  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + windowMs
  }

  entry.count++
  rateLimitMap.set(key, entry)

  return entry.count <= maxRequests
}

// Чистим старые записи каждые 5 минут чтобы не копить память
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(key)
  }
}, 300_000)

// ── Верификация Telegram initData через HMAC ──────────────────────────────────
function verifyTelegramInitData(initData) {
  if (!initData) return null

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    // В dev режиме без токена — разрешаем но логируем
    console.warn('TELEGRAM_BOT_TOKEN not set, skipping initData verification')
    return parseInitDataUnsafe(initData)
  }

  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null

    // Строим data-check-string: все поля кроме hash, отсортированные по ключу
    params.delete('hash')
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    // HMAC-SHA256: ключ = HMAC-SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest()

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    if (expectedHash !== hash) {
      console.warn('Telegram initData verification failed: hash mismatch')
      return null
    }

    // Проверяем свежесть данных — не старше 1 часа
    const authDate = parseInt(params.get('auth_date') || '0', 10)
    const age = Math.floor(Date.now() / 1000) - authDate
    if (age > 3600) {
      console.warn('Telegram initData expired:', age, 'seconds old')
      return null
    }

    return parseInitDataUnsafe(initData)
  } catch (e) {
    console.error('verifyTelegramInitData error:', e)
    return null
  }
}

function parseInitDataUnsafe(initData) {
  if (!initData) return {}
  const params = new URLSearchParams(initData)
  const user = params.get('user')
  try {
    return {
      user: user ? JSON.parse(user) : null,
      auth_date: params.get('auth_date'),
      hash: params.get('hash')
    }
  } catch {
    return {}
  }
}

// ── Основная функция получения userId ────────────────────────────────────────
export function getTgUserId(req) {
  // 1. Vercel иногда передаёт заголовки в lowercase
  const tgData = req.headers['x-tg-data']

  if (tgData && tgData.length > 10) {
    const parsed = verifyTelegramInitData(tgData)
    if (parsed?.user?.id) {
      return String(parsed.user.id)
    }
  }

  // 2. Фоллбек для браузера — x-tg-userid (сохраняется при OAuth редиректе)
  // Менее безопасно, но нужно для Safari/Chrome вне TG
  const simpleTgUserId = req.headers['x-tg-userid']
  if (simpleTgUserId && /^\d+$/.test(simpleTgUserId)) {
    return String(simpleTgUserId)
  }

  return null
}

// ── Rate limit проверка для конкретного эндпоинта ────────────────────────────
export function checkEndpointRateLimit(req, res, endpoint) {
  const userId = getTgUserId(req) || req.headers['x-forwarded-for'] || 'anon'
  const key = `${endpoint}:${userId}`

  // Лимиты по эндпоинтам
  const limits = {
    'generate':       { max: 20, windowMs: 60_000 },
    'generate-image': { max: 5,  windowMs: 60_000 },
    'launch':         { max: 10, windowMs: 300_000 },
    'photoroom':      { max: 10, windowMs: 60_000 },
    'default':        { max: 30, windowMs: 60_000 }
  }

  const limit = limits[endpoint] || limits['default']
  const allowed = checkRateLimit(key, limit.max, limit.windowMs)

  if (!allowed) {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Слишком много запросов. Подождите немного и попробуйте снова.'
    })
    return false
  }

  return true
}

// ── Проверка подписки ─────────────────────────────────────────────────────────
export function isSubscriptionActive(user) {
  if (!user?.subscription_active) return false
  if (!user.subscription_until) return true

  const until = new Date(user.subscription_until)
  if (Number.isNaN(until.getTime())) return false

  return until.getTime() > Date.now()
}

export function requireSubscription(user, res) {
  if (isSubscriptionActive(user)) return true

  res.status(402).json({
    error: 'Subscription required',
    message: 'Пожалуйста, обновите подписку для использования этой функции'
  })
  return false
}
