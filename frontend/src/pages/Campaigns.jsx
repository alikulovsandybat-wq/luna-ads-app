import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Campaigns.module.css'
import { useI18n } from '../i18n'

const API = import.meta.env.VITE_API_URL || ''

export default function Campaigns() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

      if (!res.ok || data?.error) {
        setCampaigns([])
        setError(t('campaigns.empty'))
      } else {
        const list = data.campaigns || []
        setCampaigns(list)
        setError(list.length ? '' : t('campaigns.empty'))
      }
    } catch {
      setCampaigns([])
      setError(t('campaigns.empty'))
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

      {!loading && !campaigns.length && (
        <div style={{marginTop:12,color:'var(--text2)',fontSize:12}}>{error || t('campaigns.empty')}</div>
      )}
    </div>
  )
}
