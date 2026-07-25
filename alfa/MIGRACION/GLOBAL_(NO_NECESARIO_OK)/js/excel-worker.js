/**
 * excel-worker.js - Procesamiento en segundo plano para archivos grandes
 */
importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');

self.onmessage = function(e) {
    const { data, type } = e.data;

    try {
        if (type === 'PARSE') {
            const workbook = XLSX.read(data, { 
                type: 'array',
                cellDates: true,
                cellNF: false,
                cellText: false
            });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convertir a JSON con optimización
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1, // Obtener array de arrays para máxima velocidad inicial
                defval: ''
            });

            // Separar cabeceras de datos
            const headers = jsonData[0];
            const rows = jsonData.slice(1).map(row => {
                const obj = {};
                headers.forEach((h, i) => {
                    obj[h] = row[i];
                });
                return obj;
            });

            self.postMessage({ 
                success: true, 
                data: rows,
                headers: headers,
                count: rows.length
            });
        }
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};
