-- ============================================================
-- PATCH DE FUNCIONES — SOLO PL/pgSQL
-- NO modifica tablas, no borra datos, no toca columnas.
--
-- Sirve para AMBOS proyectos:
--   • ymaojqjdnrpfkrtuezcw (columnas NUMERIC  → legacy)
--   • lklojwgmzimzojsrcdlz (columnas INTEGER/TEXT)
-- Los casts ::INTEGER / ::TEXT / ::NUMERIC son inocuos en los dos.
--
-- CÓMO APLICAR
--   Supabase Dashboard → SQL Editor → pegar → Run.
--   Idempotente: se puede ejecutar varias veces.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) get_lotes_data2(p_lotes) — firma antigua, con casts
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lotes_data2(p_lotes INT[])
RETURNS TABLE (
    id_ingreso         TEXT,
    lote               INTEGER,
    fecha_traslado     DATE,
    total              INTEGER,
    total_relativo     INTEGER,
    cantidad           INTEGER,
    diferencia         INTEGER,
    traslado           INTEGER,
    otros_traslados    JSONB,
    anexos             JSONB,
    total_general      INTEGER,
    detalle_cantidades JSONB,
    productora         TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id_ingreso::TEXT,
        i.lote::INTEGER,
        i.fecha_traslado,
        i.total::INTEGER,
        i.total_relativo::INTEGER,
        i.cantidad::INTEGER,
        i.diferencia::INTEGER,
        i.traslado::INTEGER,
        i.otros_traslados,
        i.anexos,
        i.total_general::INTEGER,
        i.detalle_cantidades,
        i.productora::TEXT
    FROM public.ingresos i
    WHERE p_lotes IS NOT NULL
      AND array_length(p_lotes, 1) > 0
      AND i.lote = ANY(p_lotes::NUMERIC[])
    ORDER BY i.created_at ASC;
END;
$$;

COMMENT ON FUNCTION public.get_lotes_data2(INT[]) IS
  'Retorna ingresos filtrados por array de lotes.';

-- ─────────────────────────────────────────────────────────────
-- 2) get_lotes_data2(p_lotes, p_ids) — la que usa api-gateway
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lotes_data2(p_lotes INT[], p_ids TEXT[])
RETURNS TABLE (
    id_ingreso         TEXT,
    lote               INTEGER,
    fecha_traslado     DATE,
    total              INTEGER,
    total_relativo     INTEGER,
    cantidad           INTEGER,
    diferencia         INTEGER,
    traslado           INTEGER,
    otros_traslados    JSONB,
    anexos             JSONB,
    total_general      INTEGER,
    detalle_cantidades JSONB,
    productora         TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id_ingreso::TEXT,
        i.lote::INTEGER,
        i.fecha_traslado,
        i.total::INTEGER,
        i.total_relativo::INTEGER,
        i.cantidad::INTEGER,
        i.diferencia::INTEGER,
        i.traslado::INTEGER,
        i.otros_traslados,
        i.anexos,
        i.total_general::INTEGER,
        i.detalle_cantidades,
        i.productora::TEXT
    FROM public.ingresos i
    WHERE (
        (p_lotes IS NOT NULL AND array_length(p_lotes, 1) > 0
            AND i.lote = ANY(p_lotes::NUMERIC[]))
        OR
        (p_ids IS NOT NULL AND array_length(p_ids, 1) > 0
            AND i.id_ingreso = ANY(p_ids))
        OR
        (p_lotes IS NOT NULL AND array_length(p_lotes, 1) > 0
            AND i.id_ingreso = ANY(SELECT unnest(p_lotes)::TEXT))
    )
    ORDER BY i.created_at ASC;
END;
$$;

COMMENT ON FUNCTION public.get_lotes_data2(INT[], TEXT[]) IS
  'Retorna ingresos filtrados por array de lotes y/o id_ingreso.';

GRANT EXECUTE ON FUNCTION public.get_lotes_data2(INT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lotes_data2(INT[], TEXT[]) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 3) get_distribution_data
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_distribution_data(p_productora TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_full       JSONB;
    v_pendientes JSONB;
BEGIN
    SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.created_at DESC)
    INTO v_full
    FROM public.ingresos i
    WHERE i.tipo = 'FULL'
      AND (p_productora IS NULL OR i.productora::TEXT = p_productora);

    SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.created_at ASC)
    INTO v_pendientes
    FROM public.ingresos i
    WHERE i.tipo = 'PENDIENTES'
      AND (p_productora IS NULL OR i.productora::TEXT = p_productora);

    RETURN jsonb_build_object(
        'full',       COALESCE(v_full, '[]'::JSONB),
        'pendientes', COALESCE(v_pendientes, '[]'::JSONB)
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4) upsert_ingreso
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_ingreso(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_existing_fecha_ingreso TIMESTAMPTZ;
    v_existing_created_at    TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    SELECT fecha_ingreso, created_at
    INTO v_existing_fecha_ingreso, v_existing_created_at
    FROM public.ingresos
    WHERE id_ingreso = (p_data->>'id_ingreso')
      AND productora::TEXT = (p_data->>'productora')
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.ingresos SET
            fecha_traslado     = (p_data->>'fecha_traslado')::DATE,
            taller             = COALESCE(p_data->>'taller', ''),
            linea              = COALESCE(p_data->>'linea', ''),
            auditor            = COALESCE(p_data->>'auditor', ''),
            gestor             = COALESCE(p_data->>'gestor', ''),
            escaner            = COALESCE(p_data->>'escaner', ''),
            lote               = COALESCE((p_data->>'lote')::INTEGER, 0),
            refprov            = COALESCE(p_data->>'refprov', ''),
            descripcion        = COALESCE(p_data->>'descripcion', ''),
            descripcion_larga  = COALESCE(p_data->>'descripcion_larga', ''),
            total              = COALESCE((p_data->>'total')::INTEGER, 0),
            cantidad           = COALESCE((p_data->>'cantidad')::INTEGER, 0),
            total_relativo     = COALESCE((p_data->>'total_relativo')::INTEGER, 0),
            total_general      = COALESCE((p_data->>'total_general')::INTEGER, 0),
            diferencia         = COALESCE((p_data->>'diferencia')::INTEGER, 0),
            costo_unitario     = COALESCE((p_data->>'costo_unitario')::NUMERIC, 0),
            costo_total        = COALESCE((p_data->>'costo_total')::NUMERIC, 0),
            auditoria          = COALESCE((p_data->>'auditoria')::INTEGER, 0),
            orden_servicio     = COALESCE((p_data->>'orden_servicio')::INTEGER, 0),
            traslado           = COALESCE((p_data->>'traslado')::INTEGER, 0),
            referencia         = COALESCE(p_data->>'referencia', ''),
            tipo               = COALESCE(p_data->>'tipo', 'FULL'),
            pvp                = COALESCE((p_data->>'pvp')::NUMERIC, 0),
            clase              = COALESCE(p_data->>'clase', ''),
            prenda             = COALESCE(p_data->>'prenda', ''),
            genero             = COALESCE(p_data->>'genero', ''),
            marca              = COALESCE(p_data->>'marca', ''),
            proveedor          = COALESCE(p_data->>'proveedor', ''),
            fuente             = COALESCE(p_data->>'fuente', 'SISPRO'),
            bolsas             = COALESCE((p_data->>'bolsas')::INTEGER, 0),
            otros_traslados    = COALESCE(p_data->'otros_traslados', '[]'::JSONB),
            anexos             = COALESCE(p_data->'anexos', '[]'::JSONB),
            hr                 = COALESCE(p_data->'hr', '[]'::JSONB),
            detalle_cantidades = COALESCE(p_data->'detalle_cantidades', '{}'::JSONB),
            fecha_ingreso      = v_existing_fecha_ingreso,
            created_at         = v_existing_created_at,
            updated_at         = v_now
        WHERE id_ingreso = (p_data->>'id_ingreso')
          AND productora::TEXT = (p_data->>'productora')
        RETURNING to_jsonb(ingresos.*) INTO v_result;
    ELSE
        INSERT INTO public.ingresos (
            id_ingreso, fecha_traslado, taller, linea, auditor, gestor, escaner,
            lote, refprov, descripcion, descripcion_larga, total, cantidad,
            total_relativo, total_general, diferencia, costo_unitario, costo_total,
            auditoria, orden_servicio, traslado, referencia, tipo, pvp, clase,
            prenda, genero, marca, proveedor, productora, fuente, bolsas,
            otros_traslados, anexos, hr, detalle_cantidades,
            fecha_ingreso, created_at, updated_at
        ) VALUES (
            p_data->>'id_ingreso',
            (p_data->>'fecha_traslado')::DATE,
            COALESCE(p_data->>'taller', ''),
            COALESCE(p_data->>'linea', ''),
            COALESCE(p_data->>'auditor', ''),
            COALESCE(p_data->>'gestor', ''),
            COALESCE(p_data->>'escaner', ''),
            COALESCE((p_data->>'lote')::INTEGER, 0),
            COALESCE(p_data->>'refprov', ''),
            COALESCE(p_data->>'descripcion', ''),
            COALESCE(p_data->>'descripcion_larga', ''),
            COALESCE((p_data->>'total')::INTEGER, 0),
            COALESCE((p_data->>'cantidad')::INTEGER, 0),
            COALESCE((p_data->>'total_relativo')::INTEGER, 0),
            COALESCE((p_data->>'total_general')::INTEGER, 0),
            COALESCE((p_data->>'diferencia')::INTEGER, 0),
            COALESCE((p_data->>'costo_unitario')::NUMERIC, 0),
            COALESCE((p_data->>'costo_total')::NUMERIC, 0),
            COALESCE((p_data->>'auditoria')::INTEGER, 0),
            COALESCE((p_data->>'orden_servicio')::INTEGER, 0),
            COALESCE((p_data->>'traslado')::INTEGER, 0),
            COALESCE(p_data->>'referencia', ''),
            COALESCE(p_data->>'tipo', 'FULL'),
            COALESCE((p_data->>'pvp')::NUMERIC, 0),
            COALESCE(p_data->>'clase', ''),
            COALESCE(p_data->>'prenda', ''),
            COALESCE(p_data->>'genero', ''),
            COALESCE(p_data->>'marca', ''),
            COALESCE(p_data->>'proveedor', ''),
            COALESCE(p_data->>'productora', ''),
            COALESCE(p_data->>'fuente', 'SISPRO'),
            COALESCE((p_data->>'bolsas')::INTEGER, 0),
            COALESCE(p_data->'otros_traslados', '[]'::JSONB),
            COALESCE(p_data->'anexos', '[]'::JSONB),
            COALESCE(p_data->'hr', '[]'::JSONB),
            COALESCE(p_data->'detalle_cantidades', '{}'::JSONB),
            v_now, v_now, v_now
        )
        RETURNING to_jsonb(ingresos.*) INTO v_result;
    END IF;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.upsert_ingreso IS
  'Upsert atómico de un ingreso. Preserva created_at y fecha_ingreso en updates.';

-- ─────────────────────────────────────────────────────────────
-- 5) rpc_get_colores_by_ids
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_get_colores_by_ids(
  p_ids        text[],
  p_productora text DEFAULT ''
)
RETURNS TABLE (
  id_color     text,
  nombre_color text,
  productora   text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF p_productora IS NOT NULL AND p_productora <> '' THEN
    RETURN QUERY
      SELECT c.id_color::text, c.nombre_color::text, c.productora::text
      FROM   colores c
      WHERE  c.id_color = ANY(p_ids)
        AND  c.productora::text = p_productora;
  ELSE
    RETURN QUERY
      SELECT c.id_color::text, c.nombre_color::text, c.productora::text
      FROM   colores c
      WHERE  c.id_color = ANY(p_ids);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_get_colores_by_ids(text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_colores_by_ids(text[], text) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 6) rpc_get_historicas_by_refprovs
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_get_historicas_by_refprovs(
  p_refprovs   text[],
  p_productora text DEFAULT ''
)
RETURNS TABLE (
  refprov      text,
  referencia   text,
  productora   text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_refprovs IS NULL OR array_length(p_refprovs, 1) IS NULL THEN
    RETURN;
  END IF;

  IF p_productora IS NOT NULL AND p_productora <> '' THEN
    RETURN QUERY
      SELECT h.refprov::text, h.referencia::text, h.productora::text
      FROM   historicas h
      WHERE  h.refprov = ANY(p_refprovs)
        AND  h.productora::text = p_productora;
  ELSE
    RETURN QUERY
      SELECT h.refprov::text, h.referencia::text, h.productora::text
      FROM   historicas h
      WHERE  h.refprov = ANY(p_refprovs);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_get_historicas_by_refprovs(text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_historicas_by_refprovs(text[], text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
