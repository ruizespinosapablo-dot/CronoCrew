-- ClapTime · Jornada no habitual (fin de semana / festivo trabajado)
-- Marca el registro como "día no habitual": todo el tiempo trabajado se suma al
-- acumulado y NUNCA genera compensación (no hay jornada esperada ese día).
-- Ejecutar en Supabase → SQL Editor. Seguro de re-ejecutar.
ALTER TABLE recs
  ADD COLUMN IF NOT EXISTS extra_day BOOLEAN DEFAULT false;
