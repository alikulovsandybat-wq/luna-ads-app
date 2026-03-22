import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Dashboard.module.css'
import { useI18n } from '../i18n'

const API = import.meta.env.VITE_API_URL || ''

// Обновленный график (теперь выше и чище)
function BarChart({ data, dataKey, color = '#007AFF', height = 120 }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d[dataKey] || 0), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, paddingTop: 20 }}>
      {data.map((d, i) => {
        const pct = ((d[dataKey] || 0) / max) * 100
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <div
              style={{
                width: '100%',
                height: `${Math.max(pct, 4)}%`,
                background: color,
                borderRadius: '4px 4px 0 0',
                opacity: 0.9,
                transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              title={`${d.date}: ${d[dataKey]}`}
            />
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7')
  const [chartMetric, setChartMetric] = useState('impressions')

  useEffect(() => {
    fetchStats()
  }, [period])

  async function fetchStats() {
    setLoading(true)
    try {
      const tgData = window.Telegram?.WebApp?.initData || ''
      const res = await fetch(`${API}/api/stats?days=${period}`, {
        headers: { 'x-tg-data': tgData }
      })
      const data = await res.json()
      setStats(data || {})
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const daily = stats?.daily || []
  const currency = stats?.currency || '$'

  const METRICS = [
    { label: 'Spend', value: `${currency}${stats?.spend || '0'}`, icon: '💸', color: '#007AFF' },
    { label: 'Leads', value: stats?.leads || '0', icon: '🎯', color: '#10B981' },
    { label: 'CPL', value: `${currency}${stats?.cpl || '0'}`, icon: '💰', color: '#6366F1' },
    { label: 'Clicks', value: stats?.clicks || '0', icon: '🖱', color: '#F59E0B' },
  ]

  return (
    <div className={styles.page}>
      {/* HEADER С ПРОФИЛЕМ (как на рефе 12) */}
      <div className={styles.topProfile}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>🌙</div>
          <div>
            <div className={styles.userName}>Ad Account #1493...</div>
            <div className={styles.userStatus}>Elite Plan • Active</div>
          </div>
        </div>
        <div className={styles.periodSelector}>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
      </div>

      {/* KPI GRID */}
      <div className={styles.grid}>
        {METRICS.map((m, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.metricLabel}>{m.icon} {m.label}</div>
            <div className={styles.metricValue}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* CHART BOX */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <h3>Analytics Dynamic</h3>
          <div className={styles.chartTabs}>
            <button onClick={() => setChartMetric('impressions')} className={chartMetric === 'impressions' ? styles.activeTab : ''}>Views</button>
            <button onClick={() => setChartMetric('spend')} className={chartMetric === 'spend' ? styles.activeTab : ''}>Spend</button>
          </div>
        </div>
        <BarChart data={daily} dataKey={chartMetric} height={140} />
      </div>

      {/* ACTION BUTTONS */}
      <div className={styles.actions}>
        <button className={styles.primaryBtn} onClick={() => navigate('/create')}>
          <span>🚀</span> Create New Campaign
        </button>
        <button className={styles.secondaryBtn} onClick={() => navigate('/billing')}>
          <span>💳</span> Upgrade Subscription
        </button>
      </div>
    </div>
  )
}
