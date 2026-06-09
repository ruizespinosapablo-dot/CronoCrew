-- CronoCrew: Migración a Supabase Auth
-- Ejecuta en Supabase → SQL Editor

-- ─── 1. Tabla de perfiles ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'employee'
             CHECK (role IN ('super_admin', 'admin', 'employee')),
  eid        TEXT REFERENCES emps(id),   -- NULL para admins sin ficha de empleado
  name       TEXT,                       -- Nombre para mostrar en la UI
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer perfiles (solo contiene rol y eid, sin datos sensibles)
CREATE POLICY "profiles_read"  ON profiles FOR SELECT TO authenticated USING (true);
-- Cada usuario solo puede modificar su propio perfil
CREATE POLICY "profiles_write" ON profiles FOR ALL    TO authenticated USING (auth.uid() = id);


-- ─── 2. Crear el usuario admin en Supabase Auth ──────────────────────────────
-- Ve a Supabase → Authentication → Users → "Add user"
-- Email: tu email real  |  Password: la que elijas  |  "Auto confirm" ✓
-- Copia el UUID que aparece en la columna "User UID"

-- ─── 3. Insertar el perfil del admin ────────────────────────────────────────
-- Sustituye <UUID_DEL_ADMIN> por el UUID que copiaste en el paso anterior
-- INSERT INTO profiles (id, role, name)
-- VALUES ('<UUID_DEL_ADMIN>', 'admin', 'Administrador');


-- ─── 4. Para cada empleado que necesite acceso ───────────────────────────────
-- En Authentication → Users → "Add user"
-- Email: el que tengan en la BD (p.ej. pablo@cronocrew.com)
-- Password: la que establezcas (luego pueden cambiarla)
-- Luego:
-- INSERT INTO profiles (id, role, eid, name)
-- VALUES ('<UUID_DEL_EMPLEADO>', 'employee', '<EID>', '<Nombre>');
--
-- Ejemplo:
-- INSERT INTO profiles (id, role, eid, name)
-- VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'employee', 'pablo', 'Pablo Espinosa');
