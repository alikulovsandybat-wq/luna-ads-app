import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Dashboard.module.css'
import { useI18n } from '../i18n'

// Импорты для графика
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

// Компонент плавного графика
function SmoothLineChart({ data, dataKey, color = '#7c5cfc' }) {
  if (!data || data.length === 0) return null;
  const chartData = {
    labels: data.map(d => d.date?.slice(5) || ''),
    datasets: [{
      fill: true,
      data: data.map(d => d[dataKey] || 0),
      borderColor: color,
      backgroundColor: `${color}1A`, 
      tension: 0.4, 
      borderWidth: 3,
      pointRadius: 0,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { display: false }, x: { display: false } }
  };
  return <div style={{ height: 100, marginTop: 10 }}><Line data={chartData} options={options} /></div>;
}

function PlatformRow({ platform, impressions, reach, spend, total }) {
  const pct = total > 0 ? Math.round((impressions / total) * 100) : 0
  const icon = platform === 'Facebook' ? '📘' : platform === 'Instagram' ? '📸' : '🌐'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{icon} {platform}</span>
        <span style={{ color: 'var(--text2)' }}>{impressions.toLocaleString('ru-RU')} показов</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #1877f2, #7c5cfc)' }} />
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
  const [chartMetric, setChartMetric] = useState('impressions')

  // Твоя ОРИГИНАЛЬНАЯ функция загрузки данных
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
      console.error("Ошибка загрузки:", e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchStats() }, [period])

  const daily = stats?.daily || []
  const platforms = stats?.platforms || []
  const totalImpressions = platforms.reduce((s, p) => s + p.impressions, 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.logo}>Luna Ads</div>
          <div className={styles.sub}>{t('dashboard.subtitle')}</div>
        </div>
        <div className={styles.periodWrap}>
          {['7', '14', '30'].map(d => (
            <button key={d} className={`${styles.periodBtn} ${period === d ? styles.periodActive : ''}`} onClick={() => setPeriod(d)}>
              {d} {t('period.days_short')}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.metricLabel}>💸 {t('dashboard.metric.spend')}</div>
          <div className={styles.metricValue} style={{ color: '#ef4444' }}>${stats?.spend || '0.00'}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.metricLabel}>👁 {t('dashboard.metric.impressions')}</div>
          <div className={styles.metricValue} style={{ color: '#f59e0b' }}>{stats?.impressions || '0'}</div>
        </div>
        {/* Добавь остальные свои карточки по аналогии */}
      </div>

      {!loading && daily.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>📈 Динамика</span>
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => setChartMetric('impressions')} style={{ fontSize: 10 }}>Показы</button>
              <button onClick={() => setChartMetric('spend')} style={{ fontSize: 10 }}>Расход</button>
            </div>
          </div>
          <SmoothLineChart data={daily} dataKey={chartMetric} />
        </div>
      )}

      {/* Твои площадки и кампании */}
      {!loading && platforms.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>📊 Площадки</div>
          {platforms.map((p, i) => (
            <PlatformRow key={i} platform={p.platform} impressions={p.impressions} total={totalImpressions} />
          ))}
        </div>
      )}

      <button className={styles.launchBtn} onClick={() => navigate('/create')} style={{ marginTop: 20 }}>
        {t('dashboard.launch')}
      </button>
    </div>
  )
}
