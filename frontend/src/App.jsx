import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import CampaignDetails from './pages/CampaignDetails'
import CreateAd from './pages/CreateAd'
import Connect from './pages/Connect'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Layout from './components/Layout'
import { I18nProvider } from './i18n'

// ─── Supabase client (использует публичный anon key — только чтение) ──────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const tg = window.Telegram?.WebApp

// ─── Получить tg_user_id из Telegram WebApp ───────────────────────────────────
function getTgUserId() {
  try {
    const user = tg?.initDataUnsafe?.user
    if (user?.id) return String(user.id)
  } catch {}
  // В dev-режиме — фиктивный id
  if (import.meta.env.DEV) return 'dev'
  return null
}

// ─── Проверить подписку в Supabase ────────────────────────────────────────────
async function checkSubscription(tgUserId) {
  if (!tgUserId) return false
  const { data, error } = await supabase
    .from('users')
    .select('subscription_active, subscription_until')
    .eq('tg_user_id', tgUserId)
    .single()

  if (error || !data) return false
  if (!data.subscription_active) return false
  if (!data.subscription_until) return true
  return new Date(data.subscription_until).getTime() > Date.now()
}

// ─── Paywall с таймером и скидкой 30% ────────────────────────────────────────
function Paywall({ planUrls }) {
  // Таймер 24 часа — считаем от первого показа, храним в sessionStorage
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = sessionStorage.getItem('paywall_deadline')
    if (saved) {
      const diff = parseInt(saved) - Date.now()
      return diff > 0 ? diff : 0
    }
    const deadline = Date.now() + 24 * 60 * 60 * 1000
    sessionStorage.setItem('paywall_deadline', String(deadline))
    return 24 * 60 * 60 * 1000
  })

  useEffect(() => {
    if (timeLeft <= 0) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1000) { clearInterval(interval); return 0 }
        return prev - 1000
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const hours = String(Math.floor(timeLeft / 3_600_000)).padStart(2, '0')
  const mins  = String(Math.floor((timeLeft % 3_600_000) / 60_000)).padStart(2, '0')
  const secs  = String(Math.floor((timeLeft % 60_000) / 1000)).padStart(2, '0')

  const plans = [
    {
      tag: 'Стартовый',
      period: '1 месяц',
      oldPrice: '$50',
      newPrice: '$35',
      url: planUrls?.plan1 || 'https://t.me/marketologluna_bot',
      highlight: false,
    },
    {
      tag: 'Рост 🔥',
      period: '3 месяца',
      oldPrice: '$120',
      newPrice: '$84',
      url: planUrls?.plan2 || 'https://t.me/marketologluna_bot',
      highlight: true,
      badge: 'Популярный',
    },
    {
      tag: 'Про',
      period: '6 месяцев',
      oldPrice: '$250',
      newPrice: '$175',
      url: planUrls?.plan3 || 'https://t.me/marketologluna_bot',
      highlight: false,
    },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#fff',
      fontFamily: "'Golos Text', sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '32px 20px 48px',
      overflowY: 'auto',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@600;700&family=Golos+Text:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Логотип */}
      <div style={{
        fontFamily: "'Unbounded', cursive", fontWeight: 700, fontSize: 20,
        background: 'linear-gradient(135deg,#FF3CAC,#FF6B35,#FFD600)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        marginBottom: 28,
      }}>Luna Ads</div>

      {/* Бейдж скидки */}
      <div style={{
        background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.4)',
        borderRadius: 100, padding: '6px 18px', fontSize: 13, fontWeight: 600,
        color: '#FF6B35', marginBottom: 16, animation: 'pulse 2s ease infinite',
      }}>
        🔥 Скидка 30% — только сейчас
      </div>

      {/* Заголовок */}
      <div style={{
        fontFamily: "'Unbounded', cursive", fontWeight: 700,
        fontSize: 'clamp(22px, 6vw, 32px)', textAlign: 'center',
        lineHeight: 1.2, marginBottom: 12, animation: 'fadeUp .5s ease both',
      }}>
        Подпишитесь и<br />запускайте рекламу
      </div>

      <div style={{
        fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center',
        marginBottom: 28, maxWidth: 300, lineHeight: 1.6,
      }}>
        Полный доступ к Luna Ads — реклама в Facebook и Instagram прямо из Telegram
      </div>

      {/* Таймер */}
      {timeLeft > 0 && (
        <div style={{
          background: 'rgba(255,60,172,0.08)', border: '1px solid rgba(255,60,172,0.2)',
          borderRadius: 14, padding: '14px 24px', marginBottom: 28,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>
            Предложение истекает через
          </div>
          <div style={{
            fontFamily: "'Unbounded', cursive", fontWeight: 700,
            fontSize: 28, letterSpacing: 4, color: '#FF3CAC',
          }}>
            {hours}:{mins}:{secs}
          </div>
        </div>
      )}

      {/* Тарифы */}
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {plans.map((plan, i) => (
          <a
            key={i}
            href={plan.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block', textDecoration: 'none',
              background: plan.highlight
                ? 'linear-gradient(135deg, rgba(255,60,172,0.12), rgba(255,107,53,0.12))'
                : 'rgba(255,255,255,0.04)',
              border: plan.highlight
                ? '1px solid rgba(255,107,53,0.45)'
                : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '18px 20px',
              position: 'relative', overflow: 'hidden',
              animation: `fadeUp .5s ease ${i * 0.08}s both`,
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {plan.badge && (
              <div style={{
                position: 'absolute', top: 12, right: 14,
                background: 'linear-gradient(135deg,#FF3CAC,#FF6B35)',
                color: '#fff', fontSize: 10, fontWeight: 700,
                padding: '3px 10px', borderRadius: 100, letterSpacing: 0.5,
              }}>{plan.badge}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{plan.tag}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{plan.period}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.3)',
                  textDecoration: 'line-through', marginBottom: 2,
                }}>{plan.oldPrice}</div>
                <div style={{
                  fontFamily: "'Unbounded', cursive", fontWeight: 700,
                  fontSize: 20,
                  background: 'linear-gradient(135deg,#FF3CAC,#FFD600)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>{plan.newPrice}</div>
              </div>
            </div>
            <div style={{
              marginTop: 14,
              background: plan.highlight
                ? 'linear-gradient(135deg,#FF3CAC,#FF6B35)'
                : 'rgba(255,255,255,0.08)',
              color: '#fff', borderRadius: 10, padding: '10px',
              textAlign: 'center', fontSize: 14, fontWeight: 600,
            }}>
              Выбрать →
            </div>
          </a>
        ))}
      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
        Безопасная оплата · Отмена в любое время
      </div>
    </div>
  )
}

// ─── AppRoutes ────────────────────────────────────────────────────────────────
function AppRoutes({ isConnected, hasSubscription, onConnect }) {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('fb_token')
    if (!token) return
    localStorage.setItem('fb_connected', '1')
    localStorage.setItem('fb_token', token)
    onConnect()
    navigate('/', { replace: true })
  }, [location.search, navigate, onConnect])

  // Публичные маршруты — всегда доступны
  if (location.pathname === '/privacy') return <Routes><Route path="/privacy" element={<Privacy />} /></Routes>
  if (location.pathname === '/terms')   return <Routes><Route path="/terms" element={<Terms />} /></Routes>

  // Нет подписки → Paywall
  if (!hasSubscription) return <Paywall planUrls={{
    plan1: import.meta.env.VITE_LEMONSQUEEZY_PLAN_1M_URL,
    plan2: import.meta.env.VITE_LEMONSQUEEZY_PLAN_2M_URL,
    plan3: import.meta.env.VITE_LEMONSQUEEZY_PLAN_3M_URL,
  }} />

  return (
    <Routes>
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/connect" element={<Connect onConnect={onConnect} />} />
      <Route element={<Layout />}>
        <Route path="/" element={isConnected ? <Dashboard /> : <Navigate to="/connect" />} />
        <Route path="/campaigns" element={isConnected ? <Campaigns /> : <Navigate to="/connect" />} />
        <Route path="/campaigns/:id" element={isConnected ? <CampaignDetails /> : <Navigate to="/connect" />} />
        <Route path="/create" element={isConnected ? <CreateAd /> : <Navigate to="/connect" />} />
      </Route>
    </Routes>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [isReady, setIsReady] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [hasSubscription, setHasSubscription] = useState(false)

  useEffect(() => {
    if (tg) {
      tg.ready()
      tg.expand()
      tg.setHeaderColor('#0a0a0f')
      tg.setBackgroundColor('#0a0a0f')
    }

    const fbConnected = localStorage.getItem('fb_connected')
    setIsConnected(!!fbConnected)

    // ── Главное исправление: проверяем подписку в Supabase ──
    const tgUserId = getTgUserId()
    checkSubscription(tgUserId).then(active => {
      setHasSubscription(active)
      setIsReady(true)
    })
  }, [])

  const handleConnect = useCallback(() => setIsConnected(true), [])

  if (!isReady) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a0a0f',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid #7c5cfc', borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )

  return (
    <BrowserRouter>
      <I18nProvider>
        <AppRoutes
          isConnected={isConnected}
          hasSubscription={hasSubscription}
          onConnect={handleConnect}
        />
      </I18nProvider>
    </BrowserRouter>
  )
}
