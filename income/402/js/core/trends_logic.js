/**
 * Trend Analysis Logic
 */

function analizarTendenciaDiaria(año, mes) {
    if (!consolidatedData || consolidatedData.length === 0) return null;

    const targetMes = String(mes || '').toUpperCase();
    const datosMensuales = consolidatedData.filter(d =>
        d.Año === año && String(d.Mes || '').toUpperCase() === targetMes
    );

    if (datosMensuales.length === 0) {
        // Fallback: usar los últimos registros disponibles en consolidatedData
        const ultimosDatos = consolidatedData.slice(-31);
        if (ultimosDatos.length > 0) {
            ultimosDatos.sort((a, b) => parseDate(a.Fecha) - parseDate(b.Fecha));
            return {
                datosDiarios: ultimosDatos,
                tendencia: calcularTendenciaLineal(ultimosDatos),
                promedioMovil: calcularPromedioMovil(ultimosDatos, 7),
                patronesSemanales: analizarPatronesSemanales(ultimosDatos),
                proyeccion: calcularProyeccionDiaria(ultimosDatos)
            };
        }
        return null;
    }

    datosMensuales.sort((a, b) => parseDate(a.Fecha) - parseDate(b.Fecha));

    return {
        datosDiarios: datosMensuales,
        tendencia: calcularTendenciaLineal(datosMensuales),
        promedioMovil: calcularPromedioMovil(datosMensuales, 7),
        patronesSemanales: analizarPatronesSemanales(datosMensuales),
        proyeccion: calcularProyeccionDiaria(datosMensuales)
    };
}

function calcularTendenciaLineal(datos) {
    if (!datos || datos.length < 2) return null;
    const n = datos.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    datos.forEach((d, i) => {
        sumX += i;
        sumY += d.Ingreso;
        sumXY += i * d.Ingreso;
        sumXX += i * i;
    });
    const pendiente = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercepto = (sumY - pendiente * sumX) / n;
    return datos.map((d, i) => Math.round(intercepto + pendiente * i));
}

function calcularPromedioMovil(datos, ventana = 7) {
    if (!datos || datos.length < ventana) return null;
    const promedios = [];
    for (let i = 0; i < datos.length; i++) {
        if (i < ventana - 1) {
            promedios.push(null);
        } else {
            const ventanaDatos = datos.slice(i - ventana + 1, i + 1);
            const suma = ventanaDatos.reduce((total, d) => total + d.Ingreso, 0);
            promedios.push(Math.round(suma / ventana));
        }
    }
    return promedios;
}

function analizarPatronesSemanales(datos) {
    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const patrones = {};
    diasSemana.forEach(dia => {
        patrones[dia] = { total: 0, count: 0, promedio: 0 };
    });
    datos.forEach(d => {
        const dia = d.Dia.toLowerCase();
        if (patrones[dia]) {
            patrones[dia].total += d.Ingreso;
            patrones[dia].count++;
        }
    });
    Object.keys(patrones).forEach(dia => {
        if (patrones[dia].count > 0) {
            patrones[dia].promedio = Math.round(patrones[dia].total / patrones[dia].count);
        }
    });
    return patrones;
}

