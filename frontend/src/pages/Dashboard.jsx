import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Dashboard.module.css'
import { useI18n } from '../i18n'

// --- НОВЫЕ ИМПОРТЫ ДЛЯ ПЛАВНОГО ГРАФИКА ---
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler, Legend
);
// ------------------------------------------

const API = import.meta.env.VITE_API_URL || ''

// Твой старый BarChart мы заменяем на этот современный LineChart внутри компонента
function LineChart({ data, dataKey, color = '#7c5cfc' }) {
  if (!data || data.length === 0) return null;

  const chartData = {
    labels: data.map(d => d.date?.slice(5) || ''),
    datasets: [
      {
        fill: true,
        data: data.map(d => d[dataKey] || 0),
        borderColor: color,
        backgroundColor: `${color}1A`, // 10% прозрачности
        tension: 0.4, // Та самая плавность волны
        borderWidth: 3,
        pointRadius: 0, // Чистая линия без точек
        pointHoverRadius: 5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      y: { display: false, beginAtZero: true },
      x: { display: false }
    }
  };

  return (
    <div style={{ height: 100, marginTop: 10 }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

function PlatformRow({ platform, impressions, reach, spend, total }) {
  const pct = total > 0 ? Math.round((impressions / total) * 100) : 0
  const icon = platform === 'Facebook' ? '📘' : platform === 'Instagram' ? '📸' : platform === 'Messenger' ? '💬' : '🌐'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{icon} {platform}</span>
        <span style={{ color: 'var(--text2)' }}>{impressions.toLocaleString('ru-RU')} показов · ${spend}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 4,
          background: platform === 'Instagram'
            ? 'linear-gradient(90deg, #f09433, #e6683c, #dc2743, #cc2366)'
            : 'linear-gradient(90deg, #1877f2, #7c5cfc)',
          transition: 'width 0.6s ease'
        }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
        Охват: {reach.toLocaleString('ru-RU')} · {pct}% от общего
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7')
  const [error, setError] = useState('')
  const [chartMetric, setChartMetric] = useState('impressions')

  const fallbackStats = {
    spend: '0.00', leads: 0, cpl: '0.00',
    impressions: '0', reach: '0', clicks: '0',
    currency: '$', daily: [], platforms: []
  }

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
      if (!res.ok || data?.error) {
        setStats(fallbackStats)
        setError(t('dashboard.no_data'))
      } else {
        setStats(data)
        setError('')
      }
    } catch {
      setStats(fallbackStats)
      setError(t('dashboard.no_data'))
    }
    setLoading(false)
  }

  const currency = stats?.currency || '$'
  const spend = stats?.spend ?? '0.00'
  const leads = stats?.leads ?? 0
  const cpl = stats?.cpl ?? '0.00'
  const impressions = stats?.impressions ?? '0'
  const reach = stats?.reach ?? '0'
  const clicks = stats?.clicks ?? '0'
  const daily = stats?.daily || []
  const platforms = stats?.platforms || []
  const totalImpressions = platforms.reduce((s, p) => s + p.impressions, 0)

  const METRICS = stats ? [
    { label: t('dashboard.metric.spend'), value: `${currency}${spend}`, icon: '💸', color: '#ef4444', key: 'spend' },
    { label: t('dashboard.metric.impressions'), value: impressions, icon: '👁', color: '#f59e0b', key: 'impressions' },
    { label: 'Охват', value: reach, icon: '📡', color: '#7c5cfc', key: 'reach' },
    { label: 'Клики', value: clicks, icon: '🖱', color: '#22c55e', key: 'clicks' },
    { label: t('dashboard.metric.leads'), value: leads, icon: '💬', color: '#06b6d4', key: 'leads' },
    { label: t('dashboard.metric.cpl'), value: `${currency}${cpl}`, icon: '🎯', color: '#ec4899', key: 'cpl' },
  ] : []

  const chartMetrics = [
    { key: 'impressions', label: 'Показы', color: '#f59e0b' },
    { key: 'reach', label: 'Охват', color: '#7c5cfc' },
    { key: 'clicks', label: 'Клики', color: '#22c55e' },
    { key: 'spend', label: 'Расход', color: '#ef4444' },
  ]
  const activeChart = chartMetrics.find(m => m.key === chartMetric) || chartMetrics[0]

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
          ? Array(6).fill(0).map((_, i) => (
              <div key={i} className={styles.card}>
                <div className="skeleton" style={{ height: 12, width: 60, marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 28, width: 80 }} />
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
        <div style={{ marginTop: 8, color: 'var(--text2)', fontSize: 12 }}>{error}</div>
      )}

      {/* CHART С НОВЫМ ПЛАВНЫМ ГРАФИКОМ */}
      {!loading && daily.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '16px', marginTop: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              📈 Динамика за {period} дней
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {chartMetrics.map(m => (
                <button
                  key={m.key}
                  onClick={() => setChartMetric(m.key)}
                  style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: chartMetric === m.key ? m.color : 'rgba(255,255,255,0.07)',
                    color: chartMetric === m.key ? '#000' : 'var(--text2)',
                    fontWeight: chartMetric === m.key ? 700 : 400,
                    transition: 'all 0.2s'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          
          <LineChart data={daily} dataKey={activeChart.key} color={activeChart.color} />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>{daily[0]?.date?.slice(5)}</span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>{daily[Math.floor(daily.length / 2)]?.date?.slice(5)}</span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>{daily[daily.length - 1]?.date?.slice(5)}</span>
          </div>
        </div>
      )}

      {/* ТВОИ ПЛОЩАДКИ — ТЕПЕРЬ ОНИ ВЕРНУТСЯ! */}
      {!loading && platforms.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '16px', marginTop: 12
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
            📊 Площадки
          </div>
          {platforms.map((p, i) => (
            <PlatformRow
              key={i}
              platform={p.platform}
              impressions={p.impressions}
              reach={p.reach}
              spend={p.spend}
              total={totalImpressions}
            />
          ))}
        </div>
      )}

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
