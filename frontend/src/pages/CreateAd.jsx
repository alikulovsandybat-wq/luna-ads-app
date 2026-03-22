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
  
  // Новое состояние для 3-х вариантов картинок
  const [aiImages, setAiImages] = useState([])

  const steps = [
    t('create.step.budget_geo'),
    t('create.step.audience'),
    t('create.step.creative'),
    t('create.step.launch')
  ]

  const creativeTypes = [
    { id: 'photo', label: t('create.creative.photo.label'), helper: t('create.creative.photo.helper') },
    { id: 'video', label: t('create.creative.video.label'), helper: t('create.creative.video.helper') },
    { id: 'reels', label: t('create.creative.reels.label'), helper: t('create.creative.reels.helper') },
    { id: 'ai', label: t('create.creative.ai.label'), helper: t('create.creative.ai.helper') }
  ]

  const ctaTypes = [
    { id: 'MESSAGE_PAGE', label: t('create.cta.message') },
    { id: 'WHATSAPP_MESSAGE', label: t('create.cta.whatsapp') },
    { id: 'TELEGRAM', label: '✈️ Telegram' },
    { id: 'LEARN_MORE', label: '🌐 ' + (t('create.cta.website') || 'Сайт') },
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

  // Функция выбора варианта из карусели
  function selectVariant(imgObj, index) {
    const file = base64ToFile(imgObj.imageBase64, imgObj.mimeType || 'image/png', `ai-variant-${index}.png`)
    update('image', file)
    update('imagePreview', `data:${imgObj.mimeType || 'image/png'};base64,${imgObj.imageBase64}`)
    update('mediaType', 'image')
    update('mediaName', `ai-variant-${index}.png`)
  }

  async function generateAI() {
    if (!form.productDesc) return
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)
    setGenerating(true)
    try {
      const tgData = window.Telegram?.WebApp?.initData || ''
      const res = await fetch(`${API}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tg-data': tgData },
        body: JSON.stringify({ description: form.productDesc, geo: form.geo }),
        signal: controller.signal
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'AI generation failed')

      update('headline', data.headline)
      update('text', data.text)
      if (data.interests?.length) {
        update('aiInterests', data.interests)
        update('interests', data.interests.join(', '))
      }
    } catch (error) {
      notify(error?.name === 'AbortError' ? t('create.notify.ai_text_timeout') : (error?.message || t('create.notify.ai_text_fail')))
    } finally {
      clearTimeout(timeoutId)
      setGenerating(false)
    }
  }

  async function generateImageAI() {
    if (!form.productDesc && !form.imagePrompt) return
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 95000) // Увеличенный таймаут для 3-х картинок

    setGeneratingImage(true)
    try {
      const tgData = window.Telegram?.WebApp?.initData || ''
      const fd = new FormData()
      fd.append('prompt', form.imagePrompt)
      fd.append('description', form.productDesc)
      fd.append('headline', form.headline)
      fd.append('text', form.text)
      fd.append('geo', form.geo)
      fd.append('n', '3') // Просим 3 варианта
      if (form.image && form.mediaType !== 'video') fd.append('reference_image', form.image)

      const res = await fetch(`${API}/api/generate-image`, {
        method: 'POST',
        headers: { 'x-tg-data': tgData },
        body: fd,
        signal: controller.signal
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('create.notify.ai_image_fail'))

      // Работаем с массивом картинок
      if (data.images && data.images.length > 0) {
        setAiImages(data.images)
        // Автоматически выбираем первую как активную
        selectVariant(data.images[0], 0)
      } else if (data.imageBase64) {
        // Фоллбек на старый формат, если бэкенд еще не обновлен
        const singleImg = { imageBase64: data.imageBase64, mimeType: data.mimeType }
        setAiImages([singleImg])
        selectVariant(singleImg, 0)
      }

      if (!form.imagePrompt && data.revisedPrompt) update('imagePrompt', data.revisedPrompt)
      notify("Варианты созданы! Выберите лучший для вашей рекламы.")
    } catch (error) {
      notify(error?.name === 'AbortError' ? t('create.notify.ai_image_timeout') : (error?.message || t('create.notify.ai_image_fail')))
    } finally {
      clearTimeout(timeoutId)
      setGeneratingImage(false)
    }
  }

  function handleMedia(file) {
    if (!file) return
    setAiImages([]) // Сбрасываем ИИ картинки, если юзер загрузил своё
    update('image', file)
    update('imagePreview', URL.createObjectURL(file))
    update('mediaType', file.type?.startsWith('video/') ? 'video' : 'image')
    update('mediaName', file.name || '')
  }

  function selectCreative(type) {
    update('creativeType', type)
    if (type === 'photo') {
      photoInputRef.current?.click()
    } else if (type === 'video') {
      videoInputRef.current?.click()
    } else if (type === 'reels') {
      notify(t('create.notify.reels_notice'))
    }
  }

  async function launch() {
    if (form.ctaType === 'WHATSAPP_MESSAGE' && !form.whatsappNumber) {
      notify(t('create.notify.whatsapp_required'))
      return
    }
    if ((form.ctaType === 'TELEGRAM' || form.ctaType === 'LEARN_MORE') && !form.ctaUrl) {
      notify('Укажите ссылку')
      return
    }
    if (form.creativeType === 'video' || form.creativeType === 'reels') {
      notify(t('create.notify.video_block'))
      return
    }

    setLaunching(true)
    try {
      const tgData = window.Telegram?.WebApp?.initData || ''
      const fd = new FormData()
      fd.append('budget', form.budget)
      fd.append('geo', form.geo)
      fd.append('ageMin', form.ageMin)
      fd.append('ageMax', form.ageMax)
      fd.append('interests', JSON.stringify(form.aiInterests?.length ? form.aiInterests : form.interests ? form.interests.split(',').map(s => s.trim()).filter(Boolean) : []))
      fd.append('headline', form.headline)
      fd.append('text', form.text)
      fd.append('ctaType', form.ctaType)
      fd.append('whatsappNumber', form.whatsappNumber)
      fd.append('ctaUrl', form.ctaUrl)
      if (form.image) fd.append('image', form.image)

      const res = await fetch(`${API}/api/launch`, {
        method: 'POST',
        headers: { 'x-tg-data': tgData },
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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('create.title')}</h1>
      </div>

      <div className={styles.steps}>
        {steps.map((s, i) => (
          <div key={i} className={`${styles.step} ${i === step ? styles.stepActive : ''} ${i < step ? styles.stepDone : ''}`}>
            <div className={styles.stepDot}>{i < step ? '✓' : i + 1}</div>
            <div className={styles.stepLabel}>{s}</div>
          </div>
        ))}
      </div>

      <div className={styles.content}>
        {step === 0 && (
          <div className="fade-up">
            <Field label={t('create.field_budget')}>
              <input className={styles.input} type="number" value={form.budget}
                onChange={e => update('budget', e.target.value)} placeholder="10" />
            </Field>
            <Field label={t('create.field_geo')}>
              <input className={styles.input} value={form.geo}
                onChange={e => update('geo', e.target.value)} placeholder={t('create.field_geo')} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="fade-up">
            <Field label={t('create.field_age')}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input className={styles.input} type="number" value={form.ageMin}
                  onChange={e => update('ageMin', e.target.value)} placeholder="18" style={{flex:1}} />
                <span style={{color:'var(--text3)'}}>—</span>
                <input className={styles.input} type="number" value={form.ageMax}
                  onChange={e => update('ageMax', e.target.value)} placeholder="45" style={{flex:1}} />
              </div>
            </Field>
            <Field label={t('create.field_interests')}>
              <input className={styles.input} value={form.interests}
                onChange={e => update('interests', e.target.value)}
                placeholder={t('create.field_interests_placeholder')} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="fade-up">
            <Field label={t('create.field_product_desc')}>
              <textarea className={styles.textarea} value={form.productDesc}
                onChange={e => update('productDesc', e.target.value)}
                placeholder={t('create.field_product_placeholder')} rows={3} />
            </Field>

            <div className={styles.aiButtons}>
              <button className={styles.aiBtn} onClick={generateAI} disabled={generating || !form.productDesc}>
                {generating ? t('create.ai_text_loading') : t('create.ai_text')}
              </button>
            </div>

            {form.aiInterests?.length > 0 && (
              <div style={{
                background: 'rgba(124,92,252,0.08)', border: '1px solid rgba(124,92,252,0.25)',
                borderRadius: 12, padding: '10px 14px', marginBottom: 16
              }}>
                <div style={{ fontSize: 11, color
