-- ClapCrew · RLS de crew_shifts / crew_days + rol dept_head
-- Fase 1 del CLAPCREW_PLAN.md · Ejecutar DESPUÉS de 01_clapcrew_schema.sql
-- Destino final del archivo: ~/ClapCrew/sql/02_clapcrew_rls.sql
--
-- Helpers preexistentes (rls_policies_v2.sql): auth_role(), auth_eid(),
-- auth_production_id(), is_admin().

-- ─── 1. Helpers nuevos ──────────────────────────────────────────────────────
-- Departamento del usuario actual, derivado de su ficha de empleado.
-- No se duplica en profiles: la fuente de verdad es emps.dept.
CREATE OR REPLACE FUNCTION auth_dept()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dept FROM emps WHERE id = auth_eid()
$$;

CREATE OR REPLACE FUNCTION is_dept_head()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(auth_role() = 'dept_head', false)
$$;

REVOKE EXECUTE ON FUNCTION auth_dept(), is_dept_head() FROM anon;

-- ─── 2. RLS activo, sin acceso anon ─────────────────────────────────────────
ALTER TABLE crew_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_days   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON crew_shifts FROM anon;
REVOKE ALL ON crew_days   FROM anon;

-- ─── 3. crew_shifts ─────────────────────────────────────────────────────────
-- admin: todo en su producción · dept_head: solo su departamento
-- empleado: LEE solo sus turnos publicados (lo usa ClapTime para el prefill).
DROP POLICY IF EXISTS "crew_shifts_admin_all"    ON crew_shifts;
DROP POLICY IF EXISTS "crew_shifts_depthead_all" ON crew_shifts;
DROP POLICY IF EXISTS "crew_shifts_self_select"  ON crew_shifts;

CREATE POLICY "crew_shifts_admin_all" ON crew_shifts
  FOR ALL TO authenticated
  USING (auth_role() = 'super_admin' OR (is_admin() AND production_id = auth_production_id()))
  WITH CHECK (auth_role() = 'super_admin' OR (is_admin() AND production_id = auth_production_id()));

CREATE POLICY "crew_shifts_depthead_all" ON crew_shifts
  FOR ALL TO authenticated
  USING (
    is_dept_head() AND production_id = auth_production_id()
    AND eid IN (SELECT id FROM emps WHERE dept = auth_dept() AND production_id = auth_production_id())
  )
  WITH CHECK (
    is_dept_head() AND production_id = auth_production_id()
    AND eid IN (SELECT id FROM emps WHERE dept = auth_dept() AND production_id = auth_production_id())
  );

CREATE POLICY "crew_shifts_self_select" ON crew_shifts
  FOR SELECT TO authenticated
  USING (eid = auth_eid() AND status = 'published');

-- ─── 4. crew_days ───────────────────────────────────────────────────────────
-- admin gestiona; cualquier miembro de la producción LEE los publicados.
DROP POLICY IF EXISTS "crew_days_admin_all"     ON crew_days;
DROP POLICY IF EXISTS "crew_days_depthead_all"  ON crew_days;
DROP POLICY IF EXISTS "crew_days_member_select" ON crew_days;

CREATE POLICY "crew_days_admin_all" ON crew_days
  FOR ALL TO authenticated
  USING (auth_role() = 'super_admin' OR (is_admin() AND production_id = auth_production_id()))
  WITH CHECK (auth_role() = 'super_admin' OR (is_admin() AND production_id = auth_production_id()));

CREATE POLICY "crew_days_member_select" ON crew_days
  FOR SELECT TO authenticated
  USING (production_id = auth_production_id() AND status = 'published');

-- ─── 5. emps: el dept_head necesita leer su departamento para planificar ────
-- La política existente solo da self_select a los no-admin.
DROP POLICY IF EXISTS "emps_depthead_select" ON emps;
CREATE POLICY "emps_depthead_select" ON emps
  FOR SELECT TO authenticated
  USING (is_dept_head() AND production_id = auth_production_id() AND dept = auth_dept());

-- ─── 6. Comprobación ────────────────────────────────────────────────────────
-- SELECT * FROM crew_shifts LIMIT 1;
-- SELECT * FROM crew_days   LIMIT 1;
