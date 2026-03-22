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

  const getAuthHeaders = () => ({
    'x-tg-data': window.Telegram?.WebApp?.initData || '',
    'x-tg-userid': localStorage.getItem('luna_tg_userid') || ''
  })

  // Шаг 2.1: Генерация текста (Headline + Body)
  async function generateAI() {
    if (!form.productDesc) {
        notify("Пожалуйста, опишите ваш продукт или услугу");
        return;
    }
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
      if (!res.ok) throw new Error(data?.error || 'Ошибка генерации текста')

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

  // Шаг 2.2: Генерация картинки (через Sharp + OpenAI)
  async function generateImageAI() {
    if (!form.productDesc && !form.headline) {
        notify("Заполните описание и заголовок для креатива");
        return;
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)

    setGeneratingImage(true)
    try {
      const fd = new FormData()
      fd.append('productDesc', form.productDesc)
      fd.append('headline', form.headline) // Sharp возьмет этот текст!
      fd.append('text', form.text)
      fd.append('prompt', form.imagePrompt || '')
      
      if (form.image) {
        fd.append('imageRef', form.image) // Отправляем референс (машину)
      }

      const res = await fetch(`${API}/api/generate-image`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd,
        signal: controller.signal
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('create.notify.ai_image_fail'))

      if (data.url) {
        // Если вернулся Base64 от Sharp
        if (data.url.startsWith('data:image')) {
            const base64Data = data.url.split(',')[1];
            const file = base64ToFile(base64Data, 'image/png', 'ai-creative.png');
            update('image', file);
            update('imagePreview', data.url);
        } else {
            // Если вернулась просто ссылка
            update('imagePreview', data.url);
        }
        update('mediaType', 'image');
        notify("Креатив готов!");
      }
    } catch (error) {
      notify(error?.name === 'AbortError' ? "Время ожидания истекло" : (error?.message || t('create.notify.ai_image_fail')))
    } finally {
      clearTimeout(timeoutId)
      setGeneratingImage(false)
    }
  }

  async function launch() {
    setLaunching(true)
    try {
      const fd = new FormData()
      fd.append('budget', form.budget)
      fd.append('geo', form.geo)
      fd.append('ageMin', form.ageMin)
      fd.append('ageMax', form.ageMax)
      fd.append('interests', JSON.stringify(form.aiInterests?.length ? form.aiInterests : form.interests.split(',').map(s => s.trim()).filter(Boolean)))
      fd.append('headline', form.headline)
      fd.append('text', form.text)
      fd.append('ctaType', form.ctaType)
      if (form.image) fd.append('image', form.image)

      const res = await fetch(`${API}/api/launch`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Ошибка запуска")
      notify("Реклама запущена!", () => navigate('/campaigns'))
    } catch (err) {
      notify(err.message)
    } finally {
      setLaunching(false)
    }
  }

  function handleMedia(file) {
    if (!file) return
    update('image', file)
    update('imagePreview', URL.createObjectURL(file))
    update('mediaType', 'image')
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
             <input className={styles.input} type="number" value={form.budget} onChange={e => update('budget', e.target.value)} />
             <label>{t('create.field_geo')}</label>
             <input className={styles.input} value={form.geo} onChange={e => update('geo', e.target.value)} />
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
            <label>О чем ваша реклама?</label>
            <textarea className={styles.textarea} value={form.productDesc} onChange={e => update('productDesc', e.target.value)} placeholder="Например: Продажа Deepal S09 в Астане..." />
            
            <button className={styles.aiBtn} onClick={generateAI} disabled={generating}>
              {generating ? "Генерация текста..." : "✨ Предложить варианты текста"}
            </button>

            <div className={styles.editSection} style={{marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                <label>Текст на картинке (Headline)</label>
                <input className={styles.input} value={form.headline} onChange={e => update('headline', e.target.value)} placeholder="Заголовок для баннера" />
                
                <label>Текст под картинкой</label>
                <textarea className={styles.textarea} style={{height: '60px'}} value={form.text} onChange={e => update('text', e.target.value)} />
            </div>

            <div className={styles.previewZone} style={{marginTop: '20px'}}>
               {form.imagePreview ? (
                 <img src={form.imagePreview} className={styles.previewImg} alt="Preview" onClick={() => photoInputRef.current.click()} />
               ) : (
                 <div className={styles.uploadPlaceholder} onClick={() => photoInputRef.current.click()}>
                   📸 Нажмите, чтобы загрузить фото-референс
                 </div>
               )}
               <input type="file" ref={photoInputRef} hidden onChange={e => handleMedia(e.target.files[0])} accept="image/*" />
            </div>

            <button className={styles.aiBtn} style={{background: '#007AFF', color: 'white'}} onClick={generateImageAI} disabled={generatingImage}>
              {generatingImage ? "AI создает шедевр..." : "🎨 Создать креатив с этим текстом"}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="fade-up">
            <div className={styles.finalPreview}>
                {form.imagePreview && <img src={form.imagePreview} style={{width: '100%', borderRadius: '12px'}} />}
                <h3>{form.headline}</h3>
                <p>{form.text}</p>
            </div>
            <button className={styles.launchBtn} onClick={launch} disabled={launching}>
              {launching ? "Запуск..." : "🚀 Опубликовать рекламу"}
            </button>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {step > 0 && <button onClick={() => setStep(s => s - 1)} className={styles.backBtn}>{t('common.back')}</button>}
        {step < 3 && <button onClick={() => setStep(s => s + 1)} className={styles.nextBtn}>{t('common.next')}</button>}
      </div>
    </div>
  )
}
