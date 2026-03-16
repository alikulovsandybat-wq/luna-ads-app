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
  <title>Privacy Policy - Luna Ads</title>
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
    ul {
      margin: 12px 0 0;
      padding-left: 20px;
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
      <h1>Политика конфиденциальности</h1>
      <p class="meta">Дата обновления: ${updatedAt}</p>

      <section>
        <h2>1. Какие данные мы обрабатываем</h2>
        <p>Сервис Luna Ads может обрабатывать Telegram ID пользователя, технические данные мини-приложения, а также токены и идентификаторы рекламных аккаунтов Meta, если пользователь подключает Facebook для работы с рекламой.</p>
      </section>

      <section>
        <h2>2. Для чего используются данные</h2>
        <p>Данные используются только для авторизации, отображения статистики, запуска и управления рекламными кампаниями, а также для технической поддержки сервиса.</p>
      </section>

      <section>
        <h2>3. Передача и хранение</h2>
        <p>Мы не продаем персональные данные третьим лицам. Данные хранятся в инфраструктуре сервиса и используются только в объеме, необходимом для работы Luna Ads и интеграции с Meta.</p>
      </section>

      <section>
        <h2>4. Удаление данных</h2>
        <p>Чтобы запросить удаление данных или отключение интеграции, напишите на <a href="mailto:testterya@gmail.com">testterya@gmail.com</a>.</p>
      </section>

      <section>
        <h2>5. Контакты</h2>
        <p>По вопросам конфиденциальности и обработки данных: <a href="mailto:testterya@gmail.com">testterya@gmail.com</a>.</p>
      </section>
    </article>
  </main>
</body>
</html>`)
}
