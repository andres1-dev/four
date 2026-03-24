/**
 * MODULO DE IMPRESIÓN - GENERADOR DE PLANTILLAS
 * Optimizado para impresión individual y por lotes (PrintConductor style)
 * Manejo de lógica Duplex (Lado y Lado) para ahorro de papel y orden.
 */

// ============================================
// GENERADOR DE HTML BASE PARA UN DOCUMENTO
// ============================================
function print_generarHTMLParaDoc(datos, options = {}) {
    const {
        modo = 'completo', // 'completo' | 'principal' | 'cliente'
        clienteNombre = null,
        soloPrincipal = false,
        soloImpresionPrincipal = false,
        esLote = false
    } = options;

    const isModoCliente = modo === 'cliente';
    const isModoPrincipal = modo === 'principal' || soloPrincipal;

    // Configuración común
    const currentSearchKey = datos.REC || '';
    const recForCode = String(currentSearchKey).split('.')[0];
    const clienteData = isModoCliente ? datos.DISTRIBUCION.Clientes[clienteNombre] : null;
    const clienteId = isModoCliente ? (clienteData.id || '') : '';

    let proveedorId = '';
    const proveedorNombre = datos.PROVEEDOR || '';
    if (!isModoCliente) {
        if (proveedorNombre.includes("TEXTILES Y CREACIONES EL UNIVERSO")) {
            proveedorId = "900616124";
        } else if (proveedorNombre.includes("TEXTILES Y CREACIONES LOS ANGELES")) {
            proveedorId = "900692469";
        }
    }

    let qrData;
    if (isModoCliente) {
        qrData = `REC${recForCode}-${clienteId}`;
    } else if (proveedorId) {
        qrData = `REC${recForCode}-${proveedorId}`;
    } else {
        qrData = `REC${recForCode}`;
    }

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrData)}`;
    const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(qrData)}&code=Code128&dpi=300&dataseparator=`;

    // Wrapper por unidad (Crítico para saltos de página)
    let html = `
    <div class="print-unit ${esLote ? 'lote-separator' : ''}">
        <div class="header-container">
            <div class="info-container">
                <div class="title-section">
                    <div class="main-title">Separación de terceros para:</div>
                    <div class="provider-name">${isModoCliente ? (clienteData.razonSocial || clienteNombre) : (datos.PROVEEDOR || 'Proveedor no especificado')}</div>
                    <div class="subtitle">${datos.DESCRIPCION || 'Sin descripción'}</div>
                </div>
                
                <div class="info-grid">
                    <div class="info-item"><div class="info-label">Referencia:</div><div class="info-value">${datos.REFERENCIA || ''}</div></div>
                    <div class="info-item"><div class="info-label">RefProv:</div><div class="info-value">${datos.REFPROV || ''}</div></div>
                    <div class="info-item"><div class="info-label">Lote:</div><div class="info-value">${datos.LOTE || ''}</div></div>
                    <div class="info-item"><div class="info-label">Género:</div><div class="info-value">${datos.GENERO || ''}</div></div>
                    <div class="info-item">
                        <div class="info-label">PVP:</div>
                        <div class="info-value">
                            ${(() => {
                                let pvpStr = String(datos.PVP || '');
                                let pvpNum = parseInt(pvpStr.replace('$', '').replace(/\./g, '').trim());
                                if (pvpNum <= 39900) return `${pvpStr} Linea`;
                                if (pvpNum >= 40000 && pvpNum <= 59900) return `${pvpStr} Moda`;
                                if (pvpNum >= 60000) return `${pvpStr} Pronta`;
                                return pvpStr;
                            })()}
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Tipo:</div>
                        <div class="info-value">
                            ${isModoCliente ? 
                                (clienteData.tipoCliente === "Empresa" ? `${clienteData.tipoCliente} ${clienteData.tipoEmpresa?.replace(/^Empresa\s*/, '') || ''} ${clienteData.porcentaje || ''}` : `${clienteData.tipoCliente || ''} ${clienteData.porcentaje || ''}`) 
                                : (datos.TIPO || '')}
                        </div>
                    </div>
                    <div class="info-item"><div class="info-label">Fecha:</div><div class="info-value">${datos.FECHA || ''}</div></div>
                    <div class="info-item"><div class="info-label">Prenda:</div><div class="info-value">${datos.PRENDA || ''}</div></div>
                    <div class="info-item"><div class="info-label">Línea:</div><div class="info-value">${datos.LINEA || ''}</div></div>
                </div>

                <div class="info-grid2">
                    <div class="info-item"><div class="info-label">Gestor:</div><div class="info-value">${datos.GESTOR || ''}</div></div>
                    <div class="info-item"><div class="info-label">Auditor:</div><div class="info-value">${datos.AUDITOR || ''}</div></div>
                    <div class="info-item"><div class="info-label">Escáner:</div><div class="info-value">${datos.ESCANER || ''}</div></div>
                    <div class="info-item"><div class="info-label">Taller:</div><div class="info-value">${datos.TALLER || ''}</div></div>
                </div>
            </div>
            
            <div class="codes-container">
                <div class="qr-container">
                    <img src="${qrCodeUrl}" class="qr-code" alt="QR">
                    <div class="code-display">${qrData}</div>
                </div>
                <div class="barcode-container">
                    <img src="${barcodeUrl}" class="barcode" alt="Barcode">
                </div>
            </div>
        </div>
        
        <div class="footer">
            ${isModoCliente ? `Cantidad: <span class="info-value"><strong>${clienteData.distribucion ? clienteData.distribucion.reduce((acc, item) => acc + (parseInt(item.cantidad) || 0), 0) : 0}</strong></span> &nbsp;|&nbsp; Responsable: <span class="info-value">${datos.COLABORADOR || ''}</span> &nbsp;|&nbsp; ` : ''}
            Impreso: ${new Date().toLocaleString('es-ES')}
        </div>
    `;

    // Sección de anexos
    if (datos.ANEXOS && Array.isArray(datos.ANEXOS) && datos.ANEXOS.length > 0) {
        const mostrarAnexosCompletos = !isModoCliente || (isModoCliente && clienteData.tipoEmpresa && clienteData.tipoEmpresa.includes("Principal"));
        if (mostrarAnexosCompletos) {
            const anexosFiltrados = datos.ANEXOS.filter(anexo => anexo.TIPO === "PENDIENTES" || anexo.TIPO === "PROMO");
            const otrosAnexos = datos.ANEXOS.filter(anexo => anexo.TIPO !== "PENDIENTES" && anexo.TIPO !== "PROMO");

            if (anexosFiltrados.length > 0) {
                let totalAnexos = 0;
                html += `
                <div class="section">
                    <div class="section-title">ANEXOS (${anexosFiltrados.length})</div>
                    <table>
                        <thead><tr><th>Referencia</th><th>Talla</th><th>Color</th><th>Tipo</th><th>Cantidad</th></tr></thead>
                        <tbody>`;
                anexosFiltrados.forEach(anexo => {
                    totalAnexos += parseInt(anexo.CANTIDAD) || 0;
                    html += `<tr><td>${anexo.DOCUMENTO || '-'}</td><td>${anexo.TALLA || '-'}</td><td>${anexo.COLOR || '-'}</td><td>${anexo.TIPO || '-'}</td><td>${anexo.CANTIDAD || '0'}</td></tr>`;
                });
                html += `<tr class="total"><td colspan="3">TOTAL ANEXOS</td><td>${anexosFiltrados.length}</td><td>${totalAnexos}</td></tr></tbody></table></div>`;
            }

            if (otrosAnexos.length > 0) {
                html += `
                <div style="padding: 10px; background-color: #fff; border-radius: 4px; border-left: 4px solid #3498db; margin-top: 10px;">
                    <p style="margin: 0; text-transform: uppercase;"><strong>OBSERVACIONES:</strong> `;
                const textosAnexos = otrosAnexos.map(anexo => {
                    const cant = parseInt(anexo.CANTIDAD) || 1;
                    return `<strong>${cant}</strong> ${anexo.TIPO || ''} ${anexo.TALLA || ''} ${anexo.COLOR || ''}`;
                });
                html += textosAnexos.join('; ') + `.</p></div>`;
            }
        }
    }

    // Sección de distribución
    if (datos.DISTRIBUCION && datos.DISTRIBUCION.Clientes) {
        if (isModoCliente) {
            if (clienteData.distribucion) {
                let total = clienteData.distribucion.reduce((t, i) => t + (parseInt(i.cantidad) || 0), 0);
                html += `<div class="section"><div class="section-title">DISTRIBUCIÓN (${total}) ${clienteNombre}</div><table>
                    <thead><tr><th>Código</th><th>Color</th><th>Talla</th><th>Cantidad</th></tr></thead><tbody>`;
                clienteData.distribucion.forEach(item => {
                    html += `<tr><td>${item.codigo}</td><td>${item.color}</td><td>${item.talla}</td><td>${item.cantidad}</td></tr>`;
                });
                html += `<tr class="total"><td colspan="3">TOTAL</td><td>${total}</td></tr></tbody></table></div>`;
            }
        } else {
            let clis = Object.keys(datos.DISTRIBUCION.Clientes);
            let clisOrd = (isModoPrincipal && !soloImpresionPrincipal) ? clis.filter(c => (datos.DISTRIBUCION.Clientes[c].tipoEmpresa || "").includes("Principal")) : clis;
            let distMap = {};
            
            clisOrd.forEach(c => {
                datos.DISTRIBUCION.Clientes[c].distribucion.forEach(i => {
                    let k = `${i.codigo}-${i.talla}`;
                    if (!distMap[k]) distMap[k] = { codigo: i.codigo, color: i.color, talla: i.talla, total: 0 };
                    distMap[k].total += i.cantidad;
                    distMap[k][c] = (distMap[k][c] || 0) + i.cantidad;
                });
            });

            html += `<div class="section"><div class="section-title">DISTRIBUCIÓN GENERAL</div><table>
                <thead><tr><th>Código</th><th>Color</th><th>Talla</th><th>Total</th>`;
            clisOrd.forEach(c => html += `<th>${c}</th>`);
            html += `</tr></thead><tbody>`;
            
            let totalClis = {};
            Object.values(distMap).forEach(row => {
                html += `<tr><td>${row.codigo}</td><td>${row.color}</td><td>${row.talla}</td><td>${row.total}</td>`;
                clisOrd.forEach(c => {
                    html += `<td>${row[c] || 0}</td>`;
                    totalClis[c] = (totalClis[c] || 0) + (row[c] || 0);
                });
                html += `</tr>`;
            });
            
            html += `<tr class="total"><td colspan="3">TOTALES</td><td>${Object.values(totalClis).reduce((a,b)=>a+b,0)}</td>`;
            clisOrd.forEach(c => html += `<td>${totalClis[c]}</td>`);
            html += `</tr></tbody></table></div>`;
        }
    }

    html += `</div>`; // .print-unit
    return html;
}

