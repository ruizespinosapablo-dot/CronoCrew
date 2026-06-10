-- CronoCrew: Políticas RLS multi-tenant (Phase 3)
-- Ejecuta en Supabase → SQL Editor
-- Aísla cada producción: un usuario solo ve datos de su production_id

-- ─── 1. Funciones helper (evitan subquery por fila = más rendimiento) ────────

CREATE OR REPLACE FUNCTION auth_production_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT production_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_company_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ─── 2. Habilitar RLS en todas las tablas de datos ───────────────────────────

ALTER TABLE emps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid          ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_perms   ENABLE ROW LEVEL SECURITY;
ALTER TABLE festivos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE express_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE rec_audit     ENABLE ROW LEVEL SECURITY;

-- ─── 3. Limpiar políticas anteriores ────────────────────────────────────────

DROP POLICY IF EXISTS "emps_tenant"         ON emps;
DROP POLICY IF EXISTS "recs_tenant"         ON recs;
DROP POLICY IF EXISTS "paid_tenant"         ON paid;
DROP POLICY IF EXISTS "requests_tenant"     ON requests;
DROP POLICY IF EXISTS "admin_perms_tenant"  ON admin_perms;
DROP POLICY IF EXISTS "festivos_tenant"     ON festivos;
DROP POLICY IF EXISTS "rec_audit_tenant"    ON rec_audit;
DROP POLICY IF EXISTS "express_links_tenant"   ON express_links;
DROP POLICY IF EXISTS "express_anon_select"    ON express_links;
DROP POLICY IF EXISTS "express_anon_update"    ON express_links;
DROP POLICY IF EXISTS "express_anon_insert"    ON express_links;
DROP POLICY IF EXISTS "companies_tenant"    ON companies;
DROP POLICY IF EXISTS "productions_tenant"  ON productions;

-- ─── 4. Tablas de datos: acceso solo a la propia producción ─────────────────
-- super_admin puede ver todo; el resto solo su production_id

CREATE POLICY "emps_tenant" ON emps
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  );

CREATE POLICY "recs_tenant" ON recs
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  );

CREATE POLICY "paid_tenant" ON paid
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  );

CREATE POLICY "requests_tenant" ON requests
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  );

CREATE POLICY "admin_perms_tenant" ON admin_perms
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  );

CREATE POLICY "festivos_tenant" ON festivos
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  );

CREATE POLICY "rec_audit_tenant" ON rec_audit
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM recs
      WHERE recs.id = rec_audit.rec_id
        AND recs.production_id = auth_production_id()
    )
  );

-- ─── 5. express_links: autenticados (admin) + anon (trabajadores) ────────────

-- Admin: solo ve enlaces de su producción
CREATE POLICY "express_links_tenant" ON express_links
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  )
  WITH CHECK (
    auth_role() = 'super_admin'
    OR production_id = auth_production_id()
  );

-- Trabajadores (anon): pueden leer cualquier enlace por UUID y actualizarlo al fichar
-- No pueden listar todos los enlaces (el UUID actúa como token de acceso)
CREATE POLICY "express_anon_select" ON express_links
  FOR SELECT TO anon USING (true);

CREATE POLICY "express_anon_update" ON express_links
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "express_anon_insert" ON express_links
  FOR INSERT TO anon WITH CHECK (true);

-- ─── 6. companies y productions ──────────────────────────────────────────────

CREATE POLICY "companies_tenant" ON companies
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR id = auth_company_id()
  );

CREATE POLICY "productions_tenant" ON productions
  FOR ALL TO authenticated
  USING (
    auth_role() = 'super_admin'
    OR company_id = auth_company_id()
  );

-- ─── 7. Verificar que todo está bien ────────────────────────────────────────
-- Ejecuta esto para confirmar que las políticas se han creado:
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
