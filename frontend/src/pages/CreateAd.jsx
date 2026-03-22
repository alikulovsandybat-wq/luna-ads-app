import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './CreateAd.module.css'
import { useI18n } from '../i18n'

const API = import.meta.env.VITE_API_URL || ''

function base64ToFile(base64, mimeType, fileName) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], fileName, { type: mimeType })
}

function notify(message, callback) {
  if (window.Telegram?.WebApp?.showAlert) {
    window.Telegram.WebApp.showAlert(message, callback)
    return
  }
  window.alert(message)
  callback?.()
}

export default function CreateAd() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const photoInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const [step, setStep] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [launching, setLaunching] = useState(false)

  const steps = [
    t('create.step.budget_geo'),
    t('create.step.audience'),
    t('create.step.creative'),
    t('create.step.launch')
  ]

  const [form, setForm] = useState({
    budget: '10',
    geo: '',
    ageMin: '18',
    ageMax: '45',
    interests: '',
    productDesc: '',
    headline: '',
    text: '',
    imagePrompt: '',
    image: null,
    imagePreview: null,
    mediaType: null,
    mediaName: '',
    creativeType: 'photo',
    ctaType: 'MESSAGE_PAGE',
    whatsappNumber: '',
    ctaUrl: '',
    aiInterests: []
  })

  function update(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  // Общий метод для получения заголовков (Safari + TG)
  const getAuthHeaders = () => ({
    'x-tg-data': window.Telegram?.WebApp?.initData || '',
    'x-tg-userid': localStorage.getItem('luna_tg_userid') || ''
  })

  async function generateAI() {
    if (!form.productDesc) return
    setGenerating(true)
    try {
      const res = await fetch(`${API}/api/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders() 
        },
        body: JSON.stringify({ description: form.productDesc, geo: form.geo })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'AI text failed')

      update('headline', data.headline)
      update('text', data.text)
      if (data.interests?.length) {
        update('aiInterests', data.interests)
        update('interests', data.interests.join(', '))
      }
    } catch (error) {
      notify(error?.message || t('create.notify.ai_text_fail'))
    } finally {
      setGenerating(false)
    }
  }

  async function generateImageAI() {
    if (!form.productDesc && !form.imagePrompt) return
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 80000)

    setGeneratingImage(true)
    try {
      const fd = new FormData()
      fd.append('prompt', form.imagePrompt)
      fd.append('description', form.productDesc)
      fd.append('headline', form.headline)
      fd.append('text', form.text)
      fd.append('geo', form.geo)
      
      if (form.image && form.mediaType !== 'video') {
        fd.append('reference_image', form.image)
      }

      async function launch() {
    // ... твой код проверок (CTA, URL и т.д.) ...

    setLaunching(true)
    try {
      const fd = new FormData()
      // ... здесь твои append (budget, geo, headline и т.д.) ...
      if (form.image) fd.append('image', form.image)

      const res = await fetch(`${API}/api/launch`, {
        method: 'POST',
        headers: getAuthHeaders(), // ЗАМЕНИ НА ЭТО
        body: fd
      })
      
      const data = await res.json()
      if (!res.ok || !data.success) {
        notify(data.error || t('create.notify.launch_error'))
        return
      }
      notify(t('create.notify.launch_success'), () => navigate('/campaigns'))
    } catch (err) {
      notify(t('create.notify.launch_error') + ': ' + (err.message || ''))
    } finally {
      setLaunching(false)
    }
  }

  // ... остальная часть функций (handleMedia, selectCreative, launch) остается без изменений, 
  // но в launch() тоже замени заголовки на getAuthHeaders()
