# SQL archivado — NO EJECUTAR

Estos archivos están **obsoletos** y se conservan solo como referencia histórica:

- `rls_policies.sql` — políticas v1. Sustituidas por `../rls_policies_v2.sql`. Tenían dos fallos graves: no distinguían admin de empleado, y permitían a `anon` listar y modificar todos los `express_links`.
- `express_links_setup.sql` — la creación de la tabla sigue siendo válida, pero sus políticas anon fueron sustituidas por las RPC `get_express_link` / `file_express_link` de `rls_policies_v2.sql`.

Las políticas vigentes están en **`rls_policies_v2.sql`** (raíz del proyecto).
