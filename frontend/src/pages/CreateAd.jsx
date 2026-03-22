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

      const res = await fetch(`${API}/api/generate-image`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd,
        signal: controller.signal
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('create.notify.ai_image_fail'))

      // Обрабатываем ОДНУ картинку из массива (или старый формат)
      const imgData = data.images?.[0] || data
      if (imgData.imageBase64) {
        const file = base64ToFile(imgData.imageBase64, imgData.mimeType || 'image/jpeg', 'ai-creative.jpg')
        update('image', file)
        update('imagePreview', `data:${imgData.mimeType || 'image/jpeg'};base64,${imgData.imageBase64}`)
        update('mediaType', 'image')
        
        if (data.revisedPrompt) update('imagePrompt', data.revisedPrompt)
        notify("Креатив готов! Если не нравится — нажми еще раз для нового варианта.")
      }

    } catch (error) {
      notify(error?.name === 'AbortError' ? t('create.notify.ai_image_timeout') : (error?.message || t('create.notify.ai_image_fail')))
    } finally {
      clearTimeout(timeoutId)
      setGeneratingImage(false)
    }
  }

  // ... остальная часть функций (handleMedia, selectCreative, launch) остается без изменений, 
  // но в launch() тоже замени заголовки на getAuthHeaders()
