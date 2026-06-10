-- CronoCrew: Fichaje Express
-- Ejecuta este SQL en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS express_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  dni         TEXT DEFAULT '',
  dept        TEXT DEFAULT '',
  role        TEXT DEFAULT '',
  date        DATE NOT NULL,
  cited_in    TEXT DEFAULT '09:00',
  cited_out   TEXT DEFAULT '18:00',
  ch          INTEGER DEFAULT 8,
  brk         INTEGER DEFAULT 60,
  entry       TEXT,
  exit        TEXT,
  obs         TEXT,
  status      TEXT DEFAULT 'pending'
              CHECK (status IN ('pending', 'filed', 'imported', 'expired')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '3 days',
  filed_at    TIMESTAMPTZ
);

ALTER TABLE express_links ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer un enlace por su ID (el UUID es el secreto)
CREATE POLICY "express_anon_read" ON express_links
  FOR SELECT TO anon USING (true);

-- Cualquiera puede fichar en un enlace pendiente no expirado
CREATE POLICY "express_anon_file" ON express_links
  FOR UPDATE TO anon
  USING (status = 'pending' AND expires_at > NOW())
  WITH CHECK (status = 'filed');

-- El admin puede insertar (la app usa anon, no Supabase Auth)
CREATE POLICY "express_anon_insert" ON express_links
  FOR INSERT TO anon WITH CHECK (true);

-- El admin (autenticado) tiene acceso total
CREATE POLICY "express_auth_all" ON express_links
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
