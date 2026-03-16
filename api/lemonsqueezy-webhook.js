// api/lemonsqueezy-webhook.js
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
    if (!secret) return res.status(500).json({ error: 'LEMONSQUEEZY_WEBHOOK_SECRET is missing' })

    const rawBody = await readRawBody(req)
    const signature = req.headers['x-signature']

    if (!isValidSignature(rawBody, signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' })
    }

    const payload = JSON.parse(rawBody.toString('utf8'))
    const eventName = payload?.meta?.event_name

    if (!eventName) return res.status(200).json({ ok: true })

    const custom = payload?.meta?.custom_data || payload?.meta?.custom || {}
    const tgUserId = String(
      custom.tg_user_id || custom.telegram_id || custom.user_id || ''
    ).trim()
    const months = parseInt(custom.months || custom.plan_months || custom.duration || '', 10)

    if (!tgUserId) {
      console.warn('Webhook missing tg_user_id', { eventName })
      return res.status(200).json({ ok: true })
    }

    if (eventName === 'order_refunded') {
      await supabase
        .from('users')
        .update({
          subscription_active: false,
          subscription_until: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('tg_user_id', tgUserId)

      return res.status(200).json({ ok: true })
    }

    if (!['order_created', 'order_paid'].includes(eventName)) {
      return res.status(200).json({ ok: true })
    }

    if (!Number.isFinite(months) || months <= 0) {
      console.warn('Webhook missing months', { eventName, tgUserId })
      return res.status(200).json({ ok: true })
    }

    const orderId = String(
      payload?.data?.id || payload?.data?.attributes?.identifier || payload?.data?.attributes?.order_number || ''
    ).trim()

    if (!orderId) {
      console.warn('Webhook missing order id', { eventName, tgUserId })
      return res.status(200).json({ ok: true })
    }

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('order_id')
      .eq('order_id', orderId)
      .maybeSingle()

    if (existingPayment) {
      return res.status(200).json({ ok: true })
    }

    await supabase.from('payments').insert({
      order_id: orderId,
      tg_user_id: tgUserId,
      months
    })

    const { data: user } = await supabase
      .from('users')
      .select('subscription_until')
      .eq('tg_user_id', tgUserId)
      .maybeSingle()

    const now = new Date()
    const base = user?.subscription_until && new Date(user.subscription_until) > now
      ? new Date(user.subscription_until)
      : now

    const newUntil = addMonths(base, months)

    await supabase
      .from('users')
      .upsert({
        tg_user_id: tgUserId,
        subscription_active: true,
        subscription_until: newUntil.toISOString(),
        updated_at: now.toISOString()
      }, { onConflict: 'tg_user_id' })

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('LemonSqueezy webhook error:', error)
    return res.status(500).json({ error: 'Webhook error' })
  }
}

function isValidSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const sigBuf = Buffer.from(signature, 'utf8')
  const digBuf = Buffer.from(digest, 'utf8')
  if (sigBuf.length !== digBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, digBuf)
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function addMonths(date, months) {
  const d = new Date(date)
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() < day) d.setDate(0)
  return d
}
