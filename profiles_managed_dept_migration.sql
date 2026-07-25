-- ClapSuite · El jefe de equipo puede gestionar CUALQUIER departamento
--
-- Hasta ahora, el departamento que gestiona un jefe de equipo salía de su ficha
-- (emps.dept). Eso ataba "de qué departamento eres" con "qué departamento
-- diriges". Con este cambio, el admin puede nombrar a cualquier persona jefe de
-- cualquier departamento: el departamento GESTIONADO se guarda aparte, en
-- profiles.managed_dept, y la seguridad lo respeta.
--
-- Ejecutar en Supabase → SQL Editor. Afecta a ClapTime y ClapCrew por igual.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS managed_dept TEXT;

-- auth_dept() pasa a devolver el departamento que la persona GESTIONA:
--   · si tiene managed_dept fijado (jefe asignado por el admin), ese;
--   · si no, el de su ficha (compatibilidad con lo de antes).
CREATE OR REPLACE FUNCTION auth_dept()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    NULLIF((SELECT managed_dept FROM profiles WHERE id = auth.uid()), ''),
    (SELECT dept FROM emps WHERE id = auth_eid())
  )
$$;

-- Nota: el trigger guard_profile_update ya permite al admin cambiar managed_dept
-- (solo bloquea id, eid, production_id y company_id), así que no hace falta
-- tocar las políticas de profiles.

-- ─── Comprobación ───────────────────────────────────────────────────────────
-- SELECT p.name, p.role, p.managed_dept, e.dept AS dept_ficha
--   FROM profiles p LEFT JOIN emps e ON e.id = p.eid
--  WHERE p.role = 'dept_head';