function calcularProyeccionDiaria(datos) {
    if (!datos || datos.length < 5) return null;

    const ultimaFecha = parseDate(datos[datos.length - 1].Fecha);
    const año = ultimaFecha.getFullYear();
    const mes = ultimaFecha.getMonth();

    // ── Días hábiles reales transcurridos ────────────────────────────────────
    const diasHabilesTranscurridos = datos.length;

    // ── Días hábiles restantes en el mes ────────────────────────────────────
    // Días no-hábiles (sáb/dom) que ya se trabajaron
    const diasNoHabilesLaborados = datos.filter(d => {
        const dDate = parseDate(d.Fecha);
        if (!dDate) return false;
        const dow = dDate.getDay();
        return dow === 0 || dow === 6;
    }).length;

    // Días lun-vie realmente trabajados
    const diasLunVieTranscurridos = diasHabilesTranscurridos - diasNoHabilesLaborados;

    // Budget como fuente de verdad (festivos ya descontados)
    const nombreMes = getNombreMes(datos[datos.length - 1].Fecha);
    const budgetMes = budgetData.find(b =>
        b.MES.toUpperCase() === nombreMes.toUpperCase() && b.ANO === String(año)
    );

    let habilesOficiales;
    if (budgetMes && budgetMes.HABILES > 0) {
        habilesOficiales = budgetMes.HABILES;
    } else {
        // Fallback: contar lun-vie del mes completo
        const diasEnMes = new Date(año, mes + 1, 0).getDate();
        habilesOficiales = 0;
        for (let d = 1; d <= diasEnMes; d++) {
            const dow = new Date(año, mes, d).getDay();
            if (dow !== 0 && dow !== 6) habilesOficiales++;
        }
    }

    // Restantes = hábiles oficiales que aún no se han trabajado
    const habilesRestantesOficiales = Math.max(0, habilesOficiales - diasLunVieTranscurridos);

    // Total = hábiles oficiales + días no-hábiles ya trabajados
    const diasHabilesTotales = habilesOficiales + diasNoHabilesLaborados;
    const diasHabilesRestantes = habilesRestantesOficiales;

    if (diasHabilesRestantes <= 0) return null;

    const ingresosAcumulados = datos.reduce((sum, d) => sum + d.Ingreso, 0);
    const promedioSimple = Math.round(ingresosAcumulados / diasHabilesTranscurridos);

    // Regresión lineal sobre días con datos
    const tendencia = calcularTendenciaLineal(datos);
    const ultimaTendencia = tendencia[tendencia.length - 1];
    const proyeccionTendencia = Math.round(ultimaTendencia * diasHabilesTotales);

    // Promedio móvil últimos 7 días hábiles
    const ultimos7 = datos.slice(-7);
    const promedioMovil = Math.round(ultimos7.reduce((sum, d) => sum + d.Ingreso, 0) / ultimos7.length);
    const proyeccionMovil = Math.round(promedioMovil * diasHabilesTotales);

    return {
        diasTranscurridos: diasHabilesTranscurridos,
        diasRestantes: diasHabilesRestantes,
        diasHabilesTotales,
        ingresosAcumulados,
        promedioSimple,
        proyeccionConservadora: Math.round((proyeccionTendencia + proyeccionMovil) / 2),
        proyeccionTendencia,
        proyeccionMovil
    };
}

async function getTrendsData(currentYear, previousYear, data) {
    const actualCurrentYear = new Date().getFullYear();
    const minHistoricalYear = 2024; // Solo trabajamos con 2024 hacia adelante

    let currentYearData = data.filter(d => d.Año === currentYear);
    let previousYearData = data.filter(d => d.Año === previousYear);

    // Si el año anterior no es el actual y es >= 2024, intentar cargar datos históricos del JSON
    if (previousYear !== actualCurrentYear && previousYear >= minHistoricalYear) {
        try {
            const { loadHistoricalYearAsConsolidated } = await import('./utils/historical_adapter.js');
            const historicalData = await loadHistoricalYearAsConsolidated(previousYear);
            if (historicalData.length > 0) {
                previousYearData = historicalData;
                console.log(`Usando datos históricos del JSON para tendencias del año ${previousYear}`);
            }
        } catch (error) {
            console.warn(`No se pudieron cargar datos históricos para tendencias de ${previousYear}:`, error);
        }
    }

    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    return {
        meses,
        actual: meses.reduce((acc, mes) => {
            acc[mes] = currentYearData.filter(d => d.Mes === mes).reduce((sum, d) => sum + d.Ingreso, 0);
            return acc;
        }, {}),
        anterior: meses.reduce((acc, mes) => {
            acc[mes] = previousYearData.filter(d => d.Mes === mes).reduce((sum, d) => sum + d.Ingreso, 0);
            return acc;
        }, {})
    };
}
