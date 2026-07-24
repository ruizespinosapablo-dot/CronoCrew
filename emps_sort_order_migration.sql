-- ClapTime · Orden manual de empleados
-- El admin coloca a su gente en la pestaña Empleados y ese orden se respeta en
-- el resto de tablas (Panel, resúmenes por departamento). Vive como columna de
-- emps porque emps es la tabla propia de ClapTime: no hace falta tabla aparte.
--
-- Se ordena DENTRO de cada departamento por sort_order; quien no tenga orden
-- manual (NULL) va al final, alfabético. Ejecutar en Supabase → SQL Editor.

ALTER TABLE emps
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Comprobación:
-- SELECT dept, name, sort_order FROM emps ORDER BY dept, sort_order NULLS LAST, name;
