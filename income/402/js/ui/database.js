/**
 * DataBase (Records) Card Logic and Downloads
 */

async function datosDescargar(formato) {
    try {
        console.log('Iniciando descarga:', formato);
        
        // Calcular automáticamente mes actual y mes anterior
        const hoy = new Date();
        const mesActual = hoy.getMonth();
        const añoActual = hoy.getFullYear();
        
        // Mes anterior
        const fechaMesAnterior = new Date(añoActual, mesActual - 1, 1);
        const mesAnterior = fechaMesAnterior.getMonth();
        const añoAnterior = fechaMesAnterior.getFullYear();
        
        // Primer día del mes anterior
        const inicio = new Date(añoAnterior, mesAnterior, 1);
        // Último día del mes actual
        const fin = new Date(añoActual, mesActual + 1, 0);

        console.log('Rango de fechas:', inicio.toISOString().split('T')[0], 'a', fin.toISOString().split('T')[0]);

        // Usar la función global de Supabase para cargar datos filtrados
        if (typeof window.datosCargarEndpointFiltrado !== 'function') {
            console.error('datosCargarEndpointFiltrado no está disponible');
            alert('Error: función de carga no disponible. Recargue la página.');
            return;
        }
        
        const datosParaExportar = await window.datosCargarEndpointFiltrado(inicio, fin);
        console.log('Datos obtenidos:', datosParaExportar.length);

        if (!datosParaExportar || datosParaExportar.length === 0) {
            alert('No hay datos para el período seleccionado (mes actual y anterior).');
            return;
        }

        // Para Excel, preparar datos con fechas en formato correcto
        let datosParaExportarFinal;
        if (formato === 'excel') {
            datosParaExportarFinal = datosParaExportar.map(registro => {
                const copia = { ...registro };
                
                // Convertir FECHA a formato DD/MM/YYYY para que Excel lo reconozca
                if (copia.FECHA) {
                    const fechaObj = parseFechaLocal(copia.FECHA);
                    if (fechaObj) {
                        const dia = String(fechaObj.getDate()).padStart(2, '0');
                        const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
                        const año = fechaObj.getFullYear();
                        copia.FECHA = `${dia}/${mes}/${año}`;
                    }
                }
                
                return copia;
            });
        } else {
            datosParaExportarFinal = datosParaExportar;
        }

        console.log('Iniciando generación de archivo:', formato);
        switch (formato) {
            case 'csv': datosDescargarCSV(datosParaExportarFinal); break;
            case 'json': datosDescargarJSON(datosParaExportarFinal); break;
            case 'excel': datosDescargarExcel(datosParaExportarFinal); break;
        }
        console.log('Descarga completada');
    } catch (error) {
        console.error('Error al descargar datos:', error);
        alert('Error al descargar datos: ' + error.message);
    }
}

function datosDescargarCSV(data) {
    const headers = Object.keys(data[0]).join(';');
    const csvContent = data.map(row =>
        Object.values(row).map(v => (typeof v === 'string' && v.includes(',')) ? `"${v}"` : v).join(';')
    ).join('\n');

    const blob = new Blob([headers + '\n' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'datos.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    console.log('Archivo CSV descargado');
}

function datosDescargarJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'datos.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    console.log('Archivo JSON descargado');
}

function datosDescargarExcel(data) {
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
        script.onload = () => generarYDescargarExcel(data);
        document.head.appendChild(script);
    } else {
        generarYDescargarExcel(data);
    }
}

