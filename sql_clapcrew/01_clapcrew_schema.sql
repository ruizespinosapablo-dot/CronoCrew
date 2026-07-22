-- ClapCrew · Esquema: turnos/citaciones y orden del día
-- Fase 1 del CLAPCREW_PLAN.md · Ejecutar en Supabase → SQL Editor.
-- Destino final del archivo: ~/ClapCrew/sql/01_clapcrew_schema.sql

-- ─── 0. Rol nuevo: dept_head ─────────────────────────────────────────────────
-- profiles.role tiene un CHECK que solo admite super_admin/admin/employee
-- (auth_migration.sql). Sin este ALTER no se puede asignar 'dept_head' a nadie
-- y las políticas de §5 quedarían inertes.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'dept_head', 'employee'));

-- ─── 1. Turno/citación planificada de UNA persona en UNA fecha ───────────────
CREATE TABLE IF NOT EXISTS crew_shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  eid           TEXT NOT NULL,               -- referencia lógica a emps.id
  date          DATE NOT NULL,
  cited_in      TEXT NOT NULL,               -- 'HH:MM'
  cited_out     TEXT NOT NULL,               -- 'HH:MM'
  brk           INTEGER NOT NULL DEFAULT 60, -- descanso en min (0 = sin descanso)
  location      TEXT,                        -- set/localización (texto libre v1)
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_by    UUID,                        -- auth.uid() del planificador
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (eid, date)                         -- una citación por persona y día
);
CREATE INDEX IF NOT EXISTS crew_shifts_prod_date ON crew_shifts (production_id, date);
CREATE INDEX IF NOT EXISTS crew_shifts_eid_date  ON crew_shifts (eid, date);

-- ─── 2. Orden del día / call sheet de la producción (una por fecha) ──────────
CREATE TABLE IF NOT EXISTS crew_days (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  title         TEXT,                        -- p.ej. 'Día 23 · Rodaje exterior plaza'
  general_call  TEXT,                        -- citación general 'HH:MM' (informativa)
  location      TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (production_id, date)
);
CREATE INDEX IF NOT EXISTS crew_days_prod_date ON crew_days (production_id, date);

-- ─── 2b. RLS desde el minuto cero ───────────────────────────────────────────
-- Se activa aquí, no en el 02, para que las tablas no queden ni un instante
-- accesibles con la anon key. Sin políticas, RLS activo = todo denegado;
-- las políticas llegan en 02_clapcrew_rls.sql.
ALTER TABLE crew_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_days   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON crew_shifts FROM anon;
REVOKE ALL ON crew_days   FROM anon;

-- ─── 3. production_id por defecto (misma red de seguridad que el resto) ──────
-- Reutiliza set_default_production_id() de rls_policies_v2.sql.
DROP TRIGGER IF EXISTS trg_default_production ON crew_shifts;
CREATE TRIGGER trg_default_production BEFORE INSERT ON crew_shifts
  FOR EACH ROW EXECUTE FUNCTION set_default_production_id();

DROP TRIGGER IF EXISTS trg_default_production ON crew_days;
CREATE TRIGGER trg_default_production BEFORE INSERT ON crew_days
  FOR EACH ROW EXECUTE FUNCTION set_default_production_id();

-- ─── 4. updated_at automático ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_updated_at ON crew_shifts;
CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON crew_shifts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_updated_at ON crew_days;
CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON crew_days
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
