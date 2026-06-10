-- =============================================================================
-- CronoCrew: Políticas RLS v2 — separación por rol (admin vs. empleado)
-- Ejecuta TODO este archivo en Supabase → SQL Editor.
-- Sustituye por completo a rls_policies.sql, express_links_setup.sql (políticas)
-- y a las políticas de profiles de auth_migration.sql.
--
-- Modelo:
--   super_admin → acceso total (todas las producciones)
--   admin       → acceso total dentro de su production_id
--   employee    → lee/escribe SOLO sus propios fichajes y solicitudes;
--                 lee su ficha, sus pagos y los festivos de su producción
--   anon        → SIN acceso directo a tablas; fichaje express solo vía RPC
-- =============================================================================

-- ─── 1. Funciones helper ─────────────────────────────────────────────────────
-- SECURITY DEFINER para evitar recursión al leer profiles desde políticas.
-- SET search_path evita ataques de search_path injection (lint de Supabase).

CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_production_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT production_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_company_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_eid()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT eid FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(auth_role() IN ('admin', 'super_admin'), false)
$$;

-- Las helper no deben ser ejecutables por anon
REVOKE EXECUTE ON FUNCTION auth_role(), auth_production_id(), auth_company_id(), auth_eid(), is_admin() FROM anon;

-- ─── 2. Trigger: rellenar production_id si falta ─────────────────────────────
-- Red de seguridad para inserts que no envían production_id (p.ej. fichajes
-- de empleados): se toma del perfil del usuario autenticado.

CREATE OR REPLACE FUNCTION set_default_production_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.production_id IS NULL THEN
    NEW.production_id := auth_production_id();
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['emps','recs','paid','requests','admin_perms','festivos','express_links']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_default_production ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_default_production BEFORE INSERT ON %I
       FOR EACH ROW EXECUTE FUNCTION set_default_production_id()', t);
  END LOOP;
END $$;

-- ─── 3. Activar RLS en TODAS las tablas ──────────────────────────────────────

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE productions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE emps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid          ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_perms   ENABLE ROW LEVEL SECURITY;
ALTER TABLE festivos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE express_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE rec_audit     ENABLE ROW LEVEL SECURITY;

-- ─── 4. Limpiar TODAS las políticas anteriores ───────────────────────────────

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles','companies','productions','emps','recs','paid',
                        'requests','admin_perms','festivos','express_links','rec_audit')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ─── 5. profiles ─────────────────────────────────────────────────────────────
-- Cada usuario lee su propio perfil; los admins, los de su producción.
-- NADIE salvo super_admin escribe (evita auto-escalado de rol).

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  );

CREATE POLICY "profiles_superadmin_write" ON profiles
  FOR ALL TO authenticated
  USING (auth_role() = 'super_admin')
  WITH CHECK (auth_role() = 'super_admin');

-- ─── 6. companies / productions ──────────────────────────────────────────────

CREATE POLICY "companies_select" ON companies
  FOR SELECT TO authenticated
  USING (auth_role() = 'super_admin' OR id = auth_company_id());

CREATE POLICY "companies_superadmin_write" ON companies
  FOR ALL TO authenticated
  USING (auth_role() = 'super_admin')
  WITH CHECK (auth_role() = 'super_admin');

CREATE POLICY "productions_select" ON productions
  FOR SELECT TO authenticated
  USING (auth_role() = 'super_admin' OR company_id = auth_company_id());

CREATE POLICY "productions_superadmin_write" ON productions
  FOR ALL TO authenticated
  USING (auth_role() = 'super_admin')
  WITH CHECK (auth_role() = 'super_admin');

-- ─── 7. emps ─────────────────────────────────────────────────────────────────
-- Admin: todo dentro de su producción. Empleado: SOLO su propia ficha
-- (incluye su config salarial, pero nunca la de compañeros).

CREATE POLICY "emps_admin_all" ON emps
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  );

CREATE POLICY "emps_self_select" ON emps
  FOR SELECT TO authenticated
  USING (id = auth_eid());

-- ─── 8. recs ─────────────────────────────────────────────────────────────────
-- Admin: todo en su producción. Empleado: lee y ficha SOLO sus registros.

CREATE POLICY "recs_admin_all" ON recs
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  );

CREATE POLICY "recs_self_select" ON recs
  FOR SELECT TO authenticated
  USING (eid = auth_eid());

