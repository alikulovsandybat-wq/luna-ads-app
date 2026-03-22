import { useState, useEffect } from 'react'
import { useI18n } from '../i18n'
import LanguageSwitcher from '../components/LanguageSwitcher'

const API = import.meta.env.VITE_API_URL || ''

// ── Замени эти ссылки на реальные из LemonSqueezy после создания продуктов ──
const CHECKOUT_URLS = {
  starter:   'https://lunaads.lemonsqueezy.com/buy/starter',
  autopilot: 'https://lunaads.lemonsqueezy.com/buy/autopilot',
  agency:    'https://lunaads.lemonsqueezy.com/buy/agency',
}

export default function Profile() {
  const { t } = useI18n()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState('autopilot')

  const PLANS = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$50',
      priceKzt: '25 000 ₸',
      color: '#007AFF',
      features: [
        t('profile.plan.starter.f1'),
        t('profile.plan.starter.f2'),
        t('profile.plan.starter.f3'),
        t('profile.plan.starter.f4'),
        t('profile.plan.starter.f5'),
      ],
      popular: false,
    },
    {
      id: 'autopilot',
      name: 'Autopilot',
      price: '$100',
      priceKzt: '50 000 ₸',
      color: '#7c3aed',
      features: [
        t('profile.plan.autopilot.f1'),
        t('profile.plan.autopilot.f2'),
        t('profile.plan.autopilot.f3'),
        t('profile.plan.autopilot.f4'),
        t('profile.plan.autopilot.f5'),
        t('profile.plan.autopilot.f6'),
      ],
      popular: true,
    },
    {
      id: 'agency',
      name: 'Agency',
      price: '$200',
      priceKzt: '100 000 ₸',
      color: '#059669',
      features: [
        t('profile.plan.agency.f1'),
        t('profile.plan.agency.f2'),
        t('profile.plan.agency.f3'),
        t('profile.plan.agency.f4'),
        t('profile.plan.agency.f5'),
        t('profile.plan.agency.f6'),
      ],
      popular: false,
    },
  ]

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    setLoading(true)
    try {
      const WebApp = window.Telegram?.WebApp
      const tgData = WebApp?.initData || ''
      const userId = localStorage.getItem('luna_tg_userid') || ''
      const tgUser = WebApp?.initDataUnsafe?.user

      const res = await fetch(`${API}/api/profile`, {
        headers: { 'x-tg-data': tgData, 'x-tg-userid': userId }
      })

      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        if (data.plan) setCurrentPlan(data.plan)
      } else {
        setProfile({
          name: tgUser ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() : null,
          username: tgUser?.username || '',
          tg_user_id: userId || tgUser?.id || '—',
          ad_account_id: '—',
          email: null,
          plan: 'autopilot',
          plan_expires: null,
        })
      }
    } catch {
      const WebApp = window.Telegram?.WebApp
      const tgUser = WebApp?.initDataUnsafe?.user
      const userId = localStorage.getItem('luna_tg_userid') || ''
      setProfile({
        name: tgUser ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() : null,
        username: tgUser?.username || '',
        tg_user_id: userId || '—',
        ad_account_id: '—',
        email: null,
        plan: 'autopilot',
        plan_expires: null,
      })
    }
    setLoading(false)
  }

  function handlePayment(planId) {
    const userId = profile?.tg_user_id || ''
    // Передаём tg_user_id как custom data в URL чтобы вебхук знал кому активировать подписку
    const baseUrl = CHECKOUT_URLS[planId]
    const url = `${baseUrl}?checkout[custom][tg_user_id]=${userId}&checkout[custom][months]=1`
    window.Telegram?.WebApp?.openLink(url) || window.open(url, '_blank')
  }

  if (loading) return (
    <div style={{ padding: 24 }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 12 }} />
      ))}
    </div>
  )

  const activePlan = PLANS.find(p => p.id === currentPlan) || PLANS[1]
  const isExpired = profile?.plan_expires && new Date(profile.plan_expires) < new Date()

  return (
    <div style={{ padding: '20px 16px 100px', fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Заголовок */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#007AFF', letterSpacing: -0.5 }}>
          {t('profile.title')}
        </div>
        <LanguageSwitcher />
      </div>

      {/* Карточка пользователя */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '20px', marginBottom: 16
      }}>
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
              {profile?.name || t('profile.user_fallback')}
            </div>
            {profile?.username && (
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>@{profile.username}</div>
            )}
          </div>
        </div>

        {[
          { label: 'Email',                        value: profile?.email || '—',          icon: '✉️' },
          { label: 'Telegram ID',                  value: profile?.tg_user_id || '—',     icon: '✈️' },
          { label: t('profile.ad_account_id'),     value: profile?.ad_account_id || '—',  icon: '📋' },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0', borderBottom: '1px solid var(--border)'
          }}>
            <span style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {row.icon} {row.label}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', maxWidth: '55%', textAlign: 'right', wordBreak: 'break-all' }}>
              {row.value}
            </span>
          </div>
        ))}

        {/* Тариф + статус */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            💎 {t('profile.plan_label')}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{
              background: activePlan.color + '18', border: `1px solid ${activePlan.color}44`,
              color: activePlan.color, fontSize: 12, fontWeight: 700,
              padding: '4px 12px', borderRadius: 20
            }}>
              {activePlan.name}
            </div>
            {profile?.plan_expires && (
              <div style={{ fontSize: 11, color: isExpired ? '#ef4444' : 'var(--text3)' }}>
                {isExpired ? '⚠️ Истёк' : `${t('profile.plan_until')} ${new Date(profile.plan_expires).toLocaleDateString()}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Промобанер ProductHunt */}
      <div style={{
        background: 'linear-gradient(135deg, #ff6154 0%, #ff8c00 100%)',
        borderRadius: 16, padding: '14px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12
      }}>
        <div style={{ fontSize: 28 }}>🚀</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            ProductHunt Launch — скидка 30%
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
            Промокод <strong>HUNT30</strong> при оформлении
          </div>
        </div>
      </div>

      {/* Тарифные планы */}
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
        {t('profile.plans_title')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PLANS.map(plan => {
          const isActive = plan.id === currentPlan && !isExpired
          return (
            <div key={plan.id} style={{
              background: 'var(--card)',
              border: `2px solid ${isActive ? plan.color : 'var(--border)'}`,
              borderRadius: 20, padding: '18px', position: 'relative',
              boxShadow: isActive ? `0 4px 20px ${plan.color}22` : 'none'
            }}>
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: -10, right: 16,
                  background: plan.color, color: '#fff',
                  fontSize: 11, fontWeight: 700, padding: '3px 12px',
                  borderRadius: 20, boxShadow: `0 2px 8px ${plan.color}44`
                }}>
                  ⭐ {t('profile.popular')}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{plan.name}</div>
                  {isActive && (
                    <div style={{ fontSize: 11, color: plan.color, fontWeight: 600, marginTop: 2 }}>
                      ✓ {t('profile.current_plan')}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>
                    <span style={{ fontSize: 28, fontWeight: 800, color: plan.color, letterSpacing: -1 }}>
                      {plan.price}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 2 }}>
                      / {t('profile.per_month')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    ≈ {plan.priceKzt} / мес
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#22c55e18', border: '1px solid #22c55e44',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 10, color: '#22c55e', fontWeight: 700
                    }}>✓</div>
                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => handlePayment(plan.id)} style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                background: isActive ? 'var(--bg3)' : plan.color,
                color: isActive ? 'var(--text2)' : '#fff',
                boxShadow: isActive ? 'none' : `0 4px 14px ${plan.color}33`
              }}>
                {isActive ? t('profile.renew') : t('profile.switch_plan')}
              </button>
            </div>
          )
        })}
      </div>

      {/* Кнопка выхода */}
      <button onClick={() => {
        localStorage.removeItem('fb_connected')
        localStorage.removeItem('fb_token')
        window.location.href = '/connect'
      }} style={{
        width: '100%', marginTop: 24, padding: '14px', borderRadius: 12,
        border: '1px solid var(--border)', background: 'transparent',
        color: '#ef4444', fontSize: 14, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit'
      }}>
        {t('profile.disconnect')}
      </button>
    </div>
  )
}
