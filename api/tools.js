// api/tools.js
import { OpenAI } from 'openai'
import { getTgUserId, requireSubscription } from './_subscription.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!requireSubscription(user, res)) return

    const { action, text, style = 'elite' } = req.body
    if (!text) return res.status(400).json({ error: 'Missing text' })

    let prompt = ''

    if (action === 'rewrite') {
      prompt = `Ты — топовый креативный директор. Перепиши этот рекламный текст в стиле "${style}". 
      Сделай 3 разных варианта: 
      1. Короткий и дерзкий.
      2. Элитный и сдержанный.
      3. Эмоциональный с использованием эмодзи.
      
      Текст для рерайта: ${text}`
    } else if (action === 'ideas') {
      prompt = `На основе описания этого продукта/услуги предложи 5 сильных и нестандартных рекламных офферов для Facebook Ads, которые пробьют баннерную слепоту.
      Описание: ${text}`
    } else {
      return res.status(400).json({ error: 'Invalid action' })
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "Ты эксперт по высококонверсионным рекламным текстам Meta Ads. Твой язык — острый, современный, без клише." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.8
    })

    const result = completion.choices[0].message.content

    res.json({ result })

  } catch (e) {
    console.error('Tools error:', e)
    res.status(500).json({ error: e.message })
  }
}