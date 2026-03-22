import { createClient } from '@supabase/supabase-js'
import { getTgUserId, requireSubscription } from './_subscription.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function extractJson(text) {
  const trimmed = (text || '').trim()
  try { return JSON.parse(trimmed) } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI did not return JSON')
  return JSON.parse(match[0])
}

async function fetchWithTimeout(url, options, timeoutMs = 25000) {
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
      return res.status(500).json({ error: 'OPENAI_API_KEY is missing' })
    }

    // ОБНОВЛЕННЫЙ ПРОМПТ: Твой "зубастый" и элитный стиль
    const prompt = `Ты — топовый креативный директор и эксперт по рекламе. Твоя задача — создать текст для рекламы в Instagram/Facebook.

ДАННЫЕ:
- Продукт: ${description}
- Локация: ${geo || 'Казахстан'}

ТВОЙ СТИЛЬ:
- Элитный, чистый, "человечный" язык. 
- Никакого "рекламного пластика" и заезженных фраз типа "лучшее предложение".
- Пиши коротко, емко, "зубасто" и по делу.

ЗАДАЧА:
1. headline: Короткий цепляющий заголовок до 40 символов. Это то, что Sharp наложит на картинку.
2. text: Основной текст поста (2-3 предложения), который бьет в боль или выгоду клиента.
3. interests: 5-8 точных интересов для таргета на английском языке.

Верни только чистый JSON:
{"headline":"...","text":"...","interests":["..."]}`

    const model = process.env.OPENAI_TEXT_MODEL || 'gpt-4o' // Используем мощную модель для качества
    const aiRes = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a professional ad copywriter. Respond with JSON only.' },
          { role: 'user', content: prompt }
        ]
      })
    }, 25000)

    const aiData = await aiRes.json()
    if (!aiRes.ok) throw new Error(aiData?.error?.message || 'OpenAI Error')

    const content = aiData.choices?.[0]?.message?.content || ''
    const parsed = extractJson(content)

    return res.json({
      headline: (parsed.headline || '').trim(),
      text: (parsed.text || '').trim(),
      interests: Array.isArray(parsed.interests) ? parsed.interests : []
    })

  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message || 'Generation error' })
  }
}
