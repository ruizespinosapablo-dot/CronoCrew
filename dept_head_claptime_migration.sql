-- ClapTime · Jefe de equipo con aprobación EN DOS PASOS
--
-- Flujo de un fichaje:  borrador → pendiente → REVISADO (jefe) → APROBADO (admin)
--
-- El jefe de equipo da el "visto bueno" a los fichajes y permisos de SU
-- departamento, pero la firma FINAL —la que cuenta para nómina— es siempre del
-- admin. Lo que el jefe NO puede hacer, blindado en la base de datos:
--   · marcar como aprobado (eso es del admin)
--   · tocar dinero (paid_extra, km_eur, km_applied, cat_up)
--   · cambiar horas, fechas, descansos o a quién pertenece un registro
--   · crear registros nuevos, ni ver/tocar nada de otro departamento
--
-- Requiere auth_dept() e is_dept_head() (ya creados por ClapCrew).
-- Ejecutar en Supabase → SQL Editor.

-- ─── Pertenencia a "mi departamento" ────────────────────────────────────────
CREATE OR REPLACE FUNCTION eid_en_mi_depto(p_eid TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM emps
    WHERE id = p_eid AND dept = auth_dept() AND production_id = auth_production_id()
  )
$$;
REVOKE EXECUTE ON FUNCTION eid_en_mi_depto(TEXT) FROM anon;

-- ─── recs: el jefe LEE y da el VISTO BUENO (pendiente ↔ revisado) ────────────
-- No inserta (los registros los crea el empleado al fichar, o el admin) ni
-- aprueba: la aprobación final es del admin.
DROP POLICY IF EXISTS "recs_depthead_insert" ON recs;   -- se retira: ya no inserta

DROP POLICY IF EXISTS "recs_depthead_select" ON recs;
CREATE POLICY "recs_depthead_select" ON recs
  FOR SELECT TO authenticated
  USING (is_dept_head() AND production_id = auth_production_id() AND eid_en_mi_depto(eid));

DROP POLICY IF EXISTS "recs_depthead_update" ON recs;
CREATE POLICY "recs_depthead_update" ON recs
  FOR UPDATE TO authenticated
  USING (is_dept_head() AND production_id = auth_production_id() AND eid_en_mi_depto(eid))
  WITH CHECK (is_dept_head() AND production_id = auth_production_id() AND eid_en_mi_depto(eid));

CREATE OR REPLACE FUNCTION guard_recs_depthead()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(auth_role(), '') <> 'dept_head' THEN RETURN NEW; END IF;

  -- El jefe SOLO mueve el estado entre pendiente y revisado. No puede aprobar
  -- (final del admin) ni tocar borradores o registros ya aprobados.
  IF NEW.status NOT IN ('pending', 'reviewed')
  OR OLD.status NOT IN ('pending', 'reviewed') THEN
    RAISE EXCEPTION 'El jefe de equipo solo da el visto bueno; la aprobación final es de administración';
  END IF;

  -- COALESCE porque la app normaliza null↔0/''/false al leer: sin esto, un
  -- visto bueno legítimo parecería un cambio de null a 0 y se bloquearía.
  IF COALESCE(NEW.eid, '')         IS DISTINCT FROM COALESCE(OLD.eid, '')
  OR COALESCE(NEW.date, '')        IS DISTINCT FROM COALESCE(OLD.date, '')
  OR COALESCE(NEW.entry, '')       IS DISTINCT FROM COALESCE(OLD.entry, '')
  OR COALESCE(NEW.exit, '')        IS DISTINCT FROM COALESCE(OLD.exit, '')
  OR COALESCE(NEW.brk, 0)          IS DISTINCT FROM COALESCE(OLD.brk, 0)
  OR COALESCE(NEW.cited_brk, -1)   IS DISTINCT FROM COALESCE(OLD.cited_brk, -1)
  OR COALESCE(NEW.cited_in, '')    IS DISTINCT FROM COALESCE(OLD.cited_in, '')
  OR COALESCE(NEW.cited_out, '')   IS DISTINCT FROM COALESCE(OLD.cited_out, '')
  OR COALESCE(NEW.absence, '')     IS DISTINCT FROM COALESCE(OLD.absence, '')
  OR COALESCE(NEW.libranza, false) IS DISTINCT FROM COALESCE(OLD.libranza, false)
  OR COALESCE(NEW.special, false)  IS DISTINCT FROM COALESCE(OLD.special, false)
  OR COALESCE(NEW.paid_extra, 0)   IS DISTINCT FROM COALESCE(OLD.paid_extra, 0)
  OR COALESCE(NEW.km_eur, -1)      IS DISTINCT FROM COALESCE(OLD.km_eur, -1)
  OR COALESCE(NEW.km_applied, false) IS DISTINCT FROM COALESCE(OLD.km_applied, false)
  OR COALESCE(NEW.cat_up, false)   IS DISTINCT FROM COALESCE(OLD.cat_up, false) THEN
    RAISE EXCEPTION 'El jefe de equipo solo revisa: no puede cambiar horas, pagos ni categorías';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_recs_depthead ON recs;
