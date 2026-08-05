-- Migración: Índices para consultas optimizadas por OP
-- Fecha: 2026-01-27
-- Propósito: Optimizar consultas on-demand de query-op-data

-- ============================================
-- ÍNDICES EN TABLA SIESA
-- ============================================

-- Índice en columna 'op' para búsquedas rápidas por OP
CREATE INDEX IF NOT EXISTS idx_siesa_op 
ON "SIESA"(op);

-- Índice en 'Nro documento' (factura) para cruce con ENTREGAS
CREATE INDEX IF NOT EXISTS idx_siesa_nro_documento 
ON "SIESA"("Nro documento");

-- Índice compuesto para consultas combinadas (OP + Fecha)
CREATE INDEX IF NOT EXISTS idx_siesa_op_fecha 
ON "SIESA"(op, "Fecha" DESC);

-- Índice en Estado para filtros por estado
CREATE INDEX IF NOT EXISTS idx_siesa_estado 
ON "SIESA"("Estado");

-- ============================================
-- ÍNDICES EN TABLA ingresos
-- ============================================

-- Índice en columna 'lote' para búsquedas rápidas por lote
CREATE INDEX IF NOT EXISTS idx_ingresos_lote 
ON ingresos(lote);

-- Índice en 'referencia' para cruce con SIESA
CREATE INDEX IF NOT EXISTS idx_ingresos_referencia 
ON ingresos(referencia);

-- Índice en 'refprov' como alternativa a referencia
CREATE INDEX IF NOT EXISTS idx_ingresos_refprov 
ON ingresos(refprov);

-- Índice compuesto para consultas por lote + tipo
CREATE INDEX IF NOT EXISTS idx_ingresos_lote_tipo 
ON ingresos(lote, tipo);

-- Índice en id_ingreso para búsquedas por documento
CREATE INDEX IF NOT EXISTS idx_ingresos_id_ingreso 
ON ingresos(id_ingreso);

-- ============================================
-- ÍNDICES EN TABLA ENTREGAS
-- ============================================

-- Índice en columna 'Lote' para búsquedas rápidas por lote
CREATE INDEX IF NOT EXISTS idx_entregas_lote 
ON "ENTREGAS"("Lote");

-- Índice en 'Factura' para cruce con SIESA (MUY IMPORTANTE)
CREATE INDEX IF NOT EXISTS idx_entregas_factura 
ON "ENTREGAS"("Factura");

-- Índice en 'Documento' para búsquedas por documento
CREATE INDEX IF NOT EXISTS idx_entregas_documento 
ON "ENTREGAS"("Documento");

-- Índice compuesto para consultas por Lote + Referencia
CREATE INDEX IF NOT EXISTS idx_entregas_lote_referencia 
ON "ENTREGAS"("Lote", "Referencia");

-- Índice en 'Registro' para ordenar por fecha de entrega
CREATE INDEX IF NOT EXISTS idx_entregas_registro 
ON "ENTREGAS"("Registro" DESC);

-- ============================================
-- COMENTARIOS Y METADATA
-- ============================================

COMMENT ON INDEX idx_siesa_op IS 
'Índice principal para consultas por OP en query-op-data';

COMMENT ON INDEX idx_entregas_factura IS 
'Índice crítico para cruce SIESA-ENTREGAS por número de factura';

COMMENT ON INDEX idx_ingresos_lote IS 
'Índice principal para consultas por lote en tabla ingresos';

-- ============================================
-- VERIFICACIÓN DE ÍNDICES
-- ============================================

-- Consulta para verificar que los índices fueron creados
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE 'idx_siesa_%'
    OR indexname LIKE 'idx_ingresos_%'
    OR indexname LIKE 'idx_entregas_%'
  )
ORDER BY tablename, indexname;

-- ============================================
-- ANÁLISIS DE TABLAS (Actualizar estadísticas)
-- ============================================

ANALYZE "SIESA";
ANALYZE ingresos;
ANALYZE "ENTREGAS";

-- ============================================
-- NOTAS SOBRE RENDIMIENTO
-- ============================================

/*
Mejoras esperadas:

1. SIESA.op: Búsqueda O(log n) en lugar de O(n)
   - Sin índice: escaneo completo de ~10,000 registros
   - Con índice: búsqueda directa en ~10-50ms

2. ENTREGAS.Factura: Cruce optimizado
   - Sin índice: nested loop O(n*m)
   - Con índice: hash join O(n+m)

3. ingresos.lote: Filtrado eficiente
   - Sin índice: escaneo completo de ~5,000 registros
   - Con índice: búsqueda directa en ~5-20ms

Resultado: Tiempo de consulta de ~500ms a ~30-80ms (85-95% más rápido)
*/
