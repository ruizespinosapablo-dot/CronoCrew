-- ClapTime · Archivar empleados (borrado de persona conservando fichajes)
-- Al "borrar" un usuario se elimina su cuenta de acceso y su perfil, y la ficha
-- queda ARCHIVADA (no se borra) para poder seguir interpretando y conservando sus
-- fichajes durante los 4 años que exige la ley de registro horario.
-- Ejecutar en Supabase → SQL Editor.

ALTER TABLE emps
  ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
