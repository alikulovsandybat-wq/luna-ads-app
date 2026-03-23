export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  
  const { renderId } = req.query
  if (!renderId) return res.status(400).json({ error: 'renderId required' })

  try {
    const statusRes = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      headers: { 'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}` }
    })
    const status = await statusRes.json()

    if (status.status === 'succeeded') {
      // Скачиваем и отдаём base64
      const bannerRes = await fetch(status.url)
      const finalBuffer = Buffer.from(await bannerRes.arrayBuffer())
      return res.status(200).json({
        status: 'done',
        imageBase64: finalBuffer.toString('base64'),
        mimeType: 'image/jpeg'
      })
    }

    if (status.status === 'failed') {
      return res.status(500).json({ 
        status: 'failed', 
        error: status.error_message || 'Render failed' 
      })
    }

    // Ещё рендерится
    return res.status(200).json({ status: 'processing' })

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
