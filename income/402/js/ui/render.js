/**
 * UI Rendering and DOM Updates
 * Complete rendering logic matching backup.html
 */

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function safeSetClass(id, className) {
    const el = document.getElementById(id);
    if (el) el.className = className;
}

function safeSetHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// ============ DATOS DEL DÍA ============
function cargarDatosDia() {
    if (!currentReportData) return;

    const data = currentReportData.dia;
    const actual = data.actual;
    const anterior = data.anterior;

    safeSetText("dia-fecha", actual.fecha);
    safeSetText("dia-habiles", `1 / 1`);
    safeSetText("dia-meta", formatoCantidad(actual.meta));
    safeSetText("dia-ingreso", formatoCantidad(actual.ingreso));

    // Tooltip de meta diaria
    const mesActual = currentReportData.mes.actual;
    if (mesActual) {
        // Meta Inicial = budget.TOTAL / budget.HABILES (sin días extra, respeta proveedor activo)
        const budgetMes = activeBudgetData.find(b =>
            b.MES.toUpperCase() === mesActual.mes.toUpperCase() && b.ANO === String(mesActual.año)
        );
        const habilesOficiales = budgetMes ? budgetMes.HABILES : mesActual.habiles_totales;
        const metaInicial = (budgetMes && habilesOficiales > 0)
            ? Math.round(budgetMes.TOTAL / habilesOficiales)
            : actual.meta;

        // Meta 100% = meta diaria + (atraso / diasRestantes)
        // diasRestantes = habiles_totales - habiles_cursados
        // habiles_totales ya incluye días no-hábiles laborados, por eso da los días reales que faltan
        const diasRestantes = Math.max(1, mesActual.habiles_totales - mesActual.habiles_cursados);
        const atraso = mesActual.meta - mesActual.ingreso;
        const metaCien = Math.round(actual.meta + (atraso / diasRestantes));

        const tooltipEl = document.getElementById('dia-meta-tooltip');
        if (tooltipEl) {
            tooltipEl.innerHTML =
                `<strong>Meta Inicial:</strong> ${formatoCantidad(metaInicial)}<br>` +
                `<strong>Meta Real:</strong> ${formatoCantidad(metaCien)}<br>` +
                `${atraso > 0 ? 'Atraso' : 'Adelanto'}: ${formatoCantidad(Math.abs(atraso))}<br>` +
                `Restantes: ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}`;
        }
    }

    // Diferencia
    safeSetText("dia-diferencia", formatoCantidad(actual.diferencia));
    safeSetClass("dia-diferencia", "data-value " + (actual.diferencia >= 0 ? "positive" : "negative"));

    // Porcentaje
    safeSetText("dia-porcentaje", actual.porcentaje);

    // Barra de progreso
    updateProgressBar("dia", actual.porcentaje, actual.meta, actual.ingreso);

    // Gestión
    updateGrowthTrend("dia", actual.gestion);

    // Tooltip de gestión anual
    const diaAnterior = data.anterior;
    const tooltipGestion = document.getElementById('dia-gestion-tooltip');
    if (tooltipGestion) {
        if (diaAnterior && actual.gestion) {
            const pctActual = extraerPorcentaje(actual.porcentaje);
            const pctAnterior = extraerPorcentaje(diaAnterior.porcentaje);
            const gestionNum = parseFloat(actual.gestion);
            const gestionDesc = gestionNum > 0 ? 'Crecimiento vs año anterior' : gestionNum < 0 ? 'Caída vs año anterior' : 'Sin variación';
            tooltipGestion.innerHTML =
                `<strong>Comparación de Gestión Anual</strong><br><br>` +
                `<strong>Año Actual (${actual.año}):</strong> ${pctActual}% cumplimiento<br>` +
                `<strong>Año Anterior (${diaAnterior.año}):</strong> ${pctAnterior}% cumplimiento<br><br>` +
                `<strong>Resultado:</strong> ${actual.gestion} — ${gestionDesc}<br><br>` +
                `<em style="font-size:11px;opacity:0.7">Fórmula: (% actual ÷ % año anterior - 1) × 100<br>` +
                `= (${pctActual} ÷ ${pctAnterior} - 1) × 100<br>` +
                `Positivo = mejora · Negativo = retroceso</em>`;
        } else {
            tooltipGestion.innerHTML = 'Sin datos del año anterior para comparar';
        }
    }

    // Estadísticas adicionales
    safeSetText("dia-average", formatoCantidad(actual.promedio));
    safeSetText("dia-weighted", formatoCantidad(actual.ponderado));
    safeSetText("dia-desvest", formatoCantidad(actual.desvest));
    safeSetText("dia-max", formatoCantidad(actual.max));
    safeSetText("dia-min", formatoCantidad(actual.min));
    const diaMaxTip = document.getElementById('dia-max-tooltip');
    if (diaMaxTip) diaMaxTip.textContent = actual.max_fecha ? `${getDiaSemana(actual.max_fecha)} ${parseDate(actual.max_fecha).getDate()} de ${getNombreMes(actual.max_fecha).toLowerCase()} de ${parseDate(actual.max_fecha).getFullYear()}` : 'Ingreso máximo registrado';
    const diaMinTip = document.getElementById('dia-min-tooltip');
    if (diaMinTip) diaMinTip.textContent = actual.min_fecha ? `${getDiaSemana(actual.min_fecha)} ${parseDate(actual.min_fecha).getDate()} de ${getNombreMes(actual.min_fecha).toLowerCase()} de ${parseDate(actual.min_fecha).getFullYear()}` : 'Ingreso mínimo registrado';

    // Comparativo extendido
    if (anterior) {
        safeSetText("dia-metaAnterior", formatoCantidad(anterior.meta));
        safeSetText("dia-ingresoAnterior", formatoCantidad(anterior.ingreso));
        safeSetText("dia-porcentajeAnterior", anterior.porcentaje);
        safeSetText("dia-diaAnterior", anterior.dia_letras);
        safeSetText("dia-averageAnterior", formatoCantidad(anterior.promedio));
        safeSetText("dia-weightedAnterior", formatoCantidad(anterior.ponderado));
        safeSetText("dia-desvestAnterior", formatoCantidad(anterior.desvest));
        safeSetText("dia-maxAnterior", formatoCantidad(anterior.max));
        safeSetText("dia-minAnterior", formatoCantidad(anterior.min));
        buildVarTable('dia-var-tbody', actual, anterior);
    }

    // VS inline
    const diaAnt = anterior;
    const diaAntYear = diaAnt?.año;
    setVs('dia-vs-ingreso',   actual.ingreso,                    diaAnt?.ingreso,  false, diaAntYear);
    setVs('dia-vs-meta',      actual.meta,                       diaAnt?.meta,     false, diaAntYear);
    setVs('dia-vs-diferencia',actual.diferencia,                 diaAnt?.diferencia, false, diaAntYear);
    setVs('dia-vs-porcentaje',extraerPorcentaje(actual.porcentaje), diaAnt ? extraerPorcentaje(diaAnt.porcentaje) : null, true, diaAntYear);
    setVs('dia-vs-gestion',   parseFloat(actual.gestion),        diaAnt ? parseFloat(diaAnt.gestion) : null, true, diaAntYear);
    setVs('dia-vs-promedio',  actual.promedio,                   diaAnt?.promedio, false, diaAntYear);
    setVs('dia-vs-weighted',  actual.ponderado,                  diaAnt?.ponderado,false, diaAntYear);
    setVs('dia-vs-desvest',   actual.desvest,                    diaAnt?.desvest,  false, diaAntYear, true);
    setDesvestTooltip('dia-desvest-tooltip', actual.desvest, actual.promedio, diaAnt?.desvest);
    setVs('dia-vs-max',       actual.max,                        diaAnt?.max,      false, diaAntYear);
    setVs('dia-vs-min',       actual.min,                        diaAnt?.min,      false, diaAntYear);
}

