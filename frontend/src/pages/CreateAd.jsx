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

  const creativeTypes = [
    { id: 'photo', label: t('create.creative.photo.label'), helper: t('create.creative.photo.helper') },
    { id: 'video', label: t('create.creative.video.label'), helper: t('create.creative.video.helper') },
    { id: 'reels', label: t('create.creative.reels.label'), helper: t('create.creative.reels.helper') },
    { id: 'ai', label: t('create.creative.ai.label'), helper: t('create.creative.ai.helper') }
  ]

  const ctaTypes = [
    { id: 'MESSAGE_PAGE', label: t('create.cta.message') },
    { id: 'WHATSAPP_MESSAGE', label: t('create.cta.whatsapp') }
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
    whatsappNumber: ''
  })

  function update(key, val) {
    setForm(f => ({ ...f, [key]: val }))
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

      if (!res.ok) {
        throw new Error(data?.error || 'AI generation failed')
      }

      update('headline', data.headline)
      update('text', data.text)
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
    const timeoutId = setTimeout(() => controller.abort(), 70000)

    setGeneratingImage(true)
    try {
      const tgData = window.Telegram?.WebApp?.initData || ''
      const fd = new FormData()
      fd.append('prompt', form.imagePrompt)
      fd.append('description', form.productDesc)
      fd.append('headline', form.headline)
      fd.append('text', form.text)
      fd.append('geo', form.geo)
      if (form.image && form.mediaType !== 'video') fd.append('reference_image', form.image)

      const res = await fetch(`${API}/api/generate-image`, {
        method: 'POST',
        headers: { 'x-tg-data': tgData },
        body: fd,
        signal: controller.signal
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || t('create.notify.ai_image_fail'))
      }

      const file = base64ToFile(data.imageBase64, data.mimeType || 'image/png', 'ai-creative.png')
      update('image', file)
      update('imagePreview', `data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`)
      update('mediaType', 'image')
      update('mediaName', 'ai-creative.png')
      if (!form.imagePrompt && data.revisedPrompt) update('imagePrompt', data.revisedPrompt)

      notify(
        data.mode === 'edit'
          ? t('create.notify.ai_image_edit_done')
          : t('create.notify.ai_image_new_done')
      )
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
      fd.append('interests', form.interests)
      fd.append('headline', form.headline)
      fd.append('text', form.text)
      fd.append('ctaType', form.ctaType)
      fd.append('whatsappNumber', form.whatsappNumber)
      if (form.image) fd.append('image', form.image)

      await fetch(`${API}/api/launch`, {
        method: 'POST',
        headers: { 'x-tg-data': tgData },
        body: fd
      })
      notify(t('create.notify.launch_success'), () => navigate('/campaigns'))
    } catch {
      notify(t('create.notify.launch_error'))
    }
    setLaunching(false)
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

            {form.headline && (
              <>
                <Field label={t('create.field_headline')}>
                  <input className={styles.input} value={form.headline}
                    onChange={e => update('headline', e.target.value)} />
                </Field>
                <Field label={t('create.field_text')}>
                  <textarea className={styles.textarea} value={form.text}
                    onChange={e => update('text', e.target.value)} rows={4} />
                </Field>
              </>
            )}

            <div className={styles.sectionTitle}>{t('create.section_creative_format')}</div>
            <div className={styles.creativeGrid}>
              {creativeTypes.map(type => (
                <button
                  key={type.id}
                  type="button"
                  className={`${styles.creativeCard} ${form.creativeType === type.id ? styles.creativeActive : ''}`}
                  onClick={() => selectCreative(type.id)}
                >
                  <div className={styles.creativeLabel}>{type.label}</div>
                  <div className={styles.creativeHint}>{type.helper}</div>
                </button>
              ))}
            </div>

            <p className={styles.helper}>
              {t('create.creative.tap_hint')}
            </p>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={e => handleMedia(e.target.files?.[0])}
              style={{display:'none'}}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={e => handleMedia(e.target.files?.[0])}
              style={{display:'none'}}
            />

            {form.image && (
              <div className={styles.mediaPreview}>
                {form.mediaType === 'video'
                  ? <video className={styles.videoPreview} src={form.imagePreview} controls />
                  : <img src={form.imagePreview} alt="" className={styles.preview} />
                }
                {form.mediaName && (
                  <div className={styles.mediaMeta}>{form.mediaType === 'video' ? t('create.summary_creative_video') : t('create.summary_creative_photo')}: {form.mediaName}</div>
                )}
              </div>
            )}

            <Field label={t('create.field_image_prompt')}>
              <textarea
                className={styles.textarea}
                value={form.imagePrompt}
                onChange={e => update('imagePrompt', e.target.value)}
                placeholder={t('create.field_image_prompt_placeholder')}
                rows={3}
              />
            </Field>

            <p className={styles.helper}>
              {t('create.image_ref_hint')}
            </p>

            <button className={styles.aiBtn} onClick={generateImageAI} disabled={generatingImage || (!form.productDesc && !form.imagePrompt)}>
              {generatingImage ? t('create.ai_image_loading') : t('create.ai_image')}
            </button>

            <div className={styles.sectionTitle}>{t('create.section_cta')}</div>
            <div className={styles.ctaRow}>
              {ctaTypes.map(type => (
                <button
                  key={type.id}
                  type="button"
                  className={`${styles.ctaButton} ${form.ctaType === type.id ? styles.ctaActive : ''}`}
                  onClick={() => update('ctaType', type.id)}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {form.ctaType === 'WHATSAPP_MESSAGE' && (
              <Field label={t('create.field_whatsapp')}>
                <input
                  className={styles.input}
                  value={form.whatsappNumber}
                  onChange={e => update('whatsappNumber', e.target.value)}
                  placeholder={t('create.whatsapp_placeholder')}
                />
              </Field>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="fade-up">
            <div className={styles.summary}>
              <SummaryRow label={t('create.summary_budget')} value={`$${form.budget} / ${t('period.days_short')}`} />
              <SummaryRow label={t('create.summary_geo')} value={form.geo} />
              <SummaryRow label={t('create.summary_age')} value={`${form.ageMin}–${form.ageMax}`} />
              <SummaryRow label={t('create.summary_headline')} value={form.headline || '—'} />
              <SummaryRow label={t('create.summary_text')} value={form.text ? form.text.slice(0,60)+'…' : '—'} />
              <SummaryRow
                label={t('create.summary_creative')}
                value={form.image
                  ? (form.mediaType === 'video' ? t('create.summary_creative_video') : t('create.summary_creative_photo'))
                  : t('create.summary_creative_missing')
                }
              />
            </div>

            <button
              className={styles.launchBtn}
              onClick={launch}
              disabled={launching || !form.headline}
            >
              {launching ? t('create.launching') : t('create.launch')}
            </button>
          </div>
        )}
      </div>

      <div className={styles.navBtns}>
        {step > 0 && (
          <button className={styles.backBtn} onClick={() => setStep(s => s - 1)}>{t('create.back')}</button>
        )}
        {step < 3 && (
          <button className={styles.nextBtn} onClick={() => setStep(s => s + 1)}>
            {t('create.next')}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:12,color:'var(--text2)',marginBottom:6,fontWeight:500}}>{label}</div>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
      <span style={{color:'var(--text2)',fontSize:13}}>{label}</span>
      <span style={{color:'var(--text)',fontSize:13,fontWeight:500,maxWidth:'60%',textAlign:'right'}}>{value}</span>
    </div>
  )
}
