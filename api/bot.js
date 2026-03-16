// api/bot.js — Telegram webhook
import { createClient } from '@supabase/supabase-js'
import { isSubscriptionActive } from './_subscription.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const PLANS = [
  { months: 1, label: '1 месяц — 25 000 ₸', url: process.env.LEMONSQUEEZY_PLAN_1M_URL },
  { months: 3, label: '3 месяца — 60 000 ₸', url: process.env.LEMONSQUEEZY_PLAN_3M_URL },
  { months: 6, label: '6 месяцев — 120 000 ₸', url: process.env.LEMONSQUEEZY_PLAN_6M_URL }
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
    await ensureUser(tgUserId)

    const { data: user } = await supabase
      .from('users')
      .select('subscription_active, subscription_until')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!isSubscriptionActive(user)) {
      const buttons = buildPlanButtons(tgUserId)

      await sendMessage(chatId, {
        text: 'Чтобы открыть доступ к Luna Ads, выбери тариф и оплати. После оплаты доступ активируется автоматически.',
        reply_markup: buttons.length
          ? { inline_keyboard: buttons }
          : undefined
      })

      return res.status(200).end()
    }

    await sendMessage(chatId, {
      text: '👋 Привет! Я *Luna Ads* — запуск рекламы Facebook прямо здесь.\n\nНажми кнопку ниже, чтобы открыть приложение 👇',
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
      url: buildCheckoutUrl(plan.url, tgUserId, plan.months)
    }])
}

function buildCheckoutUrl(baseUrl, tgUserId, months) {
  const url = new URL(baseUrl)
  url.searchParams.set('checkout[custom][tg_user_id]', tgUserId)
  url.searchParams.set('checkout[custom][months]', String(months))
  return url.toString()
}

async function ensureUser(tgUserId) {
  await supabase
    .from('users')
    .upsert({ tg_user_id: tgUserId, updated_at: new Date().toISOString() }, { onConflict: 'tg_user_id' })
}

async function sendMessage(chatId, body) {
  await fetch(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, ...body })
  })
}