// ============ DATOS DEL MES ============
function cargarDatosMes() {
    if (!currentReportData) return;

    const data = currentReportData.mes;
    const actual = data.actual;
    const anterior = data.anterior;

    // Rango de fechas en el badge (Compact)
    const mesCorto = getNombreMesCorto(currentReportData.filtros.actual).toUpperCase();
    const añoCorto = String(actual.año).slice(-2);
    let rangoTexto = `${mesCorto} '${añoCorto}`;

    try {
        const fechaInicio = consolidatedData
            .filter(d => d.Mes === actual.mes && d.Año === actual.año)
            .sort((a, b) => parseDate(a.Fecha) - parseDate(b.Fecha))[0];
        const fechaFin = parseDate(currentReportData.filtros.actual);
        if (fechaInicio && fechaFin) {
            const diaInicio = parseDate(fechaInicio.Fecha).getDate();
            const diaFin = fechaFin.getDate();
            rangoTexto = `${mesCorto} '${añoCorto} (${diaInicio}-${diaFin})`;
        }
    } catch (e) { /* fallback */ }

    safeSetText("mes-mes", rangoTexto);
    safeSetText("mes-habiles", `${actual.habiles_cursados} / ${actual.habiles_totales}`);
    safeSetText("mes-meta", formatoCantidad(actual.meta));
    safeSetText("mes-ingreso", formatoCantidad(actual.ingreso));

    // Diferencia
    safeSetText("mes-diferencia", formatoCantidad(actual.diferencia));
    safeSetClass("mes-diferencia", "data-value " + (actual.diferencia >= 0 ? "positive" : "negative"));

    // Porcentaje
    safeSetText("mes-porcentaje", actual.porcentaje);

    // Barra de progreso
    updateProgressBar("mes", actual.porcentaje, actual.meta, actual.ingreso);

    // Gestión
    updateGrowthTrend("mes", actual.gestion);

    // Tooltip de gestión anual
    const mesAnterior = data.anterior;
    const tooltipGestionMes = document.getElementById('mes-gestion-tooltip');
    if (tooltipGestionMes) {
        if (mesAnterior && actual.gestion) {
            const pctActual = extraerPorcentaje(actual.porcentaje);
            const pctAnterior = extraerPorcentaje(mesAnterior.porcentaje);
            const gestionNumMes = parseFloat(actual.gestion);
            const gestionDescMes = gestionNumMes > 0 ? 'Crecimiento vs año anterior' : gestionNumMes < 0 ? 'Caída vs año anterior' : 'Sin variación';
            tooltipGestionMes.innerHTML =
                `<strong>Comparación de Gestión Mensual</strong><br><br>` +
                `<strong>Año Actual (${actual.año}):</strong> ${actual.mes} - ${pctActual}% cumplimiento<br>` +
                `<strong>Año Anterior (${mesAnterior.año}):</strong> ${mesAnterior.mes} - ${pctAnterior}% cumplimiento<br><br>` +
                `<strong>Resultado:</strong> ${actual.gestion} — ${gestionDescMes}<br><br>` +
                `<em style="font-size:11px;opacity:0.7">Fórmula: (% actual ÷ % año anterior - 1) × 100<br>` +
                `= (${pctActual} ÷ ${pctAnterior} - 1) × 100<br>` +
                `Positivo = mejora · Negativo = retroceso</em>`;
        } else {
            tooltipGestionMes.innerHTML = 'Sin datos del año anterior para comparar';
        }
    }

    // Estadísticas adicionales
    safeSetText("mes-average", formatoCantidad(actual.promedio));
    safeSetText("mes-weighted", formatoCantidad(actual.ponderado));
    safeSetText("mes-desvest", formatoCantidad(actual.desvest));
    safeSetText("mes-max", formatoCantidad(actual.max));
    safeSetText("mes-min", formatoCantidad(actual.min));
    const mesMaxTip = document.getElementById('mes-max-tooltip');
    if (mesMaxTip) mesMaxTip.textContent = actual.max_fecha ? `${getDiaSemana(actual.max_fecha)} ${parseDate(actual.max_fecha).getDate()} de ${getNombreMes(actual.max_fecha).toLowerCase()} de ${parseDate(actual.max_fecha).getFullYear()}` : 'Ingreso máximo registrado';
    const mesMinTip = document.getElementById('mes-min-tooltip');
    if (mesMinTip) mesMinTip.textContent = actual.min_fecha ? `${getDiaSemana(actual.min_fecha)} ${parseDate(actual.min_fecha).getDate()} de ${getNombreMes(actual.min_fecha).toLowerCase()} de ${parseDate(actual.min_fecha).getFullYear()}` : 'Ingreso mínimo registrado';

    // Comparativo extendido
    if (anterior) {
        safeSetText("mes-metaAnterior", formatoCantidad(anterior.meta));
        safeSetText("mes-ingresoAnterior", formatoCantidad(anterior.ingreso));
        safeSetText("mes-porcentajeAnterior", anterior.porcentaje);
        safeSetText("mes-habilAnterior", anterior.registros + " días");
        safeSetText("mes-averageAnterior", formatoCantidad(anterior.promedio));
        safeSetText("mes-weightedAnterior", formatoCantidad(anterior.ponderado));
        safeSetText("mes-desvestAnterior", formatoCantidad(anterior.desvest));
        safeSetText("mes-maxAnterior", formatoCantidad(anterior.max));
        safeSetText("mes-minAnterior", formatoCantidad(anterior.min));
        buildVarTable('mes-var-tbody', actual, anterior);
    }

    // VS inline
    const mesAnt = anterior;
    const mesAntYear = mesAnt?.año;
    setVs('mes-vs-ingreso',   actual.ingreso,                    mesAnt?.ingreso,  false, mesAntYear);
    setVs('mes-vs-meta',      actual.meta,                       mesAnt?.meta,     false, mesAntYear);
    setVs('mes-vs-diferencia',actual.diferencia,                 mesAnt?.diferencia, false, mesAntYear);
    setVs('mes-vs-porcentaje',extraerPorcentaje(actual.porcentaje), mesAnt ? extraerPorcentaje(mesAnt.porcentaje) : null, true, mesAntYear);
    setVs('mes-vs-gestion',   parseFloat(actual.gestion),        mesAnt ? parseFloat(mesAnt.gestion) : null, true, mesAntYear);
    setVs('mes-vs-promedio',  actual.promedio,                   mesAnt?.promedio, false, mesAntYear);
    setVs('mes-vs-weighted',  actual.ponderado,                  mesAnt?.ponderado,false, mesAntYear);
    setVs('mes-vs-desvest',   actual.desvest,                    mesAnt?.desvest,  false, mesAntYear, true);
    setDesvestTooltip('mes-desvest-tooltip', actual.desvest, actual.promedio, mesAnt?.desvest);
    setVs('mes-vs-max',       actual.max,                        mesAnt?.max,      false, mesAntYear);
    setVs('mes-vs-min',       actual.min,                        mesAnt?.min,      false, mesAntYear);
}

