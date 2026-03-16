import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Campaigns.module.css'
import { useI18n } from '../i18n'

const API = import.meta.env.VITE_API_URL || ''

const MOCK = [
  { id: 1, date: '24/11/2025', name: 'Уличная кофейня', spend: '$2.63', leads: 1, cpl: '$2.63', budget: '$6.1', active: true },
  { id: 2, date: '20/09/2025', name: 'Умная Кофейня', spend: '$11.14', leads: 11, cpl: '$1.01', budget: '$36.0', active: true },
  { id: 3, date: '09/17/2025', name: 'Кофейный Бизнес', spend: '$11.62', leads: 11, cpl: '$1.66', budget: '$38.3', active: true },
  { id: 4, date: '19/09/2025', name: 'Бизнес на потоке', spend: '$0.00', leads: 0, cpl: '$0.00', budget: '$0.00', active: false }
]

export default function Campaigns() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  async function fetchCampaigns() {
    setLoading(true)
    try {
      const tgData = window.Telegram?.WebApp?.initData || ''
      const res = await fetch(`${API}/api/campaigns`, {
        headers: { 'x-tg-data': tgData }
      })
      const data = await res.json()
      setCampaigns(data.campaigns || MOCK)
    } catch {
      setCampaigns(MOCK)
    }
    setLoading(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('campaigns.title')}</h1>
      </div>

      {loading
        ? Array(3).fill(0).map((_, i) => (
            <div key={i} className={styles.card}>
              <div className="skeleton" style={{height:12,width:'60%',marginBottom:12}} />
              <div className="skeleton" style={{height:16,width:'80%',marginBottom:12}} />
              <div className="skeleton" style={{height:10,width:'40%'}} />
            </div>
          ))
        : campaigns.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.card} ${styles.cardLink} fade-up`}
              style={{animationDelay:`${i*0.06}s`}}
              onClick={() => navigate(`/campaigns/${c.id}`)}
            >
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.date}>{c.date}</div>
                  <div className={styles.name}>{c.name}</div>
                </div>
                <div className={`${styles.toggle} ${c.active ? styles.on : ''}`} />
              </div>
              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <div className={styles.mLabel}>{t('campaigns.spend')}</div>
                  <div className={styles.mValue}>{c.spend}</div>
                </div>
                <div className={styles.metric}>
                  <div className={styles.mLabel}>{t('campaigns.leads')}</div>
                  <div className={styles.mValue}>{c.leads}</div>
                </div>
                <div className={styles.metric}>
                  <div className={styles.mLabel}>{t('campaigns.cost')}</div>
                  <div className={styles.mValue}>{c.cpl}</div>
                </div>
              </div>
              <div className={styles.budget}>{t('campaigns.daily_budget')}: {c.budget}</div>
            </button>
          ))
      }
    </div>
  )
}