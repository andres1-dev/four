-- ============================================================
-- SCRIPT 02: FUNCIONES PL/pgSQL (SERVER-SIDE LOGIC)
-- Son las funciones que las Edge Functions invocan con RPC.
-- Ejecutar después del script 01.
-- ============================================================

-- ── Función: get_config_tables ───────────────────────────────
-- Retorna todos los maestros en UN solo response (reduce 4 HTTP en 1 RPC)
CREATE OR REPLACE FUNCTION public.get_config_tables()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usuarios  JSON;
    v_proveedores JSON;
    v_auditores   JSON;
    v_gestores    JSON;
BEGIN
    SELECT json_agg(row_to_json(u)) INTO v_usuarios
    FROM (SELECT id_usuario, nombre_usuario, estado FROM public.usuarios ORDER BY nombre_usuario) u;

    SELECT json_agg(row_to_json(p)) INTO v_proveedores
    FROM (SELECT id_proveedor, nombre_proveedor, estado FROM public.proveedores ORDER BY nombre_proveedor) p;

    SELECT json_agg(row_to_json(a)) INTO v_auditores
    FROM (SELECT id_auditor, nombre_auditor, estado FROM public.auditores ORDER BY nombre_auditor) a;

    SELECT json_agg(row_to_json(g)) INTO v_gestores
    FROM (SELECT id_gestor, nombre_gestor, estado FROM public.gestores ORDER BY nombre_gestor) g;

    RETURN json_build_object(
        'usuarios',    COALESCE(v_usuarios,   '[]'::json),
        'proveedores', COALESCE(v_proveedores,'[]'::json),
        'auditores',   COALESCE(v_auditores,  '[]'::json),
        'gestores',    COALESCE(v_gestores,   '[]'::json)
    );
END;
$$;
COMMENT ON FUNCTION public.get_config_tables IS
  'Retorna usuarios, proveedores, auditores y gestores en un solo call. Usado por la EF maestros.';

-- ── Función: upsert_ingreso ──────────────────────────────────
-- Inserta o actualiza un ingreso. Retorna el registro resultante.
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
    -- Verificar si existe
    SELECT fecha_ingreso, created_at
    INTO v_existing_fecha_ingreso, v_existing_created_at
    FROM public.ingresos
    WHERE id_ingreso = (p_data->>'id_ingreso')
      AND productora  = (p_data->>'productora')
    LIMIT 1;

    IF FOUND THEN
        -- UPDATE: preservar fecha_ingreso y created_at originales
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
          AND productora  = (p_data->>'productora')
        RETURNING to_jsonb(ingresos.*) INTO v_result;
    ELSE
        -- INSERT
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

-- ── Función: get_lotes_data2 ─────────────────────────────────
-- Retorna ingresos confirmados por lotes o id_ingreso (bajo demanda)
-- Soporta búsqueda tanto por lote (número) como por id_ingreso (texto e.g. Excel NUMDOC)
CREATE OR REPLACE FUNCTION public.get_lotes_data2(p_lotes INT[], p_ids TEXT[] DEFAULT '{}')
RETURNS TABLE (
    id_ingreso        TEXT,
    lote              INTEGER,
    fecha_traslado    DATE,
    total             INTEGER,
    total_relativo    INTEGER,
    cantidad          INTEGER,
    diferencia        INTEGER,
    traslado          INTEGER,
    otros_traslados   JSONB,
    anexos            JSONB,
    total_general     INTEGER,
    detalle_cantidades JSONB,
    productora        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id_ingreso,
        i.lote,
        i.fecha_traslado,
        i.total,
        i.total_relativo,
        i.cantidad,
        i.diferencia,
        i.traslado,
        i.otros_traslados,
        i.anexos,
        i.total_general,
        i.detalle_cantidades,
        i.productora
    FROM public.ingresos i
    WHERE (
        (p_lotes IS NOT NULL AND array_length(p_lotes, 1) > 0 AND i.lote = ANY(p_lotes))
        OR
        (p_ids IS NOT NULL AND array_length(p_ids, 1) > 0 AND i.id_ingreso = ANY(p_ids))
        OR
        (p_lotes IS NOT NULL AND array_length(p_lotes, 1) > 0 AND i.id_ingreso = ANY(SELECT unnest(p_lotes)::TEXT))
    )
    ORDER BY i.created_at ASC;
END;
$$;
COMMENT ON FUNCTION public.get_lotes_data2 IS
  'Retorna ingresos filtrados por array de lotes y/o id_ingreso. Compatible con CSV y Excel.';

-- ── Función: get_distribution_data ───────────────────────────
-- Retorna ingresos FULL + PENDIENTES ya fusionados en servidor
CREATE OR REPLACE FUNCTION public.get_distribution_data(p_productora TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_full       JSONB;
    v_pendientes JSONB;
BEGIN
    -- Registros FULL
    SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.created_at DESC)
    INTO v_full
    FROM public.ingresos i
    WHERE i.tipo = 'FULL'
      AND (p_productora IS NULL OR i.productora = p_productora);

    -- Registros PENDIENTES
    SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.created_at ASC)
    INTO v_pendientes
    FROM public.ingresos i
    WHERE i.tipo = 'PENDIENTES'
      AND (p_productora IS NULL OR i.productora = p_productora);

    RETURN jsonb_build_object(
        'full',       COALESCE(v_full, '[]'::JSONB),
        'pendientes', COALESCE(v_pendientes, '[]'::JSONB)
    );