// ============ DATOS DEL AÑO ============
function cargarDatosAño() {
    if (!currentReportData) return;

    const data = currentReportData.año;
    const actual = data.actual;
    const anterior = data.anterior;

    // Rango de fechas en el badge (Compact)
    let rangoTexto = `${actual.año}`;
    try {
        const fechaInicio = consolidatedData
            .filter(d => d.Año === actual.año)
            .sort((a, b) => parseDate(a.Fecha) - parseDate(b.Fecha))[0];
        const fechaFin = parseDate(currentReportData.filtros.actual);
        if (fechaInicio && fechaFin) {
            const mesInicioCorto = getNombreMesCorto(fechaInicio.Fecha);
            const diaInicio = parseDate(fechaInicio.Fecha).getDate();
            const mesFinCorto = getNombreMesCorto(formatDate(fechaFin));
            const diaFin = fechaFin.getDate();
            rangoTexto = `${actual.año} (${diaInicio} ${mesInicioCorto} - ${diaFin} ${mesFinCorto})`;
        }
    } catch (e) { /* fallback */ }

    safeSetText("año-año", rangoTexto);
    safeSetText("año-habiles", `${actual.habiles_cursados} / ${actual.habiles_totales}`);
    safeSetText("año-meta", formatoCantidad(actual.meta));
    safeSetText("año-ingreso", formatoCantidad(actual.ingreso));

    // Diferencia
    safeSetText("año-diferencia", formatoCantidad(actual.diferencia));
    safeSetClass("año-diferencia", "data-value " + (actual.diferencia >= 0 ? "positive" : "negative"));

    // Porcentaje
    safeSetText("año-porcentaje", actual.porcentaje);

    // Barra de progreso
    updateProgressBar("año", actual.porcentaje, actual.meta, actual.ingreso);

    // Gestión
    updateGrowthTrend("año", actual.gestion);

    // Tooltip de gestión anual
    const añoAnterior = data.anterior;
    const tooltipGestionAño = document.getElementById('año-gestion-tooltip');
    if (tooltipGestionAño) {
        if (añoAnterior && actual.gestion) {
            const pctActual = extraerPorcentaje(actual.porcentaje);
            const pctAnterior = extraerPorcentaje(añoAnterior.porcentaje);
            const gestionNumAño = parseFloat(actual.gestion);
            const gestionDescAño = gestionNumAño > 0 ? 'Crecimiento vs año anterior' : gestionNumAño < 0 ? 'Caída vs año anterior' : 'Sin variación';
            tooltipGestionAño.innerHTML =
                `<strong>Comparación de Gestión Anual</strong><br><br>` +
                `<strong>Año Actual (${actual.año}):</strong> ${pctActual}% cumplimiento<br>` +
                `<strong>Año Anterior (${añoAnterior.año}):</strong> ${pctAnterior}% cumplimiento<br><br>` +
                `<strong>Resultado:</strong> ${actual.gestion} — ${gestionDescAño}<br><br>` +
                `<em style="font-size:11px;opacity:0.7">Fórmula: (% actual ÷ % año anterior - 1) × 100<br>` +
                `= (${pctActual} ÷ ${pctAnterior} - 1) × 100<br>` +
                `Positivo = mejora · Negativo = retroceso</em>`;
        } else {
            tooltipGestionAño.innerHTML = 'Sin datos del año anterior para comparar';
        }
    }

    // Estadísticas adicionales
    safeSetText("año-average", formatoCantidad(actual.promedio));
    safeSetText("año-weighted", formatoCantidad(actual.ponderado));
    safeSetText("año-desvest", formatoCantidad(actual.desvest));
    safeSetText("año-max", formatoCantidad(actual.max));
    safeSetText("año-min", formatoCantidad(actual.min));
    const añoMaxTip = document.getElementById('año-max-tooltip');
    if (añoMaxTip) añoMaxTip.textContent = actual.max_fecha ? `${getDiaSemana(actual.max_fecha)} ${parseDate(actual.max_fecha).getDate()} de ${getNombreMes(actual.max_fecha).toLowerCase()} de ${parseDate(actual.max_fecha).getFullYear()}` : 'Ingreso máximo registrado';
    const añoMinTip = document.getElementById('año-min-tooltip');
    if (añoMinTip) añoMinTip.textContent = actual.min_fecha ? `${getDiaSemana(actual.min_fecha)} ${parseDate(actual.min_fecha).getDate()} de ${getNombreMes(actual.min_fecha).toLowerCase()} de ${parseDate(actual.min_fecha).getFullYear()}` : 'Ingreso mínimo registrado';

    // Comparativo extendido
    if (anterior) {
        safeSetText("año-metaAnterior", formatoCantidad(anterior.meta));
        safeSetText("año-ingresoAnterior", formatoCantidad(anterior.ingreso));
        safeSetText("año-porcentajeAnterior", anterior.porcentaje);
        safeSetText("año-diferenciaAnterior", formatoCantidad(anterior.diferencia));
        safeSetText("año-averageAnterior", formatoCantidad(anterior.promedio));
        safeSetText("año-weightedAnterior", formatoCantidad(anterior.ponderado));
        safeSetText("año-desvestAnterior", formatoCantidad(anterior.desvest));
        safeSetText("año-maxAnterior", formatoCantidad(anterior.max));
        safeSetText("año-minAnterior", formatoCantidad(anterior.min));
        buildVarTable('año-var-tbody', actual, anterior);
    }

    // VS inline
    const añoAnt = anterior;
    const añoAntYear = añoAnt?.año;
    setVs('año-vs-ingreso',   actual.ingreso,                    añoAnt?.ingreso,  false, añoAntYear);
    setVs('año-vs-meta',      actual.meta,                       añoAnt?.meta,     false, añoAntYear);
    setVs('año-vs-diferencia',actual.diferencia,                 añoAnt?.diferencia, false, añoAntYear);
    setVs('año-vs-porcentaje',extraerPorcentaje(actual.porcentaje), añoAnt ? extraerPorcentaje(añoAnt.porcentaje) : null, true, añoAntYear);
    setVs('año-vs-gestion',   parseFloat(actual.gestion),        añoAnt ? parseFloat(añoAnt.gestion) : null, true, añoAntYear);
    setVs('año-vs-promedio',  actual.promedio,                   añoAnt?.promedio, false, añoAntYear);
    setVs('año-vs-weighted',  actual.ponderado,                  añoAnt?.ponderado,false, añoAntYear);
    setVs('año-vs-desvest',   actual.desvest,                    añoAnt?.desvest,  false, añoAntYear, true);
    setDesvestTooltip('año-desvest-tooltip', actual.desvest, actual.promedio, añoAnt?.desvest);
    setVs('año-vs-max',       actual.max,                        añoAnt?.max,      false, añoAntYear);
    setVs('año-vs-min',       actual.min,                        añoAnt?.min,      false, añoAntYear);
}

