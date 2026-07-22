# ClapCrew · Plano de arquitectura y plan de construcción

> **Para el modelo/sesión que ejecute este plan:** este documento es la fuente de verdad.
> Sigue las fases EN ORDEN, cada una termina con sus criterios de aceptación cumplidos,
> `esbuild` sin errores y un commit. No improvises decisiones de arquitectura: si algo
> no está aquí, es deliberadamente v2 (no lo construyas). Los patrones de código a
> imitar están en `~/CronoCrew` (ClapTime) y `~/ClapPay` (app hermana ya existente).

---

## 1. Visión: qué es cada app (ownership de datos)

Un único **Supabase** (proyecto CronoCrew, el actual) y **frontends separados**.
Cada dato tiene UN dueño; las demás apps lo leen, nunca lo escriben.

| App | Dominio | Función | Escribe | Lee |
|---|---|---|---|---|
| **ClapCrew** | clapcrew.clapsuite.com | Organizar: equipo, turnos/citaciones, orden del día | `crew_shifts`, `crew_days`, altas de empleados (vía Edge Function `create-user`) | `emps`, `productions`, `profiles`, `festivos` |
| **ClapTime** | claptime.clapsuite.com | Registrar: fichaje, saldos, permisos, descansos | `recs`, `paid`, `requests`, `admin_perms`, `festivos`, `express_links` | `crew_shifts` (solo publicados, para prefill de citación) |
| **ClapPay** | pay.clapsuite.com | Pagar: tarifas, cuadro de nóminas, export gestoría | `pay_rates`, `pay_month` | `emps`, `recs`, `paid` |

**Regla de oro:** ClapCrew JAMÁS escribe en `recs`. La citación planificada viaja por
`crew_shifts`; ClapTime la lee al fichar. El registro horario legal es solo de ClapTime.

## 2. Arquitectura técnica

