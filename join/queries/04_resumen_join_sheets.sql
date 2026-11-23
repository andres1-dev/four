-- ============================================================
-- JOIN: parquet (datos) + catálogo de Google Sheets (cat_*)
-- Las tablas cat_* se crean automáticamente al cargar el archivo.
--   cat_GRUPO_SUBGRUPO(f120_referencia, GENERO, PRENDA)
--   cat_COLORES(color, COLORES)
--   cat_TALLAS(talla, Tallaje)
--   cat_PROVEEDOR([03-MARCA], ORIGEN)
-- ============================================================

WITH grupo_subgrupo AS (
    SELECT
        UPPER(TRIM(CAST(f120_referencia AS VARCHAR))) AS referencia_key,
        TRIM(CAST(GENERO AS VARCHAR))    AS genero,
        TRIM(CAST(PRENDA AS VARCHAR))    AS categoria   -- PRENDA ≈ categoría de la hoja
    FROM cat_GRUPO_SUBGRUPO
),

proveedores AS (
    SELECT DISTINCT
        UPPER(TRIM(CAST("[03-MARCA]" AS VARCHAR))) AS marca_key,
        TRIM(CAST(ORIGEN AS VARCHAR)) AS "MP/PN"    -- ORIGEN de Sheets (MP/PN)
    FROM cat_PROVEEDOR
),

colores AS (
    SELECT
        UPPER(TRIM(CAST(color AS VARCHAR))) AS color_key,
        TRIM(CAST("COLORES" AS VARCHAR))    AS "Familia"  -- subgrupo de color
    FROM cat_COLORES
),

tallas AS (
    SELECT
        UPPER(TRIM(CAST(talla AS VARCHAR))) AS talla_key,
        TRIM(CAST("Tallaje" AS VARCHAR))    AS "Tallaje"
    FROM cat_TALLAS
),

tipos AS (
    SELECT
        UPPER(TRIM(CAST(PRENDA AS VARCHAR))) AS prenda_key,
        TRIM(CAST(TIPO AS VARCHAR))          AS tipo
    FROM cat_TIPOS
),

-- 1. BASE CON LOS JOIN NORMALIZADOS
base AS (
    SELECT
        a.*,
        gs.genero,
        gs.categoria,
        tp.tipo,
        c."Familia"          AS familia_color,
        t."Tallaje"          AS tallaje_descripcion,
        p."MP/PN"            AS proveedor_mp_pn

    FROM datos a

    LEFT JOIN grupo_subgrupo gs
        ON UPPER(TRIM(CAST(a.f120_referencia AS VARCHAR))) = gs.referencia_key

    LEFT JOIN tipos tp
        ON UPPER(TRIM(CAST(gs.categoria AS VARCHAR))) = tp.prenda_key

    LEFT JOIN colores c
        ON UPPER(TRIM(CAST(a.color AS VARCHAR))) = c.color_key

    LEFT JOIN tallas t
        ON UPPER(TRIM(CAST(a.talla AS VARCHAR))) = t.talla_key

    LEFT JOIN proveedores p
        ON UPPER(TRIM(CAST(a."[03-MARCA]" AS VARCHAR))) = p.marca_key

    WHERE a.id_cia = 1
      AND a.f120_referencia = 'IC0083'   -- solo una referencia para la vista
),

-- 2. AGRUPACIÓN
resumen AS (
    SELECT
        CASE CAST(id_cia AS VARCHAR)
            WHEN '1' THEN 'Templo'
            WHEN '2' THEN 'Shopping'
            ELSE CAST(id_cia AS VARCHAR)
        END AS empresa,

        f120_referencia AS referencia,
        TRIM(f120_descripcion) AS descripcion,

        genero,
        categoria,
        tipo,

        color,
        familia_color,
        talla,
        tallaje_descripcion,

        TRIM("[03-MARCA]") AS marca,
        proveedor_mp_pn,

        TRIM("[01-GRUPO]")   AS f_grupo,
        TRIM("[02-SUBGRUPO]") AS f_subgrupo,

        Precio,

        -- VENTAS MENSUALES
        SUM(COLUMNS('^VTA_2026[0-9]{2}$')) AS '\0',

        -- TOTALES
        SUM(TOTAL_VTA_2026) AS TOTAL_VTA_2026,
        SUM(TOTAL_DES_2026) AS TOTAL_DES_2026

    FROM base

    GROUP BY
        id_cia,
        f120_referencia,
        TRIM(f120_descripcion),

        genero,
        categoria,
        tipo,

        color,
        familia_color,
        talla,
        tallaje_descripcion,

        TRIM("[03-MARCA]"),
        proveedor_mp_pn,

        TRIM("[01-GRUPO]"),
        TRIM("[02-SUBGRUPO]"),

        Precio
),

-- 3. INDICADORES
indicadores AS (
    SELECT
        *,
        COALESCE(TOTAL_VTA_2026, 0) AS total_vta_general,
        COALESCE(TOTAL_DES_2026, 0) AS despacho_total
    FROM resumen
),

-- 4. ROTACIÓN
resultado AS (
    SELECT
        *,
        CASE
            WHEN despacho_total = 0 THEN NULL
            ELSE ROUND(total_vta_general::DOUBLE / despacho_total, 4)
        END AS rotacion
    FROM indicadores
)

-- 5. RESULTADO FINAL
SELECT
    empresa               AS "Empresa",
    referencia            AS "Referencia",
    descripcion           AS "Descripción",
    genero                AS "Género",
    categoria             AS "Categoría",
    tipo                  AS "Tipo",
    color                 AS "Color",
    familia_color         AS "Familia Color",
    talla                 AS "Talla",
    tallaje_descripcion   AS "Descripción Talla",
    f_grupo               AS "Grupo",
    f_subgrupo            AS "Subgrupo",
    marca                 AS "Marca",
    proveedor_mp_pn       AS "Proveedor MP/PN",
    Precio                AS "Precio",

    COLUMNS('^VTA_(2026)([0-9]{2})$') AS '\1-\2',

    TOTAL_VTA_2026        AS "Total Ventas",
    TOTAL_DES_2026        AS "Despacho",
    total_vta_general     AS "Total Ventas General",
    despacho_total        AS "Despacho General",
    rotacion              AS "% ROT"

FROM resultado

ORDER BY "Empresa", "Grupo", "Subgrupo", "Marca";
