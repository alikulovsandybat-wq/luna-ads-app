import { useRef, useState, useEffect, useCallback } from 'react'

const CANVAS_SIZE = 1080
const DISPLAY_SIZE = Math.min(window.innerWidth - 32, 400)
const SCALE = DISPLAY_SIZE / CANVAS_SIZE

const FONTS = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
]

const COLORS = [
  '#FFFFFF', '#000000', '#007AFF', '#FF3B30',
  '#FF9500', '#FFCC00', '#34C759', '#5AC8FA',
  '#AF52DE', '#FF2D55', '#1C1C1E', '#F2F2F7',
]

const API = import.meta.env.VITE_API_URL || ''

function defaultLayers(headline, subtext, cta) {
  return [
    {
      id: 1,
      text: headline || 'Заголовок',
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE * 0.65,
      fontSize: 72,
      fontFamily: 'Inter, sans-serif',
      color: '#FFFFFF',
      bold: true,
      italic: false,
      align: 'center',
      shadow: true,
    },
    {
      id: 2,
      text: subtext || 'Подзаголовок или описание',
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE * 0.75,
      fontSize: 44,
      fontFamily: 'Inter, sans-serif',
      color: '#FFFFFF',
      bold: false,
      italic: false,
      align: 'center',
      shadow: true,
    },
    {
      id: 3,
      text: cta || 'Узнать подробнее',
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE * 0.87,
      fontSize: 40,
      fontFamily: 'Inter, sans-serif',
      color: '#FFFFFF',
      bold: true,
      italic: false,
      align: 'center',
      shadow: false,
      pill: true,
      pillColor: '#007AFF',
    },
  ]
}

