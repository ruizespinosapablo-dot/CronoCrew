-- =====================================================
-- MIGRACIÓN: Inmutabilidad y trazabilidad de cambios
-- Ejecutar en: Supabase → SQL Editor
-- =====================================================

-- 1. Añadir columnas de borrado suave a la tabla recs
ALTER TABLE recs
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by  text        DEFAULT NULL;

-- 2. Crear tabla de auditoría
CREATE TABLE IF NOT EXISTS rec_audit (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rec_id      text        NOT NULL,
  action      text        NOT NULL,   -- 'create' | 'update' | 'delete'
  changed_by  text        NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  prev_data   jsonb       DEFAULT NULL,
  new_data    jsonb       DEFAULT NULL,
  reason      text        DEFAULT NULL
);

-- 3. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS rec_audit_rec_id_idx   ON rec_audit (rec_id);
CREATE INDEX IF NOT EXISTS rec_audit_changed_at_idx ON rec_audit (changed_at DESC);

-- 4. (Opcional pero recomendado) Política RLS: solo lectura para usuarios normales
-- ALTER TABLE rec_audit ENABLE ROW LEVEL SECURITY;
