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
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is missing in Vercel' })
    }

    const prompt = `Ты senior performance-маркетолог по Facebook Ads.\n\nСгенерируй 1 сильный рекламный вариант для объявления.\n\nДанные:\n- Продукт или услуга: ${description}\n- Гео: ${geo || 'Казахстан'}\n\nТребования:\n- headline: до 40 символов\n- text: 2-3 коротких предложения\n- язык: русский\n- стиль: живой, конкретный, без воды\n- укажи понятную выгоду\n- добавь 1-2 уместных эмодзи\n- не пиши слишком общие фразы вроде "лучшее предложение"\n- не используй markdown\n\nВерни только чистый JSON без пояснений:\n{"headline":"...","text":"..."}`

    const model = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini'

    const aiRes = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Respond with JSON only.' },
          { role: 'user', content: prompt }
        ]
      })
    }, 20000)

    const aiData = await aiRes.json()

    if (!aiRes.ok) {
      return res.status(500).json({
        error: aiData?.error?.message || 'OpenAI request failed',
        details: aiData
      })
    }

    const text = aiData.choices?.[0]?.message?.content || ''
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
