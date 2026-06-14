-- ClapTime · get_express_link devuelve también productora y proyecto
-- Para mostrarlos en el comprobante en pantalla y en el PDF del refuerzo.
-- Ejecutar en Supabase → SQL Editor.

DROP FUNCTION IF EXISTS get_express_link(UUID);

CREATE FUNCTION get_express_link(p_id UUID)
RETURNS TABLE (
  id UUID, name TEXT, dept TEXT, role TEXT, date DATE,
  cited_in TEXT, cited_out TEXT, ch INTEGER, brk INTEGER,
  status TEXT, expires_at TIMESTAMPTZ,
  production_name TEXT, company_name TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.name, e.dept, e.role, e.date,
         e.cited_in, e.cited_out, e.ch, e.brk,
         e.status, e.expires_at,
         p.name AS production_name, c.name AS company_name
  FROM express_links e
  LEFT JOIN productions p ON p.id = e.production_id
  LEFT JOIN companies   c ON c.id = p.company_id
  WHERE e.id = p_id
$$;

REVOKE EXECUTE ON FUNCTION get_express_link(UUID) FROM public;
GRANT  EXECUTE ON FUNCTION get_express_link(UUID) TO anon, authenticated;
