import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './CampaignDetails.module.css'
import { useI18n } from '../i18n'

const API = import.meta.env.VITE_API_URL || ''

function notify(message, callback) {
  if (window.Telegram?.WebApp?.showAlert) {
    window.Telegram.WebApp.showAlert(message, callback)
    return
  }

  window.alert(message)
  callback?.()
}

function normalizeNumber(value, fallback = '') {
  if (value === undefined || value === null) return fallback
  return String(value).replace(',', '.').trim()
}

export default function CampaignDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [campaign, setCampaign] = useState(null)
  const [insights, setInsights] = useState([])
  const [form, setForm] = useState({
    status: 'ACTIVE',
    budget: '',
    geo: '',
    ageMin: '18',
    ageMax: '45',
    interests: ''
  })

  useEffect(() => {
    fetchCampaign()
  }, [id])

  async function fetchCampaign() {
    setLoading(true)
    try {
      const tgData = window.Telegram?.WebApp?.initData || ''
      const res = await fetch(`${API}/api/campaign-detail?id=${encodeURIComponent(id)}`, {
        headers: { 'x-tg-data': tgData }
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data?.error || t('campaign_details.error_load'))

      setCampaign(data.campaign)
      setInsights(data.insights || [])

      setForm({
        status: data.campaign?.status || 'ACTIVE',
        budget: normalizeNumber(data.adset?.budget, ''),
        geo: data.adset?.geo || '',
        ageMin: String(data.adset?.ageMin || '18'),
        ageMax: String(data.adset?.ageMax || '45'),
        interests: data.adset?.interests || ''
      })
    } catch (error) {
      notify(error?.message || t('campaign_details.error_load_generic'))
    }
    setLoading(false)
  }

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function saveChanges() {
    setSaving(true)
    try {
      const tgData = window.Telegram?.WebApp?.initData || ''
      const res = await fetch(`${API}/api/campaign-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tg-data': tgData
        },
        body: JSON.stringify({
          campaignId: id,
          status: form.status,
          budget: form.budget,
          geo: form.geo,
          ageMin: form.ageMin,
          ageMax: form.ageMax,
          interests: form.interests
        })
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data?.error || t('campaign_details.error_save'))

      notify(t('campaign_details.save_success'))
      await fetchCampaign()
    } catch (error) {
      notify(error?.message || t('campaign_details.error_save_generic'))
    }
    setSaving(false)
  }

  const metrics = useMemo(() => {
    if (!campaign?.metrics) return []
    return [
      { label: t('campaign_details.metric.spend'), value: campaign.metrics.spend, accent: '#4b7bff' },
      { label: t('campaign_details.metric.leads'), value: campaign.metrics.leads, accent: '#6f63ff' },
      { label: t('campaign_details.metric.cpl'), value: campaign.metrics.cpl, accent: '#16a34a' },
      { label: t('campaign_details.metric.ctr'), value: campaign.metrics.ctr, accent: '#f59e0b' },
      { label: t('campaign_details.metric.impressions'), value: campaign.metrics.impressions, accent: '#0ea5e9' },
      { label: t('campaign_details.metric.clicks'), value: campaign.metrics.clicks, accent: '#ef4444' }
    ]
  }, [campaign, t])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/campaigns')}>{t('campaign_details.back')}</button>
        <div className={styles.titleBlock}>
          <div className={styles.title}>{campaign?.name || t('campaign_details.title_fallback')}</div>
          <div className={styles.sub}>{campaign?.createdTime || ''}</div>
        </div>
        <button
          className={`${styles.statusBtn} ${form.status === 'ACTIVE' ? styles.on : styles.off}`}
          onClick={() => update('status', form.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')}
        >
          {form.status === 'ACTIVE' ? t('campaign_details.status_active') : t('campaign_details.status_paused')}
        </button>
      </div>

      {loading ? (
        <div className={styles.card}>{t('campaign_details.loading')}</div>
      ) : (
        <>
          <div className={styles.metricsGrid}>
            {metrics.map((metric) => (
              <div key={metric.label} className={styles.metricCard}>
                <div className={styles.metricLabel}>{metric.label}</div>
                <div className={styles.metricValue} style={{ color: metric.accent }}>{metric.value}</div>
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div className={styles.sectionTitle}>{t('campaign_details.section_params')}</div>
            <div className={styles.fieldRow}>
              <label className={styles.label}>{t('campaign_details.field_budget')}</label>
              <input className={styles.input} value={form.budget} onChange={(e) => update('budget', e.target.value)} placeholder="30" />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.label}>{t('campaign_details.field_geo')}</label>
              <input className={styles.input} value={form.geo} onChange={(e) => update('geo', e.target.value)} placeholder={t('campaign_details.field_geo')} />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.label}>{t('campaign_details.field_age')}</label>
              <div className={styles.ageRow}>
                <input className={styles.input} value={form.ageMin} onChange={(e) => update('ageMin', e.target.value)} />
                <span className={styles.ageDash}>—</span>
                <input className={styles.input} value={form.ageMax} onChange={(e) => update('ageMax', e.target.value)} />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.label}>{t('campaign_details.field_interests')}</label>
              <input
                className={styles.input}
                value={form.interests}
                onChange={(e) => update('interests', e.target.value)}
                placeholder={t('campaign_details.interests_placeholder')}
              />
              <div className={styles.hint}>{t('campaign_details.interests_hint')}</div>
            </div>
            <button className={styles.saveBtn} onClick={saveChanges} disabled={saving}>
              {saving ? t('campaign_details.saving') : t('campaign_details.save')}
            </button>
          </div>

          <div className={styles.card}>
            <div className={styles.sectionTitle}>{t('campaign_details.section_efficiency')}</div>
            {insights.length === 0 && <div className={styles.hint}>{t('campaign_details.no_data')}</div>}
            {insights.length > 0 && (
              <div className={styles.table}>
                <div className={styles.tableRow}>
                  <div>{t('campaign_details.table.date')}</div>
                  <div>{t('campaign_details.table.spend')}</div>
                  <div>{t('campaign_details.table.leads')}</div>
                  <div>{t('campaign_details.table.cpl')}</div>
                </div>
                {insights.map((row) => (
                  <div key={row.date} className={styles.tableRow}>
                    <div>{row.date}</div>
                    <div>{row.spend}</div>
                    <div>{row.leads}</div>
                    <div>{row.cpl}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}