// ============ VS AÑO ANTERIOR (inline) ============
// ============ VS AÑO ANTERIOR (inline) ============
function setDesvestTooltip(id, desvest, promedio, antDesvest) {
    const el = document.getElementById(id);
    if (!el) return;
    const cv = promedio > 0 ? ((desvest / promedio) * 100).toFixed(1) : null;
    let dispersion = '';
    if (cv !== null) {
        const cvNum = parseFloat(cv);
        dispersion = cvNum < 15 ? 'Baja dispersión — ingresos estables' :
                     cvNum < 30 ? 'Dispersión moderada' :
                                  'Alta dispersión — ingresos irregulares';
    }
    let vsText = '';
    if (antDesvest && antDesvest > 0) {
        const diff = desvest - antDesvest;
        const pct = ((desvest / antDesvest) - 1) * 100;
        vsText = diff < 0
            ? `<br>▼ ${Math.abs(pct).toFixed(1)}% menos dispersión vs año anterior — mayor estabilidad`
            : diff > 0
            ? `<br>▲ ${pct.toFixed(1)}% más dispersión vs año anterior — mayor variabilidad`
            : `<br>Sin cambio vs año anterior`;
    }
    el.innerHTML = `Mide qué tan variables son los ingresos día a día.<br>`
        + (cv !== null ? `CV: <strong>${cv}%</strong> — ${dispersion}` : 'Sin datos suficientes')
        + vsText
        + `<br><br><em style="font-size:11px;opacity:0.7">Fórmula: CV = (Desv. Estándar ÷ Promedio) × 100<br>< 15% estable · 15–30% moderado · > 30% irregular</em>`;
}