- **Backend:** el Supabase existente (mismas env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` que ClapTime/ClapPay).
- **Frontend:** repo nuevo `~/ClapCrew`, React 19 + Vite (idéntico stack que ClapPay). Deploy en Vercel, dominio `clapcrew.clapsuite.com`.
- **Auth:** mismo Supabase Auth. Mismas credenciales en las tres apps. *Nota honesta:* la sesión (localStorage) es por subdominio → cada app pide login la primera vez. Aceptado para v1; el hand-off de token entre apps es v2.
- **Diseño:** tokens ClapSuite de ClapTime (`src/index.css` de CronoCrew) con **accent teal `#33D6C0`** (color de ClapCrew) en lugar de lima. Fuentes Syne/DM Sans/DM Mono. Logo: `~/CronoCrew/src/assets/brand/clapcrew-logo.svg`.
- **Zona horaria y formatos:** como ClapTime — fechas `YYYY-MM-DD` (string), horas `HH:MM` (string). Sin objetos Date en la BD.

## 3. Modelo de roles

`profiles.role` admite un valor nuevo: **`dept_head`** (jefe de equipo).

| Rol | ClapCrew | ClapTime |
|---|---|---|
| `super_admin` | Todo, todas las producciones | Todo |
| `admin` (producción) | Todo dentro de su producción | Todo dentro de su producción |
| `dept_head` | Planifica SOLO su departamento (el `dept` de su ficha `emps`) | Es un empleado normal (ficha lo suyo) |
| `employee` | **Sin acceso en v1** (su citación la ve en ClapTime) | Fichaje normal |

El departamento del `dept_head` NO se guarda en `profiles`: se deriva de su ficha
(`emps.dept` vía `auth_eid()`), así no hay dato duplicado.

## 4. Esquema de tablas nuevas (migración `01_clapcrew_schema.sql`)

```sql
-- ClapCrew · Esquema: turnos/citaciones y orden del día
-- Ejecutar en Supabase → SQL Editor.

-- Turno/citación planificada de UNA persona en UNA fecha.
CREATE TABLE IF NOT EXISTS crew_shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  eid           TEXT NOT NULL,               -- referencia lógica a emps.id
  date          DATE NOT NULL,
  cited_in      TEXT NOT NULL,               -- 'HH:MM'
  cited_out     TEXT NOT NULL,               -- 'HH:MM'
  location      TEXT,                        -- set/localización (texto libre v1)
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_by    UUID,                        -- auth.uid() del planificador
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (eid, date)                         -- una citación por persona y día
);
CREATE INDEX IF NOT EXISTS crew_shifts_prod_date ON crew_shifts (production_id, date);
CREATE INDEX IF NOT EXISTS crew_shifts_eid_date  ON crew_shifts (eid, date);

-- Orden del día / call sheet de la producción (una por fecha).
CREATE TABLE IF NOT EXISTS crew_days (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  title         TEXT,                        -- p.ej. 'Día 23 · Rodaje exterior plaza'
  general_call  TEXT,                        -- citación general 'HH:MM' (informativa)
  location      TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (production_id, date)
);
```

## 5. RLS (migración `02_clapcrew_rls.sql`)

```sql
-- Helper nuevo: departamento del usuario actual (desde su ficha de empleado)
CREATE OR REPLACE FUNCTION auth_dept()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dept FROM emps WHERE id = auth_eid()
$$;

CREATE OR REPLACE FUNCTION is_dept_head()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(auth_role() = 'dept_head', false)
$$;

REVOKE EXECUTE ON FUNCTION auth_dept(), is_dept_head() FROM anon;

ALTER TABLE crew_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_days   ENABLE ROW LEVEL SECURITY;

-- crew_shifts: admin todo en su producción; dept_head solo su departamento;
-- empleado lee SOLO sus turnos publicados (los usa ClapTime para el prefill).
CREATE POLICY "crew_shifts_admin_all" ON crew_shifts
  FOR ALL TO authenticated
  USING (auth_role() = 'super_admin' OR (is_admin() AND production_id = auth_production_id()))
  WITH CHECK (auth_role() = 'super_admin' OR (is_admin() AND production_id = auth_production_id()));

CREATE POLICY "crew_shifts_depthead_all" ON crew_shifts
  FOR ALL TO authenticated
  USING (
    is_dept_head() AND production_id = auth_production_id()
    AND eid IN (SELECT id FROM emps WHERE dept = auth_dept() AND production_id = auth_production_id())
  )
  WITH CHECK (
    is_dept_head() AND production_id = auth_production_id()
    AND eid IN (SELECT id FROM emps WHERE dept = auth_dept() AND production_id = auth_production_id())
  );

CREATE POLICY "crew_shifts_self_select" ON crew_shifts
  FOR SELECT TO authenticated
  USING (eid = auth_eid() AND status = 'published');

-- crew_days: admin/dept_head gestionan; cualquier miembro de la producción LEE publicados.
CREATE POLICY "crew_days_admin_all" ON crew_days
  FOR ALL TO authenticated
  USING (auth_role() = 'super_admin' OR (is_admin() AND production_id = auth_production_id()))
  WITH CHECK (auth_role() = 'super_admin' OR (is_admin() AND production_id = auth_production_id()));

CREATE POLICY "crew_days_member_select" ON crew_days
  FOR SELECT TO authenticated
  USING (production_id = auth_production_id() AND status = 'published');
```

Además: el `dept_head` necesita leer los `emps` de su departamento para planificar.
La política actual de `emps` solo deja `self_select` a no-admins → añadir:

```sql
CREATE POLICY "emps_depthead_select" ON emps
  FOR SELECT TO authenticated
  USING (is_dept_head() AND production_id = auth_production_id() AND dept = auth_dept());
```

## 6. Sincronización con ClapTime (cambio pequeño y quirúrgico)

**Único cambio en ClapTime** (fase 4): al abrir Fichar, si existe `crew_shifts`
publicado para (mi eid, hoy), usarlo como citación inicial.

- Archivo: `~/CronoCrew/src/pages/employee/Clock.jsx`
  - En el estado inicial: `citedIn`/`citedOut` parten de `emp.start`/`emp.end` como hoy;
    añadir un `useEffect` que haga
    `supabase.from('crew_shifts').select('cited_in, cited_out, location').eq('eid', emp.id).eq('date', TODAY).eq('status','published').maybeSingle()`
    y si hay fila: `setCitedIn/setCitedOut` (solo si el usuario aún no fichó ese día)
    + banner pequeño "📋 Citación de ClapCrew · {location}".
- Archivo: `~/CronoCrew/src/pages/employee/ActorClock.jsx` — igual con
  `actorCited`/`actorEnd`.
- NO escribir nada en `crew_shifts` desde ClapTime. NO tocar `calcRec`/`calcActorRec`.

## 7. Estructura del repo `~/ClapCrew`

Clonar el patrón de `~/ClapPay` (mismo `vite.config.js`, `vercel.json` adaptado, mismos
patrones de contexto). Árbol objetivo:

```
ClapCrew/
├── package.json              # deps: @supabase/supabase-js, react, react-dom (SIN xlsx)
├── vite.config.js            # igual que ClapPay
├── vercel.json               # copiar de ClapPay, misma CSP (mismo supabase URL)
├── .env                      # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (mismas que ClapPay)
├── index.html                # título "ClapCrew · Planificación", fuentes Syne/DM Sans/DM Mono
├── sql/
│   ├── 01_clapcrew_schema.sql
│   ├── 02_clapcrew_rls.sql
│   └── 03_depthead_role.sql  # fase 6
└── src/
    ├── main.jsx
    ├── App.jsx               # router simple por estado (como ClapPay)
    ├── index.css             # tokens ClapSuite con --accent:#33D6C0
    ├── lib/
    │   ├── supabase.js       # copiar de ClapPay
    │   ├── constants.js      # DEPARTMENTS (copiar de ClapTime)
    │   └── crew.js           # mapShift/toShiftRow, mapDay/toDayRow, weekDates()
    ├── context/
    │   ├── AuthContext.jsx   # copiar de ClapPay; ALLOWED_ROLES = ['admin','super_admin','dept_head']
    │   └── CrewContext.jsx   # carga emps, shifts, days; upsert/publish/delete
    └── pages/
        ├── Login.jsx         # copiar de ClapPay (rebrand teal)
        ├── Layout.jsx        # sidebar: Planner, Equipo, Orden del día
        ├── Planner.jsx       # fase 3 — grid semanal
        ├── Team.jsx          # fase 3 — lista de equipo (lee emps)
        └── CallSheet.jsx     # fase 5 — orden del día
```

Convenciones obligatorias (las de ClapTime/ClapPay):
- Mapeos `mapX` (snake→camel) / `toXRow` (camel→snake) en `lib/crew.js`.
- Escrituras optimistas: actualizar estado local + `supabase.from(...)` con manejo de error por toast.
- Validar sintaxis antes de cada commit:
  `npx esbuild src/... --loader:.jsx=jsx --bundle --external:react --external:react-dom --external:./* --external:../* --format=esm --outfile=/dev/null`
- Commits: `feat(clapcrew): ...` / `fix(clapcrew): ...`, uno por fase como mínimo.

## 8. Plan por fases

### Fase 0 · Preparación (manual, con el usuario)
1. Crear repo `~/ClapCrew` vacío + `git init`.
2. Vercel: nuevo proyecto → dominio `clapcrew.clapsuite.com` (CNAME en Cloudflare como se hizo con claptime).
3. Edge Function `create-user` (repo CronoCrew): añadir `'https://clapcrew.clapsuite.com'` a `ALLOWED_ORIGINS` y `'dept_head'` a los roles válidos. Redeploy de la función.
✅ *Criterio:* dominio resolviendo y función redeployada.

### Fase 1 · Base de datos
1. Crear `sql/01_clapcrew_schema.sql` y `sql/02_clapcrew_rls.sql` con el contenido de §4 y §5.
2. Usuario los ejecuta en Supabase.
✅ *Criterio:* `select * from crew_shifts limit 1` funciona; el lint de seguridad de Supabase no marca las tablas nuevas.

### Fase 2 · Scaffold de la app
1. Copiar de ClapPay: `vite.config.js`, `vercel.json`, `src/lib/supabase.js`, `src/context/AuthContext.jsx` (cambiar ALLOWED_ROLES), `src/pages/Login.jsx`.
2. `index.css` copiado de ClapTime cambiando `--accent` a `#33D6C0` (y `--green` se mantiene `#4ADE80`).
3. `Layout.jsx` con sidebar (Planner / Equipo / Orden del día) y wordmark Clap**Crew** teal.
4. `npm install`, build OK, commit.
✅ *Criterio:* login funciona con un admin real, layout navega entre páginas vacías.

### Fase 3 · Equipo + Planner semanal (el corazón)
1. `CrewContext.jsx`: carga `emps` (activos, `!archived`) y `crew_shifts` de la semana visible; helpers `upsertShift`, `deleteShift`, `publishWeek(dates)` (pasa a `published` todos los draft de la semana), `copyWeek(from,to)`.
2. `Team.jsx`: tabla de equipo agrupada por departamento (nombre, cargo, horario por defecto `start/end`). Solo lectura en v1.
3. `Planner.jsx`: **grid semanal** — filas = empleados (agrupados por depto, filtro de depto arriba), columnas = L–D de la semana (selector de semana como el de ClapTime `weekDates`). Celda:
   - vacía → click abre mini-form (cited_in/cited_out con default del horario del emp, location, notes) → crea draft.
   - con turno → muestra `HH:MM–HH:MM` + location; borde discontinuo si draft, sólido si published; click edita; botón ✕ borra.
   - festivos de la producción sombreados (leer `festivos`).
4. Botones de cabecera: **“Publicar semana”** (confirm + publishWeek) y “Copiar semana anterior”.
5. Si el rol es `dept_head`: el filtro de departamento queda fijado a su `dept` (la RLS ya lo restringe en servidor; la UI solo lo refleja).
✅ *Criterio:* un admin crea turnos de una semana, los publica, y un `select` como el empleado (self) devuelve solo los publicados.

### Fase 4 · Prefill de citación en ClapTime
1. Aplicar §6 en `Clock.jsx` y `ActorClock.jsx` de CronoCrew.
2. Build + commit en CronoCrew, push + redeploy.
✅ *Criterio:* empleado con turno publicado para hoy abre Fichar y ve su citación de ClapCrew precargada + banner; sin turno → comportamiento actual intacto.

### Fase 5 · Orden del día (call sheet)
1. `CallSheet.jsx`: editor por fecha (title, general_call, location, notes) + lista de turnos publicados de ese día agrupados por depto (lectura de `crew_shifts`). Botón publicar.
2. (Opcional, si hay ganas) Edge Function `send-callsheet` calcada de `send-express-receipt`: envía por Resend el orden del día a los emails de los `emps` con turno ese día. Misma plantilla HTML con logo.
✅ *Criterio:* se crea y publica un orden del día; (si se hizo el email) llega a un buzón real.

### Fase 6 · Rol jefe de equipo end-to-end
1. `sql/03_depthead_role.sql`: nada nuevo si §5 ya se ejecutó (las políticas dept_head ya existen); este archivo solo documenta el UPDATE manual de un perfil a `dept_head` para pruebas.
2. UsersPage del super admin (CronoCrew): añadir `dept_head` al selector de roles (`ROLES`/`ROLE_LABEL`).
3. Probar con un usuario real: en ClapCrew solo ve/edita su depto; en ClapTime ficha normal.
✅ *Criterio:* dept_head no puede leer emps de otro depto (probar con la API, no solo la UI).

### Fase 7 · QA y seguridad
1. Repasar: ningún acceso `anon` a `crew_*` (no hay GRANT, RLS activo), `dept_head` no escribe fuera de su depto, ClapTime sigue sin escribir en `crew_shifts`.
2. Lint de seguridad de Supabase en verde.
3. Prueba end-to-end del flujo completo: alta empleado (create-user) → turno → publicar → prefill en Fichar → confirmar fichaje → revisar en admin.
✅ *Criterio:* checklist completa y demo del flujo grabable.

## 9. Decisiones tomadas (no reabrir en ejecución)

- Empleados NO entran en ClapCrew en v1; su ventana es ClapTime (prefill + banner).
- Un turno por persona/día (`UNIQUE(eid,date)`). Turnos partidos = v2.
- `location` texto libre; catálogo de localizaciones = v2.
- Avisos push/WhatsApp = v2 (v1 como mucho email opcional en fase 5).
- Sin hand-off de sesión entre subdominios en v1.
- ClapCrew no valida descansos al planificar (v2: avisar si la citación rompe las 12/13/60h) — PERO no bloquea el plan, ClapTime seguirá marcándolo en rojo al ficharse.

## 10. Referencias para el ejecutor

- Patrones de app hermana: `~/ClapPay/src/**` (Auth, contexto, Login, Layout).
- Tokens de diseño: `~/CronoCrew/src/index.css` (líneas 1–30).
- Helpers RLS existentes: `~/CronoCrew/rls_policies_v2.sql` (líneas 15–45).
- Convención semanal: `weekDates()` en `~/CronoCrew/src/lib/utils.js`.
- Edge Function patrón: `~/CronoCrew/supabase/functions/create-user/index.ts`.
- Logo: `~/CronoCrew/src/assets/brand/clapcrew-logo.svg`.
