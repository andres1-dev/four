/**
 * Chart and Data Visualizations
 * Complete trend analysis logic matching backup.html
 */

// Función principal para cargar datos de tendencia DIARIA
function cargarDatosTendencia() {
    if (!currentReportData) return;

    const data = currentReportData.mes;
    const actual = data.actual;
    const anterior = data.anterior;

    // 1. Actualizar información básica
    safeSetText("tendencia-mes", `${actual.mes} ${actual.año}`);

    // 2. Realizar análisis diario
    const analisisDiario = analizarTendenciaDiaria(actual.año, actual.mes);

    if (!analisisDiario) {
        console.error("No se pudieron analizar los datos diarios");
        return;
    }

    // 3. Actualizar UI con análisis diario
    actualizarTendenciaUI(analisisDiario, actual, anterior);

    // 4. Generar gráfico con datos diarios
    generarGraficoTendenciaDiaria(analisisDiario, actual.año, actual.mes);

    // 5. Calcular estadísticas detalladas
    calcularEstadisticasTendenciaDiaria(analisisDiario, actual.año, actual.mes, actual);
}

// Actualizar la UI con los resultados del análisis diario
function actualizarTendenciaUI(analisisDiario, actual, anterior) {
    const { proyeccion, tendencia, promedioMovil, datosDiarios } = analisisDiario;

    // Proyección mensual
    if (proyeccion) {
        // Obtener el budget total del mes (no la meta acumulada)
        const budgetMes = budgetData.find(b => 
            b.MES.toUpperCase() === actual.mes && 
            b.ANO === String(actual.año)
        );
        const metaTotalMes = budgetMes ? budgetMes.TOTAL : actual.meta;

        const proyeccionEl = document.getElementById("tendencia-proyeccion");
        const diferencia = proyeccion.proyeccionConservadora - metaTotalMes;
        const porcentaje = ((diferencia / metaTotalMes) * 100).toFixed(1);
        const tendenciaClass = diferencia >= 0 ? "positive" : "negative";

        if (proyeccionEl) {
            proyeccionEl.innerHTML = `${formatoCantidad(proyeccion.proyeccionConservadora)}<span class="proyeccion-pct ${tendenciaClass}">${porcentaje >= 0 ? '+' : ''}${porcentaje}%</span>`;
            proyeccionEl.className = "data-value " + tendenciaClass;
        }

        updateResumenEjecutivo('proyeccion', {
            valor: proyeccion.proyeccionConservadora,
            meta: metaTotalMes,
            porcentaje: porcentaje,
            tendencia: diferencia >= 0 ? "positive" : "negative"
        });

        // Poblar datos de análisis avanzado para modales (con manejo de errores)
        try {
            poblarDatosAnalisisAvanzado(analisisDiario, actual, metaTotalMes);
        } catch (error) {
            console.error('Error al poblar datos de análisis avanzado:', error);
            // Continuar sin romper el flujo
        }
    }

    // Calcular tendencia basada en regresión lineal de datos diarios
    if (datosDiarios && datosDiarios.length >= 2) {
        const n = datosDiarios.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        datosDiarios.forEach((d, i) => {
            sumX += i;
            sumY += d.Ingreso;
            sumXY += i * d.Ingreso;
            sumXX += i * i;
        });
        const pendiente = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        
        // Determinar tendencia basada en la pendiente de regresión lineal
        // Usar el mismo criterio que en el modal: pendiente >= 0 es alza, < 0 es baja
        if (pendiente > 100) {
            globalTrend = 'positive';
        } else if (pendiente < -100) {
            globalTrend = 'negative';
        } else {
            globalTrend = 'neutral';
        }
        
        updateTrendIndicator();
    }
}

