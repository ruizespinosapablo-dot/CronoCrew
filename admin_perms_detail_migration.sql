-- ClapTime · Detalle de permisos (vacaciones, bajas, etc.)
-- Hasta ahora admin_perms solo guardaba el tipo; faltaban nombres, fechas, días y nota,
-- por lo que al recargar se perdían los detalles. Esto los persiste.
-- Ejecutar en Supabase → SQL Editor.

ALTER TABLE admin_perms
  ADD COLUMN IF NOT EXISTS names      TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date   DATE,
  ADD COLUMN IF NOT EXISTS days       INTEGER,
  ADD COLUMN IF NOT EXISTS note       TEXT;
