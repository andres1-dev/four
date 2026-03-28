/**
 * print-templates.js
 * Lógica modular para la generación de plantillas de impresión
 * Refactorizado bajo el principio de Responsabilidad Única (SOLID)
 */

const PrintService = {
    getUrls(qrData) {
        return {
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrData)}`,
            barcodeUrl: `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(qrData)}&scale=2&includetext=false`
        };
    },

    getProveedorId(proveedorNombre) {
        if (!proveedorNombre) return '';
        if (proveedorNombre.includes("TEXTILES Y CREACIONES EL UNIVERSO")) return "900616124";
        if (proveedorNombre.includes("TEXTILES Y CREACIONES LOS ANGELES")) return "900692469";
        return '';
    },

    formatPVP(pvpStr) {
        if (!pvpStr) return '';
        const pvpNum = parseInt(pvpStr.replace('$', '').replace(/\./g, '').trim());
        if (pvpNum <= 39900) return `${pvpStr} Linea`;
        if (pvpNum >= 40000 && pvpNum <= 59900) return `${pvpStr} Moda`;
        if (pvpNum >= 60000) return `${pvpStr} Pronta`;
        return pvpStr;
    },

    parseSize(size) {
        const sizeOrder = { "XXXS": 1, "XXS": 2, "XS": 3, "S": 4, "M": 5, "L": 6, "XL": 7, "XXL": 8, "XXXL": 9 };
        const match = size ? size.match(/^(\d+)?(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL)?$/) : [null, null, null];

        if (match && !match[1] && match[2]) return { numPart: null, rank: sizeOrder[match[2]] || 99, textPart: match[2] };

        if (match && match[1] && match[2]) {
            const num = parseInt(match[1]);
            const text = match[2];
            let rank = text === "XS" ? 4 - num : (text === "XL" ? 6 + num : sizeOrder[text] || 99);
            return { numPart: num, rank, textPart: text };
        }

        if (match && match[1] && !match[2]) {
            const num = parseInt(match[1]);
            return { numPart: num, rank: num, textPart: "" };
        }

        return { numPart: null, rank: 99, textPart: "" };
    },

    sortSizes(a, b) {
        const sizeA = PrintService.parseSize(a.talla);
        const sizeB = PrintService.parseSize(b.talla);
        if (sizeA.rank !== sizeB.rank) return sizeA.rank - sizeB.rank;
        if (sizeA.numPart !== null && sizeB.numPart !== null && sizeA.numPart !== sizeB.numPart) return sizeA.numPart - sizeB.numPart;
        return a.color.localeCompare(b.color, "es", { sensitivity: "base" });
    }
};

const TemplateBuilder = {
    getCSS() {
        return `
            @page { size: letter; margin: 0.5cm; }
            tr:nth-child(even):not(:last-child) { background-color: #f8fafc; }
            tr:last-child { background-color: white !important; }
            @media screen { tr:hover { background-color: #e3f2fd; } }
            @media print {
                tr:nth-child(even):not(:last-child) { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                tr:last-child { background-color: white !important; }
                td, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                table { page-break-inside: auto !important; }
                thead { display: table-header-group !important; }
                tbody { display: table-row-group !important; }
                tr { page-break-inside: avoid !important; page-break-after: auto !important; }
                th { position: relative !important; top: auto !important; }
                body { padding: 0; }
                .no-print { display: none; }
                .header-container { border-bottom-color: #ccc; }
            }
            .info-grid .info-item:nth-child(1) .info-value, .info-grid .info-item:nth-child(2) .info-value, .info-grid .info-item:nth-child(3) .info-value { font-weight: bold; font-size: 11pt; }
            .info-grid .info-item:nth-child(4) .info-value, .info-grid .info-item:nth-child(5) .info-value { border-left: 4px solid #3498db; padding-left: 8px; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; width: 7.5in; margin: 0 auto; padding: 10px; font-size: 10pt; line-height: 1.4; color: #333; }
            .header-container { display: flex; justify-content: space-between; margin-bottom: 10px; page-break-after: avoid; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .info-container { flex: 1; min-width: 0; }
            .codes-container { display: flex; flex-direction: column; align-items: flex-end; margin-left: 15px; }
            .qr-container { text-align: center; margin-bottom: 10px; }
            .qr-code { width: 120px; height: 120px; padding: 5px; background: white; }
            .barcode { display: block; margin-top: 0px; max-height: 60px; height: auto; width: auto; }
            .title-section { text-align: center; margin-bottom: 10px; }
            .main-title { font-size: 12pt; margin: 5px 0; color: #555; font-weight: normal; }
            .provider-name { font-weight: bold; font-size: 16pt; margin: 5px 0; color: #2c3e50; text-transform: uppercase; }
            .subtitle { font-size: 11pt; margin: 5px 0; color: #7f8c8d; font-style: italic; }
            .info-grid, .info-grid2 { display: grid; gap: 8px; margin: 10px 0; font-size: 9pt; }
            .info-grid { grid-template-columns: repeat(3, 1fr); }
            .info-grid2 { grid-template-columns: repeat(2, 1fr); }
            .info-item { display: flex; align-items: center; }
            .info-label { font-weight: 600; min-width: 70px; color: #34495e; }
            .info-value { flex: 1; padding-left: 5px; border-left: 1px solid #eee; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9pt; page-break-inside: avoid; }
            th, td { border: 1px solid #ddd; padding: 5px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: 600; color: #2c3e50; position: sticky; top: 0; }
            .section-title { font-weight: bold; font-size: 11pt; margin: 10px 0 5px 0; color: #2c3e50; padding: 5px 10px; background-color: #f8f9fa; border-left: 4px solid #3498db; }
            .code-display { font-weight: bold; text-align: center; margin-top: 3px; }
            .footer { margin-top: 15px; font-size: 8pt; color: #777; text-align: right; }
            tr.total td { font-weight: bold !important; color: #2c3e50; }
        `;
    },

    buildHeader(datos, ctx) {
        let tipoStr = datos.TIPO || '';
        if (ctx.isModoCliente) {
            tipoStr = ctx.clienteData.tipoCliente === "Empresa"
                ? `${ctx.clienteData.tipoCliente} ${ctx.clienteData.tipoEmpresa?.replace(/^Empresa\s*/, '') || ''} ${ctx.clienteData.porcentaje || ''}`
                : `${ctx.clienteData.tipoCliente || ''} ${ctx.clienteData.porcentaje || ''}`;
        }

        return `
            <div class="header-container">
                <div class="info-container">
                    <div class="title-section">
                        <div class="main-title">Separación de terceros para:</div>
                        <div class="provider-name">${ctx.isModoCliente ? ctx.clienteData.razonSocial || ctx.clienteNombre : datos.PROVEEDOR || 'Proveedor no especificado'}</div>
                        <div class="subtitle">${datos.DESCRIPCION || 'Sin descripción'}</div>
                    </div>
                    <div class="info-grid">
                        <div class="info-item"><div class="info-label">Referencia:</div><div class="info-value">${datos.REFERENCIA || ''}</div></div>
                        <div class="info-item"><div class="info-label">RefProv:</div><div class="info-value">${datos.REFPROV || ''}</div></div>
                        <div class="info-item"><div class="info-label">Lote:</div><div class="info-value">${datos.LOTE || ''}</div></div>
                        <div class="info-item"><div class="info-label">Género:</div><div class="info-value">${datos.GENERO || ''}</div></div>
                        <div class="info-item"><div class="info-label">PVP:</div><div class="info-value">${PrintService.formatPVP(datos.PVP)}</div></div>
                        <div class="info-item"><div class="info-label">Tipo:</div><div class="info-value">${tipoStr}</div></div>
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
                        <img src="${ctx.urls.qrCodeUrl}" class="qr-code" alt="Código QR">
                        <div class="code-display">${ctx.qrData}</div>
                    </div>
                    <div class="barcode-container" style="text-align: center; width: 100%;">
                        <img src="${ctx.urls.barcodeUrl}" class="barcode" alt="Código de barras" style="height: 40px; width: 130px; margin: 0 auto; display: block;">
                    </div>
                </div>
            </div>`;
    },

    buildAnexos(datos, ctx) {
        if (!datos.ANEXOS || !Array.isArray(datos.ANEXOS) || datos.ANEXOS.length === 0) return '';

        const mostrarAnexosCompletos = !ctx.isModoCliente || (ctx.isModoCliente && ctx.clienteData.tipoEmpresa && ctx.clienteData.tipoEmpresa.includes("Principal"));
        if (!mostrarAnexosCompletos) return '';

        const anexosFiltrados = datos.ANEXOS.filter(anexo => anexo.TIPO === "PENDIENTES" || anexo.TIPO === "PROMO");
        const otrosAnexos = datos.ANEXOS.filter(anexo => anexo.TIPO !== "PENDIENTES" && anexo.TIPO !== "PROMO");

        let html = '';
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
            const textosAnexos = otrosAnexos.map(anexo => {
                const cantidad = parseInt(anexo.CANTIDAD) || 1;
                return `<strong>${cantidad}</strong> UNIDAD${cantidad > 1 ? 'ES' : ''}` +
                    (anexo.TIPO ? `, ${anexo.TIPO.toUpperCase()}` : '') +
                    (anexo.TALLA ? `, TALLA ${anexo.TALLA.toUpperCase()}` : '') +
                    (anexo.COLOR ? `, COLOR ${anexo.COLOR.toUpperCase()}` : '');
            }).join('; ');

            html += `<div style="padding: 8px 15px 15px 15px; background-color: #ffffff; border-radius: 4px; border-left: 4px solid #3498db; text-align: left;">
                        <p style="margin: 0; line-height: 1.3; text-transform: uppercase;"><strong>OBSERVACIONES:</strong> ${textosAnexos}.</p>
                     </div>`;
        }
        return html;
    },

    buildDistribucionCliente(ctx) {
        if (!ctx.clienteData.distribucion) return '';
        const total = ctx.clienteData.distribucion.reduce((sum, item) => sum + (parseInt(item.cantidad) || 0), 0);
        const filtrado = [...ctx.clienteData.distribucion].sort(PrintService.sortSizes);

        let html = `
            <div class="section">
                <div class="section-title">DISTRIBUCIÓN (${total}) ${ctx.clienteNombre}</div>
                <table>
                    <thead><tr><th>Código</th><th>Color</th><th>Talla</th><th>Cantidad</th></tr></thead>
                    <tbody>`;
        filtrado.forEach(item => {
            html += `<tr><td>${item.codigo}</td><td>${item.color}</td><td>${item.talla}</td><td>${item.cantidad}</td></tr>`;
        });
        html += `<tr class="total"><td colspan="3">TOTAL</td><td>${total}</td></tr></tbody></table></div>`;
        return html;
    },

    buildDistribucionGeneral(datos, ctx) {
        let clientes = Object.keys(datos.DISTRIBUCION.Clientes);
        let principales = [], secundarias = [], mayoristas = [];
        let porcentajes = {};

        clientes.forEach(c => {
            porcentajes[c] = datos.DISTRIBUCION.Clientes[c].porcentaje || '';
            let tipo = datos.DISTRIBUCION.Clientes[c].tipoEmpresa || "";
            if (tipo.includes("Principal")) principales.push(c);
            else if (tipo.includes("Secundaria")) secundarias.push(c);
            else mayoristas.push(c);
        });

        const clientesOrdenados = (ctx.isModoPrincipal && !ctx.soloImpresionPrincipal) ? principales : [...principales, ...secundarias, ...mayoristas];
        let distribucionFinal = {};

        clientesOrdenados.forEach(cliente => {
            datos.DISTRIBUCION.Clientes[cliente].distribucion.forEach(({ codigo, color, talla, cantidad }) => {
                let key = `${codigo}-${talla}`;
                if (!distribucionFinal[key]) {
                    distribucionFinal[key] = { codigo, color, talla, cantidadTotal: 0 };
                    clientesOrdenados.forEach(c => distribucionFinal[key][c] = 0);
                }
                distribucionFinal[key].cantidadTotal += cantidad;
                distribucionFinal[key][cliente] += cantidad;
            });
        });

        const todasLasFilas = Object.values(distribucionFinal).sort(PrintService.sortSizes);

        let html = `
            <div class="section">
                <div class="section-title">DISTRIBUCIÓN (${clientesOrdenados.length})</div>
                <table>
                    <thead><tr><th>Código</th><th>Color</th><th>Talla</th><th>Total</th>`;
        clientesOrdenados.forEach(c => html += `<th>${c}${porcentajes[c] ? '<br>' + porcentajes[c] : ''}</th>`);
        html += `</tr></thead><tbody>`;

        let totalPorCliente = {};
        todasLasFilas.forEach(row => {
            html += `<tr><td>${row.codigo}</td><td>${row.color}</td><td>${row.talla}</td><td>${row.cantidadTotal}</td>`;
            clientesOrdenados.forEach(c => {
                html += `<td>${row[c]}</td>`;
                totalPorCliente[c] = (totalPorCliente[c] || 0) + row[c];
            });
            html += `</tr>`;
        });

        const totalGeneral = Object.values(totalPorCliente).reduce((sum, val) => sum + val, 0);
        html += `<tr class="total"><td colspan="3">TOTALES</td><td>${totalGeneral}</td>`;
        clientesOrdenados.forEach(c => html += `<td>${totalPorCliente[c]}</td>`);
        html += `</tr></tbody></table></div>`;
        return html;
    },

    buildFooterInfo(datos, ctx) {
        let qtyString = '';
        if (ctx.isModoCliente) {
            const qty = ctx.clienteData.distribucion ? ctx.clienteData.distribucion.reduce((acc, item) => acc + (parseInt(item.cantidad) || 0), 0) : 0;
            qtyString = `Cantidad: <span class="info-value"><strong>${qty}</strong></span> &nbsp;|&nbsp; Responsable: <span class="info-value">${datos.COLABORADOR || ''}</span> &nbsp;|&nbsp; `;
        }

        const timestamp = new Date().toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

        return `<div class="footer" style="margin-top: 5px; margin-bottom: 15px; border-bottom: 1px dashed #eee; padding-bottom: 10px;text-align: right;">${qtyString} Impreso: ${timestamp}</div>`;
    },

    buildActionButtons() {
        return `<div class="no-print" style="text-align: center; margin-top: 15px;">
                <button onclick="window.print()" style="padding: 8px 15px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">Imprimir</button>
                <button onclick="downloadHTML()" style="padding: 8px 15px; margin-left: 10px; background: #2ecc71; color: white; border: none; border-radius: 4px; cursor: pointer;">Descargar</button>
                <button onclick="window.close()" style="padding: 8px 15px; margin-left: 10px; background: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer;">Cerrar</button>
            </div>
            <script>
                function downloadHTML() {
                    const docClone = document.documentElement.cloneNode(true);
                    const noPrintDiv = docClone.querySelector('.no-print');
                    if (noPrintDiv) noPrintDiv.remove();
                    docClone.querySelectorAll('script').forEach(s => s.remove());
                    const url = URL.createObjectURL(new Blob(["<!DOCTYPE html>" + docClone.outerHTML], {type: 'text/html'}));
                    const a = document.createElement('a');
                    a.href = url; a.download = document.title + '.html'; a.click();
                    URL.revokeObjectURL(url);
                }
            </script>`;
    }
};

function abrirPlantillaImpresion(datos, options = {}) {
    const { modo = 'completo', clienteNombre = null, soloPrincipal = false, soloImpresionPrincipal = false } = options;
    const ctx = {
        isModoCliente: modo === 'cliente',
        isModoPrincipal: modo === 'principal' || soloPrincipal,
        clienteNombre,
        soloImpresionPrincipal,
        clienteData: modo === 'cliente' ? datos.DISTRIBUCION.Clientes[clienteNombre] : null
    };

    const recForCode = String(datos.REC || '').split('.')[0];
    const proveedorId = !ctx.isModoCliente ? PrintService.getProveedorId(datos.PROVEEDOR) : '';

    ctx.qrData = ctx.isModoCliente ? `REC${recForCode}-${ctx.clienteData.id || ''}` : (proveedorId ? `REC${recForCode}-${proveedorId}` : `REC${recForCode}`);
    ctx.urls = PrintService.getUrls(ctx.qrData);

    const titulo = ctx.isModoCliente ? `Separación REC${datos.REC} - ${clienteNombre}` : `Separación REC${datos.REC}`;
    const ventana = window.open('', '_blank');

    ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title><style>${TemplateBuilder.getCSS()}</style></head><body>`);
    ventana.document.write(TemplateBuilder.buildHeader(datos, ctx));
    ventana.document.write(TemplateBuilder.buildFooterInfo(datos, ctx));
    ventana.document.write(TemplateBuilder.buildAnexos(datos, ctx));

    if (datos.DISTRIBUCION && datos.DISTRIBUCION.Clientes) {
        ventana.document.write(ctx.isModoCliente ? TemplateBuilder.buildDistribucionCliente(ctx) : TemplateBuilder.buildDistribucionGeneral(datos, ctx));
    }

    ventana.document.write(TemplateBuilder.buildActionButtons());
    ventana.document.write(`</body></html>`);
    ventana.document.close();
}