function generarYDescargarExcel(data) {
    try {
        const wb = XLSX.utils.book_new();
        
        // Convertir datos a formato de hoja
        const ws = XLSX.utils.json_to_sheet(data);
        
        // Identificar columnas de fecha y aplicar formato
        const range = XLSX.utils.decode_range(ws['!ref']);
        const headers = [];
        
        // Leer encabezados
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            const cell = ws[cellAddress];
            if (cell && cell.v) {
                headers.push({ col: C, name: cell.v });
            }
        }
        
        // Encontrar columnas de fecha (FECHA, TIMESTAMP, etc.)
        const dateColumns = headers.filter(h => 
            h.name.toUpperCase().includes('FECHA') || 
            h.name.toUpperCase().includes('TIMESTAMP')
        ).map(h => h.col);
        
        // Aplicar formato de fecha a las celdas correspondientes
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            dateColumns.forEach(C => {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = ws[cellAddress];
                
                if (cell && cell.v) {
                    let dateValue = null;
                    
                    // Intentar parsear diferentes formatos de fecha
                    if (typeof cell.v === 'string') {
                        // Formato DD/MM/YYYY
                        if (cell.v.includes('/')) {
                            const parts = cell.v.split('/');
                            if (parts.length === 3) {
                                const day = parseInt(parts[0], 10);
                                const month = parseInt(parts[1], 10) - 1;
                                const year = parseInt(parts[2], 10);
                                dateValue = new Date(year, month, day);
                            }
                        }
                        // Formato YYYY-MM-DD
                        else if (cell.v.includes('-')) {
                            const parts = cell.v.split('-');
                            if (parts.length === 3) {
                                const year = parseInt(parts[0], 10);
                                const month = parseInt(parts[1], 10) - 1;
                                const day = parseInt(parts[2], 10);
                                dateValue = new Date(year, month, day);
                            }
                        }
                    } else if (cell.v instanceof Date) {
                        dateValue = cell.v;
                    }
                    
                    // Convertir a número de serie de Excel
                    if (dateValue && !isNaN(dateValue.getTime())) {
                        // Excel usa 1900-01-01 como día 1
                        const excelEpoch = new Date(1899, 11, 30);
                        const daysSinceEpoch = Math.floor((dateValue - excelEpoch) / (24 * 60 * 60 * 1000));
                        
                        cell.t = 'n'; // Tipo numérico
                        cell.v = daysSinceEpoch;
                        cell.z = 'dd/mm/yyyy'; // Formato de fecha
                    }
                }
            });
        }
        
        // Ajustar ancho de columnas automáticamente
        const colWidths = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            let maxWidth = 10;
            for (let R = range.s.r; R <= range.e.r; ++R) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = ws[cellAddress];
                if (cell && cell.v) {
                    const cellLength = String(cell.v).length;
                    maxWidth = Math.max(maxWidth, cellLength);
                }
            }
            colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
        }
        ws['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, ws, "Datos");
        XLSX.writeFile(wb, 'datos.xlsx');
    } catch (error) {
        console.error('Error al generar Excel:', error);
        alert('Error al generar el archivo Excel.');
    }
}

async function datosDescargarExcelFiltrado() {
    try {
        // Calcular automáticamente mes actual y mes anterior
        const hoy = new Date();
        const mesActual = hoy.getMonth();
        const añoActual = hoy.getFullYear();
        
        // Mes anterior
        const fechaMesAnterior = new Date(añoActual, mesActual - 1, 1);
        const mesAnterior = fechaMesAnterior.getMonth();
        const añoAnterior = fechaMesAnterior.getFullYear();
        
        // Primer día del mes anterior
        const inicio = new Date(añoAnterior, mesAnterior, 1);
        // Último día del mes actual
        const fin = new Date(añoActual, mesActual + 1, 0);

        // Usar la función global de Supabase para cargar datos filtrados
        if (typeof window.datosCargarEndpointFiltrado !== 'function') {
            alert('Error: función de carga no disponible. Recargue la página.');
            return;
        }
        
        const datosFiltrados = await window.datosCargarEndpointFiltrado(inicio, fin);

        if (!datosFiltrados || datosFiltrados.length === 0) {
            alert('No hay datos para el período seleccionado (mes actual y anterior).');
            return;
        }

        // Preparar datos con fechas en formato correcto para Excel
        const datosConFechas = datosFiltrados.map(registro => {
            const copia = { ...registro };
            
            // Convertir FECHA a formato DD/MM/YYYY para que Excel lo reconozca
            if (copia.FECHA) {
                const fechaObj = parseFechaLocal(copia.FECHA);
                if (fechaObj) {
                    const dia = String(fechaObj.getDate()).padStart(2, '0');
                    const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
                    const año = fechaObj.getFullYear();
                    copia.FECHA = `${dia}/${mes}/${año}`;
                }
            }
            
            return copia;
        });

        datosDescargarExcel(datosConFechas);
    } catch (error) {
        console.error('Error al descargar Excel filtrado:', error);
        alert('Error al descargar Excel. Por favor, intente nuevamente.');
    }
}

function parseFechaLocal(fechaStr) {
    if (!fechaStr) return null;
    
    // Si ya es un objeto Date, retornarlo
    if (fechaStr instanceof Date) return fechaStr;
    
    // Formato DD/MM/YYYY
    if (fechaStr.includes('/')) {
        const parts = fechaStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day);
        }
    }
    
    // Formato YYYY-MM-DD
    if (fechaStr.includes('-')) {
        const parts = fechaStr.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            return new Date(year, month, day);
        }
    }
    
    return null;
}
