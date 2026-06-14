-- ClapTime · Comprobante del Fichaje Express
-- Guarda el email (opcional) que indica el refuerzo para enviarle su copia.
-- Ejecutar en Supabase → SQL Editor.

-- 1. Columna de email en express_links
ALTER TABLE express_links
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Recrear el RPC de fichaje añadiendo el email
DROP FUNCTION IF EXISTS file_express_link(UUID, TEXT, TEXT, TEXT, BOOLEAN, NUMERIC);

CREATE OR REPLACE FUNCTION file_express_link(
  p_id UUID, p_entry TEXT, p_exit TEXT, p_obs TEXT DEFAULT NULL,
  p_km_applied BOOLEAN DEFAULT false, p_km_count NUMERIC DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_entry !~ '^\d{2}:\d{2}$' OR p_exit !~ '^\d{2}:\d{2}$' THEN
    RAISE EXCEPTION 'Formato de hora no válido';
  END IF;

  UPDATE express_links
  SET entry      = p_entry,
      exit       = p_exit,
      obs        = NULLIF(TRIM(COALESCE(p_obs, '')), ''),
      km_applied = COALESCE(p_km_applied, false),
      km_count   = CASE WHEN COALESCE(p_km_applied, false) THEN p_km_count ELSE NULL END,
      email      = NULLIF(TRIM(COALESCE(p_email, '')), ''),
      status     = 'filed',
      filed_at   = NOW()
  WHERE id = p_id
    AND status = 'pending'
    AND expires_at > NOW();

  RETURN FOUND;
END $$;

REVOKE EXECUTE ON FUNCTION file_express_link(UUID, TEXT, TEXT, TEXT, BOOLEAN, NUMERIC, TEXT) FROM public;
GRANT  EXECUTE ON FUNCTION file_express_link(UUID, TEXT, TEXT, TEXT, BOOLEAN, NUMERIC, TEXT) TO anon, authenticated;
