-- CronoCrew: Esquema multi-tenant (Phase 2)
-- Ejecuta en Supabase → SQL Editor

-- ─── 1. Tabla de productoras ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  nif        TEXT,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Tabla de producciones ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  season     TEXT,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. Añadir production_id a todas las tablas de datos ────────────────────
ALTER TABLE emps          ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES productions(id);
ALTER TABLE recs          ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES productions(id);
ALTER TABLE paid          ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES productions(id);
ALTER TABLE requests      ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES productions(id);
ALTER TABLE admin_perms   ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES productions(id);
ALTER TABLE festivos      ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES productions(id);
ALTER TABLE express_links ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES productions(id);

-- ─── 4. Añadir company_id y production_id a perfiles ─────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id    UUID REFERENCES companies(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES productions(id);

-- ─── 5. Crear Bambú Producciones + La Promesa y migrar datos existentes ───────
DO $$
DECLARE
  v_company_id    UUID;
  v_production_id UUID;
BEGIN
  -- Crear productora
  INSERT INTO companies (name, nif)
  VALUES ('Bambú Producciones, S.L.', 'B36557916')
  RETURNING id INTO v_company_id;

  -- Crear producción La Promesa 5T
  INSERT INTO productions (company_id, name, season)
  VALUES (v_company_id, 'La Promesa', '5T')
  RETURNING id INTO v_production_id;

  -- Migrar todos los datos existentes a La Promesa
  UPDATE emps          SET production_id = v_production_id WHERE production_id IS NULL;
  UPDATE recs          SET production_id = v_production_id WHERE production_id IS NULL;
  UPDATE paid          SET production_id = v_production_id WHERE production_id IS NULL;
  UPDATE requests      SET production_id = v_production_id WHERE production_id IS NULL;
  UPDATE admin_perms   SET production_id = v_production_id WHERE production_id IS NULL;
  UPDATE festivos      SET production_id = v_production_id WHERE production_id IS NULL;
  UPDATE express_links SET production_id = v_production_id WHERE production_id IS NULL;

  RAISE NOTICE 'company_id    = %', v_company_id;
  RAISE NOTICE 'production_id = %', v_production_id;
END $$;

-- ─── 6. Ver los UUIDs generados ──────────────────────────────────────────────
-- Cópialos para el paso siguiente
SELECT id AS company_id, name FROM companies;
SELECT id AS production_id, name, season FROM productions;

-- ─── 7. Asignar la producción al perfil del admin ────────────────────────────
-- Sustituye los UUIDs por los del paso anterior
-- UPDATE profiles
-- SET company_id    = '<company_id>',
--     production_id = '<production_id>'
-- WHERE id = '<tu_uuid_de_auth>';