// ============================================
// APERTURA DE VENTANAS (INDIVIDUAL Y LOTE)
// ============================================

function print_abrirPlantillaImpresion(datos, options = {}) {
    const ventana = window.open('', '_blank');
    const htmlContenido = print_generarHTMLParaDoc(datos, options);
    const titulo = options.modo === 'cliente' ? `REC${datos.REC} - ${options.clienteNombre}` : `REC${datos.REC}`;

    ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>${print_getEstilosGenerales()}</head><body>${htmlContenido}${print_getBotoneraImpresion()}</body></html>`);
    ventana.document.close();
}

/**
 * Imprime un lote de documentos de forma secuencial en una sola ventana.
 * Implementa lógica de Duplex (break-before: right) para asegurar que cada REC empiece en Side A.
 */
function print_imprimirLoteDocumentos(listaProcesada) {
    const ventana = window.open('', '_blank');
    const loteId = new Date().getTime();
    
    ventana.document.write(`
        <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Lote de Impresión #${loteId}</title>
        ${print_getEstilosGenerales()}
        <style>
            @media print {
                /* Lógica Crítica: Duplex */
                .lote-separator {
                    break-before: right !important;
                    page-break-before: right !important;
                }
            }
            .lote-header {
                background: var(--surface); padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 2px dashed var(--primary); text-align: center;
            }
        </style>
        </head>
        <body class="print-lote">
            <div class="lote-header no-print">
                <h3 style="margin: 0; color: var(--primary);">MODO LOTE (PRINTCONDUCTOR STYLE)</h3>
                <p>Se han cargado <strong>${listaProcesada.length}</strong> plantillas.</p>
                <p style="font-size: 13px; color: var(--text-secondary);">Cada documento comenzará en una nueva hoja física si usa impresión a doble cara.</p>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 15px;">
                    <button onclick="window.print()" style="padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">🚀 LANZAR IMPRESIÓN</button>
                    <button onclick="window.close()" style="padding: 12px 24px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer;">Cerrar Lote</button>
                </div>
            </div>
    `);

    listaProcesada.forEach((item) => {
        const docHtml = print_generarHTMLParaDoc(item.datos, { ...item.options, esLote: true });
        ventana.document.write(docHtml);
    });

    ventana.document.write(`</body></html>`);
    ventana.document.close();
}

// ============================================
// ESTILOS Y COMPONENTES REUTILIZABLES
// ============================================

function print_getEstilosGenerales() {
    return `
    <style>
        @page {
            size: letter;
            margin: 0.5cm;
        }

        /* Estilos Base de Tabla */
        tr:nth-child(even):not(:last-child) {
            background-color: #f8fafc;
        }
        tr:last-child {
            background-color: white !important;
        }

        @media print {
            tr:nth-child(even):not(:last-child) {
                background-color: #f8fafc !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            tr:last-child { background-color: white !important; }
            td, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            table { page-break-inside: auto !important; }
            thead { display: table-header-group !important; }
            tbody { display: table-row-group !important; }
            tr { page-break-inside: avoid !important; page-break-after: auto !important; }
            
            /* LOGICA DUPLEX CRITICA */
            .lote-separator {
                break-before: right !important; /* Fuerza inicio en página impar */
                page-break-before: right !important;
            }
            .print-unit {
                page-break-after: always;
            }
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            width: 7.5in;
            margin: 0 auto;
            padding: 10px;
            font-size: 10pt;
            line-height: 1.2;
            color: #333;
        }

        .print-unit {
            padding: 10px 0;
            position: relative;
        }

        .header-container {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            border-bottom: 2px solid #eee;
            padding-bottom: 5px;
        }

        .info-container { flex: 1; min-width: 0; }
        .codes-container { display: flex; flex-direction: column; align-items: flex-end; margin-left: 15px; }
        .qr-code { width: 110px; height: 110px; padding: 5px; background: white; }
        .barcode { display: block; max-height: 38px; width: auto; margin-top: 2px; }

        .title-section { text-align: center; margin-bottom: 8px; }
        .main-title { font-size: 11pt; margin: 2px 0; color: #666; }
        .provider-name { font-weight: bold; font-size: 15pt; margin: 2px 0; color: #2c3e50; text-transform: uppercase; }
        .subtitle { font-size: 10pt; margin: 2px 0; color: #7f8c8d; font-style: italic; }

        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin: 5px 0; font-size: 9pt; }
        .info-grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin: 5px 0; font-size: 9pt; }
        .info-item { display: flex; align-items: center; }
        .info-label { font-weight: 600; min-width: 65px; color: #34495e; }
        .info-value { flex: 1; padding-left: 5px; border-left: 1px solid #eee; }

        table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 8.5pt; }
        th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: 600; color: #2c3e50; }

        .section-title {
            font-weight: bold; font-size: 10pt; margin: 8px 0 4px 0; color: #2c3e50;
            padding: 4px 10px; background-color: #f8f9fa; border-left: 4px solid #3498db;
        }

        .total { font-weight: bold; background-color: #f8f9fa; }
        .code-display { font-weight: bold; text-align: center; margin-top: 2px; font-size: 9pt; }
        
        @media print {
            body { padding: 0; width: 100%; }
            .no-print { display: none !important; }
        }

        .footer { margin-top: 10px; font-size: 8pt; color: #777; text-align: right; }
    </style>`;
}

function print_getBotoneraImpresion() {
    return `<div class="no-print" style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: white; padding: 10px 30px; border-radius: 50px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); display: flex; gap: 15px; border: 1px solid #eee;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 20px; font-weight: bold; cursor: pointer;">Imprimir</button>
        <button onclick="window.close()" style="padding: 10px 20px; background: #95a5a6; color: white; border: none; border-radius: 20px; cursor: pointer;">Cerrar</button>
    </div>`;
}

// Función auxiliar para el orden de tallas (idéntica a la original para no romper nada)
function print_parseSize(size) {
    const sizeOrder = { "XXXS": 1, "XXS": 2, "XS": 3, "S": 4, "M": 5, "L": 6, "XL": 7, "XXL": 8, "XXXL": 9 };
    const match = size ? size.match(/^(\d+)?(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL)?$/) : [null, null, null];
    if (match && !match[1] && match[2]) return { numPart: null, rank: sizeOrder[match[2]] || 99, textPart: match[2] };
    if (match && match[1] && match[2]) {
        const num = parseInt(match[1]);
        const text = match[2];
        let rank = 99;
        if (text === "XS") rank = 4 - num; else if (text === "XL") rank = 6 + num; else rank = sizeOrder[text] || 99;
        return { numPart: num, rank, textPart: text };
    }
    if (match && match[1] && !match[2]) return { numPart: parseInt(match[1]), rank: parseInt(match[1]), textPart: "" };
    return { numPart: null, rank: 99, textPart: "" };
}
