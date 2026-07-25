const ORCA_SHEET_ID    = '1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE';
const ORCA_SHEET_NAME  = 'DATA';
const BUSINT_SHEET_ID  = '1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc';
const BUSINT_SHEET_NAME = 'DataBase';
const ORCA_API_KEY     = 'AIzaSyDrfha70cCUIHlaGeuX__rXKsczabswv68';

const SUPABASE_URL = 'https://iladaofarozipitwaeti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsYWRhb2Zhcm96aXBpdHdhZXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjYzMDksImV4cCI6MjA5MzA0MjMwOX0.4fyiibeZS10DCgov62d7tIFVzJHsklsBrbokAJ9ptK8';

let lineaMap = new Map();

const PRODUCTORA_UNIVERSO = "900616124";
const PRODUCTORA_ANGELES  = "900692469";

const IDX_ORCA = {
    REC:              0,
    GUARDADO:         1,
    DISTRIBUCION:     2,
    ESTADO:           3,
    COLABORADOR:      4,
    DATETIME:         5,
    FIN:              6,
    DURACION:         7,
    PAUSAS:           8,
    DATETIME_PAUSAS:  9,
    DURACION_PAUSAS:  10,
    ESTADO_IMP:       11
};

/**
 * Carga el mapeo de REC -> Linea desde el libro de BUSINT
 */
async function loadLineaMap() {
    if (lineaMap.size > 0) return;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${BUSINT_SHEET_ID}/values/${BUSINT_SHEET_NAME}!A:D?key=${ORCA_API_KEY}`;
    try {
        const response = await fetch(url);
        const json = await response.json();
        const rows = json.values || [];
        rows.slice(1).forEach(row => {
            const rec = String(row[0] || '').replace(/^REC/i, '').trim();
            const linea = String(row[3] || '').toUpperCase().trim().replace(/^LINEA\s+/i, '').replace(/\s+/g, '');
            if (rec) lineaMap.set(rec, linea);
        });
    } catch (e) {
        console.error("Error cargando mapa de líneas:", e);
    }
}

/**
 * Consulta los datos directamente desde Google Sheets
 */
async function fetchOrcaFromSheets() {
    // Asegurar que el mapa de líneas esté cargado
    await loadLineaMap();
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ORCA_SHEET_ID}/values/${ORCA_SHEET_NAME}!A:L?key=${ORCA_API_KEY}`;
    try {
        const response = await fetch(url);
        const json = await response.json();
        if (json.error) throw new Error(json.error.message);
        
        // Convertir de array de arrays (Sheets) a array de objetos para compatibilidad
        const rows = json.values || [];
        if (rows.length < 2) return [];

        const data = rows.slice(1).map(row => {
            const obj = {};
            Object.keys(IDX_ORCA).forEach(key => {
                obj[key] = row[IDX_ORCA[key]] || '';
            });
            return obj;
        });
        return data;
    } catch (e) {
        throw e;
    }
}

/**
 * Transforma una fila del CSV de Google Sheets al formato de Supabase
 * @param {Object} row Fila original del CSV
 * @returns {Object} Fila formateada para Supabase
 */
function transformRowOrca(row) {
    // Si row es un array (desde Sheets), lo mapeamos a objeto primero si no se hizo en fetch
    // Pero en fetchOrcaFromSheets ya lo convertimos a objeto con llaves REC, GUARDADO, etc.
    
    const rec = String(row.REC || '').trim();
    const guardado = String(row.GUARDADO || '').trim();
    const distribucionRaw = String(row.DISTRIBUCION || '').trim();
    const datetime = String(row.DATETIME || '').trim();

    // 1. Formatear fecha_distribucion
    // Fuente: 8/5/2026 16:40:18 (D/M/YYYY)
    // Destino: 2026-05-08 16:40:18-05
    let fechaDistribucion = null;
    if (guardado) {
        const [fecha, hora] = guardado.split(' ');
        if (fecha && hora) {
            const [d, m, y] = fecha.split('/');
            if (d && m && y) {
                fechaDistribucion = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')} ${hora}-05`;
            }
        }
    }

    // 2. Formatear datos_distribucion (Mantener como objeto JSONB)
    let datosDistribucion = null;
    try {
        if (distribucionRaw) {
            datosDistribucion = JSON.parse(distribucionRaw);
        }
    } catch (e) {
        console.warn(`Error parseando JSON en REC ${rec}:`, e);
    }

    // 3. created_at / updated_at
    // Fuente: 2026-05-11 7:39:46
    // Destino: 2026-05-11 07:39:46-05
    let createdAt = null;
    if (datetime) {
        const [f, h] = datetime.split(' ');
        if (f && h) {
            createdAt = `${f} ${h.padStart(8, '0')}-05`;
        }
    }
    if (!createdAt) {
        createdAt = new Date().toISOString().replace('T', ' ').split('.')[0] + '-05';
    }

    // 4. Mapeo dinámico de campos operativos
    const estado      = String(row.ESTADO || '').trim() || 'PENDIENTE';
    const colaborador = String(row.COLABORADOR || '').trim() || null;
    const duracion    = String(row.DURACION || '').trim() || null;
    const pausas      = String(row.PAUSAS || '').trim() || null;

    // Formatear inicio y fin con zona horaria
    const formatTime = (val) => {
        if (!val) return null;
        const [f, h] = val.split(' ');
        if (f && h) return `${f} ${h.padStart(8, '0')}-05`;
        return val;
    };

    const inicio = formatTime(row.DATETIME);
    const fin    = formatTime(row.FIN);

    // Determinar Productora según Linea (Lookup en lineaMap)
    const linea = lineaMap.get(rec) || '';
    const productora = linea.includes('ANGELES') ? PRODUCTORA_ANGELES : PRODUCTORA_UNIVERSO;

    return {
        id_distribucion:    rec,
        fecha_distribucion: fechaDistribucion,
        datos_distribucion: datosDistribucion,
        estado:             estado,
        colaborador:        colaborador,
        inicio:             inicio,
        fin:                fin,
        duracion:           duracion,
        pausas:             pausas,
        created_at:         createdAt,
        updated_at:         createdAt,
        productora:         productora
    };
}

/**
 * Reemplaza todos los registros de DIS_ORCA en Supabase usando Edge Function
 */
async function replaceDIS_ORCA(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No hay datos para reemplazar');
    }

    if (!confirm(`¿Estás seguro de reemplazar TODOS los registros de fuente DIS_ORCA (${data.length} registros)?`)) {
        return;
    }

    // Preparar registros para enviar a la Edge Function
    const toInsert = data.map(row => {
        return transformRowOrca(row);
    });

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/replace-disorca`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ records: toInsert })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Error en Edge Function');
        }

        return result;
    } catch (e) {
        console.error('Error:', e);
        throw e;
    }
}
