/**
 * Configuración de Mapeo Global
 * Define cómo se transforman las columnas del Excel a la estructura de la base de datos.
 */
const MAPPING_CONFIG = {
    // Ejemplo de mapeo para Ingresos
    ingresos: {
        targetTable: 'ingresos',
        columns: [
            { source: 'OP', target: 'op', type: 'string', required: true },
            { source: 'Referencia', target: 'referencia', type: 'string', required: true },
            { source: 'Cuento', target: 'linea', type: 'string' },
            { source: 'Cantidad', target: 'cantidad', type: 'number' },
            { source: 'Fecha', target: 'fecha', type: 'date' }
        ]
    },
    
    // Espacio para futuros mapeos (Proveedores, Clientes, etc.)
    maestros: {
        // ...
    }
};

window.MAPPING_CONFIG = MAPPING_CONFIG;