END;
$$;

-- ── Función: upsert_maestro ──────────────────────────────────
-- Upsert genérico para tablas maestras pequeñas (usuarios/proveedores/auditores/gestores)
CREATE OR REPLACE FUNCTION public.upsert_maestro(
    p_tabla TEXT,
    p_data  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_id_col TEXT;
    v_id_val TEXT;
BEGIN
    -- Determinar columna PK
    v_id_col := CASE p_tabla
        WHEN 'usuarios'    THEN 'id_usuario'
        WHEN 'proveedores' THEN 'id_proveedor'
        WHEN 'auditores'   THEN 'id_auditor'
        WHEN 'gestores'    THEN 'id_gestor'
        ELSE NULL
    END;

    IF v_id_col IS NULL THEN
        RAISE EXCEPTION 'Tabla no permitida: %', p_tabla;
    END IF;

    v_id_val := p_data ->> v_id_col;
    IF v_id_val IS NULL OR v_id_val = '' THEN
        RAISE EXCEPTION 'ID requerido en % para %', p_tabla, v_id_col;
    END IF;

    -- Usar INSERT ... ON CONFLICT DO UPDATE
    EXECUTE format(
        'INSERT INTO public.%I (data_col)
         VALUES ($1)
         ON CONFLICT (%I) DO UPDATE SET updated_at = NOW()
         RETURNING to_jsonb(%I.*)',
        p_tabla, v_id_col, p_tabla
    ) USING p_data INTO v_result;

    -- Como los campos son fijos, se hace con CASE específico
    -- (El EXECUTE dinámico genérico es complejo; usar upserts específicos en la EF maestros)
    RETURN v_result;
END;
$$;

-- ── Función: sync_master_from_remote ─────────────────────────
-- Función auxiliar que la EF sync-master usa internamente para hacer upsert batch
CREATE OR REPLACE FUNCTION public.sync_master_batch(p_records JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
    v_rec   JSONB;
BEGIN
    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records) LOOP
        INSERT INTO public.master (id_master, referencia, descripcion, cuento, genero, synced_at)
        VALUES (
            v_rec->>'id_master',
            COALESCE(v_rec->>'referencia', ''),
            COALESCE(v_rec->>'descripcion', ''),
            COALESCE(v_rec->>'cuento', ''),
            COALESCE(v_rec->>'genero', ''),
            NOW()
        )
        ON CONFLICT (id_master) DO UPDATE SET
            referencia  = EXCLUDED.referencia,
            descripcion = EXCLUDED.descripcion,
            cuento      = EXCLUDED.cuento,
            genero      = EXCLUDED.genero,
            synced_at   = NOW();
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;
COMMENT ON FUNCTION public.sync_master_batch IS
  'Recibe un array JSON de registros master y hace upsert batch. Llamada desde la EF sync-master.';

-- ============================================================
-- RPC: rpc_get_colores_by_ids
-- Devuelve colores estrictamente por los id_color solicitados.
-- Parámetros:
--   p_ids        text[]  — códigos de color del archivo
--   p_productora text    — NIT del proveedor (vacío = sin filtro)
--
-- NOTA: Función NUEVA. No reemplaza ni modifica ninguna función existente.
-- ============================================================

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
        AND  c.productora = p_productora;
  ELSE
    RETURN QUERY
      SELECT c.id_color::text, c.nombre_color::text, c.productora::text
      FROM   colores c
      WHERE  c.id_color = ANY(p_ids);
  END IF;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION rpc_get_colores_by_ids(text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_colores_by_ids(text[], text) TO service_role;
-- ============================================================
-- RPC: rpc_get_precios_by_refs
-- Devuelve precios estrictamente por las referencias solicitadas.
-- Parámetros:
--   p_refs text[] — referencias extraídas del archivo
--
-- NOTA: Función NUEVA. No reemplaza ni modifica ninguna función existente.
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_get_precios_by_refs(
  p_refs text[]
)
RETURNS TABLE (
  referencia text,
  pvp        numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_refs IS NULL OR array_length(p_refs, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.referencia::text, p.pvp
    FROM   precios p
    WHERE  p.referencia = ANY(p_refs);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_get_precios_by_refs(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_precios_by_refs(text[]) TO service_role;
-- ============================================================
-- RPC: rpc_get_historicas_by_refprovs
-- Devuelve históricos estrictamente por las refprovs solicitadas.
-- Parámetros:
--   p_refprovs   text[] — refprovs del archivo
--   p_productora text   — NIT del proveedor (vacío = sin filtro)
--
-- NOTA: Función NUEVA. No reemplaza ni modifica ninguna función existente.
-- ============================================================

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
        AND  h.productora = p_productora;
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
-- ============================================================
-- RPC: rpc_get_barras_by_refprovs
-- Devuelve códigos de barras estrictamente por refprovs solicitadas.
-- Parámetros:
--   p_refprovs text[] — refprovs del archivo
--
-- NOTA: Función NUEVA. No reemplaza ni modifica ninguna función existente.
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_get_barras_by_refprovs(
  p_refprovs text[]
)
RETURNS TABLE (
  refprov  text,
  talla    text,
  id_color text,
  barra    text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_refprovs IS NULL OR array_length(p_refprovs, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT b.refprov::text, b.talla::text, b.id_color::text, b.barra::text
    FROM   barras b
    WHERE  b.refprov = ANY(p_refprovs);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_get_barras_by_refprovs(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_barras_by_refprovs(text[]) TO service_role;
-- ============================================================
-- RPC: rpc_get_global_maps_by_ids
-- Devuelve las 4 tablas globales filtrando solo por los IDs
-- presentes en el Excel subido. Retorna JSON con 4 arrays.
-- Parámetros:
--   p_taller_ids  text[] — IDs de taller del Excel
--   p_linea_ids   text[] — IDs de línea del Excel
--   p_auditor_ids text[] — IDs de auditor del Excel
--   p_usuario_ids text[] — IDs de usuario del Excel
--
-- NOTA: Función NUEVA. No reemplaza ni modifica ninguna función existente.
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_get_global_maps_by_ids(
  p_taller_ids  text[] DEFAULT '{}',
  p_linea_ids   text[] DEFAULT '{}',
  p_auditor_ids text[] DEFAULT '{}',
  p_usuario_ids text[] DEFAULT '{}'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_talleres  json;
  v_lineas    json;
  v_auditores json;
  v_usuarios  json;
BEGIN
  -- Talleres
  IF array_length(p_taller_ids, 1) > 0 THEN
    SELECT json_agg(row_to_json(t))
    INTO   v_talleres
    FROM   (SELECT id_taller::text, taller::text FROM global_talleres WHERE id_taller = ANY(p_taller_ids)) t;
  ELSE
    v_talleres := '[]'::json;
  END IF;

  -- Líneas
  IF array_length(p_linea_ids, 1) > 0 THEN
    SELECT json_agg(row_to_json(t))
    INTO   v_lineas
    FROM   (SELECT id_linea::text, linea::text FROM global_lineas WHERE id_linea = ANY(p_linea_ids)) t;
  ELSE
    v_lineas := '[]'::json;
  END IF;

  -- Auditores
  IF array_length(p_auditor_ids, 1) > 0 THEN
    SELECT json_agg(row_to_json(t))
    INTO   v_auditores
    FROM   (SELECT id_auditor::text, auditor::text FROM global_auditores WHERE id_auditor = ANY(p_auditor_ids)) t;
  ELSE
    v_auditores := '[]'::json;
  END IF;

  -- Usuarios
  IF array_length(p_usuario_ids, 1) > 0 THEN
    SELECT json_agg(row_to_json(t))
    INTO   v_usuarios
    FROM   (SELECT id_usuario::text, usuario::text FROM global_usuarios WHERE id_usuario = ANY(p_usuario_ids)) t;
  ELSE
    v_usuarios := '[]'::json;
  END IF;

  RETURN json_build_object(
    'talleres',  COALESCE(v_talleres,  '[]'::json),
    'lineas',    COALESCE(v_lineas,    '[]'::json),
    'auditores', COALESCE(v_auditores, '[]'::json),
    'usuarios',  COALESCE(v_usuarios,  '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_get_global_maps_by_ids(text[], text[], text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_global_maps_by_ids(text[], text[], text[], text[]) TO service_role;
-- ============================================================
-- AJUSTE ESQUEMA: distribuciones (compatibilidad total)
-- Proyecto destino: lklojwgmzimzojsrcdlz
-- ============================================================

-- 1. Agregar columnas que existen en el origen y faltaban en destino
ALTER TABLE public.distribuciones 
ADD COLUMN IF NOT EXISTS datetime_ultima_pausa TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duracion_pausas TEXT DEFAULT '00:00:00';

-- 2. Cambiar tipo de 'duracion' a TEXT (almacena "00:08:44", no números)
ALTER TABLE public.distribuciones 
ALTER COLUMN duracion TYPE TEXT USING duracion::TEXT;

-- 3. Notificar a PostgREST para recargar la caché del esquema de inmediato
NOTIFY pgrst, 'reload schema';
