import { createClient } from '@supabase/supabase-js'
import { getTgUserId } from './_subscription.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).end()

  const { q } = req.query
  if (!q || q.length < 2) return res.json({ data: [] })

  try {
    const tgUserId = getTgUserId(req)
    if (!tgUserId) return res.status(401).json({ error: 'Unauthorized' })

    // Берём токен пользователя из Supabase
    const { data: user } = await supabase
      .from('users')
      .select('fb_access_token')
      .eq('tg_user_id', tgUserId)
      .single()

    if (!user?.fb_access_token) {
      // Фоллбек — возвращаем захардкоженный список если нет токена
      return res.json({ data: getFallbackCities(q), fallback: true })
    }

    // Запрос к Meta Locations API
    const url = `https://graph.facebook.com/v21.0/search?` + new URLSearchParams({
      type: 'adgeolocation',
      q,
      location_types: JSON.stringify(['city', 'region', 'country']),
      access_token: user.fb_access_token,
      limit: 10
    })

    const fbRes = await fetch(url)
    const fbData = await fbRes.json()

    if (!fbRes.ok || fbData.error) {
      console.warn('Meta geo search error:', fbData.error)
      return res.json({ data: getFallbackCities(q), fallback: true })
    }

    // Форматируем ответ
    const results = (fbData.data || []).map(item => ({
      key: item.key,
      name: item.name,
      type: item.type,          // city / region / country
      country_code: item.country_code,
      country_name: item.country_name,
      region: item.region || null,
      display: buildDisplayName(item)
    }))

    return res.json({ data: results })

  } catch (e) {
    console.error('geo-search error:', e)
    return res.json({ data: getFallbackCities(q), fallback: true })
  }
}

function buildDisplayName(item) {
  if (item.type === 'city') {
    return `${item.name}${item.region ? ', ' + item.region : ''}, ${item.country_name}`
  }
  if (item.type === 'region') {
    return `${item.name}, ${item.country_name}`
  }
  return item.name
}

// Фоллбек если нет токена или Meta недоступна
function getFallbackCities(q) {
  const cities = [
    { key: 'KZ', name: 'Казахстан', type: 'country', country_code: 'KZ', display: 'Казахстан (вся страна)' },
    { key: '2147', name: 'Алматы', type: 'city', country_code: 'KZ', display: 'Алматы, Казахстан' },
    { key: '2233', name: 'Астана', type: 'city', country_code: 'KZ', display: 'Астана, Казахстан' },
    { key: '2148', name: 'Шымкент', type: 'city', country_code: 'KZ', display: 'Шымкент, Казахстан' },
    { key: '2149', name: 'Қарағанды', type: 'city', country_code: 'KZ', display: 'Қарағанды, Казахстан' },
    { key: '2150', name: 'Актобе', type: 'city', country_code: 'KZ', display: 'Актобе, Казахстан' },
    { key: '2151', name: 'Тараз', type: 'city', country_code: 'KZ', display: 'Тараз, Казахстан' },
    { key: '2152', name: 'Павлодар', type: 'city', country_code: 'KZ', display: 'Павлодар, Казахстан' },
    { key: '2153', name: 'Өскемен', type: 'city', country_code: 'KZ', display: 'Өскемен, Казахстан' },
    { key: '2154', name: 'Семей', type: 'city', country_code: 'KZ', display: 'Семей, Казахстан' },
    { key: '2155', name: 'Атырау', type: 'city', country_code: 'KZ', display: 'Атырау, Казахстан' },
    { key: '2156', name: 'Костанай', type: 'city', country_code: 'KZ', display: 'Костанай, Казахстан' },
    { key: 'RU', name: 'Россия', type: 'country', country_code: 'RU', display: 'Россия (вся страна)' },
    { key: '2077', name: 'Москва', type: 'city', country_code: 'RU', display: 'Москва, Россия' },
    { key: '2078', name: 'Санкт-Петербург', type: 'city', country_code: 'RU', display: 'Санкт-Петербург, Россия' },
    { key: 'UZ', name: 'Узбекистан', type: 'country', country_code: 'UZ', display: 'Узбекистан (вся страна)' },
    { key: '2200', name: 'Ташкент', type: 'city', country_code: 'UZ', display: 'Ташкент, Узбекистан' },
  ]

  const lower = q.toLowerCase()
  return cities.filter(c =>
    c.name.toLowerCase().includes(lower) ||
    c.display.toLowerCase().includes(lower)
  )
}
