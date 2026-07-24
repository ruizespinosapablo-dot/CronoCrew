-- ClapTime · Descanso planificado en el registro
-- Separa el descanso PLANIFICADO en la citación del descanso REAL que disfrutó
-- la persona. Sin esto, reducir el descanso real inflaba la jornada citada y el
-- exceso se contaba como acumulado en vez de como hora extra.
--
-- Los registros antiguos quedan con cited_brk NULL: el cálculo asume entonces
-- el descanso de contrato (emps.brk), que es el comportamiento correcto para
-- todo lo fichado hasta ahora. Ejecutar en Supabase → SQL Editor.

ALTER TABLE recs
  ADD COLUMN IF NOT EXISTS cited_brk INTEGER;

-- Comprobación:
-- SELECT date, brk, cited_brk FROM recs ORDER BY date DESC LIMIT 10;
