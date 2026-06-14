-- ClapTime · Refuerzo RLS: el empleado no puede auto-aprobarse ni autopagarse
-- Antes, recs_self_update solo comprobaba que el registro fuese suyo, pero NO
-- limitaba el estado ni los campos de dinero. Un empleado podía, llamando a la API
-- directamente, poner status='approved', fijarse su km_eur, cat_up o paid_extra.
-- Estos campos son SIEMPRE responsabilidad del admin. Ejecutar en Supabase → SQL Editor.

DROP POLICY IF EXISTS recs_self_insert ON recs;
CREATE POLICY "recs_self_insert" ON recs
  FOR INSERT TO authenticated
  WITH CHECK (
    eid = auth_eid()
    AND production_id = auth_production_id()
    AND status IN ('draft', 'pending')          -- nunca 'approved'
    AND COALESCE(km_eur, 0) = 0                  -- el importe de km lo fija el admin
    AND COALESCE(cat_up, false) = false          -- subida de categoría: admin
    AND COALESCE(paid_extra, 0) = 0              -- pago de extras: admin
  );

DROP POLICY IF EXISTS recs_self_update ON recs;
CREATE POLICY "recs_self_update" ON recs
  FOR UPDATE TO authenticated
  USING (eid = auth_eid() AND deleted_at IS NULL)
  WITH CHECK (
    eid = auth_eid()
    AND production_id = auth_production_id()
    AND deleted_at IS NULL                       -- el borrado (soft delete) es de admins
    AND status IN ('draft', 'pending')          -- el empleado no se autoaprueba
    AND COALESCE(km_eur, 0) = 0                  -- ni se fija el importe de km
    AND COALESCE(cat_up, false) = false          -- ni la subida de categoría
    AND COALESCE(paid_extra, 0) = 0              -- ni los extras pagados
  );