CREATE POLICY "recs_self_insert" ON recs
  FOR INSERT TO authenticated
  WITH CHECK (
    eid = auth_eid()
    AND production_id = auth_production_id()
  );

CREATE POLICY "recs_self_update" ON recs
  FOR UPDATE TO authenticated
  USING (eid = auth_eid() AND deleted_at IS NULL)
  WITH CHECK (
    eid = auth_eid()
    AND production_id = auth_production_id()
    AND deleted_at IS NULL          -- el borrado (soft delete) es cosa de admins
  );

-- ─── 9. paid ─────────────────────────────────────────────────────────────────

CREATE POLICY "paid_admin_all" ON paid
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  );

CREATE POLICY "paid_self_select" ON paid
  FOR SELECT TO authenticated
  USING (eid = auth_eid());

-- ─── 10. requests ────────────────────────────────────────────────────────────
-- Empleado: ve sus solicitudes y crea nuevas (siempre en estado 'pending').

CREATE POLICY "requests_admin_all" ON requests
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  );

CREATE POLICY "requests_self_select" ON requests
  FOR SELECT TO authenticated
  USING (eid = auth_eid());

CREATE POLICY "requests_self_insert" ON requests
  FOR INSERT TO authenticated
  WITH CHECK (
    eid = auth_eid()
    AND production_id = auth_production_id()
    AND status = 'pending'
  );

-- ─── 11. admin_perms: solo admins ────────────────────────────────────────────

CREATE POLICY "admin_perms_admin_all" ON admin_perms
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  );

-- ─── 12. festivos: lectura para toda la producción, escritura admin ──────────

CREATE POLICY "festivos_select" ON festivos
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  );

CREATE POLICY "festivos_admin_write" ON festivos
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  );

-- ─── 13. rec_audit: insert-only, lectura solo admin ──────────────────────────
-- Sin políticas de UPDATE/DELETE → inmutable para todos los clientes.

CREATE POLICY "rec_audit_admin_select" ON rec_audit
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR (is_admin() AND EXISTS (
      SELECT 1 FROM recs
      WHERE recs.id = rec_audit.rec_id
        AND recs.production_id = auth_production_id()
    ))
  );

CREATE POLICY "rec_audit_insert" ON rec_audit
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ─── 14. express_links ───────────────────────────────────────────────────────
-- Admins: gestión completa dentro de su producción.
-- Anon: SIN acceso directo a la tabla (antes podía listar nombres y DNIs).
--       El fichaje express pasa a hacerse vía RPC con el UUID como token.

CREATE POLICY "express_links_admin_all" ON express_links
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR (is_admin() AND production_id = auth_production_id())
  );

-- RPC: obtener UN enlace por su UUID (sin posibilidad de listar)
CREATE OR REPLACE FUNCTION get_express_link(p_id UUID)
RETURNS TABLE (
  id UUID, name TEXT, dept TEXT, role TEXT, date DATE,
  cited_in TEXT, cited_out TEXT, ch INTEGER, brk INTEGER,
  status TEXT, expires_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, dept, role, date, cited_in, cited_out, ch, brk, status, expires_at
  FROM express_links
  WHERE id = p_id
$$;

-- RPC: fichar en un enlace pendiente y no caducado
CREATE OR REPLACE FUNCTION file_express_link(
  p_id UUID, p_entry TEXT, p_exit TEXT, p_obs TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_entry !~ '^\d{2}:\d{2}$' OR p_exit !~ '^\d{2}:\d{2}$' THEN
    RAISE EXCEPTION 'Formato de hora no válido';
  END IF;

  UPDATE express_links
  SET entry    = p_entry,
      exit     = p_exit,
      obs      = NULLIF(TRIM(COALESCE(p_obs, '')), ''),
      status   = 'filed',
      filed_at = NOW()
  WHERE id = p_id
    AND status = 'pending'
    AND expires_at > NOW();

  RETURN FOUND;
END $$;

REVOKE EXECUTE ON FUNCTION get_express_link(UUID), file_express_link(UUID, TEXT, TEXT, TEXT) FROM public;
GRANT  EXECUTE ON FUNCTION get_express_link(UUID), file_express_link(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ─── 15. Verificación ────────────────────────────────────────────────────────
-- a) RLS activo en todas las tablas (relrowsecurity debe ser true):
SELECT relname, relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY relname;

-- b) Políticas creadas:
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
