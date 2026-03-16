// api/cron/daily-report.js
import { createClient } from '@supabase/supabase-js'
import { isSubscriptionActive } from '../_subscription.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).end()

  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const querySecret = req.query?.secret
    if (token !== secret && querySecret !== secret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    const tz = process.env.REPORT_TZ || 'Asia/Almaty'
    const dateParts = getYesterdayParts(tz)
    const dateYmd = `${dateParts.year}-${dateParts.month}-${dateParts.day}`
    const dateLabel = `${dateParts.day}.${dateParts.month}.${dateParts.year}`

    const { data: users, error } = await supabase
      .from('users')
      .select('tg_user_id, fb_access_token, fb_ad_account_id, subscription_active, subscription_until')
      .eq('subscription_active', true)
      .not('fb_access_token', 'is', null)
      .not('fb_ad_account_id', 'is', null)

    if (error) throw error

    const results = []

    for (const user of users || []) {
      if (!isSubscriptionActive(user)) continue

      const stats = await fetchDailyStats(user, dateYmd)
      if (!stats) continue

      const message = buildReportMessage(dateLabel, stats)
      const sent = await sendMessage(user.tg_user_id, message)
      results.push({ tg_user_id: user.tg_user_id, sent })
    }

    return res.json({ ok: true, date: dateYmd, sent: results.length })
  } catch (error) {
    console.error('Daily report error:', error)
    return res.status(500).json({ error: 'Daily report error' })
  }
}

function getYesterdayParts(timeZone) {
  const nowTz = new Date(new Date().toLocaleString('en-US', { timeZone }))
  const yesterday = new Date(nowTz)
  yesterday.setDate(yesterday.getDate() - 1)
  return getDatePartsInTz(yesterday, timeZone)
}

function getDatePartsInTz(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const parts = formatter.formatToParts(date)
  const map = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  return map
}

async function fetchDailyStats(user, dateYmd) {
  try {
    const url = `https://graph.facebook.com/v18.0/${user.fb_ad_account_id}/insights?` + new URLSearchParams({
      fields: 'spend,impressions,actions,currency',
      time_range: JSON.stringify({ since: dateYmd, until: dateYmd }),
      access_token: user.fb_access_token
    })

    const res = await fetch(url)
    const data = await res.json()

    if (!res.ok || data?.error) {
      console.warn('FB stats error:', data?.error || data)
      return null
    }

    const insight = data.data?.[0] || {}
    const leads = insight.actions?.find(a => a.action_type === 'lead')?.value || 0
    const spend = parseFloat(insight.spend || 0)
    const impressions = parseInt(insight.impressions || 0)
    const cpl = leads > 0 ? (spend / leads) : 0

    return {
      spend,
      leads: parseInt(leads),
      cpl,
      impressions: Number.isNaN(impressions) ? 0 : impressions,
      currency: insight.currency || '$'
    }
  } catch (error) {
    console.warn('FB stats exception:', error)
    return null
  }
}

function buildReportMessage(dateLabel, stats) {
  const spend = formatMoney(stats.spend, stats.currency)
  const cpl = formatMoney(stats.cpl, stats.currency)
  const impressions = formatNumber(stats.impressions)

  return [
    `Отчёт за ${dateLabel}`,
    `Траты: ${spend}`,
    `Лиды: ${stats.leads}`,
    `CPL: ${cpl}`,
    `Показы: ${impressions}`
  ].join('\n')
}

function formatMoney(value, currency) {
  const amount = Number.isFinite(value) ? value : 0
  const formatted = amount.toFixed(2)
  return `${formatted} ${currency}`
}

function formatNumber(value) {
  if (!value) return '0'
  return value.toLocaleString('ru-RU')
}

async function sendMessage(chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    })

    return res.ok
  } catch (error) {
    console.warn('Telegram send error:', error)
    return false
  }
}
