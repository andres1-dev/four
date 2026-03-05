/**
 * main.js
 * Lógica principal para la carga y procesamiento de datos.
 * Refactorizado aplicando responsabilidades únicas y abstracción.
 */

const CONFIG = {
    SPREADSHEET_IDS: {
        main: "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI",
        rec: "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc",
        clientes: "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE"
    },
    API_KEY: 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM'
};

let datosGlobales = [];

// ==== SERVICIOS DE API ====
const ApiService = {
    async fetchSheetData(spreadsheetId, range) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${CONFIG.API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status} al obtener ${range}`);
        const data = await response.json();
        return data.values || [];
    }
};

// ==== UTILIDADES DE NORMALIZACIÓN ====
const Utils = {
    normalizeDocumento: (doc) => doc.replace(/^REC/i, '').trim(),
    normalizeLinea: (linea) => linea.replace(/^LINEA\s*/i, '').replace(/\s+/g, '').toUpperCase(),
    normalizePVP: (pvp) => pvp.replace(/\$\s*/g, '').replace(/\./g, '').trim(),
    normalizeDate: (dateStr) => {
        if (!dateStr || !dateStr.includes('/')) return null;
        const [dd, mm, yyyy] = dateStr.split('/');
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    },
    getClaseByPVP(pvp) {
        const valor = parseFloat(pvp);
        if (isNaN(valor)) return 'NO DEFINIDO';
        if (valor <= 39900) return 'LINEA';
        if (valor <= 59900) return 'MODA';
        return 'PRONTAMODA';
    },
    getGestorByLinea(linea) {
        const normalized = Utils.normalizeLinea(linea);
        const gestores = {
            'ANGELES': 'VILLAMIZAR GOMEZ LUIS',
            'MODAFRESCA': 'FABIAN MARIN FLOREZ',
            'BASICO': 'CESAR AUGUSTO LOPEZ GIRALDO',
            'INTIMA': 'KELLY GIOVANA ZULUAGA HOYOS',
            'URBANO': 'MARYI ANDREA GONZALEZ SILVA',
            'DEPORTIVO': 'JOHAN STEPHANIE ESPÍNOSA RAMIREZ',
            'PRONTAMODA': 'SANCHEZ LOPEZ YULIETH',
            'ESPECIALES': 'JUAN ESTEBAN ZULUAGA HOYOS',
            'BOGOTA': 'JUAN ESTEBAN ZULUAGA HOYOS'
        };
        const entry = Object.entries(gestores).find(([key]) => normalized.includes(key));
        return entry ? entry[1] : 'GESTOR NO ASIGNADO';
    },
    getProveedorByLinea: (linea) => Utils.normalizeLinea(linea).includes('ANGELES') 
        ? 'TEXTILES Y CREACIONES LOS ANGELES SAS' 
        : 'TEXTILES Y CREACIONES EL UNIVERSO SAS',
    
    parseHRStringOptimized(hrString) {
        if (!hrString) return [];
        return hrString.split('☬').reduce((result, entry) => {
            const parts = entry.split('∞');
            if (parts.length === 4) {
                const cantidad = Number(parts[3]);
                if (!isNaN(cantidad)) {
                    result.push([parts[0].trim(), parts[1].trim(), parts[2].trim(), cantidad]);
                }
            }
            return result;
        }, []);
    },

    isAnuladoOptimized(item) {
        const camposRequeridos = [
            'TALLER', 'LINEA', 'AUDITOR', 'ESCANER', 'LOTE',
            'REFPROV', 'DESCRIPCIÓN', 'CANTIDAD', 'REFERENCIA',
            'TIPO', 'PVP', 'PRENDA', 'GENERO'
        ];
        let vacios = 0;
        for (const campo of camposRequeridos) {
            const val = item[campo];
            if (!val || (typeof val === 'string' && val.trim() === '') || (typeof val === 'number' && val === 0)) {
                if (++vacios > 4) return true;
            }
        }
        return false;
    }
};

// ==== PROCESADORES DE DATOS ====
const DataProcessor = {
    async getAllSpreadsheetData() {
        const [data2Values, recValues, clientesValues, dataValues] = await Promise.all([
            ApiService.fetchSheetData(CONFIG.SPREADSHEET_IDS.main, "DATA2!S2:S"),
            ApiService.fetchSheetData(CONFIG.SPREADSHEET_IDS.rec, "DataBase!A2:AG"),
            ApiService.fetchSheetData(CONFIG.SPREADSHEET_IDS.clientes, "CLIENTES!A2:I"),
            ApiService.fetchSheetData(CONFIG.SPREADSHEET_IDS.clientes, "DATA!A2:K")
        ]);
        window.datosTablaDocumentos = dataValues;
        return { data2Values, recValues, clientesValues, dataValues };
    },

    processDistribucionAndColaboradorData(values) {
        const result = { clienteDistribucionMap: {}, colaboradorMap: {} };
        for (const row of values) {
            const documento = String(row[0] || '').trim();
            if (!documento) continue;
            
            if (row[4]) result.colaboradorMap[documento] = row[4];
            if (row[2]) {
                try {
                    const parsed = JSON.parse(row[2]);
                    if (parsed.Clientes) result.clienteDistribucionMap[documento] = parsed.Clientes;
                } catch (e) {
                    console.error("Error parseando JSON de distribución para doc:", documento);
                }
            }
        }
        return result;
    },

    processClientesData(values) {
        const clientesMap = {};
        for (const row of values) {
            const id = String(row[0] || '').trim();
            if (id) {
                clientesMap[id] = {
                    id, razonSocial: row[1] || '', nombreCorto: row[2] || '',
                    tipoCliente: row[3] || '', estado: row[4] || '', direccion: row[5] || '',
                    telefono: row[6] || '', email: row[7] || '', tipoEmpresa: row[8] || ''
                };
            }
        }
        return clientesMap;
    },

    processMainDataOptimized(values) {
        return values.map(row => {
            try {
                const json = JSON.parse(row[0]);
                const rawPVP = Utils.normalizePVP(json.PVP || '');
                return {
                    DOCUMENTO: String(json.A || ''),
                    FECHA: Utils.normalizeDate(json.FECHA || ''),
                    TALLER: json.TALLER || '',
                    LINEA: Utils.normalizeLinea(json.LINEA || ''),
                    AUDITOR: json.AUDITOR || '',
                    ESCANER: json.ESCANER || '',
                    LOTE: Number(json.LOTE) || 0,
                    REFPROV: String(json.REFPROV || ''),
                    DESCRIPCIÓN: json.DESCRIPCIÓN_LARGA || '',
                    CANTIDAD: Number(json.CANTIDAD) || 0,
                    REFERENCIA: json.REFERENCIA || '',
                    TIPO: json.TIPO || '',
                    PVP: rawPVP,
                    PRENDA: json.PRENDA || '',
                    GENERO: json.GENERO || '',
                    GESTOR: json.GESTOR || '',
                    PROVEEDOR: json.PROVEEDOR || Utils.getProveedorByLinea(json.LINEA || ''),
                    CLASE: Utils.getClaseByPVP(rawPVP),
                    HR: json.HR,
                    ANEXOS: json.ANEXOS,
                    REC: json.A
                };
            } catch (e) {
                return null;
            }
        }).filter(Boolean);
    },

    processRecDataOptimized(values) {
        return values.map(row => {
            if (!row[0] && !row[1]) return null;
            const linea = row[3] || '';
            const rawPVP = Utils.normalizePVP(row[31] || '');
            return {
                DOCUMENTO: Utils.normalizeDocumento(String(row[0] || '')),
                FECHA: Utils.normalizeDate(row[1] || ''),
                TALLER: row[2] || '',
                LINEA: Utils.normalizeLinea(linea),
                AUDITOR: row[4] || '',
                ESCANER: row[5] || '',
                LOTE: Number(row[8]) || 0,
                REFPROV: String(row[6] || ''),
                DESCRIPCIÓN: row[9] || '',
                CANTIDAD: Number(row[18]) || 0,
                REFERENCIA: row[26] || '',
                TIPO: row[27] || '',
                PVP: rawPVP,
                PRENDA: row[29] || '',
                GENERO: row[30] || '',
                GESTOR: Utils.getGestorByLinea(linea),
                PROVEEDOR: Utils.getProveedorByLinea(linea),
                CLASE: Utils.getClaseByPVP(rawPVP),
                FUENTE: "BUSINT",
                HR: Utils.parseHRStringOptimized(row[32] || ''),
                REC: Number(Utils.normalizeDocumento(String(row[0] || ''))) || 0
            };
        }).filter(item => item !== null && item.DOCUMENTO !== '');
    },

    enrichSingleClient(clienteData, clientesDataMap) {
        const clienteId = clienteData.id;
        if (clientesDataMap[clienteId]) {
            return { ...clientesDataMap[clienteId], distribucion: clienteData.distribucion || [] };
        }
        return {
            id: clienteId,
            nombre: clienteData.nombre || '',
            razonSocial: clienteData.nombre || '',
            distribucion: clienteData.distribucion || []
        };
    },

    enrichClientesData(clientesDistribucion, clientesData) {
        const enriched = {};
        for (const [nombre, data] of Object.entries(clientesDistribucion)) {
            if (clientesData[data.id]) {
                enriched[nombre] = { ...clientesData[data.id], distribucion: data.distribucion || [] };
                if (data.porcentaje) enriched[nombre].porcentaje = data.porcentaje;
            } else {
                enriched[nombre] = { id: data.id, nombre, razonSocial: data.nombre || nombre, distribucion: data.distribucion || [], ...data };
            }
        }
        return enriched;
    },

    enrichItem(item, clienteDistribucionMap, clientesDataMap, colaboradorMap, fuente) {
        const docKey = String(item.DOCUMENTO).trim();
        if (clienteDistribucionMap[docKey]) item.CLIENTES = this.enrichClientesData(clienteDistribucionMap[docKey], clientesDataMap);
        if (colaboradorMap[docKey]) item.COLABORADOR = colaboradorMap[docKey];
        
        item.FUENTE = fuente;
        item.GESTOR = item.GESTOR || Utils.getGestorByLinea(item.LINEA);
        item.PROVEEDOR = item.PROVEEDOR || Utils.getProveedorByLinea(item.LINEA);
        return item;
    },

    processBusintData(busintData, clienteDistribucionMap, clientesDataMap, colaboradorMap) {
        const busintMap = new Map();
        const busintFinal = [];
        const clientesEspeciales = {
            "ESTEBAN": { nombre: "Esteban", nit: "1007348825" },
            "JESUS": { nombre: "Jesús", nit: "70825517" },
            "ALEX": { nombre: "Alex", nit: "14838951" },
            "RUBEN": { nombre: "Ruben", nit: "901920844" }
        };

        for (const item of busintData) {
            const lote = item.LOTE;
            if (!busintMap.has(lote)) busintMap.set(lote, []);
            busintMap.get(lote).push(item);
        }

        for (const registros of busintMap.values()) {
            const fulls = registros.filter(r => r.TIPO === 'FULL');
            const anexos = registros.filter(r => r.TIPO !== 'FULL');

            for (const full of fulls) {
                const docKey = String(full.DOCUMENTO).trim();
                const principal = { ...full, FUENTE: "BUSINT", GESTOR: Utils.getGestorByLinea(full.LINEA), PROVEEDOR: Utils.getProveedorByLinea(full.LINEA) };
                if (colaboradorMap[docKey]) principal.COLABORADOR = colaboradorMap[docKey];

                let totalCantidad = principal.HR ? principal.HR.reduce((sum, item) => sum + (item[3] || 0), 0) : 0;
                const pendientesMap = new Map();
                const clientesEspecialesData = {};
                const anexosNormales = [];

                for (const anexo of anexos) {
                    const tipoAnexo = (anexo.TIPO || '').toUpperCase();

                    if (clientesEspeciales[tipoAnexo]) {
                        if (Array.isArray(anexo.HR) && anexo.HR.length > 0) {
                            const distribucion = anexo.HR.map(([codigo, color, talla, cantidad]) => {
                                const cant = Number(cantidad) || 0;
                                totalCantidad += cant;
                                return { codigo: String(codigo||'').trim(), color: String(color||'').trim(), talla: String(talla||'').trim(), cantidad: cant };
                            });
                            clientesEspecialesData[tipoAnexo] = this.enrichSingleClient({
                                id: clientesEspeciales[tipoAnexo].nit,
                                nombre: clientesEspeciales[tipoAnexo].nombre,
                                distribucion
                            }, clientesDataMap);
                        }
                        continue;
                    }

                    if (tipoAnexo === 'PENDIENTES') {
                        if (Array.isArray(anexo.HR)) {
                            for (const [codigo, color, talla, cantidad] of anexo.HR) {
                                const key = `${codigo}-${color}-${talla}`;
                                pendientesMap.set(key, (pendientesMap.get(key) || 0) + (Number(cantidad) || 0));
                            }
                        }
                        continue;
                    }

                    if (Array.isArray(anexo.HR) && anexo.HR.length > 0) {
                        anexosNormales.push(...anexo.HR.map(([codigo, color, talla, cantidad]) => {
                            const cant = Number(cantidad) || 0;
                            totalCantidad += cant;
                            return { DOCUMENTO: anexo.REFPROV || '', CODIGO: codigo, COLOR: color, TALLA: talla, TIPO: anexo.TIPO || '', CANTIDAD: cant, REC: Number(anexo.DOCUMENTO) || '' };
                        }));
                    }
                }

                if (Object.keys(clientesEspecialesData).length > 0) {
                    principal.CLIENTES = principal.CLIENTES || {};
                    for (const [nombre, data] of Object.entries(clientesEspecialesData)) {
                        principal.CLIENTES[nombre.charAt(0) + nombre.slice(1).toLowerCase()] = data;
                    }
                }

                if (pendientesMap.size > 0) {
                    const hrMap = new Map();
                    if (principal.HR) {
                        for (const [cod, col, tal, cant] of principal.HR) hrMap.set(`${cod}-${col}-${tal}`, { codigo: cod, color: col, talla: tal, cantidad: cant });
                    }
                    for (const [key, cantPend] of pendientesMap.entries()) {
                        const [cod, col, tal] = key.split('-');
                        if (hrMap.has(key)) hrMap.get(key).cantidad += cantPend;
                        else hrMap.set(key, { codigo: String(cod||'').trim(), color: String(col||'').trim(), talla: String(tal||'').trim(), cantidad: Number(cantPend) });
                        totalCantidad += cantPend;
                    }
                    principal.HR = Array.from(hrMap.values()).map(item => [item.codigo, item.color, item.talla, item.cantidad]);
                }

                principal.CANTIDAD = totalCantidad;
                if (anexosNormales.length > 0) principal.ANEXOS = anexosNormales;
                if (clienteDistribucionMap[docKey]) principal.CLIENTES = { ...principal.CLIENTES, ...this.enrichClientesData(clienteDistribucionMap[docKey], clientesDataMap) };
                
                busintFinal.push(principal);
            }
        }
        return busintFinal;
    }
};

// ==== FUNCIÓN PRINCIPAL ====
async function cargarDatos() {
    const loader = document.getElementById("loader");
    const resultado = document.getElementById("resultado");
    loader.style.display = "block";
    resultado.innerHTML = "<p>Cargando datos...</p>";

    try {
        const { data2Values, recValues, clientesValues, dataValues } = await DataProcessor.getAllSpreadsheetData();
        const { clienteDistribucionMap, colaboradorMap } = DataProcessor.processDistribucionAndColaboradorData(dataValues);
        const clientesDataMap = DataProcessor.processClientesData(clientesValues);

        const sisproData = DataProcessor.processMainDataOptimized(data2Values)
            .filter(item => !Utils.isAnuladoOptimized(item))
            .map(item => DataProcessor.enrichItem(item, clienteDistribucionMap, clientesDataMap, colaboradorMap, "SISPRO"));

        const busintData = DataProcessor.processRecDataOptimized(recValues)
            .filter(item => !Utils.isAnuladoOptimized(item));

        const busintFinal = DataProcessor.processBusintData(busintData, clienteDistribucionMap, clientesDataMap, colaboradorMap);

        const resultadoFinal = [...sisproData, ...busintFinal].map(item => ({
            ...item,
            REC: item.DOCUMENTO,
            COLABORADOR: item.COLABORADOR || '',
            DESCRIPCION: item.DESCRIPCIÓN,
            DISTRIBUCION: {
                Documento: item.DOCUMENTO,
                Clientes: item.CLIENTES || {},
                Colaborador: item.COLABORADOR || ''
            }
        }));

        datosGlobales = resultadoFinal;
        loader.style.display = "none";
        resultado.innerHTML = "<p>Datos cargados correctamente. Ingrese un documento para buscar.</p>";
        
        return resultadoFinal;
    } catch (error) {
        loader.style.display = "none";
        resultado.innerHTML = `<p>Error al cargar datos: ${error.message}</p>`;
        throw error;
    }
}

window.loaderPromise = cargarDatos();
