import { OpenAI } from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  try {
    const { text } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: "Ты эксперт по таргетингу Meta (Facebook). На основе описания продукта предложи 5-7 точных интересов для настройки рекламы на английском языке (так как Meta лучше понимает английские теги). Выдай только список слов через запятую, без лишних пояснений." 
        },
        { role: "user", content: text }
      ],
    });

    const interests = completion.choices[0].message.content.split(',').map(i => i.trim());
    res.status(200).json({ interests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