// Función para actualizar el resumen ejecutivo
function updateResumenEjecutivo(tipo, datos) {
    const resumenEl = document.getElementById("tendencia-resumen-texto");
    if (!resumenEl) return;

    switch (tipo) {
        case 'actual':
            resumenEl.textContent = `El mes actual muestra ${datos.tendencia === 'positive' ? 'un crecimiento' :
                datos.tendencia === 'negative' ? 'una disminución' : 'una estabilidad'} ` +
                `de ${datos.comparativo} respecto al mes anterior.`;
            break;
        case 'proyeccion':
            const vsMeta = parseFloat(datos.porcentaje);
            // Texto corregido para reflejar que se compara con el budget total del mes
            resumenEl.textContent = `Proyección: ${vsMeta >= 0 ? 'supera' : 'por debajo de'} ` +
                `el budget mensual en ${Math.abs(vsMeta).toFixed(1)}%`;
            break;
        case 'interanual':
            resumenEl.textContent = `En comparación anual, el crecimiento es ${datos.tendencia === 'positive' ? 'positivo' :
                datos.tendencia === 'negative' ? 'negativo' : 'neutral'} (${datos.valor}).`;
            break;
    }

    determinarTendenciaGlobal();
}

// Calcular estadísticas de tendencia DIARIA
function calcularEstadisticasTendenciaDiaria(analisisDiario, año, mesActual, actual) {
    const { datosDiarios, patronesSemanales, proyeccion } = analisisDiario;

    // Calcular métricas básicas
    const ingresos = datosDiarios.map(d => d.Ingreso);
    const promedio = Math.round(ingresos.reduce((a, b) => a + b, 0) / ingresos.length);
    const maxIngreso = Math.max(...ingresos);
    const minIngreso = Math.min(...ingresos);

    // Encontrar mejor y peor día
    const mejorDia = datosDiarios.find(d => d.Ingreso === maxIngreso);
    const peorDia = datosDiarios.find(d => d.Ingreso === minIngreso);

    // Calcular variabilidad (coeficiente de variación)
    const desviacion = calcularDesviacionEstandar(ingresos);
    const variabilidad = ((desviacion / promedio) * 100).toFixed(1) + '%';

    // Actualizar información de proyección si existe
    if (proyeccion) {
        const comparisonGrid = document.querySelector('.trend-analysis-card .comparison-grid');
        if (comparisonGrid) {
            // Check if projection item already exists
            let existingProjection = comparisonGrid.querySelector('.projection-item');
            if (!existingProjection) {
                const proyeccionItem = document.createElement('div');
                proyeccionItem.className = 'comparison-item projection-item';
                proyeccionItem.innerHTML = `
                    <div class="comparison-label">
                        <i class="fas fa-project-diagram"></i> Proyección mensual
                    </div>
                    <div class="comparison-value">${formatoCantidad(proyeccion.proyeccionConservadora)}</div>
                    <div class="comparison-description">Basada en tendencia y patrones</div>
                `;
                comparisonGrid.appendChild(proyeccionItem);
            }
        }
    }
}

// Desviación estándar
function calcularDesviacionEstandar(valores) {
    if (!valores || valores.length < 2) return 0;
    const n = valores.length;
    const media = valores.reduce((a, b) => a + b) / n;
    const sumaDiferencias = valores.reduce((sum, val) => sum + Math.pow(val - media, 2), 0);
    return Math.sqrt(sumaDiferencias / n);
}

// Determinar la tendencia global
function determinarTendenciaGlobal() {
    if (!tendenciaValues || tendenciaValues.length === 0) {
        globalTrend = 'neutral';
        updateTrendIndicator();
        return;
    }

    const counts = {
        positive: tendenciaValues.filter(t => t === 'positive').length,
        negative: tendenciaValues.filter(t => t === 'negative').length,
        neutral: tendenciaValues.filter(t => t === 'neutral').length
    };

    if (counts.positive > counts.negative && counts.positive > counts.neutral) {
        globalTrend = 'positive';
    } else if (counts.negative > counts.positive && counts.negative > counts.neutral) {
        globalTrend = 'negative';
    } else {
        globalTrend = 'neutral';
    }

    updateTrendIndicator();
}