function setVs(id, actual, anterior, isPct = false, year = null, invert = false) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!anterior && anterior !== 0) { el.innerHTML = ''; return; }
    const diff = actual - anterior;
    // invert: menor valor es mejor (ej. desviación estándar)
    const better = invert ? diff < 0 : diff > 0;
    const worse  = invert ? diff > 0 : diff < 0;
    const cls = better ? 'up' : worse ? 'down' : 'flat';
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
    let deltaText;
    if (isPct) {
        deltaText = `${arrow} ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} pp`;
    } else {
        const pct = anterior !== 0 ? ((actual / anterior) - 1) * 100 : 0;
        deltaText = `${arrow} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    }
    const label = year ? year : 'Ant';
    el.innerHTML = `<span class="vs-ant">${label}: ${isPct ? anterior.toFixed(2) + '%' : formatoCantidad(anterior)}</span><span class="vs-delta ${cls}">${deltaText}</span>`;
}

// ============ TABLA DE VARIACIÓN ============
function buildVarTable(tbodyId, actual, anterior) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody || !anterior) return;

    function delta(a, b, isPercent = false) {
        if (!b || b === 0) return { text: 'N/A', cls: 'flat' };
        const diff = a - b;
        const pct = ((a / b) - 1) * 100;
        const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
        const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
        if (isPercent) {
            const diffPts = (a - b).toFixed(2);
            return { text: `${arrow} ${diffPts > 0 ? '+' : ''}${diffPts} pp`, cls };
        }
        return { text: `${arrow} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, cls };
    }

    const rows = [
        { label: 'Ingreso',    a: actual.ingreso,  b: anterior.ingreso,  fmt: formatoCantidad },
        { label: 'Meta',       a: actual.meta,     b: anterior.meta,     fmt: formatoCantidad },
        { label: '% Cumpl.',   a: extraerPorcentaje(actual.porcentaje), b: extraerPorcentaje(anterior.porcentaje), fmt: v => v.toFixed(2) + '%', isPct: true },
        { label: 'Promedio',   a: actual.promedio, b: anterior.promedio, fmt: formatoCantidad },
        { label: 'Ponderado',  a: actual.ponderado,b: anterior.ponderado,fmt: formatoCantidad },
        { label: 'Máximo',     a: actual.max,      b: anterior.max,      fmt: formatoCantidad },
        { label: 'Mínimo',     a: actual.min,      b: anterior.min,      fmt: formatoCantidad },
    ];

    tbody.innerHTML = rows.map(r => {
        const d = delta(r.a, r.b, r.isPct);
        return `<tr>
            <td>${r.label}</td>
            <td>${r.fmt(r.a)}</td>
            <td>${r.fmt(r.b)}</td>
            <td class="var-delta ${d.cls}">${d.text}</td>
        </tr>`;
    }).join('');
}