export default function CreativeEditor({ imageUrl, rawImageFile, headline, subtext, cta, onExport, onClose }) {
  const canvasRef = useRef(null)
  const [layers, setLayers] = useState(() => defaultLayers(headline, subtext, cta))
  const [selected, setSelected] = useState(1)
  const [dragging, setDragging] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [bgImage, setBgImage] = useState(null)
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl)
  const [exporting, setExporting] = useState(false)
  const [photoroomLoading, setPhotoroomLoading] = useState(false)
  const [photoroomMode, setPhotoroomMode] = useState('beautify')

  function getAuthHeaders() {
    return {
      'x-tg-data': window.Telegram?.WebApp?.initData || '',
      'x-tg-userid': localStorage.getItem('luna_tg_userid') || ''
    }
  }

  async function processWithPhotoroom(mode) {
    const fileToProcess = rawImageFile
    if (!fileToProcess && !currentImageUrl) return

    setPhotoroomLoading(true)
    try {
      const fd = new FormData()

      if (fileToProcess) {
        fd.append('image', fileToProcess)
      } else {
        // Конвертируем dataUrl в blob если нет файла
        const res = await fetch(currentImageUrl)
        const blob = await res.blob()
        fd.append('image', blob, 'image.jpg')
      }
      fd.append('mode', mode)

      const res = await fetch(`${API}/api/photoroom`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd
      })

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Photoroom failed')

      // Обновляем фон в редакторе
      setCurrentImageUrl(data.dataUrl)
      const img = new Image()
      img.onload = () => setBgImage(img)
      img.src = data.dataUrl

    } catch (e) {
      alert('Ошибка обработки: ' + e.message)
    } finally {
      setPhotoroomLoading(false)
    }
  }

  // Загружаем фоновое изображение
  useEffect(() => {
    if (!currentImageUrl) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setBgImage(img)
    img.onerror = () => setBgImage(null)
    img.src = currentImageUrl
  }, [currentImageUrl])

  // Рендерим canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Фон
    if (bgImage) {
      // Cover fit
      const scale = Math.max(CANVAS_SIZE / bgImage.width, CANVAS_SIZE / bgImage.height)
      const w = bgImage.width * scale
      const h = bgImage.height * scale
      const ox = (CANVAS_SIZE - w) / 2
      const oy = (CANVAS_SIZE - h) / 2
      ctx.drawImage(bgImage, ox, oy, w, h)
    } else {
      // Градиент-заглушка
      const grad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      grad.addColorStop(0, '#1a1a2e')
      grad.addColorStop(1, '#16213e')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    }

    // Затемнение снизу для читаемости текста
    const overlay = ctx.createLinearGradient(0, CANVAS_SIZE * 0.4, 0, CANVAS_SIZE)
    overlay.addColorStop(0, 'rgba(0,0,0,0)')
    overlay.addColorStop(1, 'rgba(0,0,0,0.65)')
    ctx.fillStyle = overlay
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Слои текста
    layers.forEach(layer => {
      const isSelected = layer.id === selected
      const fs = layer.fontSize
      const weight = layer.bold ? 'bold' : 'normal'
      const style = layer.italic ? 'italic' : 'normal'
      ctx.font = `${style} ${weight} ${fs}px ${layer.fontFamily}`
      ctx.textAlign = layer.align
      ctx.textBaseline = 'middle'

      // Pill (кнопка CTA)
      if (layer.pill) {
        const metrics = ctx.measureText(layer.text)
        const pw = metrics.width + 80
        const ph = fs + 40
        const px = layer.x - pw / 2
        const py = layer.y - ph / 2
        ctx.fillStyle = layer.pillColor || '#007AFF'
        roundRect(ctx, px, py, pw, ph, ph / 2)
        ctx.fill()
      }

      // Тень
      if (layer.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.8)'
        ctx.shadowBlur = 12
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
      } else {
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
      }

      ctx.fillStyle = layer.color
      ctx.fillText(layer.text, layer.x, layer.y)

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      // Рамка выделения
      if (isSelected) {
        const metrics = ctx.measureText(layer.text)
        const tw = metrics.width
        const th = fs
        const padding = 16
        ctx.strokeStyle = '#007AFF'
        ctx.lineWidth = 3
        ctx.setLineDash([10, 5])
        const rx = layer.align === 'center' ? layer.x - tw / 2 - padding
                 : layer.align === 'right'  ? layer.x - tw - padding
                 : layer.x - padding
        ctx.strokeRect(rx, layer.y - th / 2 - padding, tw + padding * 2, th + padding * 2)
        ctx.setLineDash([])
      }
    })
  }, [layers, selected, bgImage])

  useEffect(() => { render() }, [render])

  // Helpers для canvas координат
  function canvasCoords(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) / SCALE,
      y: (clientY - rect.top) / SCALE,
    }
  }

  function hitTest(x, y) {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    // Проверяем в обратном порядке (верхний слой первый)
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      const fs = layer.fontSize
      const weight = layer.bold ? 'bold' : 'normal'
      ctx.font = `${weight} ${fs}px ${layer.fontFamily}`
      const metrics = ctx.measureText(layer.text)
      const tw = metrics.width
      const th = fs
      const padding = 20
      const lx = layer.align === 'center' ? layer.x - tw / 2 - padding
               : layer.align === 'right'  ? layer.x - tw - padding
               : layer.x - padding
      if (
        x >= lx && x <= lx + tw + padding * 2 &&
        y >= layer.y - th / 2 - padding && y <= layer.y + th / 2 + padding
      ) return layer.id
    }
    return null
  }

  function onPointerDown(e) {
    e.preventDefault()
    const { x, y } = canvasCoords(e)
    const hit = hitTest(x, y)
    if (hit) {
      const layer = layers.find(l => l.id === hit)
      setSelected(hit)
      setDragging(hit)
      setDragOffset({ x: x - layer.x, y: y - layer.y })
    }
  }

  function onPointerMove(e) {
    if (!dragging) return
    e.preventDefault()
    const { x, y } = canvasCoords(e)
    setLayers(prev => prev.map(l =>
      l.id === dragging
        ? { ...l, x: Math.max(0, Math.min(CANVAS_SIZE, x - dragOffset.x)), y: Math.max(0, Math.min(CANVAS_SIZE, y - dragOffset.y)) }
        : l
    ))
  }

  function onPointerUp() { setDragging(null) }

  function updateLayer(id, changes) {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l))
  }

  function addLayer() {
    const newId = Date.now()
    setLayers(prev => [...prev, {
      id: newId,
      text: 'Новый текст',
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE / 2,
      fontSize: 56,
      fontFamily: 'Inter, sans-serif',
      color: '#FFFFFF',
      bold: false,
      italic: false,
      align: 'center',
      shadow: true,
      pill: false,
    }])
    setSelected(newId)
  }

  function removeLayer(id) {
    if (layers.length <= 1) return
    setLayers(prev => prev.filter(l => l.id !== id))
    setSelected(layers.find(l => l.id !== id)?.id)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const canvas = canvasRef.current
      // Рендерим без рамки выделения
      const savedSelected = selected
      setSelected(null)
      await new Promise(r => setTimeout(r, 50))

      canvas.toBlob(blob => {
        const file = new File([blob], 'creative.png', { type: 'image/png' })
        const previewUrl = URL.createObjectURL(blob)
        onExport({ file, previewUrl })
        setSelected(savedSelected)
        setExporting(false)
      }, 'image/png', 1.0)
    } catch (e) {
      console.error('Export error:', e)
      setExporting(false)
    }
  }

  const activeLayer = layers.find(l => l.id === selected)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto'
    }}>
      {/* Шапка */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0
      }}>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
          borderRadius: 10, padding: '8px 14px', fontSize: 14, cursor: 'pointer'
        }}>← Назад</button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>✏️ Редактор</span>
        <button onClick={handleExport} disabled={exporting} style={{
          background: '#007AFF', border: 'none', color: '#fff',
          borderRadius: 10, padding: '8px 16px', fontSize: 14,
          fontWeight: 700, cursor: 'pointer', opacity: exporting ? 0.7 : 1
        }}>
          {exporting ? '⌛' : '✅ Готово'}
        </button>
      </div>

      {/* Панель Photoroom */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ✨ Photoroom AI обработка
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { mode: 'remove_bg', label: '✂️ Убрать фон', hint: 'прозрачный PNG' },
            { mode: 'beautify',  label: '✨ Beautify',   hint: 'белый фон + тень' },
            { mode: 'full',      label: '🎨 AI фон',     hint: 'AI генерация фона' },
          ].map(({ mode, label, hint }) => (
            <button
              key={mode}
              onClick={() => processWithPhotoroom(mode)}
              disabled={photoroomLoading}
              style={{
                padding: '8px 14px', borderRadius: 10, border: 'none', cursor: photoroomLoading ? 'wait' : 'pointer',
                background: photoroomMode === mode ? 'rgba(0,122,255,0.3)' : 'rgba(255,255,255,0.08)',
                color: '#fff', fontSize: 13, opacity: photoroomLoading ? 0.6 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2
              }}
              onMouseEnter={() => setPhotoroomMode(mode)}
            >
              <span style={{ fontWeight: 600 }}>{photoroomLoading && photoroomMode === mode ? '⌛ Обрабатываю...' : label}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{
              width: DISPLAY_SIZE, height: DISPLAY_SIZE,
              borderRadius: 16, display: 'block',
              touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
          />
          <div style={{
            position: 'absolute', bottom: 8, left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)', borderRadius: 8,
            padding: '4px 10px', color: 'rgba(255,255,255,0.7)', fontSize: 11,
            whiteSpace: 'nowrap'
          }}>
            👆 Перетаскивай надписи
          </div>
        </div>
      </div>

      {/* Список слоёв */}
      <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {layers.map(layer => (
            <button key={layer.id} onClick={() => setSelected(layer.id)} style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 10, border: 'none',
              background: layer.id === selected ? '#007AFF' : 'rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 13, cursor: 'pointer', maxWidth: 140,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {layer.text.slice(0, 16)}{layer.text.length > 16 ? '…' : ''}
            </button>
          ))}
          <button onClick={addLayer} style={{
            flexShrink: 0, padding: '6px 12px', borderRadius: 10, border: '1.5px dashed rgba(255,255,255,0.3)',
            background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer'
          }}>+ Текст</button>
        </div>
      </div>

      {/* Панель редактирования активного слоя */}
      {activeLayer && (
        <div style={{
          margin: '0 16px 16px',
          background: 'rgba(255,255,255,0.07)',
          borderRadius: 16, padding: 16, flexShrink: 0
        }}>
          {/* Текст */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>ТЕКСТ</div>
            <textarea
              value={activeLayer.text}
              onChange={e => updateLayer(activeLayer.id, { text: e.target.value })}
              rows={2}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', fontSize: 15, resize: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Размер шрифта */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>РАЗМЕР</span>
              <span style={{ fontSize: 12, color: '#007AFF', fontWeight: 700 }}>{activeLayer.fontSize}px</span>
            </div>
            <input
              type="range" min="24" max="160" step="4"
              value={activeLayer.fontSize}
              onChange={e => updateLayer(activeLayer.id, { fontSize: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: '#007AFF' }}
            />
          </div>

          {/* Шрифт */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>ШРИФТ</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FONTS.map(f => (
                <button key={f.value} onClick={() => updateLayer(activeLayer.id, { fontFamily: f.value })}
                  style={{
                    padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: activeLayer.fontFamily === f.value ? '#007AFF' : 'rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 12, fontFamily: f.value
                  }}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* Цвет текста */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>ЦВЕТ ТЕКСТА</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => updateLayer(activeLayer.id, { color: c })}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: activeLayer.color === c ? '3px solid #007AFF' : '2px solid rgba(255,255,255,0.2)',
                    flexShrink: 0
                  }} />
              ))}
              <input type="color" value={activeLayer.color}
                onChange={e => updateLayer(activeLayer.id, { color: e.target.value })}
                style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, background: 'none' }}
              />
            </div>
          </div>

          {/* Стиль + выравнивание + pill */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { label: 'Ж', key: 'bold', active: activeLayer.bold },
              { label: 'К', key: 'italic', active: activeLayer.italic },
              { label: 'Тень', key: 'shadow', active: activeLayer.shadow },
            ].map(({ label, key, active }) => (
              <button key={key} onClick={() => updateLayer(activeLayer.id, { [key]: !active })}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: active ? '#007AFF' : 'rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 13, fontWeight: key === 'bold' ? 'bold' : 'normal',
                  fontStyle: key === 'italic' ? 'italic' : 'normal'
                }}>{label}</button>
            ))}
            {['left', 'center', 'right'].map(a => (
              <button key={a} onClick={() => updateLayer(activeLayer.id, { align: a })}
                style={{
                  padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: activeLayer.align === a ? '#007AFF' : 'rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 13
                }}>
                {a === 'left' ? '⬛⬜⬜' : a === 'center' ? '⬜⬛⬜' : '⬜⬜⬛'}
              </button>
            ))}
          </div>

          {/* Pill (кнопка) */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <button onClick={() => updateLayer(activeLayer.id, { pill: !activeLayer.pill })}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeLayer.pill ? '#007AFF' : 'rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 13
              }}>🔵 Кнопка</button>
            {activeLayer.pill && (
              <>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Цвет кнопки:</span>
                {['#007AFF', '#34C759', '#FF3B30', '#FF9500', '#AF52DE', '#1C1C1E'].map(c => (
                  <div key={c} onClick={() => updateLayer(activeLayer.id, { pillColor: c })}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: activeLayer.pillColor === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                      flexShrink: 0
                    }} />
                ))}
              </>
            )}
          </div>

          {/* Удалить слой */}
          {layers.length > 1 && (
            <button onClick={() => removeLayer(activeLayer.id)}
              style={{
                marginTop: 8, padding: '6px 14px', borderRadius: 8, border: 'none',
                background: 'rgba(255,59,48,0.2)', color: '#FF3B30',
                fontSize: 13, cursor: 'pointer'
              }}>🗑 Удалить слой</button>
          )}
        </div>
      )}
    </div>
  )
}

// Вспомогательная функция — скруглённый прямоугольник
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
