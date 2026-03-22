import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Dashboard.module.css'
import { useI18n } from '../i18n'

// --- ИМПОРТЫ ДЛЯ НОВОГО ПЛАВНОГО ГРАФИКА ---
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

const API = import.meta.env.VITE_API_URL || ''

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
      // Пытаемся взять данные из LocalStorage если мы в браузере, или из TG
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

  // --- ПОДГОТОВКА ДАННЫХ ДЛЯ ГРАФИКА ---
  const daily = stats?.daily || []
  const chartData = {
    labels: daily.map(d => d.date),
    datasets: [
      {
        fill: true,
        label: chartMetric === 'impressions' ? 'Views' : 'Spend',
        data: daily.map(d => d[chartMetric]),
        borderColor: '#007AFF', // Цвет линии
        backgroundColor: 'rgba(0, 122, 255, 0.1)', // Заливка под линией
        tension: 0.4, // ЭТО ДЕЛАЕТ ЛИНИЮ ПЛАВНОЙ (как ты просила!)
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
      x: { display: false } // Скрываем даты внизу для чистоты, как на рефе
    }
  };

  const currency = stats?.currency || '$'
  const METRICS = [
    { label: 'Spend', value: `${currency}${stats?.spend || '0'}`, icon: '💸' },
    { label: 'Leads', value: stats?.leads || '0', icon: '🎯' },
    { label: 'CPL', value: `${currency}${stats?.cpl || '0'}`, icon: '💰' },
    { label: 'Clicks', value: stats?.clicks || '0', icon: '🖱' },
  ]

  return (
    <div className={styles.page}>
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
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
      </div>

      <div className={styles.grid}>
        {METRICS.map((m, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.metricLabel}>{m.icon} {m.label}</div>
            <div className={styles.metricValue}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <h3>Analytics Dynamic</h3>
          <div className={styles.chartTabs}>
            <button 
              onClick={() => setChartMetric('impressions')} 
              className={chartMetric === 'impressions' ? styles.activeTab : ''}
            >Views</button>
            <button 
              onClick={() => setChartMetric('spend')} 
              className={chartMetric === 'spend' ? styles.activeTab : ''}
            >Spend</button>
          </div>
        </div>
        
        {/* ЗАМЕНИЛИ BarChart НА НАСТОЯЩУЮ ЛИНИЮ */}
        <div style={{ height: 160, marginTop: 10 }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

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
