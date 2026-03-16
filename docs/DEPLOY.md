# 🚀 Инструкция по деплою Luna Ads

## Шаг 1 — Supabase (база данных)

1. Зайди на **supabase.com** → New Project
2. Название: `luna-ads`, выбери регион: `eu-central-1`
3. Придумай пароль для БД, сохрани его
4. Подожди ~2 минуты пока создаётся проект
5. Зайди в **SQL Editor** → New Query
6. Скопируй содержимое файла `docs/supabase-schema.sql` и нажми **Run**
7. Зайди в **Settings → API** и скопируй:
   - `Project URL` → это `SUPABASE_URL`
   - `service_role` secret → это `SUPABASE_SERVICE_KEY`

---

## Шаг 2 — Anthropic API Key (для ИИ)

1. Зайди на **console.anthropic.com**
2. API Keys → Create Key
3. Скопируй ключ — это `ANTHROPIC_API_KEY`
4. Пополни баланс на $5 (хватит на тысячи генераций)

---

## Шаг 3 — GitHub репозиторий

1. Скачай все файлы из этого проекта
2. Залей в репозиторий `luna-ads-app` на GitHub
3. Структура должна быть такой:
```
luna-ads-app/
├── frontend/
├── api/
├── docs/
├── package.json
├── vercel.json
└── .env.example
```

---

## Шаг 4 — Vercel деплой

1. Зайди на **vercel.com** → Add New Project
2. Выбери репозиторий `luna-ads-app`
3. **ВАЖНО**: Root Directory оставь пустым (не `frontend`)
4. Build Settings:
   - Framework: **Other**
   - Build Command: `cd frontend && npm install && npm run build`
   - Output Directory: `frontend/dist`
5. Нажми **Deploy** — пока будет ошибка, это нормально

---

## Шаг 5 — Переменные окружения в Vercel

Зайди в проект → **Settings → Environment Variables** и добавь:

| Переменная | Значение |
|---|---|
| `TG_BOT_TOKEN` | `8610121034:AAErbEqy8sb3wuIok750xIKiM7XfLAY1H48` |
| `FB_APP_ID` | `795668556422629` |
| `FB_APP_SECRET` | `de0fe88d5f8ef8d1866ec0f2e87e6c01` |
| `ANTHROPIC_API_KEY` | твой ключ с console.anthropic.com |
| `SUPABASE_URL` | из Supabase Settings → API |
| `SUPABASE_SERVICE_KEY` | service_role ключ из Supabase |
| `APP_URL` | `https://luna-ads-app.vercel.app` |
| `FRONTEND_URL` | `https://luna-ads-app.vercel.app` |

После добавления нажми **Redeploy**.

---

## Шаг 6 — Настройка Facebook App

1. Зайди на **developers.facebook.com** → твоё приложение
2. **App Domains**: добавь `luna-ads-app.vercel.app`
3. **Valid OAuth Redirect URIs**: добавь
   `https://luna-ads-app.vercel.app/api/auth/facebook/callback`
4. **Privacy Policy URL**: `https://luna-ads-app.vercel.app/privacy`
5. **Terms of Service URL**: `https://luna-ads-app.vercel.app/terms`

---

## Шаг 7 — Настройка Telegram бота

Открой **@BotFather** и выполни:

```
/setmenubutton
→ выбери @marketologluna_bot
→ Web App
→ введи URL: https://luna-ads-app.vercel.app
→ Текст кнопки: 🚀 Открыть Luna Ads
```

Затем установи вебхук (открой эту ссылку в браузере, заменив домен):
```
https://api.telegram.org/bot8610121034:AAErbEqy8sb3wuIok750xIKiM7XfLAY1H48/setWebhook?url=https://luna-ads-app.vercel.app/api/bot
```

---

## Шаг 8 — Проверка

1. Открой **@marketologluna_bot** в Telegram
2. Нажми `/start`
3. Нажми кнопку "Открыть Luna Ads"
4. Должна открыться страница подключения Facebook
5. Нажми "Подключить Facebook" — откроется браузер с OAuth
6. После авторизации — попадёшь на дашборд

---

## Добавление тестировщиков (пока нет App Review)

1. Зайди на developers.facebook.com → твоё приложение
2. **Roles → Testers → Add Testers**
3. Введи Facebook ID или имя пользователя клиента
4. Клиент должен принять приглашение на facebook.com/settings?tab=business_tools

---

## Частые ошибки

**"No Facebook token"** — пользователь не прошёл OAuth, попроси переподключиться

**"Campaign error"** — проверь что у пользователя есть рекламный аккаунт на Facebook

**Белый экран в Telegram** — проверь что FRONTEND_URL правильный в переменных Vercel

---

## Готово! 🎉

Твоё приложение работает. Следующий шаг — подать на **App Review** в Meta чтобы любой пользователь мог подключиться без добавления в тестировщики.

---

## Шаг 9 — LemonSqueezy (оплата)

1. В LemonSqueezy открой **Settings → Webhooks** и создай webhook.
2. URL: `https://<твой-домен>/api/lemonsqueezy-webhook`
3. Секретный ключ (Signing Secret) сохрани и добавь в Vercel как `LEMONSQUEEZY_WEBHOOK_SECRET`.
4. Добавь в Vercel ссылки на тарифы:
   - `LEMONSQUEEZY_PLAN_1M_URL`
   - `LEMONSQUEEZY_PLAN_3M_URL`
   - `LEMONSQUEEZY_PLAN_6M_URL`

Webhook активирует доступ и продлевает подписку автоматически.
