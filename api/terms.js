export default function handler(req, res) {
  const updatedAt = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date())

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms of Service - Luna Ads</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f3ff;
      --card: #ffffff;
      --text: #1f1637;
      --muted: #5e5873;
      --accent: #7c5cfc;
      --border: rgba(124, 92, 252, 0.18);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Arial, sans-serif;
      background:
        radial-gradient(circle at top, rgba(124, 92, 252, 0.14), transparent 32%),
        linear-gradient(180deg, #faf8ff 0%, var(--bg) 100%);
      color: var(--text);
      line-height: 1.7;
    }
    main {
      max-width: 880px;
      margin: 0 auto;
      padding: 48px 20px 72px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 18px 60px rgba(32, 22, 58, 0.08);
    }
    .eyebrow {
      display: inline-block;
      margin-bottom: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(124, 92, 252, 0.1);
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(32px, 5vw, 46px);
      line-height: 1.05;
    }
    .meta,
    p,
    li {
      color: var(--muted);
      font-size: 16px;
    }
    section + section {
      margin-top: 28px;
      padding-top: 28px;
      border-top: 1px solid rgba(124, 92, 252, 0.12);
    }
    h2 {
      margin: 0 0 12px;
      font-size: 22px;
      color: var(--text);
    }
    a {
      color: var(--accent);
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <main>
    <article class="card">
      <span class="eyebrow">Luna Ads</span>
      <h1>Пользовательское соглашение</h1>
      <p class="meta">Дата обновления: ${updatedAt}</p>

      <section>
        <h2>1. Общие положения</h2>
        <p>Luna Ads предоставляет пользователю доступ к инструментам просмотра статистики и управления рекламой Meta через Telegram Mini App.</p>
      </section>

      <section>
        <h2>2. Использование сервиса</h2>
        <p>Пользователь обязуется использовать сервис законно, не нарушать правила Telegram, Meta и применимые требования рекламных платформ.</p>
      </section>

      <section>
        <h2>3. Ответственность пользователя</h2>
        <p>Пользователь самостоятельно отвечает за содержание рекламных материалов, настройки кампаний, бюджет и соответствие рекламной деятельности требованиям Meta.</p>
      </section>

      <section>
        <h2>4. Ограничение ответственности</h2>
        <p>Luna Ads не гарантирует конкретные рекламные результаты и не несет ответственность за решения платформ Meta, блокировки, отклонение объявлений или иные внешние ограничения.</p>
      </section>

      <section>
        <h2>5. Контакты</h2>
        <p>По вопросам использования сервиса: <a href="mailto:testterya@gmail.com">testterya@gmail.com</a>.</p>
      </section>
    </article>
  </main>
</body>
</html>`)
}
