// api/_subscription.js
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
  const tgData = req.headers['x-tg-data'];
  if (tgData) {
    const parsed = parseInitData(tgData);
    if (parsed.user?.id) return String(parsed.user.id);
  }
  const simpleTgUserId = req.headers['x-tg-userid'];
  if (simpleTgUserId) return String(simpleTgUserId); 
  return null;
}

export function isSubscriptionActive(user) {
  if (!user?.subscription_active) return false;
  if (!user.subscription_until) return true;
  const until = new Date(user.subscription_until);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() > Date.now();
}

export async function checkUsageLimits(user, type, supabase) {
  const plan = (user.plan || 'standard').toLowerCase();
  
  // Лимиты из ТЗ
  const limits = {
    standard: { creatives: 30, campaigns: 30 },
    pro: { creatives: 100, campaigns: 100 }
  };

  const userLimits = limits[plan] || limits.standard;
  const currentCreatives = user.usage_creatives_month || 0;
  const currentCampaigns = user.usage_campaigns_month || 0;

  if (type === 'creative' && currentCreatives >= userLimits.creatives) {
    throw new Error(`Лимит креативов исчерпан для тарифа ${plan.toUpperCase()} (${userLimits.creatives}/мес)`);
  }
  if (type === 'campaign' && currentCampaigns >= userLimits.campaigns) {
    throw new Error(`Лимит кампаний исчерпан для тарифа ${plan.toUpperCase()} (${userLimits.campaigns}/мес)`);
  }

  // Обновляем счетчик в БД
  const updateField = type === 'creative' ? 'usage_creatives_month' : 'usage_campaigns_month';
  const newValue = (type === 'creative' ? currentCreatives : currentCampaigns) + 1;
  
  await supabase.from('users').update({ [updateField]: newValue }).eq('tg_user_id', user.tg_user_id);
}

export function requireSubscription(user, res) {
  if (isSubscriptionActive(user)) return true;
  res.status(402).json({ 
    error: 'Subscription required',
    message: 'Пожалуйста, обновите подписку'
  });
  return false;
}