// ============ BARRA DE PROGRESO ============
function updateProgressBar(idPrefix, percentStr, meta, ingreso) {
    const progressBar = document.getElementById(`${idPrefix}-progressBar`);
    const progressPercent = document.getElementById(`${idPrefix}-progressPercent`);
    const remainingEl = document.getElementById(`${idPrefix}-restante`);

    let progreso = extraerPorcentaje(percentStr);
    let colorBarra;

    if (progreso < 30) {
        colorBarra = "linear-gradient(90deg, #e74c3c, #f39c12)";
    } else if (progreso < 70) {
        colorBarra = "linear-gradient(90deg, #f39c12, #f1c40f)";
    } else if (progreso < 100) {
        colorBarra = "linear-gradient(90deg, #2ecc71, #27ae60)";
    } else {
        colorBarra = "linear-gradient(90deg, #27ae60, #219653)";
    }

    if (progressBar) {
        progressBar.style.background = colorBarra;
        if (progressPercent) progressPercent.textContent = "0%";
        setTimeout(() => {
            progressBar.style.width = Math.min(progreso, 100) + "%";
            if (progressPercent) progressPercent.textContent = percentStr;
        }, 300);
    }

    if (remainingEl) {
        const diff = meta - ingreso;
        remainingEl.textContent = diff > 0 ? `Faltan ${formatoCantidad(diff)} para alcanzar la meta` : "Meta alcanzada";
    }
}

