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
    const timeoutId = setTimeout(() => controller.abort(), 85000)

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

      const imgData = data.images?.[0] || data
      if (imgData.imageBase64) {
        const file = base64ToFile(imgData.imageBase64, imgData.mimeType || 'image/jpeg', 'ai-creative.jpg')
        update('image', file)
        update('imagePreview', `data:${imgData.mimeType || 'image/jpeg'};base64,${imgData.imageBase64}`)
        update('mediaType', 'image')
        
        if (data.revisedPrompt) update('imagePrompt', data.revisedPrompt)
        notify("Готово! Креатив создан.")
      }
    } catch (error) {
      notify(error?.name === 'AbortError' ? t('create.notify.ai_image_timeout') : (error?.message || t('create.notify.ai_image_fail')))
    } finally {
      clearTimeout(timeoutId)
      setGeneratingImage(false)
    }
  }

  async function launch() {
    if (form.ctaType === 'WHATSAPP_MESSAGE' && !form.whatsappNumber) {
      notify(t('create.notify.whatsapp_required'))
      return
    }
    
    setLaunching(true)
    try {
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
        headers: getAuthHeaders(),
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

  function handleMedia(file) {
    if (!file) return
    update('image', file)
    update('imagePreview', URL.createObjectURL(file))
    update('mediaType', file.type?.startsWith('video/') ? 'video' : 'image')
    update('mediaName', file.name || '')
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
             <label>{t('create.field_budget')}</label>
             <input className={styles.input} type="number" value={form.budget}
                    onChange={e => update('budget', e.target.value)} placeholder="10" />
             <label>{t('create.field_geo')}</label>
             <input className={styles.input} value={form.geo}
                    onChange={e => update('geo', e.target.value)} placeholder="Astana" />
          </div>
        )}

        {step === 1 && (
          <div className="fade-up">
            <label>{t('create.field_age')}</label>
            <div style={{display:'flex', gap: 10}}>
              <input className={styles.input} type="number" value={form.ageMin} onChange={e => update('ageMin', e.target.value)} />
              <input className={styles.input} type="number" value={form.ageMax} onChange={e => update('ageMax', e.target.value)} />
            </div>
            <label>{t('create.field_interests')}</label>
            <input className={styles.input} value={form.interests} onChange={e => update('interests', e.target.value)} />
          </div>
        )}

        {step === 2 && (
          <div className="fade-up">
            <textarea className={styles.textarea} value={form.productDesc} 
                      onChange={e => update('productDesc', e.target.value)} 
                      placeholder={t('create.field_product_placeholder')} />
            
            <button className={styles.aiBtn} onClick={generateAI} disabled={generating}>
              {generating ? "..." : t('create.ai_text')}
            </button>

            <div className={styles.previewZone}>
               {form.imagePreview ? (
                 <img src={form.imagePreview} className={styles.previewImg} alt="Preview" />
               ) : (
                 <div className={styles.uploadPlaceholder} onClick={() => photoInputRef.current.click()}>
                   {t('create.creative.photo.label')}
                 </div>
               )}
               <input type="file" ref={photoInputRef} hidden onChange={e => handleMedia(e.target.files[0])} accept="image/*" />
            </div>

            <button className={styles.aiBtn} onClick={generateImageAI} disabled={generatingImage}>
              {generatingImage ? "AI Generation..." : "🎨 Сгенерировать картинку через ИИ"}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="fade-up">
            <h3>{form.headline}</h3>
            <p>{form.text}</p>
            <button className={styles.launchBtn} onClick={launch} disabled={launching}>
              {launching ? "..." : t('create.step.launch')}
            </button>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {step > 0 && <button onClick={() => setStep(s => s - 1)}>{t('common.back')}</button>}
        {step < 3 && <button onClick={() => setStep(s => s + 1)} className={styles.nextBtn}>{t('common.next')}</button>}
      </div>
    </div>
  )
}