// Generar gráfico de tendencia DIARIA
function generarGraficoTendenciaDiaria(analisisDiario, año, mesActual) {
    const { datosDiarios, tendencia, promedioMovil } = analisisDiario;

    // Labels con fecha Colombia (solo datos reales)
    const labels = datosDiarios.map(d => {
        const fecha = parseDate(d.Fecha);
        const offset = fecha.getTimezoneOffset() + 300;
        const col = new Date(fecha.getTime() + offset * 60000);
        return `${col.getDate()}/${col.getMonth() + 1}`;
    });

    const dataActual    = datosDiarios.map(d => d.Ingreso);
    const dataMeta      = datosDiarios.map(d => d.Meta);

    const canvas = document.getElementById('tendenciaChart');
    if (!canvas) return;
    if (tendenciaChart) tendenciaChart.destroy();

    const pointBackgroundColors = datosDiarios.map(d => {
        const fecha = parseDate(d.Fecha);
        const offset = fecha.getTimezoneOffset() + 300;
        const col = new Date(fecha.getTime() + offset * 60000);
        return col.getDay() === 5 ? '#f87171' : '#6366f1';
    });

    const isMobile = window.innerWidth < 768;

    tendenciaChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Ingresos diarios',
                    data: dataActual,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99,102,241,0.06)',
                    borderWidth: isMobile ? 2 : 1.5,
                    tension: 0.1,
                    pointBackgroundColor: pointBackgroundColors,
                    pointRadius: isMobile ? 4 : 3,
                    pointHoverRadius: 7,
                    fill: true,
                    order: 1
                },
                {
                    label: 'Meta diaria',
                    data: dataMeta,
                    borderColor: 'rgba(251,191,36,0.6)',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    tension: 0,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderDash: [4, 4],
                    fill: false,
                    order: 3
                },
                {
                    label: 'Promedio móvil (7d)',
                    data: promedioMovil,
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    borderDash: [6, 3],
                    fill: false,
                    order: 2
                },
                {
                    label: 'Tendencia lineal',
                    data: tendencia,
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    tension: 0,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    fill: false,
                    order: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 12,
                        font: { size: isMobile ? 10 : 11 },
                        color: '#64748b',
                        boxWidth: 8
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15,17,23,0.97)',
                    titleColor: '#94a3b8',
                    bodyColor: '#64748b',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            if (context.parsed.y === null) return null;
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            label += formatoCantidad(context.parsed.y);
                            return label;
                        },
                        afterLabel: function(context) {
                            if (context.datasetIndex === 0 && context.dataIndex < datosDiarios.length) {
                                return `Día: ${datosDiarios[context.dataIndex].Dia}`;
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: v => formatoCantidad(v),
                        color: '#64748b',
                        maxTicksLimit: 6,
                        font: { size: isMobile ? 10 : 11 }
                    },
                    grid: { color: 'rgba(255,255,255,0.04)' }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#64748b',
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: isMobile ? 6 : 12,
                        font: { size: isMobile ? 10 : 11 }
                    }
                }
            }
        }
    });
}


