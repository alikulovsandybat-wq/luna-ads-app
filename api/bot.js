// api/bot.js — Telegram webhook
import { createClient } from '@supabase/supabase-js'
import { isSubscriptionActive } from './_subscription.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

/**
 * ОБНОВЛЕННЫЕ ТАРИФЫ СОГЛАСНО ТЗ:
 * Тариф «Стандарт»: 50 000 тенге / мес.
 * Тариф «PRO»: 150 000 тенге / мес.
 */
const PLANS = [
  { 
    id: 'standard', 
    label: '💳 Тариф «Стандарт» — 50 000 ₸', 
    url: process.env.LEMONSQUEEZY_STANDARD_URL || process.env.LEMONSQUEEZY_PLAN_1M_URL,
    desc: '30 креативов + 30 кампаний'
  },
  { 
    id: 'pro', 
    label: '💎 Тариф «PRO» — 150 000 ₸', 
    url: process.env.LEMONSQUEEZY_PRO_URL || process.env.LEMONSQUEEZY_PLAN_3M_URL,
    desc: '100 креативов + сотрудники'
  }
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end()

  const { message } = req.body
  if (!message) return res.status(200).end()

  const chatId = message.chat?.id
  const text = message.text || ''
  const tgUserId = String(message.from?.id || message.chat?.id || '').trim()

  if (!chatId || !tgUserId) return res.status(200).end()

  if (text === '/start' || text.startsWith('/start')) {
    // Создаем или обновляем пользователя в базе
    await ensureUser(tgUserId)

    const { data: user } = await supabase
      .from('users')
      .select('subscription_active, subscription_until, plan')
      .eq('tg_user_id', tgUserId)
      .single()

    // Если подписки нет или она просрочена
    if (!isSubscriptionActive(user)) {
      const buttons = buildPlanButtons(tgUserId)

      await sendMessage(chatId, {
        text: '👋 Привет! Я *Luna Ads* — твой личный ИИ-таргетолог.\n\n' +
              'Чтобы начать запускать эффективную рекламу в Facebook/Instagram, выбери подходящий тариф:\n\n' +
              '🔹 *Стандарт (50 000 ₸):*\n— 30 креативов в месяц\n— 30 рекламных кампаний\n— Доступ ко всем ИИ функциям\n\n' +
              '🔸 *PRO (150 000 ₸):*\n— 100 креативов в месяц\n— Доступ для 2-х сотрудников\n— Приоритетная поддержка\n\n' +
              'После оплаты доступ активируется автоматически.',
        parse_mode: 'Markdown',
        reply_markup: buttons.length
          ? { inline_keyboard: buttons }
          : undefined
      })

      return res.status(200).end()
    }

    // Если подписка активна
    await sendMessage(chatId, {
      text: '👋 С возвращением! Я *Luna Ads* готов к работе.\n\nНажми кнопку ниже, чтобы открыть панель управления 👇',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{
          text: '🚀 Открыть Luna Ads',
          web_app: { url: process.env.FRONTEND_URL }
        }]]
      }
    })
  }

  res.status(200).end()
}

function buildPlanButtons(tgUserId) {
  return PLANS
    .filter(plan => Boolean(plan.url))
    .map(plan => [{
      text: plan.label,
      url: buildCheckoutUrl(plan.url, tgUserId, plan.id)
    }])
}

function buildCheckoutUrl(baseUrl, tgUserId, planId) {
  const url = new URL(baseUrl)
  // Передаем ID пользователя и ID тарифа в LemonSqueezy
  url.searchParams.set('checkout[custom][tg_user_id]', tgUserId)
  url.searchParams.set('checkout[custom][plan_id]', planId)
  // Для совместимости с вебхуком (месяцы)
  url.searchParams.set('checkout[custom][months]', planId === 'pro' ? '1' : '1') 
  return url.toString()
}

async function ensureUser(tgUserId) {
  await supabase
    .from('users')
    .upsert({ 
      tg_user_id: tgUserId, 
      updated_at: new Date().toISOString() 
    }, { onConflict: 'tg_user_id' })
}

async function sendMessage(chatId, body) {
  await fetch(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, ...body })
  })
}