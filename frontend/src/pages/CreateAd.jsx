import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './CreateAd.module.css'
import { useI18n } from '../i18n'
import CreativeEditor from '../components/CreativeEditor'

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
  const tg = window.Telegram?.WebApp;
  if (tg?.initData && typeof tg.showAlert === 'function') {
    try {
      tg.showAlert(message, callback);
      return;
    } catch (e) {
      console.warn("Telegram showAlert failed, falling back to browser alert", e);
    }
  }
  window.alert(message);
  callback?.();
}

const getAuthHeaders = () => {
  const tg = window.Telegram?.WebApp
  return {
    'x-tg-data': tg?.initData || '',
    'x-tg-userid': tg?.initDataUnsafe?.user?.id?.toString() || ''
  }
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
              strokeLinecap="round" strokeLinejoin="round" />
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
      <div style={{
        width: '100%', aspectRatio: '1 / 1', borderRadius: 16, overflow: 'hidden',
        border: '2px solid var(--border)', position: 'relative',
        background: 'var(--bg3)'
      }}>
        <img src={images[current]} alt={`Вариант ${current + 1}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: '#007AFF', color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '4px 10px',
          borderRadius: 20, boxShadow: '0 2px 8px rgba(0,122,255,0.4)'
        }}>
          Вариант {current + 1}/{images.length}
        </div>
      </div>
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
    </div>
  )
}

// ── Поиск городов через Meta Locations API ────────────────────────────────────
function GeoSearch({ value, onSelect, placeholder }) {
  const [query, setQuery] = useState(value?.display || value?.name || '')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleInput(e) {
    const val = e.target.value
    setQuery(val)
    setOpen(true)
    if (!val) { onSelect(null); setSuggestions([]); return }
    clearTimeout(debounceRef.current)
    if (val.length < 2) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API}/api/geo-search?q=${encodeURIComponent(val)}`, { headers: getAuthHeaders() })
        const data = await res.json()
        setSuggestions(data.data || [])
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 350)
  }

  function select(item) {
    setQuery(item.display || item.name)
    onSelect(item)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          style={{
            width: '100%', padding: '12px 40px 12px 14px',
            borderRadius: 12, border: '1.5px solid var(--border)',
            background: 'var(--bg2)', color: 'var(--text)',
            fontSize: 15, outline: 'none', transition: 'border 0.2s'
          }}
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || 'Алматы, Астана...'}
        />
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}>
          {loading ? '⌛' : '📍'}
        </span>
      </div>
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 100, overflow: 'hidden'
        }}>
          {suggestions.map((item, i) => (
            <div key={i} onClick={() => select(item)} style={{
              padding: '12px 14px', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer', fontSize: 14, color: 'var(--text)'
            }}>
              {item.display || item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  )
}

export default function CreateAd() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const photoInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [generatedImages, setGeneratedImages] = useState([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  const [form, setForm] = useState({
    budget: '10',
    geo: '',
    geoObj: null,
    ageMin: '18',
    ageMax: '45',
    interests: '',
    productDesc: '',
    headline: '',
    text: '',
    creativeType: 'photo',
    image: null,
    imagePreview: null,
    ctaType: 'WHATSAPP_MESSAGE',
    whatsappNumber: '',
    ctaUrl: '',
    aiInterests: []
  })

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const steps = [t('create.step.budget_geo'), t('create.step.audience'), t('create.step.creative'), t('create.step.launch')]
  const creativeTypes = [
    { id: 'photo', label: t('create.creative.photo.label'), sub: t('create.creative.photo.helper'), icon: '🖼' },
    { id: 'video', label: t('create.creative.video.label'), sub: t('create.creative.video.helper'), icon: '📹' },
    { id: 'ai', label: t('create.creative.ai.label'), sub: t('create.creative.ai.helper'), icon: '✨' }
  ]

  async function generateAI() {
    if (!form.productDesc) return
    setGenerating(true)
    try {
      const res = await fetch(`${API}/api/generate`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: form.productDesc })
      })
      const data = await res.json()
      if (data.headline) update('headline', data.headline)
      if (data.text) update('text', data.text)
      if (data.interests) update('aiInterests', data.interests)
    } catch (e) {
      notify(t('create.notify.ai_text_fail'))
    } finally {
      setGenerating(false)
    }
  }

  async function generateImageAI() {
    setGeneratingImage(true)
    try {
      const res = await fetch(`${API}/api/generate-image`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: form.productDesc, headline: form.headline })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      const { renderId } = data
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 4000))
        const sRes = await fetch(`${API}/api/render-status?renderId=${renderId}`, { headers: getAuthHeaders() })
        const sData = await sRes.json()
        if (sData.status === 'done') {
          const file = base64ToFile(sData.imageBase64, sData.mimeType, 'ai.jpg')
          const preview = `data:${sData.mimeType};base64,${sData.imageBase64}`
          setGeneratedImages(p => [...p, preview].slice(-3))
          update('image', file)
          update('imagePreview', preview)
          return
        }
        if (sData.status === 'failed') throw new Error('Render failed')
      }
    } catch (e) {
      notify(e.message || t('create.notify.ai_image_fail'))
    } finally {
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
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'image' && v) fd.append(k, v)
        else if (typeof v === 'object') fd.append(k, JSON.stringify(v))
        else fd.append(k, v)
      })
      const res = await fetch(`${API}/api/launch`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd
      })
      if (res.ok) setShowSuccess(true)
      else {
        const d = await res.json()
        notify(d.error || t('create.notify.launch_error'))
      }
    } catch (e) {
      notify(t('create.notify.launch_error'))
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className={styles.page}>
      {showSuccess && <SuccessModal onClose={() => navigate('/')} />}
      <div className={styles.header}><h1 className={styles.title}>{t('create.title')}</h1></div>
      <div className={styles.steps}>
        {steps.map((s, i) => (
          <div key={i} className={`${styles.step} ${i === step ? styles.stepActive : ''}`}>
            <div className={styles.stepDot}>{i < step ? '✓' : i + 1}</div>
          </div>
        ))}
      </div>
      <div className={styles.content}>
        {step === 0 && (
          <div className="fade-up">
            <Field label={t('create.field_budget')}><input className={styles.input} type="number" value={form.budget} onChange={e => update('budget', e.target.value)} /></Field>
            <Field label={t('create.field_geo')}><GeoSearch value={form.geoObj} onSelect={it => { update('geoObj', it); update('geo', it?.key || '') }} /></Field>
          </div>
        )}
        {step === 1 && (
          <div className="fade-up">
            <Field label={t('create.field_age')}><input className={styles.input} type="number" value={form.ageMin} onChange={e => update('ageMin', e.target.value)} /></Field>
            <Field label={t('create.field_interests')}><input className={styles.input} value={form.interests} onChange={e => update('interests', e.target.value)} /></Field>
          </div>
        )}
        {step === 2 && (
          <div className="fade-up">
            <Field label={t('create.field_product_desc')}><textarea className={styles.textarea} value={form.productDesc} onChange={e => update('productDesc', e.target.value)} /></Field>
            <button className={styles.aiBtn} onClick={generateAI} disabled={generating}>{generating ? '...' : '✨ AI Text'}</button>
            <Field label={t('create.field_headline')}><input className={styles.input} value={form.headline} onChange={e => update('headline', e.target.value)} /></Field>
            <Field label={t('create.field_text')}><textarea className={styles.textarea} value={form.text} onChange={e => update('text', e.target.value)} /></Field>
          </div>
        )}
        {step === 3 && (
          <div className="fade-up">
            <div className={styles.sectionTitle}>{t('create.section_creative_format')}</div>
            <div className={styles.creativeGrid}>
              {creativeTypes.map(t => (
                <div key={t.id} className={`${styles.creativeCard} ${form.creativeType === t.id ? styles.creativeActive : ''}`} onClick={() => update('creativeType', t.id)}>
                  <div>{t.icon} {t.label}</div>
                </div>
              ))}
            </div>
            {form.creativeType === 'ai' && <button className={styles.aiBtn} onClick={generateImageAI} disabled={generatingImage}>{generatingImage ? '...' : '🖼 AI Image'}</button>}
            {form.imagePreview && <img src={form.imagePreview} style={{ width: '100%', borderRadius: 12, marginTop: 12 }} />}
            <button className={styles.launchBtn} onClick={launch} disabled={launching}>{launching ? '...' : t('create.launch')}</button>
          </div>
        )}
      </div>
      <div className={styles.footer}>
        {step > 0 && <button className={styles.backBtn} onClick={() => setStep(s => s - 1)}>{t('create.back')}</button>}
        {step < 3 && <button className={styles.nextBtn} onClick={() => setStep(s => s + 1)}>{t('create.next')}</button>}
      </div>
    </div>
  )
}