CREATE TRIGGER trg_guard_recs_depthead BEFORE UPDATE ON recs
  FOR EACH ROW EXECUTE FUNCTION guard_recs_depthead();

-- ─── requests: el jefe da el VISTO BUENO o RECHAZA; el admin finaliza ────────
-- Aprobar un permiso crea las ausencias (registros): eso lo hace el admin. El
-- jefe deja la solicitud en 'revisado' (recomendada) o la rechaza.
DROP POLICY IF EXISTS "requests_depthead_select" ON requests;
CREATE POLICY "requests_depthead_select" ON requests
  FOR SELECT TO authenticated
  USING (is_dept_head() AND production_id = auth_production_id() AND eid_en_mi_depto(eid));

DROP POLICY IF EXISTS "requests_depthead_update" ON requests;
CREATE POLICY "requests_depthead_update" ON requests
  FOR UPDATE TO authenticated
  USING (is_dept_head() AND production_id = auth_production_id() AND eid_en_mi_depto(eid))
  WITH CHECK (is_dept_head() AND production_id = auth_production_id() AND eid_en_mi_depto(eid));

CREATE OR REPLACE FUNCTION guard_requests_depthead()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(auth_role(), '') <> 'dept_head' THEN RETURN NEW; END IF;

  -- Visto bueno (revisado) o rechazo, nunca aprobación final (que crea ausencias).
  IF NEW.status NOT IN ('pending', 'reviewed', 'rejected')
  OR OLD.status NOT IN ('pending', 'reviewed') THEN
    RAISE EXCEPTION 'El jefe de equipo recomienda o rechaza; la aprobación final es de administración';
  END IF;

  IF COALESCE(NEW.eid, '')        IS DISTINCT FROM COALESCE(OLD.eid, '')
  OR COALESCE(NEW.type, '')       IS DISTINCT FROM COALESCE(OLD.type, '')
  OR COALESCE(NEW.start_date, '') IS DISTINCT FROM COALESCE(OLD.start_date, '')
  OR COALESCE(NEW.end_date, '')   IS DISTINCT FROM COALESCE(OLD.end_date, '')
  OR COALESCE(NEW.days, 0)        IS DISTINCT FROM COALESCE(OLD.days, 0) THEN
    RAISE EXCEPTION 'El jefe de equipo solo cambia el estado de la solicitud, no la edita';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_requests_depthead ON requests;
CREATE TRIGGER trg_guard_requests_depthead BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION guard_requests_depthead();

-- paid y admin_perms siguen sin política para dept_head → denegadas por RLS.

-- ─── Comprobación ───────────────────────────────────────────────────────────
-- Como dept_head, por la API:
--   · UPDATE recs SET status='approved'  → error (solo el admin aprueba)
--   · UPDATE recs SET status='reviewed'  (de uno pendiente y suyo) → OK
--   · UPDATE recs SET paid_extra=999     → error del trigger
