import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import CampaignDetails from './pages/CampaignDetails'
import CreateAd from './pages/CreateAd'
import Connect from './pages/Connect'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Profile from './pages/Profile'
import Layout from './components/Layout'
import { I18nProvider } from './i18n'

const tg = window.Telegram?.WebApp
const API_URL = import.meta.env.VITE_API_URL || ''

function AppRoutes({ isConnected, onConnect }) {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('fb_token')
    if (!token) return

    // Если токен пришел в URL (например, из старого флоу или отладки), 
    // мы все равно полагаемся на проверку бэкенда по tg_id, 
    // но можем вызвать onConnect для немедленного перехода.
    onConnect()
    navigate('/', { replace: true })
  }, [location.search, navigate, onConnect])

  return (
    <Routes>
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/connect" element={<Connect onConnect={onConnect} />} />
      <Route element={<Layout />}>
        <Route path="/" element={isConnected ? <Dashboard /> : <Navigate to="/connect" />} />
        <Route path="/campaigns" element={isConnected ? <Campaigns /> : <Navigate to="/connect" />} />
        <Route path="/campaigns/:id" element={isConnected ? <CampaignDetails /> : <Navigate to="/connect" />} />
        <Route path="/create" element={isConnected ? <CreateAd /> : <Navigate to="/connect" />} />
        <Route path="/profile" element={isConnected ? <Profile /> : <Navigate to="/connect" />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const [isReady, setIsReady] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  const checkAuth = useCallback(async () => {
    try {
      const tgUserId = tg?.initDataUnsafe?.user?.id
      if (!tgUserId) {
        setIsReady(true)
        return
      }

      const headers = {
        'x-tg-data': tg.initData || '',
        'x-tg-userid': String(tgUserId)
      }

      const res = await fetch(`${API_URL}/api/profile`, { headers })
      if (res.ok) {
        const data = await res.json()
        // Если у пользователя есть ad_account_id, значит Facebook подключен
        if (data.ad_account_id) {
          setIsConnected(true)
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err)
    } finally {
      setIsReady(true)
    }
  }, [])

  useEffect(() => {
    if (tg) {
      tg.ready()
      tg.expand()
      tg.setHeaderColor('#ffffff')
      tg.setBackgroundColor('#F9FAFB')
    }
    checkAuth()
  }, [checkAuth])

  if (!isReady) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#F9FAFB'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid #007AFF', borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )

  return (
    <BrowserRouter>
      <I18nProvider>
        <AppRoutes isConnected={isConnected} onConnect={() => setIsConnected(true)} />
      </I18nProvider>
    </BrowserRouter>
  )
}
