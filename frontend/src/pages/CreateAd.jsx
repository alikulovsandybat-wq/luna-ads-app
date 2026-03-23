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

// ── Наложение текста через Canvas (работает в браузере без fontconfig) ──────
async function overlayTextOnImage(imageBase64, mimeType, headline) {
  if (!headline || !headline.trim()) {
    // Нет заголовка — возвращаем картинку как есть
    return { imageBase64, mimeType }
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')

      // Рисуем картинку
      ctx.drawImage(img, 0, 0)

      // Параметры текста
      const text = headline.toUpperCase()
      const maxWidth = canvas.width * 0.85
      const fontSize = Math.round(canvas.width * 0.058)
      ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`

      // Разбиваем текст на строки
      const words = text.split(' ')
      const lines = []
      let currentLine = ''
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) lines.push(currentLine)
      const maxLines = lines.slice(0, 3)

      const lineHeight = fontSize * 1.25
      const totalTextHeight = maxLines.length * lineHeight
      const paddingV = 40
      const gradientStartY = canvas.height - totalTextHeight - paddingV * 2 - 20

      // Градиент снизу
      const gradient = ctx.createLinearGradient(0, gradientStartY, 0, canvas.height)
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.70)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, gradientStartY, canvas.width, canvas.height - gradientStartY)

      // Рисуем текст
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      maxLines.forEach((line, i) => {
        const y = canvas.height - totalTextHeight - paddingV + i * lineHeight + lineHeight / 2

        // Чёрная обводка
        ctx.strokeStyle = 'rgba(0,0,0,0.9)'
        ctx.lineWidth = fontSize * 0.08
        ctx.lineJoin = 'round'
        ctx.strokeText(line, canvas.width / 2, y)

        // Белый текст
        ctx.fillStyle = '#ffffff'
        ctx.fillText(line, canvas.width / 2, y)
      })

      // Экспортируем как base64
      const resultBase64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
      resolve({ imageBase64: resultBase64, mimeType: 'image/jpeg' })
    }
    img.onerror = () => resolve({ imageBase64, mimeType }) // fallback
    img.src = `data:${mimeType};base64,${imageBase64}`
  })
}

function notify(message, callback) {
  if (window.Telegram?.WebApp?.showAlert) {
    window.Telegram.WebApp.showAlert(message, callback)
    return
  }
  window.alert(message)
  callback?.()
}

// ── Модальное окно успешного запуска ──────────────────────────────────────────
function SuccessModal({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 24, padding: '36px 28px',
        textAlign: 'center', maxWidth: 340, width: '100%',
        border: '1px solid var(--border)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.2)'
      }}>
        {/* Анимированный зелёный круг */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 8px 24px rgba(34,197,94,0.35)',
          animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M8 18L15 25L28 11" stroke="white" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 30, strokeDashoffset: 0,
                animation: 'drawCheck 0.4s 0.2s ease forwards' }} />
          </svg>
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
          Реклама запущена! 🎉
        </div>
        <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 28 }}>
          Рекламная кампания создана. Facebook проверит её, и она скоро появится в вашем дашборде.
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: '#007AFF', color: '#fff',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,122,255,0.3)'
          }}
        >
          Отлично 👍
        </button>
      </div>
    </div>
  )
}

// ── Карусель картинок ─────────────────────────────────────────────────────────
function ImageCarousel({ images, selectedIndex, onSelect }) {
  const [current, setCurrent] = useState(selectedIndex || 0)

  function prev() {
    const idx = (current - 1 + images.length) % images.length
    setCurrent(idx)
    onSelect(idx)
  }

  function next() {
    const idx = (current + 1) % images.length
    setCurrent(idx)
    onSelect(idx)
  }

  if (!images || images.length === 0) return null

  return (
    <div style={{ position: 'relative', marginTop: 16, marginBottom: 16 }}>
      {/* Основное изображение */}
      <div style={{
        width: '100%', aspectRatio: '1 / 1', borderRadius: 16, overflow: 'hidden',
        border: '2px solid var(--border)', position: 'relative',
        background: 'var(--bg3)'
      }}>
        <img
          src={images[current]}
          alt={`Вариант ${current + 1}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Метка "Выбрано" */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: '#007AFF', color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '4px 10px',
          borderRadius: 20, boxShadow: '0 2px 8px rgba(0,122,255,0.4)'
        }}>
          Вариант {current + 1}/{images.length}
        </div>
      </div>

      {/* Стрелки навигации — только если больше 1 картинки */}
      {images.length > 1 && (
        <>
          <button onClick={prev} style={{
            position: 'absolute', top: '50%', left: -10, transform: 'translateY(-50%)',
            width: 36, height: 36, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#111'
          }}>‹</button>
          <button onClick={next} style={{
            position: 'absolute', top: '50%', right: -10, transform: 'translateY(-50%)',
            width: 36, height: 36, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#111'
          }}>›</button>
        </>
      )}

      {/* Точки-индикаторы */}
      {images.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          {images.map((_, i) => (
            <div
              key={i}
              onClick={() => { setCurrent(i); onSelect(i) }}
              style={{
                width: i === current ? 20 : 8, height: 8,
                borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s',
                background: i === current ? '#007AFF' : 'var(--border)'
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Основной компонент ────────────────────────────────────────────────────────
export default function CreateAd() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const photoInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const [step, setStep] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Несколько сгенерированных картинок
  const [generatedImages, setGeneratedImages] = useState([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

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

  // Категории рекламы для выбора шаблона Creatomate
  const adCategories = [
    {
      id: 'saas',
      icon: '💻',
      label: 'SaaS / Бизнес',
      hint: 'Приложения, сервисы, B2B, авто, недвижимость',
      color: '#007AFF'
    },
    {
      id: 'ecommerce',
      icon: '🛍️',
      label: 'E-commerce',
      hint: 'Одежда, косметика, товары, магазины',
      color: '#f59e0b'
    },
    {
      id: 'premium',
      icon: '✨',
      label: 'Премиум / Обучение',
      hint: 'Курсы, коучинг, психологи, блогеры, эксперты',
      color: '#7c3aed'
    },
    {
      id: 'universal',
      icon: '🎯',
      label: 'Универсальный',
      hint: 'Подходит для любой ниши',
      color: '#059669'
    },
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
    aiInterests: [],
    adCategory: 'universal' // категория для выбора шаблона Creatomate
  })

  function update(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  const getAuthHeaders = () => ({
    'x-tg-data': window.Telegram?.WebApp?.initData || '',
    'x-tg-userid': localStorage.getItem('luna_tg_userid') || ''
  })

  async function generateAI() {
    if (!form.productDesc) return

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)

    setGenerating(true)
    try {
      const res = await fetch(`${API}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
      const message = error?.name === 'AbortError'
        ? t('create.notify.ai_text_timeout')
        : (error?.message || t('create.notify.ai_text_fail'))
      notify(message)
    } finally {
      clearTimeout(timeoutId)
      setGenerating(false)
    }
  }

  async function generateImageAI() {
    if (!form.productDesc && !form.imagePrompt) return

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)

    setGeneratingImage(true)
    try {
      const fd = new FormData()
      fd.append('prompt', form.imagePrompt || '')
      fd.append('description', form.productDesc)
      fd.append('headline', form.headline)
      fd.append('text', form.text)
      fd.append('geo', form.geo)
      fd.append('adCategory', form.adCategory) // передаём выбранную категорию
      if (form.image && form.mediaType !== 'video') fd.append('reference_image', form.image)

      const res = await fetch(`${API}/api/generate-image`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd,
        signal: controller.signal
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('create.notify.ai_image_fail'))

      // Creatomate уже наложил текст — используем картинку напрямую
      const imageBase64 = data.imageBase64
      const finalMime = data.mimeType || 'image/jpeg'

      const file = base64ToFile(imageBase64, finalMime, 'ai-creative.jpg')
      const previewUrl = `data:${finalMime};base64,${imageBase64}`

      // Добавляем к существующим (макс 3)
      setGeneratedImages(prev => {
        const next = [...prev, previewUrl].slice(-3)
        setSelectedImageIndex(next.length - 1)
        return next
      })

      update('image', file)
      update('imagePreview', previewUrl)
      update('mediaType', 'image')
      update('mediaName', 'ai-creative.png')

      if (!form.imagePrompt && data.revisedPrompt) update('imagePrompt', data.revisedPrompt)

    } catch (error) {
      const message = error?.name === 'AbortError'
        ? t('create.notify.ai_image_timeout')
        : (error?.message || t('create.notify.ai_image_fail'))
      notify(message)
    } finally {
      clearTimeout(timeoutId)
      setGeneratingImage(false)
    }
  }

  function handleMedia(file) {
    if (!file) return
    const preview = URL.createObjectURL(file)
    update('image', file)
    update('imagePreview', preview)
    update('mediaType', file.type?.startsWith('video/') ? 'video' : 'image')
    update('mediaName', file.name || '')
    if (!file.type?.startsWith('video/')) {
      setGeneratedImages([preview])
      setSelectedImageIndex(0)
    }
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

  // При выборе картинки из карусели — обновляем form.image
  function handleCarouselSelect(idx) {
    setSelectedImageIndex(idx)
    const previewUrl = generatedImages[idx]
    update('imagePreview', previewUrl)
    // Конвертируем base64 обратно в File если это ai-картинка
    if (previewUrl.startsWith('data:')) {
      const [meta, base64] = previewUrl.split(',')
      const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/png'
      const file = base64ToFile(base64, mimeType, 'ai-creative.png')
      update('image', file)
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
      const fd = new FormData()
      fd.append('budget', form.budget)
      fd.append('geo', form.geo)
      fd.append('ageMin', form.ageMin)
      fd.append('ageMax', form.ageMax)
      fd.append('interests', JSON.stringify(
        form.aiInterests?.length
          ? form.aiInterests
          : form.interests ? form.interests.split(',').map(s => s.trim()).filter(Boolean) : []
      ))
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

      // Показываем красивое модальное окно вместо alert
      setShowSuccess(true)

    } catch (err) {
      notify(t('create.notify.launch_error') + ': ' + (err.message || ''))
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Модальное окно успеха */}
      {showSuccess && (
        <SuccessModal onClose={() => {
          setShowSuccess(false)
          navigate('/')
        }} />
      )}

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
        {/* ── Шаг 0: Бюджет и гео ── */}
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

        {/* ── Шаг 1: Аудитория ── */}
        {step === 1 && (
          <div className="fade-up">
            <Field label={t('create.field_age')}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className={styles.input} type="number" value={form.ageMin}
                  onChange={e => update('ageMin', e.target.value)} placeholder="18" style={{ flex: 1 }} />
                <span style={{ color: 'var(--text3)' }}>—</span>
                <input className={styles.input} type="number" value={form.ageMax}
                  onChange={e => update('ageMax', e.target.value)} placeholder="45" style={{ flex: 1 }} />
              </div>
            </Field>
            <Field label={t('create.field_interests')}>
              <input className={styles.input} value={form.interests}
                onChange={e => update('interests', e.target.value)}
                placeholder={t('create.field_interests_placeholder')} />
            </Field>
          </div>
        )}

        {/* ── Шаг 2: Креатив ── */}
        {step === 2 && (
          <div className="fade-up">
            <Field label={t('create.field_product_desc')}>
              <textarea className={styles.textarea} value={form.productDesc}
                onChange={e => update('productDesc', e.target.value)}
                placeholder={t('create.field_product_placeholder')} rows={3} />
            </Field>

            <div className={styles.aiButtons}>
              <button className={styles.aiBtn} onClick={generateAI}
                disabled={generating || !form.productDesc}>
                {generating ? t('create.ai_text_loading') : t('create.ai_text')}
              </button>
            </div>

            {form.aiInterests?.length > 0 && (
              <div style={{
                background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.2)',
                borderRadius: 12, padding: '10px 14px', marginBottom: 16
              }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>
                  🎯 ИИ подобрал интересы для таргетинга:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {form.aiInterests.map((interest, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 20,
                      background: 'rgba(0,122,255,0.12)', color: '#007AFF', fontWeight: 500
                    }}>
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Field label={t('create.field_headline')}>
              <input className={styles.input} value={form.headline}
                onChange={e => update('headline', e.target.value)}
                placeholder={t('create.field_headline')} />
            </Field>
            <Field label={t('create.field_text')}>
              <textarea className={styles.textarea} value={form.text}
                onChange={e => update('text', e.target.value)} rows={4}
                placeholder={t('create.field_text')} />
            </Field>

            <div className={styles.sectionTitle}>{t('create.section_creative_format')}</div>
            <div className={styles.creativeGrid}>
              {creativeTypes.map(type => (
                <button key={type.id} type="button"
                  className={`${styles.creativeCard} ${form.creativeType === type.id ? styles.creativeActive : ''}`}
                  onClick={() => selectCreative(type.id)}>
                  <div className={styles.creativeLabel}>{type.label}</div>
                  <div className={styles.creativeHint}>{type.helper}</div>
                </button>
              ))}
            </div>

            <p className={styles.helper}>{t('create.creative.tap_hint')}</p>

            <input ref={photoInputRef} type="file" accept="image/*"
              onChange={e => handleMedia(e.target.files?.[0])} style={{ display: 'none' }} />
            <input ref={videoInputRef} type="file" accept="video/*"
              onChange={e => handleMedia(e.target.files?.[0])} style={{ display: 'none' }} />

            {/* Видео превью */}
            {form.mediaType === 'video' && form.imagePreview && (
              <div className={styles.mediaPreview}>
                <video className={styles.videoPreview} src={form.imagePreview} controls />
                {form.mediaName && (
                  <div className={styles.mediaMeta}>{t('create.summary_creative_video')}: {form.mediaName}</div>
                )}
              </div>
            )}

            {/* Карусель картинок */}
            {generatedImages.length > 0 && form.mediaType !== 'video' && (
              <ImageCarousel
                images={generatedImages}
                selectedIndex={selectedImageIndex}
                onSelect={handleCarouselSelect}
              />
            )}

            <Field label="Категория рекламы">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {adCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => update('adCategory', cat.id)}
                    style={{
                      padding: '12px 10px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${form.adCategory === cat.id ? cat.color : 'var(--border)'}`,
                      background: form.adCategory === cat.id ? cat.color + '12' : 'var(--card)',
                      textAlign: 'left', transition: 'all 0.2s',
                      boxShadow: form.adCategory === cat.id ? `0 2px 8px ${cat.color}33` : 'none'
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{cat.icon}</div>
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: form.adCategory === cat.id ? cat.color : 'var(--text)'
                    }}>
                      {cat.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, lineHeight: 1.3 }}>
                      {cat.hint}
                    </div>
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t('create.field_image_prompt')}>
              <textarea className={styles.textarea} value={form.imagePrompt}
                onChange={e => update('imagePrompt', e.target.value)}
                placeholder={t('create.field_image_prompt_placeholder')} rows={3} />
            </Field>

            <p className={styles.helper}>{t('create.image_ref_hint')}</p>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className={styles.aiBtn}
                onClick={generateImageAI}
                disabled={generatingImage || (generatedImages.length === 0 && !form.productDesc && !form.imagePrompt)}
                style={{ flex: 1, position: 'relative' }}>
                {generatingImage ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block', flexShrink: 0
                    }} />
                    {t('create.ai_image_loading')}
                  </span>
                ) : generatedImages.length > 0
                  ? '🔄 Перегенерировать'
                  : t('create.ai_image')}
              </button>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

            <div className={styles.sectionTitle}>{t('create.section_cta')}</div>
            <div className={styles.ctaRow}>
              {ctaTypes.map(type => (
                <button key={type.id} type="button"
                  className={`${styles.ctaButton} ${form.ctaType === type.id ? styles.ctaActive : ''}`}
                  onClick={() => update('ctaType', type.id)}>
                  {type.label}
                </button>
              ))}
            </div>

            {form.ctaType === 'WHATSAPP_MESSAGE' && (
              <Field label={t('create.field_whatsapp')}>
                <input className={styles.input} value={form.whatsappNumber}
                  onChange={e => update('whatsappNumber', e.target.value)}
                  placeholder={t('create.whatsapp_placeholder')} />
              </Field>
            )}
            {form.ctaType === 'TELEGRAM' && (
              <Field label="Ссылка на Telegram">
                <input className={styles.input} value={form.ctaUrl}
                  onChange={e => update('ctaUrl', e.target.value)}
                  placeholder="https://t.me/username" />
              </Field>
            )}
            {form.ctaType === 'LEARN_MORE' && (
              <Field label="Ссылка на сайт">
                <input className={styles.input} value={form.ctaUrl}
                  onChange={e => update('ctaUrl', e.target.value)}
                  placeholder="https://yoursite.com" />
              </Field>
            )}
          </div>
        )}

        {/* ── Шаг 3: Summary + Launch ── */}
        {step === 3 && (
          <div className="fade-up">
            {form.imagePreview && form.mediaType !== 'video' && (
              <div style={{
                width: '100%', aspectRatio: '1/1', borderRadius: 16,
                overflow: 'hidden', marginBottom: 20, border: '1px solid var(--border)'
              }}>
                <img src={form.imagePreview} alt="Креатив"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <div className={styles.summary}>
              <SummaryRow label={t('create.summary_budget')} value={`$${form.budget} / ${t('period.days_short')}`} />
              <SummaryRow label={t('create.summary_geo')} value={form.geo} />
              <SummaryRow label={t('create.summary_age')} value={`${form.ageMin}–${form.ageMax}`} />
              <SummaryRow label={t('create.summary_headline')} value={form.headline || '—'} />
              <SummaryRow label={t('create.summary_text')} value={form.text ? form.text.slice(0, 60) + '…' : '—'} />
              <SummaryRow
                label={t('create.summary_creative')}
                value={form.image
                  ? (form.mediaType === 'video' ? t('create.summary_creative_video') : t('create.summary_creative_photo'))
                  : t('create.summary_creative_missing')}
              />
              <SummaryRow
                label="CTA"
                value={
                  form.ctaType === 'WHATSAPP_MESSAGE' ? `WhatsApp: ${form.whatsappNumber}` :
                  form.ctaType === 'TELEGRAM' ? `Telegram: ${form.ctaUrl}` :
                  form.ctaType === 'LEARN_MORE' ? `Сайт: ${form.ctaUrl}` :
                  'Написать на страницу'
                }
              />
            </div>

            <button className={styles.launchBtn} onClick={launch}
              disabled={launching || !form.headline}>
              {launching ? t('create.launching') : t('create.launch')}
            </button>
          </div>
        )}
      </div>

      <div className={styles.navBtns}>
        {step > 0 && (
          <button className={styles.backBtn} onClick={() => setStep(s => s - 1)}>
            {t('create.back')}
          </button>
        )}
        {step < 3 && (
          <button className={styles.nextBtn} onClick={() => setStep(s => s + 1)}>
            {t('create.next')}
          </button>
        )}
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes drawCheck {
          from { stroke-dashoffset: 30; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text2)', fontSize: 14 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500, maxWidth: '60%', textAlign: 'right' }}>{value}</span>
    </div>
  )
}
