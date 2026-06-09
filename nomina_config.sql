-- CronoCrew: Configuración salarial por empleado
-- Ejecuta en Supabase → SQL Editor

ALTER TABLE emps
  ADD COLUMN IF NOT EXISTS bruto_mes        NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS irpf_pct         NUMERIC(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exento_ss        NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exento_irpf      NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desc_nomina      NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tarifa_hora_ext  NUMERIC(10,2) DEFAULT 0;

-- bruto_mes:       Total devengado mensual fijo (salario base + todos los pluses fijos)
--                  Ej: 1813.91 + 181.39 + 134.59 + 645.11 + 153.00 + 126.10 + 50.00 = 3104.10
-- irpf_pct:        % de retención IRPF (ej: 17.85)
-- exento_ss:       Importe mensual NO sujeto a SS (ej: kilometraje 126.10)
-- exento_irpf:     Importe mensual adicional NO sujeto a IRPF más allá de exento_ss
--                  (ej: comedor/manutención 153.00)
-- desc_nomina:     Descuentos fijos que aparecen en deducciones de la nómina
--                  (ej: descuento comedor 153.00)
-- tarifa_hora_ext: Tarifa bruta €/hora para horas extras (ej: 15.00)
