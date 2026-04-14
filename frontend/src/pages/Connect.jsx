import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Connect.module.css'
import { useI18n } from '../i18n'
import LanguageSwitcher from '../components/LanguageSwitcher'

const API = import.meta.env.VITE_API_URL || ''
const FB_APP_ID = import.meta.env.VITE_FB_APP_ID || '795668556422629'

export default function Connect({ onConnect }) {
  const navigate = useNavigate()
  const { t } = useI18n()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('fb_token')
    
    if (token === 'ok') {
      // Чистим URL
      window.history.replaceState({}, '', '/')
      onConnect()
      navigate('/')
    }
  }, [navigate, onConnect])

  function connectFacebook() {
    const tg = window.Telegram?.WebApp
    const tgUserId = tg?.initDataUnsafe?.user?.id
    
    if (!tgUserId) {
      alert('Ошибка: Не удалось получить ID пользователя Telegram')
      return
    }

    const redirectUri = `${API}/api/auth/facebook/callback`
    const scope = 'ads_management,ads_read,business_management'
    const state = String(tgUserId)

    const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&response_type=code`

    if (tg?.openLink) {
      tg.openLink(url, { try_instant_view: false })
    } else {
      window.open(url, '_blank')
    }
  }

  const features = [
    t('connect.feature.metrics'),
    t('connect.feature.launch'),
    t('connect.feature.ai'),
    t('connect.feature.target')
  ]

  return (
    <div className={styles.page}>
      <div className={styles.langWrapper}>
        <LanguageSwitcher className={styles.langSelect} />
      </div>

      <div className={styles.inner}>
        <div className={styles.logo}>🌙</div>
        <h1 className={styles.title}>Luna Ads</h1>
        <p className={styles.sub}>{t('connect.subtitle')}</p>

        <div className={styles.features}>
          {features.map((feature, index) => (
            <div key={index} className={styles.feature}>
              <span style={{color: 'var(--green)'}}>✓</span> {feature}
            </div>
          ))}
        </div>

        <button className={styles.connectBtn} onClick={connectFacebook}>
          {t('connect.button')}
        </button>

        <p className={styles.hint}>{t('connect.hint')}</p>

        <div className={styles.legalLinks}>
          <a href="/privacy" target="_blank" rel="noreferrer">{t('connect.privacy')}</a>
          <a href="/terms" target="_blank" rel="noreferrer">{t('connect.terms')}</a>
        </div>
      </div>
    </div>
  )
}
