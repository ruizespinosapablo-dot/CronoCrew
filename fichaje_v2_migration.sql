-- ClapTime · Fichaje v2: kilometraje + estado borrador
-- Ejecutar en Supabase → SQL Editor. Seguro de re-ejecutar (IF NOT EXISTS).

-- Ausencia parcial justificada (médico, etc.) — si no se ejecutó antes.
ALTER TABLE recs
  ADD COLUMN IF NOT EXISTS perm_min    INTEGER DEFAULT 0,   -- minutos de ausencia parcial justificada
  ADD COLUMN IF NOT EXISTS perm_reason TEXT;                -- motivo (médico, acompañamiento, etc.)

-- Kilometraje: el empleado marca que lo aplicó; el admin le pone importe en €.
ALTER TABLE recs
  ADD COLUMN IF NOT EXISTS km_applied BOOLEAN DEFAULT false, -- el empleado marcó "apliqué kilometraje"
  ADD COLUMN IF NOT EXISTS km_count   NUMERIC,               -- nº de km (opcional, informativo)
  ADD COLUMN IF NOT EXISTS km_eur     NUMERIC;               -- importe € que fija el admin en Revisar

-- Estado 'draft' (borrador): mientras el empleado rellena su fichaje del día.
-- status es TEXT, no hace falta migrar el tipo. Valores: 'draft' | 'pending' | 'approved'.
-- Los borradores NO aparecen en el Registro del admin hasta que el empleado pulsa "Confirmar".
