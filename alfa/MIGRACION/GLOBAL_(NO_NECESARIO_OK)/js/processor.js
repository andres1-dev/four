/**
 * Processor.js - Lógica de Normalización y Transformación
 */
class DataProcessor {
    constructor(config) {
        this.config = config;
    }

    /**
     * Normaliza un registro basado en el esquema de mapeo
     */
    normalizeRow(row, schemaName) {
        const schema = this.config[schemaName];
        if (!schema) throw new Error(`Esquema ${schemaName} no definido`);

        const normalized = {};
        schema.columns.forEach(col => {
            let value = row[col.source];
            
            // Aplicar transformaciones básicas según el tipo
            if (col.type === 'number') value = parseFloat(value) || 0;
            if (col.type === 'string') value = String(value || '').trim();
            if (col.type === 'date') value = this.formatDate(value);

            normalized[col.target] = value;
        });

        return normalized;
    }

    formatDate(val) {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    }
}

window.DataProcessor = DataProcessor;