// ============ GESTIÓN / TENDENCIA ============
function updateGrowthTrend(idPrefix, gestion) {
    const gestEl = document.getElementById(`${idPrefix}-gestion`);
    const trendIcon = document.getElementById(`${idPrefix}-trendIcon`);
    if (!gestEl || !trendIcon) return;

    if (gestion) {
        const val = parseFloat(gestion);
        gestEl.textContent = gestion;

        if (val > 5) {
            gestEl.className = "positive";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            trendIcon.style.color = "var(--success-color)";
        } else if (val < -5) {
            gestEl.className = "negative";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
            trendIcon.style.color = "var(--danger-color)";
        } else {
            gestEl.className = "neutral";
            trendIcon.innerHTML = '<i class="fa-solid fa-equals"></i>';
            trendIcon.style.color = "var(--warning-color)";
        }
    } else {
        gestEl.textContent = "N/A";
        gestEl.className = "";
        trendIcon.innerHTML = '';
    }
}

// ============ INDICADOR DE TENDENCIA GLOBAL ============
function updateTrendIndicator() {
    const value = document.getElementById("tendencia-resumen-texto");
    if (!value) return;

    const label = globalTrend === 'positive' ? 'Alza' :
                  globalTrend === 'negative' ? 'Baja' : 'Estable';

    value.textContent = label;
    value.className = 'days-badge ' + (globalTrend || 'neutral');
}
