// api/_subscription.js

/**
 * Вспомогательная функция для парсинга initData от Telegram
 */
function parseInitData(initData) {
  if (!initData) return {};
  const params = new URLSearchParams(initData);
  const user = params.get('user');
  try {
    return {
      user: user ? JSON.parse(user) : null,
      auth_date: params.get('auth_date'),
      hash: params.get('hash')
    };
  } catch (e) {
    return {};
  }
}

export function getTgUserId(req) {
  // 1. Пытаемся взять стандартные TG-данные (работает внутри TG WebApp)
  const tgData = req.headers['x-tg-data'];
  if (tgData) {
    const parsed = parseInitData(tgData);
    if (parsed.user?.id) {
      return String(parsed.user.id);
    }
  }

  // 2. ФОЛЛБЕК ДЛЯ БРАУЗЕРА (Safari/Chrome)
  // Берем ID, который мы сохранили в LocalStorage при логине
  const simpleTgUserId = req.headers['x-tg-userid'];
  if (simpleTgUserId) {
    return String(simpleTgUserId); 
  }

  return null;
}

export function isSubscriptionActive(user) {
  // Если подписки нет вообще
  if (!user?.subscription_active) return false;
  
  // Если дата окончания не указана, считаем активной (бессрочно)
  if (!user.subscription_until) return true;
  
  const until = new Date(user.subscription_until);
  if (Number.isNaN(until.getTime())) return false;
  
  // Проверяем, не истекло ли время
  return until.getTime() > Date.now();
}

export function requireSubscription(user, res) {
  if (isSubscriptionActive(user)) return true;
  
  // Если подписка неактивна, возвращаем ошибку 402 (Payment Required)
  res.status(402).json({ 
    error: 'Subscription required',
    message: 'Пожалуйста, обновите подписку для использования этой функции'
  });
  return false;
}
