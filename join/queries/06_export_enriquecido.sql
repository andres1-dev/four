-- ============================================================
-- EXPORT: PARQUET + GOOGLE SHEETS
-- TODAS LAS COLUMNAS ORIGINALES + COLUMNAS DE CATÁLOGOS
-- SIN FILTROS · SIN AGRUPACIONES · SIN LÍMITE (export completo)
-- Se ejecuta bajo demanda desde el botón "Parquet enriquecido".
-- ============================================================

WITH grupo_subgrupo AS (
    SELECT
        UPPER(TRIM(CAST(f120_referencia AS VARCHAR))) AS referencia_key,
        TRIM(CAST(GENERO AS VARCHAR)) AS genero,
        TRIM(CAST(PRENDA AS VARCHAR)) AS categoria
    FROM cat_GRUPO_SUBGRUPO
),

proveedores AS (
    SELECT DISTINCT
        UPPER(TRIM(CAST("[03-MARCA]" AS VARCHAR))) AS marca_key,
        TRIM(CAST(ORIGEN AS VARCHAR)) AS proveedor_mp_pn
    FROM cat_PROVEEDOR
),

colores AS (
    SELECT
        UPPER(TRIM(CAST(color AS VARCHAR))) AS color_key,
        TRIM(CAST(COLORES AS VARCHAR)) AS familia_color
    FROM cat_COLORES
),

tallas AS (
    SELECT
        UPPER(TRIM(CAST(talla AS VARCHAR))) AS talla_key,
        TRIM(CAST(Tallaje AS VARCHAR)) AS tallaje_descripcion
    FROM cat_TALLAS
),

tipos AS (
    SELECT
        UPPER(TRIM(CAST(PRENDA AS VARCHAR))) AS prenda_key,
        TRIM(CAST(TIPO AS VARCHAR)) AS tipo
    FROM cat_TIPOS
)

SELECT
    a.*,

    gs.genero           AS "CESAR_Genero",
    gs.categoria        AS "CESAR_Categoria",
    tp.tipo             AS "CESAR_Tipo",
    c.familia_color     AS "CESAR_Familia_Color",
    t.tallaje_descripcion AS "CESAR_Tallaje",
    p.proveedor_mp_pn   AS "CESAR_Proveedor_MP_PN"

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
    ON UPPER(TRIM(CAST(a."[03-MARCA]" AS VARCHAR))) = p.marca_key;
