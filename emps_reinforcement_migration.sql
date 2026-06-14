-- ClapTime · Marca de "refuerzo" en empleados
-- Distingue refuerzos puntuales (Fichaje Express) de la plantilla fija.
-- Ejecutar en Supabase → SQL Editor.

ALTER TABLE emps
  ADD COLUMN IF NOT EXISTS is_reinforcement BOOLEAN DEFAULT false;

-- Backfill: marca como refuerzo a quien entró por Fichaje Express
-- (tiene jornadas con método 'Express') o quedó con cargo 'Refuerzo'.
UPDATE emps SET is_reinforcement = true
WHERE COALESCE(is_reinforcement, false) = false
  AND (
    id IN (SELECT DISTINCT eid FROM recs WHERE method = 'Express')
    OR role = 'Refuerzo'
  );
