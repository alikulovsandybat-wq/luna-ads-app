import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import LanguageSwitcher from '../components/LanguageSwitcher'

const API = import.meta.env.VITE_API_URL || ''

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    period: '/ мес',
    color: '#007AFF',
    features: [
      '1 рекламный аккаунт',
      'До 5 активных кампаний',
      'AI генерация текстов',
      'Базовая аналитика',
      'Поддержка по email',
    ],
    popular: false,
  },
  {
    id: 'autopilot',
    name: 'Autopilot',
    price: '$79',
    period: '/ мес',
    color: '#7c3aed',
    features: [
      '3 рекламных аккаунта',
      'Неограниченные кампании',
      'AI генерация картинок',
      'AI автооптимизация',
      'Расширенная аналитика',
      'Приоритетная поддержка',
    ],
    popular: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: '$199',
    period: '/ мес',
    color: '#059669',
    features: [
      '10 рекламных аккаунтов',
      'White-label отчёты',
      'API доступ',
      'Командный доступ',
      'Персональный менеджер',
      'SLA 99.9%',
    ],
    popular: false,
  },
]

export default function Profile() {
  const { t, lang, setLang } = useI18n()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState('autopilot')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    try {
      const WebApp = window.Telegram?.WebApp
      const tgData = WebApp?.initData || ''
      const userId = localStorage.getItem('luna_tg_userid') || ''
      const tgUser = WebApp?.initDataUnsafe?.user

      // Пробуем загрузить профиль с сервера
      const res = await fetch(`${API}/api/profile`, {
        headers: { 'x-tg-data': tgData, 'x-tg-userid': userId }
      })

      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        if (data.plan) setCurrentPlan(data.plan)
      } else {
        // Fallback — данные из Telegram
        setProfile({
          name: tgUser ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() : 'Пользователь',
          username: tgUser?.username || '',
          tg_user_id: userId || tgUser?.id || '—',
          ad_account_id: localStorage.getItem('fb_ad_account_id') || '—',
          email: '—',
          plan: 'autopilot',
          plan_expires: null,
        })
      }
    } catch {
      const WebApp = window.Telegram?.WebApp
      const tgUser = WebApp?.initDataUnsafe?.user
      const userId = localStorage.getItem('luna_tg_userid') || ''
      setProfile({
        name: tgUser ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() : 'Пользователь',
        username: tgUser?.username || '',
        tg_user_id: userId || '—',
        ad_account_id: localStorage.getItem('fb_ad_account_id') || '—',
        email: '—',
        plan: 'autopilot',
        plan_expires: null,
      })
    }
    setLoading(false)
  }

  function handlePayment(planId) {
    const WebApp = window.Telegram?.WebApp
    if (WebApp?.openInvoice) {
      // Telegram Payments — если настроены
      WebApp.openLink(`${API}/api/subscribe?plan=${planId}&uid=${profile?.tg_user_id}`)
    } else {
      window.open(`${API}/api/subscribe?plan=${planId}&uid=${profile?.tg_user_id}`, '_blank')
    }
  }

  if (loading) return (
    <div style={{ padding: 24 }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 12 }} />
      ))}
    </div>
  )

  const activePlan = PLANS.find(p => p.id === currentPlan) || PLANS[1]

  return (
    <div style={{ padding: '20px 16px 100px', fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ── Заголовок ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#007AFF', letterSpacing: -0.5 }}>
          Профиль
        </div>
        <LanguageSwitcher />
      </div>

      {/* ── Карточка пользователя ── */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '20px', marginBottom: 16
      }}>
        {/* Аватар + имя */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #007AFF, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: '#fff', fontWeight: 700, flexShrink: 0
          }}>
            {profile?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              {profile?.name || 'Пользователь'}
            </div>
            {profile?.username && (
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
                @{profile.username}
              </div>
            )}
          </div>
        </div>

        {/* Инфо-строки */}
        {[
          { label: 'Email', value: profile?.email || '—', icon: '✉️' },
          { label: 'Telegram ID', value: profile?.tg_user_id || '—', icon: '✈️' },
          { label: 'ID рекл. кабинета', value: profile?.ad_account_id || '—', icon: '📋' },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0', borderBottom: '1px solid var(--border)'
          }}>
            <span style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {row.icon} {row.label}
            </span>
            <span style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text)',
              maxWidth: '55%', textAlign: 'right', wordBreak: 'break-all'
            }}>
              {row.value}
            </span>
          </div>
        ))}

        {/* Текущий тариф */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 0'
        }}>
          <span style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            💎 Тариф
          </span>
          <div style={{
            background: activePlan.color + '18', border: `1px solid ${activePlan.color}44`,
            color: activePlan.color, fontSize: 12, fontWeight: 700,
            padding: '4px 12px', borderRadius: 20
          }}>
            {activePlan.name}
            {profile?.plan_expires && ` · до ${new Date(profile.plan_expires).toLocaleDateString('ru-RU')}`}
          </div>
        </div>
      </div>

      {/* ── Тарифы ── */}
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
        Тарифные планы
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PLANS.map(plan => {
          const isActive = plan.id === currentPlan
          return (
            <div key={plan.id} style={{
              background: 'var(--card)',
              border: `2px solid ${isActive ? plan.color : 'var(--border)'}`,
              borderRadius: 20, padding: '18px',
              position: 'relative', transition: 'border-color 0.2s',
              boxShadow: isActive ? `0 4px 20px ${plan.color}22` : 'none'
            }}>
              {/* Бейдж Popular */}
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: -10, right: 16,
                  background: plan.color, color: '#fff',
                  fontSize: 11, fontWeight: 700, padding: '3px 12px',
                  borderRadius: 20, boxShadow: `0 2px 8px ${plan.color}44`
                }}>
                  ⭐ Популярный
                </div>
              )}

              {/* Название + цена */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{plan.name}</div>
                  {isActive && (
                    <div style={{ fontSize: 11, color: plan.color, fontWeight: 600, marginTop: 2 }}>
                      ✓ Текущий план
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: plan.color, letterSpacing: -1 }}>
                    {plan.price}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 2 }}>{plan.period}</span>
                </div>
              </div>

              {/* Фичи */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#22c55e18', border: '1px solid #22c55e44',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 10, color: '#22c55e', fontWeight: 700
                    }}>
                      ✓
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* Кнопка */}
              <button
                onClick={() => handlePayment(plan.id)}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                  background: isActive ? 'var(--bg3)' : plan.color,
                  color: isActive ? 'var(--text2)' : '#fff',
                  transition: 'opacity 0.15s',
                  boxShadow: isActive ? 'none' : `0 4px 14px ${plan.color}33`
                }}
              >
                {isActive ? 'Продлить подписку' : 'Перейти на этот план'}
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Выход ── */}
      <button
        onClick={() => {
          localStorage.removeItem('fb_connected')
          localStorage.removeItem('fb_token')
          window.location.href = '/connect'
        }}
        style={{
          width: '100%', marginTop: 24, padding: '14px', borderRadius: 12,
          border: '1px solid var(--border)', background: 'transparent',
          color: '#ef4444', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit'
        }}
      >
        Отключить Facebook аккаунт
      </button>
    </div>
  )
}
