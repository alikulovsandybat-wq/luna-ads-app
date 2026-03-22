import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Dashboard.module.css'
import { useI18n } from '../i18n'

const API = import.meta.env.VITE_API_URL || ''

// ── Комбо-график: столбцы + линия поверх ─────────────────────────────────────
function ComboChart({ data, dataKey, color = '#007AFF', height = 120 }) {
  if (!data || data.length === 0) return null

  const values = data.map(d => Number(d[dataKey]) || 0)
  const max = Math.max(...values, 1)

  // Точки для линии
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100
    const y = 100 - (v / max) * 85
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{ position: 'relative', height, marginTop: 8 }}>
      {/* Горизонтальные направляющие */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ width: '100%', height: 1, background: 'rgba(0,0,0,0.06)' }} />
        ))}
      </div>

      {/* Столбцы */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%', position: 'relative', zIndex: 1 }}>
        {values.map((v, i) => {
          const pct = (v / max) * 85
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{
                width: '100%',
                height: `${Math.max(pct, 2)}%`,
                background: `${color}22`,
                borderRadius: '4px 4px 0 0',
                border: `1px solid ${color}44`,
                transition: 'height 0.5s ease',
              }} />
            </div>
          )
        })}
      </div>

      {/* SVG линия поверх */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Заливка под линией */}
        <polygon
          points={`0,100 ${points} 100,100`}
          fill={`url(#grad-${dataKey})`}
        />
        {/* Линия */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Точки на линии */}
        {values.map((v, i) => {
          const x = (i / (values.length - 1)) * 100
          const y = 100 - (v / max) * 85
          return (
            <circle key={i} cx={x} cy={y} r="2.5" fill={color} stroke="white" strokeWidth="1.5" />
          )
        })}
      </svg>
    </div>
  )
}

// ── Площадка с прогресс-баром ────────────────────────────────────────────────
function PlatformRow({ platform, impressions, reach, spend, total }) {
  const pct = total > 0 ? Math.round((impressions / total) * 100) : 0
  const icon = platform === 'Facebook' ? '📘' : platform === 'Instagram' ? '📸' : platform === 'Messenger' ? '💬' : '🌐'

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{icon} {platform}</span>
        <span style={{ color: 'var(--text2)', fontSize: 13 }}>{impressions.toLocaleString('ru-RU')} показов · ${spend}</span>
      </div>
      <div style={{ height: 7, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 4,
          background: platform === 'Instagram'
            ? 'linear-gradient(90deg, #f09433, #e6683c, #dc2743, #cc2366)'
            : 'linear-gradient(90deg, #1877f2, #007AFF)',
          transition: 'width 0.6s ease'
        }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
        Охват: {reach.toLocaleString('ru-RU')} · {pct}% от общего
      </div>
    </div>
  )
}

