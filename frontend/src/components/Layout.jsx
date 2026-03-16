import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import styles from './Layout.module.css'
import { useI18n } from '../i18n'
import LanguageSwitcher from './LanguageSwitcher'

const NAV = [
  { path: '/', icon: '◈', labelKey: 'nav.home' },
  { path: '/campaigns', icon: '◉', labelKey: 'nav.campaigns' },
  { path: '/create', icon: '＋', labelKey: 'nav.create' }
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <LanguageSwitcher />
        <Outlet />
      </main>
      <nav className={styles.nav}>
        {NAV.map(item => (
          <button
            key={item.path}
            className={`${styles.navBtn} ${location.pathname === item.path ? styles.active : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{t(item.labelKey)}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}