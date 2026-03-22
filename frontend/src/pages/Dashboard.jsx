import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Dashboard.module.css'
import { useI18n } from '../i18n'

// --- НОВЫЕ ИМПОРТЫ ДЛЯ ГРАФИКА (Это мы оставляем) ---
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
// ----------------------------------------------------

const API = import.meta.env.VITE_API_URL || ''

export default function Dashboard() {
  const { t } = useI18n() // ВАЖНО: Убедись, что это работает
  const navigate = useNavigate()
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
      const tgData = window.Telegram?.WebApp?.initData || localStorage.getItem('luna_tg_data') || ''
      const res = await fetch(`${API}/api/stats?days=${period}`, {
        headers: { 
          'x-tg-data': tgData,
          'x-tg-userid': localStorage.getItem('luna_tg_userid') || '' 
        }
      })
      const data = await res.json()
      setStats(data || {})
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  // --- ПОДГОТОВКА ДАННЫХ ДЛЯ ГРАФИКА (Оставляем) ---
  const daily = stats?.daily || []
  const chartData = {
    labels: daily.map(d => d.date),
    datasets: [
      {
        fill: true,
        label: chartMetric === 'impressions' ? 'Views' : 'Spend',
        data: daily.map(d => d[chartMetric]),
        borderColor: '#007AFF', 
        backgroundColor: 'rgba(0, 122, 255, 0.1)', 
        tension: 0.4, // ПЛАВНОСТЬ ОСТАВЛЯЕМ
        borderWidth: 3,
        pointRadius: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
      x: { display: false } 
    }
  };
  // ----------------------------------------------------

  const currency = stats?.currency || '$'
  
  // ВОЗВРАЩАЕМ СТАРУЮ СТРУКТУРУ METRICS
  const METRICS = [
    { label: t('dashboard.metric.spend'), value: `${currency}${stats?.spend || '0'}`, icon: '💸', color: '#007AFF' },
    { label: t('dashboard.metric.leads'), value: stats?.leads || '0', icon: '🎯', color: '#10B981' },
    { label: t('dashboard.metric.cpl'), value: `${currency}${stats?.cpl || '0'}`, icon: '💰', color: '#6366F1' },
    { label: t('dashboard.metric.clicks'), value: stats?.clicks || '0', icon: '🖱', color: '#F59E0B' },
  ]

  return (
    <div className={styles.page}>
      {/* ВОЗВРАЩАЕМ СТАРЫЙ HEADER С ПРОФИЛЕМ */}
      <div className={styles.topProfile}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>🌙</div>
          <div>
            <div className={styles.userName}>Ad Account #{stats?.account_id || '1493...'}</div>
            <div className={styles.userStatus}>Elite Plan • Active</div>
          </div>
        </div>
        <div className={styles.periodSelector}>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="7">{t('dashboard.period.7days')}</option>
            <option value="30">{t('dashboard.period.30days')}</option>
          </select>
        </div>
      </div>

      {/* ВОЗВРАЩАЕМ KPI GRID С ЦВЕТАМИ */}
      <div className={styles.grid}>
        {METRICS.map((m, i) => (
          <div key={i} className={styles.card} style={{ borderTop: `4px solid ${m.color}` }}>
            <div className={styles.metricLabel}>{m.icon} {m.label}</div>
            <div className={styles.metricValue}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* СЕКЦИЯ ГРАФИКА */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <h3>{t('dashboard.chart.title')}</h3>
          <div className={styles.chartTabs}>
            <button 
              onClick={() => setChartMetric('impressions')} 
              className={chartMetric === 'impressions' ? styles.activeTab : ''}
            >{t('dashboard.chart.views')}</button>
            <button 
              onClick={() => setChartMetric('spend')} 
              className={chartMetric === 'spend' ? styles.activeTab : ''}
            >{t('dashboard.chart.spend')}</button>
          </div>
        </div>
        
        {/* НОВЫЙ ПЛАВНЫЙ ГРАФИК */}
        <div style={{ height: 160, marginTop: 10 }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* ВОЗВРАЩАЕМ СТАРЫЕ КНОПКИ ДЕЙСТВИЙ */}
      <div className={styles.actions}>
        <button className={styles.primaryBtn} onClick={() => navigate('/create')}>
          <span>🚀</span> {t('dashboard.btn.create')}
        </button>
        <button className={styles.secondaryBtn} onClick={() => navigate('/billing')}>
          <span>💳</span> {t('dashboard.btn.upgrade')}
        </button>
      </div>
    </div>
  )
}