// Exportar gráfico como imagen
function exportChartAsImage(chartId, filename) {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// Obtener tendencia global
function getGlobalTrend() {
    return globalTrend || 'neutral';
}

/**
 * Poblar datos de análisis avanzado para los modales
 */
function poblarDatosAnalisisAvanzado(analisisDiario, actual, metaTotalMes) {
    try {
        const { proyeccion, datosDiarios, tendencia, promedioMovil } = analisisDiario;
        
        if (!proyeccion || !datosDiarios || datosDiarios.length === 0) {
            console.warn('No hay datos suficientes para análisis avanzado');
            return;
        }

        // Usar la meta total del mes pasada como parámetro
        const metaTotal = metaTotalMes || actual.meta;

        // Función auxiliar para parsear fechas
        const parseFecha = (dateStr) => {
            if (!dateStr) return null;
            const parts = dateStr.split('/');
            if (parts.length !== 3) return null;
            return new Date(parts[2], parts[1] - 1, parts[0]);
        };

        // Calcular regresión lineal
        const n = datosDiarios.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        datosDiarios.forEach((d, i) => {
            sumX += i;
            sumY += d.Ingreso;
            sumXY += i * d.Ingreso;
            sumXX += i * i;
        });
        const pendiente = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercepto = (sumY - pendiente * sumX) / n;

        // Identificar días no hábiles trabajados
        const sabDomTrabajados = datosDiarios.filter(d => {
            const fecha = parseFecha(d.Fecha);
            if (!fecha) return false;
            const dow = fecha.getDay();
            return dow === 0 || dow === 6;
        });

        // Calcular días restantes
        const ultimaFecha = parseFecha(datosDiarios[datosDiarios.length - 1].Fecha);
        if (!ultimaFecha) {
            console.warn('No se pudo parsear la última fecha');
            return;
        }
        
        const año = ultimaFecha.getFullYear();
        const mes = ultimaFecha.getMonth();
        const diasEnMes = new Date(año, mes + 1, 0).getDate();
        const offset = ultimaFecha.getTimezoneOffset() + 300;
        const ultimaFechaCol = new Date(ultimaFecha.getTime() + offset * 60000);
        const ultimoDiaConDatos = ultimaFechaCol.getDate();
        
        const diasRestantesList = [];
        const dowNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
        for (let d = ultimoDiaConDatos + 1; d <= diasEnMes; d++) {
            const dow = new Date(año, mes, d).getDay();
            const esHabil = dow !== 0 && dow !== 6;
            diasRestantesList.push({ dia: d, dow: dowNames[dow], esHabil });
        }

        // Últimos 7 días para promedio móvil
        const ultimos7 = datosDiarios.slice(-7);
        const promedioMovilValor = ultimos7.reduce((s, d) => s + d.Ingreso, 0) / ultimos7.length;

        // Actualizar UI con métricas adicionales
        const pendienteEl = document.getElementById('tendencia-pendiente');
        if (pendienteEl) {
            const direccion = pendiente >= 0 ? 'positive' : 'negative';
            pendienteEl.textContent = `${pendiente >= 0 ? '+' : ''}${pendiente.toFixed(1)} /día`;
            pendienteEl.className = 'data-value ' + direccion;
        }

        const promedioMovilEl = document.getElementById('tendencia-promedio-movil');
        if (promedioMovilEl) {
            promedioMovilEl.textContent = formatoCantidad(Math.round(promedioMovilValor));
        }

        // Integrar información de días hábiles en el promedio móvil
        const diasInfoEl = document.getElementById('tendencia-dias-info');
        if (diasInfoEl) {
            const extraInfo = sabDomTrabajados.length > 0 
                ? ` · <span style="color: var(--warning-color)">${sabDomTrabajados.length} día${sabDomTrabajados.length > 1 ? 's' : ''} extra${sabDomTrabajados.length > 1 ? 's' : ''}</span>`
                : '';
            diasInfoEl.innerHTML = `<i class="fas fa-calendar-check" style="margin-right: 4px;"></i>${proyeccion.diasTranscurridos} de ${proyeccion.diasHabilesTotales} días hábiles${extraInfo}`;
        }

        // Guardar datos en variable global para los modales
        window.analyticsData = {
            proyeccion: {
                proyeccionConservadora: proyeccion.proyeccionConservadora,
                proyeccionTendencia: proyeccion.proyeccionTendencia,
                proyeccionMovil: proyeccion.proyeccionMovil,
                ultimaTendencia: tendencia[tendencia.length - 1],
                promedioMovil: Math.round(promedioMovilValor),
                diasHabilesTotales: proyeccion.diasHabilesTotales,
                metaTotal: metaTotal, // Meta total del mes (budget)
                ingresosAcumulados: proyeccion.ingresosAcumulados
            },
            regresion: {
                pendiente,
                intercepto,
                n,
                sumX,
                sumY,
                sumXY,
                sumXX
            },
            diasHabiles: {
                diasHabilesTranscurridos: proyeccion.diasTranscurridos,
                diasHabilesRestantes: proyeccion.diasRestantes,
                diasHabilesTotales: proyeccion.diasHabilesTotales,
                sabDomTrabajados,
                diasRestantesList,
                diasEnMes,
                ultimoDiaConDatos,
                mes: actual.mes,
                año: actual.año
            },
            promedioMovil: {
                ultimos7,
                promedioMovil: Math.round(promedioMovilValor)
            }
        };

    } catch (error) {
        console.error('❌ Error en poblarDatosAnalisisAvanzado:', error);
        // No lanzar el error para no romper el flujo
    }
}
