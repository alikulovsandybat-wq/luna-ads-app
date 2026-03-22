import { useEffect, useState } from 'react'
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

function AppRoutes({ isConnected, onConnect }) {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('fb_token')
    if (!token) return
    localStorage.setItem('fb_connected', '1')
    localStorage.setItem('fb_token', token)
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

  useEffect(() => {
    if (tg) {
      tg.ready()
      tg.expand()
      tg.setHeaderColor('#ffffff')
      tg.setBackgroundColor('#F9FAFB')
    }

    const fbConnected = localStorage.getItem('fb_connected')
    setIsConnected(!!fbConnected)
    setIsReady(true)
  }, [])

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
