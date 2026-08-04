/**
 * DataBase (Records) Card Logic and Downloads
 */

let rangoSeleccionado = [];

function datosDescargar(formato) {
    if (!datosRegistros || datosRegistros.length === 0) {
        alert('No hay datos cargados.');
        return;
    }

    // Para Excel, preparar datos con fechas en formato correcto
    let datosParaExportar = datosRegistros;
    if (formato === 'excel') {
        datosParaExportar = datosRegistros.map(registro => {
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
    }

    switch (formato) {
        case 'csv': datosDescargarCSV(datosParaExportar); break;
        case 'json': datosDescargarJSON(datosParaExportar); break;
        case 'excel': datosDescargarExcel(datosParaExportar); break;
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
    link.click();
}

function datosDescargarJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'datos.json';
    link.click();
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

function initFlatpickr() {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    rangoSeleccionado = [primerDiaMes, hoy];

    if (typeof flatpickr !== 'undefined') {
        const fpInstance = flatpickr("#filtro-fechas", {
            mode: "range",
            dateFormat: "Y-m-d",
            defaultDate: [primerDiaMes, hoy],
            locale: {
                firstDayOfWeek: 1,
                weekdays: {
                    shorthand: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
                    longhand:  ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
                },
                months: {
                    shorthand: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
                    longhand:  ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
                },
                rangeSeparator: ' a '
            },
            onReady: (selectedDates, dateStr, instance) => {
                const el = document.getElementById('filtro-fechas');
                if (el) {
                    fitFlatpickrWidth(el);
                    // Prevenir que el clic en el input dispare la descarga
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });
                }
            },
            onChange: (selectedDates, dateStr, instance) => {
                if (selectedDates.length === 2) {
                    rangoSeleccionado = selectedDates;
                } else if (selectedDates.length === 1) {
                    rangoSeleccionado = [selectedDates[0], selectedDates[0]];
                }
                const el = document.getElementById('filtro-fechas');
                if (el) fitFlatpickrWidth(el);
            },
            onClose: (selectedDates, dateStr, instance) => {
                // Asegurar que el rango esté completo al cerrar
                if (selectedDates.length === 1) {
                    rangoSeleccionado = [selectedDates[0], selectedDates[0]];
                } else if (selectedDates.length === 2) {
                    rangoSeleccionado = selectedDates;
                }
            }
        });

        // Guardar instancia para acceso global si es necesario
        window._filtroFechasPicker = fpInstance;
    }
}

function fitFlatpickrWidth(el) {
    const tmp = document.createElement('canvas');
    const ctx = tmp.getContext('2d');
    const style = window.getComputedStyle(el);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = el.value || 'aaaa-mm-dd';
    const measured = ctx.measureText(text).width;
    el.style.width = `${Math.ceil(measured + 24 + 16)}px`; // padding izq + respiro
}

function datosDescargarExcelFiltrado() {
    if (!datosRegistros || datosRegistros.length === 0) {
        alert('No hay datos cargados. Por favor, abre la tarjeta de Base de Datos primero.');
        return;
    }
    
    if (!rangoSeleccionado || rangoSeleccionado.length === 0) {
        alert('Por favor, selecciona un rango de fechas.');
        return;
    }
    
    // Si solo hay una fecha, usar la misma para inicio y fin
    const fechaInicio = rangoSeleccionado[0];
    const fechaFin = rangoSeleccionado.length === 2 ? rangoSeleccionado[1] : rangoSeleccionado[0];
    
    if (!fechaInicio || !fechaFin) {
        alert('Selecciona un rango válido de fechas.');
        return;
    }

    const inicio = normalizarInicio(fechaInicio);
    const fin = normalizarFin(fechaFin);

    const datosFiltrados = datosRegistros.filter(registro => {
        const fecha = parseFechaLocal(registro.FECHA);
        return fecha >= inicio && fecha <= fin;
    });

    if (datosFiltrados.length === 0) {
        alert(`No hay datos en el rango seleccionado:\n${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}`);
        return;
    }

    // Preparar datos con fechas en formato correcto para Excel
    const datosConFechas = datosFiltrados.map(registro => {
        const copia = { ...registro };
        
        // Convertir FECHA a formato DD/MM/YYYY para que Excel lo reconozca
        const fechaObj = parseFechaLocal(registro.FECHA);
        if (fechaObj) {
            const dia = String(fechaObj.getDate()).padStart(2, '0');
            const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const año = fechaObj.getFullYear();
            copia.FECHA = `${dia}/${mes}/${año}`;
        }
        
        return copia;
    });

    console.log(`Descargando ${datosFiltrados.length} registros del rango: ${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}`);
    datosDescargarExcel(datosConFechas);
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const año = d.getFullYear();
    return `${dia}/${mes}/${año}`;
}

// Call init on load
document.addEventListener('DOMContentLoaded', initFlatpickr);
