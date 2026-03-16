// api/generate.js
import { createClient } from '@supabase/supabase-js'
import { getTgUserId, requireSubscription } from './_subscription.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function extractJson(text) {
  const trimmed = (text || '').trim()

  try {
    return JSON.parse(trimmed)
  } catch {}

  const match = trimmed.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI did not return JSON')

  return JSON.parse(match[0])
}

async function fetchWithTimeout(url, options, timeoutMs = 20000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user } = await supabase
      .from('users')
      .select('subscription_active, subscription_until')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!requireSubscription(user, res)) return

    const { description, geo } = req.body || {}

    if (!description) return res.status(400).json({ error: 'No description' })
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is missing in Vercel' })
    }

    const prompt = `Ты senior performance-маркетолог по Facebook Ads.

Сгенерируй 1 сильный рекламный вариант для объявления.

Данные:
- Продукт или услуга: ${description}
- Гео: ${geo || 'Казахстан'}

Требования:
- headline: до 40 символов
- text: 2-3 коротких предложения
- язык: русский
- стиль: живой, конкретный, без воды
- укажи понятную выгоду
- добавь 1-2 уместных эмодзи
- не пиши слишком общие фразы вроде "лучшее предложение"
- не используй markdown

Верни только чистый JSON без пояснений:
{"headline":"...","text":"..."}`

    const aiRes = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        temperature: 0.8,
        messages: [{ role: 'user', content: prompt }]
      })
    }, 20000)

    const aiData = await aiRes.json()

    if (!aiRes.ok) {
      return res.status(500).json({
        error: aiData?.error?.message || 'Anthropic request failed',
        details: aiData
      })
    }

    const text = aiData.content?.map(item => item.text || '').join('\n') || ''
    const parsed = extractJson(text)

    if (!parsed.headline || !parsed.text) {
      return res.status(500).json({ error: 'AI returned incomplete result', raw: text })
    }

    return res.json({
      headline: parsed.headline.trim(),
      text: parsed.text.trim()
    })
  } catch (e) {
    console.error(e)

    if (e.name === 'AbortError') {
      return res.status(504).json({ error: 'AI generation timed out after 20 seconds' })
    }

    return res.status(500).json({ error: e.message || 'Generation error' })
  }
}
