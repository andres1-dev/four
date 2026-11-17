-- ============================================================
-- PATCH 2 — upsert_ingreso type-agnostic + timeout de distribución
-- NO modifica tablas ni datos.
--
-- Corrige:
--   • 42804: column "productora" is of type numeric but expression is text
--     (el INSERT/UPDATE pasaba texto a una columna NUMERIC)
--   • 57014: canceling statement due to statement timeout en
--     get_distribution_data (agrega de todas las filas)
--
-- Estrategia: jsonb_populate_record convierte cada campo del JSON al
-- tipo REAL de la columna. Así funciona igual si la columna es
-- numeric o text, integer o numeric.
--
-- Aplicar en: Supabase Dashboard → SQL Editor → Run.
-- Idempotente.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) upsert_ingreso
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
    v_rec public.ingresos%ROWTYPE;
BEGIN
    -- Convierte el JSON a los tipos REALES de la tabla.
    -- Evita los errores "numeric but expression is text".
    SELECT * INTO v_rec
    FROM jsonb_populate_record(NULL::public.ingresos, p_data);

    -- Defaults equivalentes a los COALESCE del código original
    v_rec.taller             := COALESCE(v_rec.taller, '');
    v_rec.linea              := COALESCE(v_rec.linea, '');
    v_rec.auditor            := COALESCE(v_rec.auditor, '');
    v_rec.gestor             := COALESCE(v_rec.gestor, '');
    v_rec.escaner            := COALESCE(v_rec.escaner, '');
    v_rec.lote               := COALESCE(v_rec.lote, 0);
    v_rec.refprov            := COALESCE(v_rec.refprov, '');
    v_rec.descripcion        := COALESCE(v_rec.descripcion, '');
    v_rec.descripcion_larga  := COALESCE(v_rec.descripcion_larga, '');
    v_rec.total              := COALESCE(v_rec.total, 0);
    v_rec.cantidad           := COALESCE(v_rec.cantidad, 0);
    v_rec.total_relativo     := COALESCE(v_rec.total_relativo, 0);
    v_rec.total_general      := COALESCE(v_rec.total_general, 0);
    v_rec.diferencia         := COALESCE(v_rec.diferencia, 0);
    v_rec.costo_unitario     := COALESCE(v_rec.costo_unitario, 0);
    v_rec.costo_total        := COALESCE(v_rec.costo_total, 0);
    v_rec.auditoria          := COALESCE(v_rec.auditoria, 0);
    v_rec.orden_servicio     := COALESCE(v_rec.orden_servicio, 0);
    v_rec.traslado           := COALESCE(v_rec.traslado, 0);
    v_rec.referencia         := COALESCE(v_rec.referencia, '');
    v_rec.tipo               := COALESCE(v_rec.tipo, 'FULL');
    v_rec.pvp                := COALESCE(v_rec.pvp, 0);
    v_rec.clase              := COALESCE(v_rec.clase, '');
    v_rec.prenda             := COALESCE(v_rec.prenda, '');
    v_rec.genero             := COALESCE(v_rec.genero, '');
    v_rec.marca              := COALESCE(v_rec.marca, '');
    v_rec.proveedor          := COALESCE(v_rec.proveedor, '');
    v_rec.fuente             := COALESCE(v_rec.fuente, 'SISPRO');
    v_rec.bolsas             := COALESCE(v_rec.bolsas, 0);
    v_rec.otros_traslados    := COALESCE(v_rec.otros_traslados, '[]'::JSONB);
    v_rec.anexos             := COALESCE(v_rec.anexos, '[]'::JSONB);
    v_rec.hr                 := COALESCE(v_rec.hr, '[]'::JSONB);
    v_rec.detalle_cantidades := COALESCE(v_rec.detalle_cantidades, '{}'::JSONB);

    -- ¿Existe ya? (comparación como texto: válida con productora numeric o text)
    SELECT fecha_ingreso, created_at
    INTO v_existing_fecha_ingreso, v_existing_created_at
    FROM public.ingresos
    WHERE id_ingreso = v_rec.id_ingreso
      AND productora::TEXT = v_rec.productora::TEXT
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.ingresos SET
            fecha_traslado     = v_rec.fecha_traslado,
            taller             = v_rec.taller,
            linea              = v_rec.linea,
            auditor            = v_rec.auditor,
            gestor             = v_rec.gestor,
            escaner            = v_rec.escaner,
            lote               = v_rec.lote,
            refprov            = v_rec.refprov,
            descripcion        = v_rec.descripcion,
            descripcion_larga  = v_rec.descripcion_larga,
            total              = v_rec.total,
            cantidad           = v_rec.cantidad,
            total_relativo     = v_rec.total_relativo,
            total_general      = v_rec.total_general,
            diferencia         = v_rec.diferencia,
            costo_unitario     = v_rec.costo_unitario,
            costo_total        = v_rec.costo_total,
            auditoria          = v_rec.auditoria,
            orden_servicio     = v_rec.orden_servicio,
            traslado           = v_rec.traslado,
            referencia         = v_rec.referencia,
            tipo               = v_rec.tipo,
            pvp                = v_rec.pvp,
            clase              = v_rec.clase,
            prenda             = v_rec.prenda,
            genero             = v_rec.genero,
            marca              = v_rec.marca,
            proveedor          = v_rec.proveedor,
            fuente             = v_rec.fuente,
            bolsas             = v_rec.bolsas,
            otros_traslados    = v_rec.otros_traslados,
            anexos             = v_rec.anexos,
            hr                 = v_rec.hr,
            detalle_cantidades = v_rec.detalle_cantidades,
            fecha_ingreso      = v_existing_fecha_ingreso,
            created_at         = v_existing_created_at,
            updated_at         = v_now
        WHERE id_ingreso = v_rec.id_ingreso
          AND productora::TEXT = v_rec.productora::TEXT
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
            v_rec.id_ingreso,
            v_rec.fecha_traslado,
            v_rec.taller,
            v_rec.linea,
            v_rec.auditor,
            v_rec.gestor,
            v_rec.escaner,
            v_rec.lote,
            v_rec.refprov,
            v_rec.descripcion,
            v_rec.descripcion_larga,
            v_rec.total,
            v_rec.cantidad,
            v_rec.total_relativo,
            v_rec.total_general,
            v_rec.diferencia,
            v_rec.costo_unitario,
            v_rec.costo_total,
            v_rec.auditoria,
            v_rec.orden_servicio,
            v_rec.traslado,
            v_rec.referencia,
            v_rec.tipo,
            v_rec.pvp,
            v_rec.clase,
            v_rec.prenda,
            v_rec.genero,
            v_rec.marca,
            v_rec.proveedor,
            v_rec.productora,
            v_rec.fuente,
            v_rec.bolsas,
            v_rec.otros_traslados,
            v_rec.anexos,
            v_rec.hr,
            v_rec.detalle_cantidades,
            v_now, v_now, v_now
        )
        RETURNING to_jsonb(ingresos.*) INTO v_result;
    END IF;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.upsert_ingreso IS
  'Upsert atómico de un ingreso. Type-agnostic (numeric/text) vía jsonb_populate_record.';

-- ─────────────────────────────────────────────────────────────
-- 2) get_distribution_data — evita el statement timeout
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
    -- Esta función agrega muchas filas en un solo JSON; el límite por
    -- defecto (3s/8s) no alcanza. Se sube solo para esta transacción.
    PERFORM set_config('statement_timeout', '120s', true);

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

COMMIT;

NOTIFY pgrst, 'reload schema';