// ── Главный компонент ────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [error, setError] = useState('')
  const [chartMetric, setChartMetric] = useState('impressions')
  const [autopilot, setAutopilot] = useState(true)

  const fallbackStats = {
    spend: '0.00', leads: 0, cpl: '0.00',
    impressions: '0', reach: '0', clicks: '0',
    currency: '$', daily: [], platforms: []
  }

  useEffect(() => { fetchStats() }, [period])

  async function fetchStats() {
    setLoading(true)
    try {
      const WebApp = window.Telegram?.WebApp
      const tgData = WebApp?.initData || ''
      let userId = localStorage.getItem('luna_tg_userid')
      if (!userId && WebApp?.initDataUnsafe?.user?.id) {
        userId = WebApp.initDataUnsafe.user.id.toString()
        localStorage.setItem('luna_tg_userid', userId)
      }
      const res = await fetch(`${API}/api/stats?days=${period}`, {
        headers: { 'x-tg-data': tgData, 'x-tg-userid': userId || '' }
      })
      const data = await res.json()
      if (!res.ok || data?.error) {
        setStats(fallbackStats)
        setError(t('dashboard.no_data'))
      } else {
        setStats(data)
        setError('')
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setStats(fallbackStats)
      setError(t('dashboard.no_data'))
    }
    setLoading(false)
  }

  const currency = stats?.currency || '$'
  const spend    = stats?.spend ?? '0.00'
  const leads    = stats?.leads ?? 0
  const cpl      = stats?.cpl ?? '0.00'
  const impressions = stats?.impressions ?? '0'
  const reach    = stats?.reach ?? '0'
  const clicks   = stats?.clicks ?? '0'
  const daily    = stats?.daily || []
  const platforms = stats?.platforms || []
  const totalImpressions = platforms.reduce((s, p) => s + p.impressions, 0)

  const METRICS = stats ? [
    { label: t('dashboard.metric.spend'),       value: `${currency}${spend}`,  icon: '💸', color: '#ef4444' },
    { label: t('dashboard.metric.impressions'), value: impressions,             icon: '👁',  color: '#f59e0b' },
    { label: 'Охват',                           value: reach,                   icon: '📡', color: '#007AFF' },
    { label: 'Клики',                           value: clicks,                  icon: '🖱',  color: '#22c55e' },
    { label: t('dashboard.metric.leads'),       value: leads,                   icon: '💬', color: '#06b6d4' },
    { label: t('dashboard.metric.cpl'),         value: `${currency}${cpl}`,    icon: '🎯', color: '#ec4899' },
  ] : []

  const chartMetrics = [
    { key: 'impressions', label: 'Показы',  color: '#f59e0b' },
    { key: 'reach',       label: 'Охват',   color: '#007AFF' },
    { key: 'clicks',      label: 'Клики',   color: '#22c55e' },
    { key: 'spend',       label: 'Расход',  color: '#ef4444' },
  ]
  const activeChart = chartMetrics.find(m => m.key === chartMetric) || chartMetrics[0]

  return (
    <div className={styles.page}>

      {/* ── Шапка ── */}
      <div className={styles.header}>
        <div>
          <div className={styles.logo}>Luna Ads</div>
          <div className={styles.sub}>{t('dashboard.subtitle')}</div>
        </div>
        <div className={styles.periodWrap}>
          {['7', '14', '30'].map(d => (
            <button
              key={d}
              className={`${styles.periodBtn} ${period === d ? styles.periodActive : ''}`}
              onClick={() => setPeriod(d)}
            >
              {d} {t('period.days_short')}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI карточки ── */}
      <div className={styles.grid}>
        {loading
          ? Array(6).fill(0).map((_, i) => (
              <div key={i} className={styles.card}>
                <div className="skeleton" style={{ height: 13, width: 60, marginBottom: 12, borderRadius: 6 }} />
                <div className="skeleton" style={{ height: 30, width: 80, borderRadius: 6 }} />
              </div>
            ))
          : METRICS.map((m, i) => (
              <div key={i} className={`${styles.card} fade-up`} style={{ animationDelay: `${i * 0.07}s` }}>
                <div className={styles.metricLabel}>{m.icon} {m.label}</div>
                <div className={styles.metricValue} style={{ color: m.color }}>{m.value}</div>
              </div>
            ))
        }
      </div>

      {!loading && error && (
        <div style={{ marginTop: 8, color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
          {error}
        </div>
      )}

      {/* ── График динамики ── */}
      {!loading && (
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              📈 Динамика за {period} дней
            </div>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', padding: 4, borderRadius: 10 }}>
              {chartMetrics.map(m => (
                <button
                  key={m.key}
                  onClick={() => setChartMetric(m.key)}
                  style={{
                    fontSize: 11, padding: '4px 9px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    background: chartMetric === m.key ? m.color : 'transparent',
                    color: chartMetric === m.key ? '#fff' : 'var(--text2)',
                    fontWeight: chartMetric === m.key ? 700 : 500,
                    transition: 'all 0.2s'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {daily.length > 0 ? (
            <>
              <ComboChart data={daily} dataKey={activeChart.key} color={activeChart.color} height={120} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{daily[0]?.date?.slice(5)}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{daily[Math.floor(daily.length / 2)]?.date?.slice(5)}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{daily[daily.length - 1]?.date?.slice(5)}</span>
              </div>
            </>
          ) : (
            <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Нет данных за период
            </div>
          )}
        </div>
      )}

      {/* ── Площадки ── */}
      {!loading && platforms.length > 0 && (
        <div className={styles.platformSection}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            📊 Площадки
          </div>
          {platforms.map((p, i) => (
            <PlatformRow key={i}
              platform={p.platform} impressions={p.impressions}
              reach={p.reach} spend={p.spend} total={totalImpressions}
            />
          ))}
        </div>
      )}

      {/* ── AI Autopilot ── */}
      <div className={`${styles.autopilot} fade-up-3`}>
        <div className={styles.autopilotTop}>
          <div>
            <div className={styles.autopilotTitle}>{t('dashboard.autopilot.title')}</div>
            <div className={styles.autopilotSub}>{t('dashboard.autopilot.sub')}</div>
          </div>
          {/* Кликабельный тоггл */}
          <div
            onClick={() => setAutopilot(v => !v)}
            style={{
              width: 48, height: 28, borderRadius: 14, cursor: 'pointer',
              background: autopilot ? '#007AFF' : 'var(--bg3)',
              position: 'relative', transition: 'background 0.25s', flexShrink: 0
            }}
          >
            <div style={{
              position: 'absolute', top: 4,
              left: autopilot ? 24 : 4,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              transition: 'left 0.25s'
            }} />
          </div>
        </div>
      </div>

      {/* ── Кнопка запуска ── */}
      <div className={`${styles.btnWrap} fade-up-4`}>
        <button className={styles.launchBtn} onClick={() => navigate('/create')}>
          {t('dashboard.launch')}
        </button>
        <div className={styles.hint}>{t('dashboard.hint')}</div>
      </div>

    </div>
  )
}
