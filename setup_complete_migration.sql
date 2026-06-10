-- CronoCrew: Asegura la columna setup_complete en emps
-- (ya existe en producción; este script es idempotente y solo documenta el esquema)
ALTER TABLE emps
  ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN DEFAULT false;

-- Los empleados dados de alta desde el panel de super admin se crean ya con
-- setup_complete = true, por lo que el admin de proyecto no debe activarlos.
