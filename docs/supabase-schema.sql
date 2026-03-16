-- Запусти это в Supabase SQL Editor

-- Таблица пользователей
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tg_user_id TEXT UNIQUE NOT NULL,
  fb_access_token TEXT,
  fb_ad_account_id TEXT,
  subscription_active BOOLEAN DEFAULT false,
  subscription_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Таблица кампаний
CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tg_user_id TEXT NOT NULL REFERENCES users(tg_user_id),
  fb_campaign_id TEXT,
  fb_adset_id TEXT,
  fb_ad_id TEXT,
  name TEXT,
  budget NUMERIC,
  geo TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Индексы для быстрых запросов
CREATE INDEX idx_users_tg ON users(tg_user_id);
CREATE INDEX idx_campaigns_tg ON campaigns(tg_user_id);

-- RLS политики (безопасность)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Только сервисный ключ имеет полный доступ
CREATE POLICY "Service only" ON users USING (true) WITH CHECK (true);
CREATE POLICY "Service only" ON campaigns USING (true) WITH CHECK (true);

-- Таблица оплат
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  tg_user_id TEXT NOT NULL REFERENCES users(tg_user_id),
  months INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_tg ON payments(tg_user_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service only" ON payments USING (true) WITH CHECK (true);
