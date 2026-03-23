import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './CreateAd.module.css'
import { useI18n } from '../i18n'

const API = import.meta.env.VITE_API_URL || ''

// Вспомогательная функция
function base64ToFile(base64, mimeType, fileName) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) { bytes[i] = binary.charCodeAt(i) }
  return new File([bytes], fileName, { type: mimeType })
}

function notify(message, callback) {
  const tg = window.Telegram?.WebApp;
  if (tg?.initData && typeof tg.showAlert === 'function') { try { tg.showAlert(message, callback); return; } catch (e) { } }
  window.alert(message);
  callback?.();
}

// ── Модальное окно успеха ──
function SuccessModal({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--card)', borderRadius: 24, padding: '36px 28px', textAlign: 'center', maxWidth: 340, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'popIn 0.4s' }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M8 18L15 25L28 11" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Реклама запущена! 🎉</div>
        <button onClick={onClose} style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: '#007AFF', color: '#fff', fontSize: 16, fontWeight: 700 }}>Отлично 👍</button>
      </div>
    </div>
  )
}

// ── Карусель картинок ──
function ImageCarousel({ images, selectedIndex, onSelect }) {
  const [current, setCurrent] = useState(selectedIndex || 0)
  const move = (dir) => { const n = (current + dir + images.length) % images.length; setCurrent(n); onSelect(n); }
  if (!images || images.length === 0) return null
  return (
    <div style={{ position: 'relative', margin: '16px 0' }}>
      <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 16, overflow: 'hidden', border: '2px solid var(--border)', position: 'relative' }}>
        <img src={images[current]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', top: 10, right: 10, background: '#007AFF', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>Вариант {current + 1}/{images.length}</div>
      </div>
      {images.length > 1 && (
        <>
          <button onClick={() => move(-1)} style={{ position: 'absolute', top: '50%', left: -10, transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>‹</button>
          <button onClick={() => move(1)} style={{ position: 'absolute', top: '50%', right: -10, transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>›</button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
            {images.map((_, i) => <div key={i} onClick={() => { setCurrent(i); onSelect(i) }} style={{ width: i === current ? 18 : 6, height: 6, borderRadius: 3, background: i === current ? '#007AFF' : 'var(--border)', cursor: 'pointer' }} />)}
          </div>
        </>
      )}
    </div>
  )
}

export default function CreateAd() {
  const navigate = useNavigate(); const { t } = useI18n()
  const photoInputRef = useRef(null); const videoInputRef = useRef(null)
  
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState({ ai: false, image: false, launch: false })
  const [showSuccess, setShowSuccess] = useState(false)
  const [generatedImages, setGeneratedImages] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)

  // Категории рекламы для выбора шаблона (вернул этот массив!)
  const adCategories = [
    { id: 'saas', icon: '💻', label: 'SaaS / Бизнес', hint: 'B2B, авто, недвижимость', color: '#007AFF' },
    { id: 'ecommerce', icon: '🛍️', label: 'E-commerce', hint: 'Товары, магазины', color: '#f59e0b' },
    { id: 'premium', icon: '✨', label: 'Премиум / Обучение', hint: 'Курсы, эксперты', color: '#7c3aed' },
    { id: 'universal', icon: '🎯', label: 'Универсальный', hint: 'Подходит для любой ниши', color: '#059669' },
  ]

  const [form, setForm] = useState({
    budget: '10', geo: '', ageMin: '18', ageMax: '45', interests: '', productDesc: '', headline: '', text: '',
    ctaType: 'MESSAGE_PAGE', whatsappNumber: '', ctaUrl: '', aiInterests: [], image: null, imagePreview: null, mediaType: null, creativeType: 'photo', adCategory: 'universal'
  })

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const getHeaders = () => ({ 'x-tg-data': window.Telegram?.WebApp?.initData || '', 'x-tg-userid': localStorage.getItem('luna_tg_userid') || '' })

  const handleGenerateText = async () => {
    if (!form.productDesc) return
    setLoading(l => ({ ...l, ai: true }))
    try {
      const res = await fetch(`${API}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ description: form.productDesc, geo: form.geo })
      })
      const data = await res.json()
      update('headline', data.headline); update('text', data.text)
      if (data.interests) { update('aiInterests', data.interests); update('interests', data.interests.join(', ')) }
    } catch (e) { notify(t('create.notify.ai_text_fail')) } finally { setLoading(l => ({ ...l, ai: false })) }
  }

  const handleGenerateImage = async () => {
    setLoading(l => ({ ...l, image: true }))
    try {
      const fd = new FormData()
      fd.append('description', form.productDesc); fd.append('headline', form.headline);
      // Важно: Отправляем выбранную категорию!
      fd.append('adCategory', form.adCategory)
      if (form.image && form.mediaType !== 'video') fd.append('reference_image', form.image)
      
      const res = await fetch(`${API}/api/generate-image`, { method: 'POST', headers: getHeaders(), body: fd })
      const { renderId } = await res.json()

      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 4000))
        const sRes = await fetch(`${API}/api/render-status?renderId=${renderId}`, { headers: getHeaders() })
        const sData = await sRes.json()
        if (sData.status === 'done') {
          const url = `data:${sData.mimeType};base64,${sData.imageBase64}`
          setGeneratedImages(prev => { const n = [...prev, url].slice(-3); setSelectedIdx(n.length - 1); return n })
          update('image', base64ToFile(sData.imageBase64, sData.mimeType, 'ai.jpg')); update('imagePreview', url); update('mediaType', 'image')
          break
        }
      }
    } catch (e) { notify('Ошибка генерации') } finally { setLoading(l => ({ ...l, image: false })) }
  }

  const handleMedia = (file) => {
    if (!file) return
    const url = URL.createObjectURL(file); update('image', file); update('imagePreview', url)
    update('mediaType', file.type.startsWith('video/') ? 'video' : 'image')
    if (!file.type.startsWith('video/')) { setGeneratedImages([url]); setSelectedIdx(0) }
  }

  const handleLaunch = async () => {
    setLoading(l => ({ ...l, launch: true }))
    try {
      const fd = new FormData()
      fd.append('budget', form.budget); fd.append('geo', form.geo); fd.append('headline', form.headline); fd.append('text', form.text)
      fd.append('interests', JSON.stringify(form.aiInterests.length ? form.aiInterests : form.interests.split(',').map(s => s.trim())))
      fd.append('ctaType', form.ctaType); fd.append('whatsappNumber', form.whatsappNumber); fd.append('ctaUrl', form.ctaUrl)
      if (form.image) fd.append('image', form.image)
      const res = await fetch(`${API}/api/launch`, { method: 'POST', headers: getHeaders(), body: fd })
      if (res.ok) setShowSuccess(true)
    } catch (e) { notify('Ошибка запуска') } finally { setLoading(l => ({ ...l, launch: false })) }
  }

  return (
    <div className={styles.page}>
      {showSuccess && <SuccessModal onClose={() => navigate('/')} />}
      <div className={styles.header}><h1>{t('create.title')}</h1></div>
      
      <div className={styles.steps}>
        {[t('create.step.budget_geo'), t('create.step.audience'), t('create.step.creative'), t('create.step.launch')].map((s, i) => (
          <div key={i} className={`${styles.step} ${i === step ? styles.stepActive : ''} ${i < step ? styles.stepDone : ''}`}>
            <div className={styles.stepDot}>{i < step ? '✓' : i + 1}</div>
          </div>
        ))}
      </div>

      <div className={styles.content}>
        {step === 0 && (
          <div className="fade-up">
            <Field label={t('create.field_budget')}><input className={styles.input} type="number" value={form.budget} onChange={e => update('budget', e.target.value)} /></Field>
            <Field label={t('create.field_geo')}><input className={styles.input} value={form.geo} onChange={e => update('geo', e.target.value)} /></Field>
          </div>
        )}

        {step === 1 && (
          <div className="fade-up">
            <Field label={t('create.field_age')}>
              <div style={{ display: 'flex', gap: 8 }}><input className={styles.input} type="number" value={form.ageMin} onChange={e => update('ageMin', e.target.value)} /><input className={styles.input} type="number" value={form.ageMax} onChange={e => update('ageMax', e.target.value)} /></div>
            </Field>
            <Field label={t('create.field_interests')}><input className={styles.input} value={form.interests} onChange={e => update('interests', e.target.value)} /></Field>
          </div>
        )}

        {step === 2 && (
          <div className="fade-up">
            <Field label={t('create.field_product_desc')}><textarea className={styles.textarea} value={form.productDesc} onChange={e => update('productDesc', e.target.value)} rows={3} /></Field>
            <button className={styles.aiBtn} onClick={handleGenerateText} disabled={loading.ai}>{loading.ai ? '...' : '✨ Текст и интересы'}</button>
            
            {form.aiInterests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
                {form.aiInterests.map((it, i) => <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(0,122,255,0.1)', color: '#007AFF' }}>{it}</span>)}
              </div>
            )}

            <Field label="Заголовок"><input className={styles.input} value={form.headline} onChange={e => update('headline', e.target.value)} /></Field>
            <Field label="Текст"><textarea className={styles.textarea} value={form.text} onChange={e => update('text', e.target.value)} rows={3} /></Field>

            <div className={styles.creativeGrid}>
              {['photo', 'video', 'reels', 'ai'].map(type => (
                <button key={type} className={`${styles.creativeCard} ${form.creativeType === type ? styles.creativeActive : ''}`} onClick={() => { update('creativeType', type); if(type === 'photo') photoInputRef.current.click(); if(type === 'video') videoInputRef.current.click(); }}>
                  {t(`create.creative.${type}.label`)}
                </button>
              ))}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleMedia(e.target.files[0])} />
            <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleMedia(e.target.files[0])} />

            {generatedImages.length > 0 && form.mediaType !== 'video' && <ImageCarousel images={generatedImages} selectedIndex={selectedIdx} onSelect={idx => update('imagePreview', generatedImages[idx])} />}

            {/* Восстановленный блок выбора категорий рекламы */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '16px 0' }}>
              {adCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => update('adCategory', cat.id)}
                  style={{
                    padding: '10px',
                    borderRadius: 12,
                    border: `2px solid ${form.adCategory === cat.id ? cat.color : 'var(--border)'}`,
                    background: form.adCategory === cat.id ? cat.color + '10' : 'var(--card)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: 18 }}>{cat.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: form.adCategory === cat.id ? cat.color : 'var(--text)' }}>{cat.label}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>{cat.hint}</div>
                </button>
              ))}
            </div>

            <Field label="Промпт для картинки"><textarea className={styles.textarea} value={form.imagePrompt} onChange={e => update('imagePrompt', e.target.value)} rows={2} /></Field>
            <button className={styles.aiBtn} onClick={handleGenerateImage} disabled={loading.image} style={{ background: '#000', color: '#fff' }}>{loading.image ? '🎨 Рисую...' : '🎨 Создать ИИ-креатив'}</button>

            <div className={styles.ctaRow}>
              {['MESSAGE_PAGE', 'WHATSAPP_MESSAGE', 'TELEGRAM', 'LEARN_MORE'].map(c => <button key={c} className={`${styles.ctaButton} ${form.ctaType === c ? styles.ctaActive : ''}`} onClick={() => update('ctaType', c)}>{c.replace('_', ' ')}</button>)}
            </div>
            {form.ctaType === 'WHATSAPP_MESSAGE' && <Field label="WhatsApp"><input className={styles.input} value={form.whatsappNumber} onChange={e => update('whatsappNumber', e.target.value)} /></Field>}
            {(form.ctaType === 'TELEGRAM' || form.ctaType === 'LEARN_MORE') && <Field label="URL"><input className={styles.input} value={form.ctaUrl} onChange={e => update('ctaUrl', e.target.value)} /></Field>}
          </div>
        )}

        {step === 3 && (
          <div className="fade-up">
            {form.imagePreview && <img src={form.imagePreview} style={{ width: '100%', borderRadius: 16, marginBottom: 20 }} />}
            <div className={styles.summary}>
              <SummaryRow label="Бюджет" value={`$${form.budget}`} />
              <SummaryRow label="Гео" value={form.geo} />
              <SummaryRow label="Категория" value={form.adCategory} />
              <SummaryRow label="Кнопка" value={form.ctaType} />
            </div>
            <button className={styles.launchBtn} onClick={handleLaunch} disabled={loading.launch}>{loading.launch ? '🚀...' : '🚀 Запустить рекламу'}</button>
          </div>
        )}
      </div>

      <div className={styles.navBtns}>
        {step > 0 && <button onClick={() => setStep(s => s - 1)} className={styles.backBtn}>{t('create.back')}</button>}
        {step < 3 && <button onClick={() => setStep(s => s + 1)} className={styles.nextBtn}>{t('create.next')}</button>}
      </div>

      <style>{`
        @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  )
}

function Field({ label, children }) { return ( <div style={{ marginBottom: 16 }}><div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>{label}</div>{children}</div> ) }
function SummaryRow({ label, value }) { return ( <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text2)', fontSize: 13 }}>{label}</span><span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span></div> ) }
