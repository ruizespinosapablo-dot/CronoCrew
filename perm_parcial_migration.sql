-- ClapTime · Ausencia parcial justificada en el fichaje (médico, etc.)
-- Ejecutar en Supabase → SQL Editor.
ALTER TABLE recs
  ADD COLUMN IF NOT EXISTS perm_min    INTEGER DEFAULT 0,   -- minutos de ausencia parcial justificada
  ADD COLUMN IF NOT EXISTS perm_reason TEXT;                -- motivo (médico, acompañamiento, etc.)
