/**
 * Advanced Analytics Modals
 * Maneja los modales de análisis detallado de tendencias
 */

// Variables globales para almacenar datos de análisis
window.analyticsData = {};

/**
 * Formatea números con separadores de miles
 */
function fmtModal(n) {
    return Math.round(n).toLocaleString('es-CO');
}

/**
 * Parsea una fecha en formato DD/MM/YYYY
 * NOTA: Esta función NO debe ser usada fuera de analytics_modals.js
 * Para uso general, usar la función parseDate de date_utils.js
 */
function parseDateModal(dateStr) {
    if (!dateStr) return null;
    if (typeof dateStr !== 'string') return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
}

/**
 * Muestra el modal de proyección mensual
 */
function mostrarModalProyeccion() {
    const data = window.analyticsData;
    if (!data.proyeccion) {
        console.warn('No hay datos de proyección disponibles');
        return;
    }

    const {
        proyeccionConservadora,
        proyeccionTendencia,
        proyeccionMovil,
        ultimaTendencia,
        promedioMovil,
        diasHabilesTotales,
        metaTotal,
        ingresosAcumulados
    } = data.proyeccion;

    const pctVsMeta = metaTotal > 0 ? ((proyeccionConservadora / metaTotal) * 100).toFixed(1) : '0';
    const diferenciaMeta = proyeccionConservadora - metaTotal;

    const html = `
        <div class="modal-stats-grid">
            <div class="modal-stat-card">
                <div class="modal-stat-label">Proyección Conservadora</div>
                <div class="modal-stat-value" style="color: var(--primary-color)">${fmtModal(proyeccionConservadora)}</div>
                <div class="modal-stat-sub">${pctVsMeta}% de la meta mensual</div>
            </div>
            <div class="modal-stat-card ${diferenciaMeta >= 0 ? '' : 'warning'}">
                <div class="modal-stat-label">${diferenciaMeta >= 0 ? 'Excedente' : 'Faltante'} Proyectado</div>
                <div class="modal-stat-value" style="color: ${diferenciaMeta >= 0 ? 'var(--success-color)' : 'var(--warning-color)'}">
                    ${diferenciaMeta >= 0 ? '+' : ''}${fmtModal(diferenciaMeta)}
                </div>
                <div class="modal-stat-sub">vs Meta: ${fmtModal(metaTotal)}</div>
            </div>
        </div>

        <div class="formula-box-modal">
            <span class="formula-label">1. Proyección por Tendencia</span>
            <code>proyTendencia = ultimaTendencia × diasHabilesTotales</code><br>
            <code>= ${fmtModal(ultimaTendencia)} × ${diasHabilesTotales} = <strong>${fmtModal(proyeccionTendencia)}</strong></code>
            <p>Usa el último valor de la línea de tendencia (regresión lineal) y lo multiplica por el total de días hábiles del mes.</p>
        </div>

        <div class="formula-box-modal">
            <span class="formula-label">2. Proyección por Promedio Móvil</span>
            <code>proyMovil = promedioMovil × diasHabilesTotales</code><br>
            <code>= ${fmtModal(promedioMovil)} × ${diasHabilesTotales} = <strong>${fmtModal(proyeccionMovil)}</strong></code>
            <p>Usa el promedio de los últimos 7 días hábiles y lo multiplica por el total de días hábiles del mes.</p>
        </div>

        <div class="formula-box-modal" style="border-color: var(--primary-color); background: rgba(99,102,241,0.08);">
            <span class="formula-label" style="color: var(--primary-color)">3. Proyección Conservadora (Resultado Final)</span>
            <code>proyConservadora = (proyTendencia + proyMovil) / 2</code><br>
            <code>= (${fmtModal(proyeccionTendencia)} + ${fmtModal(proyeccionMovil)}) / 2</code><br>
            <code>= <strong style="color: var(--primary-color); font-size: 16px">${fmtModal(proyeccionConservadora)}</strong></code>
            <p>Promedia ambas proyecciones para obtener una estimación equilibrada que considera tanto la tendencia general como el comportamiento reciente.</p>
        </div>

        <div class="alert-box-modal info">
            <i class="fas fa-lightbulb"></i>
            <div>
                <strong>¿Por qué "conservadora"?</strong><br>
                Esta proyección combina dos métodos diferentes: la tendencia lineal (que captura el patrón general) y el promedio móvil (que refleja el comportamiento reciente). 
                Al promediarlos, obtenemos una estimación más robusta y menos susceptible a variaciones extremas.
            </div>
        </div>

        <table class="modal-data-table">
            <thead>
                <tr>
                    <th>Concepto</th>
                    <th class="num">Valor</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Ingreso acumulado</td>
                    <td class="num highlight-cell">${fmtModal(ingresosAcumulados)}</td>
                </tr>
                <tr>
                    <td>Meta mensual</td>
                    <td class="num">${fmtModal(metaTotal)}</td>
                </tr>
                <tr>
                    <td>Días hábiles totales</td>
                    <td class="num">${diasHabilesTotales}</td>
                </tr>
                <tr style="border-top: 2px solid rgba(255,255,255,0.1)">
                    <td><strong>Proyección conservadora</strong></td>
                    <td class="num highlight-cell" style="color: var(--primary-color)"><strong>${fmtModal(proyeccionConservadora)}</strong></td>
                </tr>
                <tr>
                    <td>% vs Meta</td>
                    <td class="num" style="color: ${parseFloat(pctVsMeta) >= 100 ? 'var(--success-color)' : 'var(--warning-color)'}">
                        ${pctVsMeta}%
                    </td>
                </tr>
            </tbody>
        </table>
    `;

    document.getElementById('modalProyeccionBody').innerHTML = html;
    document.getElementById('modalProyeccion').style.display = 'block';
}

/**
 * Muestra el modal de regresión lineal
 */
function mostrarModalRegresion() {
    const data = window.analyticsData;
    if (!data.regresion) {
        console.warn('No hay datos de regresión disponibles');
        return;
    }

    const { pendiente, intercepto, n, sumX, sumY, sumXY, sumXX } = data.regresion;
    const direccion = pendiente >= 0 ? 'alza' : 'baja';
    const colorDireccion = pendiente >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

    const html = `
        <p style="color: var(--text-medium); margin-bottom: 20px; line-height: 1.7;">
            La regresión lineal calcula una línea de tendencia que mejor se ajusta a los datos históricos del mes. 
            Esta línea nos permite identificar si los ingresos están en crecimiento o decrecimiento.
        </p>

        <div class="modal-stats-grid">
            <div class="modal-stat-card">
                <div class="modal-stat-label">Pendiente (m)</div>
                <div class="modal-stat-value" style="color: ${colorDireccion}">
                    ${pendiente >= 0 ? '+' : ''}${pendiente.toFixed(2)}
                </div>
                <div class="modal-stat-sub">Unidades por día hábil</div>
            </div>
            <div class="modal-stat-card">
                <div class="modal-stat-label">Dirección</div>
                <div class="modal-stat-value" style="color: ${colorDireccion}; font-size: 20px; text-transform: uppercase;">
                    ${direccion}
                </div>
                <div class="modal-stat-sub">${pendiente >= 0 ? 'Crecimiento' : 'Decrecimiento'} diario</div>
            </div>
        </div>

        <div class="formula-box-modal">
            <span class="formula-label">1. Cálculo de la Pendiente (m)</span>
            <code>m = (n·ΣXY − ΣX·ΣY) / (n·ΣX² − (ΣX)²)</code><br><br>
            <code>n = ${n} días</code><br>
            <code>ΣX = ${sumX.toFixed(2)}</code><br>
            <code>ΣY = ${sumY.toFixed(2)}</code><br>
            <code>ΣXY = ${sumXY.toFixed(2)}</code><br>
            <code>ΣX² = ${sumXX.toFixed(2)}</code><br><br>
            <code>m = (${n} × ${sumXY.toFixed(2)} − ${sumX.toFixed(2)} × ${sumY.toFixed(2)}) / (${n} × ${sumXX.toFixed(2)} − ${sumX.toFixed(2)}²)</code><br>
            <code>m = <strong>${pendiente.toFixed(4)}</strong></code>
        </div>

        <div class="formula-box-modal">
            <span class="formula-label">2. Cálculo del Intercepto (b)</span>
            <code>b = (ΣY − m·ΣX) / n</code><br>
            <code>b = (${sumY.toFixed(2)} − ${pendiente.toFixed(4)} × ${sumX.toFixed(2)}) / ${n}</code><br>
            <code>b = <strong>${intercepto.toFixed(2)}</strong></code>
        </div>

        <div class="formula-box-modal">
            <span class="formula-label">3. Ecuación de la Línea de Tendencia</span>
            <code>y = b + m × x</code><br>
            <code>y = ${intercepto.toFixed(2)} + ${pendiente.toFixed(4)} × x</code>
            <p>Donde <code>x</code> es el índice del día (0, 1, 2, ...) e <code>y</code> es el valor proyectado de ingreso.</p>
        </div>

        <div class="alert-box-modal ${pendiente >= 0 ? 'info' : 'warning'}">
            <i class="fas fa-${pendiente >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'}"></i>
            <div>
                <strong>Interpretación:</strong><br>
                La pendiente indica la tasa de cambio: <strong>${pendiente >= 0 ? '+' : ''}${pendiente.toFixed(1)}</strong> unidades por día hábil.
                Esto significa que los ingresos están en <strong>${direccion}</strong>.
                ${pendiente >= 0 
                    ? 'Cada día hábil, en promedio, los ingresos aumentan en esta cantidad.'
                    : 'Cada día hábil, en promedio, los ingresos disminuyen en esta cantidad.'}
            </div>
        </div>
    `;

    document.getElementById('modalRegresionBody').innerHTML = html;
    document.getElementById('modalRegresion').style.display = 'block';
}

/**
 * Muestra el modal de días hábiles
 */
function mostrarModalDiasHabiles() {
    const data = window.analyticsData;
    if (!data.diasHabiles) {
        console.warn('No hay datos de días hábiles disponibles');
        return;
    }

    const {
        diasHabilesTranscurridos,
        diasHabilesRestantes,
        diasHabilesTotales,
        sabDomTrabajados,
        diasRestantesList,
        diasEnMes,
        ultimoDiaConDatos,
        mes,
        año
    } = data.diasHabiles;

    const finesDeSemana = diasRestantesList ? diasRestantesList.filter(d => !d.esHabil).length : 0;
    const dowNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

    let sabDomHtml = '';
    if (sabDomTrabajados && sabDomTrabajados.length > 0) {
        sabDomHtml = `
            <div class="alert-box-modal warning">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>Días no hábiles trabajados:</strong><br>
                    Se detectaron ${sabDomTrabajados.length} día(s) de fin de semana con ingresos registrados.
                    Estos días se cuentan como días hábiles en el cálculo de proyecciones.
                </div>
            </div>

            <table class="modal-data-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Día</th>
                        <th class="num">Ingreso</th>
                        <th class="num">Meta</th>
                    </tr>
                </thead>
                <tbody>
                    ${sabDomTrabajados.map(d => `
                        <tr>
                            <td class="highlight-cell">${d.Fecha} <span class="day-badge-modal weekend">FIN DE SEMANA</span></td>
                            <td style="text-transform: capitalize">${d.Dia}</td>
                            <td class="num highlight-cell">${fmtModal(d.Ingreso)}</td>
                            <td class="num">${fmtModal(d.Meta)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="border-top: 2px solid rgba(255,255,255,0.1)">
                        <td colspan="2"><strong>Total</strong></td>
                        <td class="num highlight-cell"><strong>${fmtModal(sabDomTrabajados.reduce((s, d) => s + d.Ingreso, 0))}</strong></td>
                        <td class="num">${fmtModal(sabDomTrabajados.reduce((s, d) => s + d.Meta, 0))}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    let diasRestantesHtml = '';
    if (diasRestantesList && diasRestantesList.length > 0) {
        diasRestantesHtml = `
            <h3 style="color: var(--text-dark); font-size: 16px; font-weight: 700; margin: 28px 0 16px;">
                Calendario de días restantes
            </h3>
            <p style="color: var(--text-medium); margin-bottom: 16px;">
                Días restantes en ${mes} ${año} desde el día ${ultimoDiaConDatos + 1} hasta el ${diasEnMes}:
            </p>

            <table class="modal-data-table">
                <thead>
                    <tr>
                        <th>Día del mes</th>
                        <th>Día de la semana</th>
                        <th>Tipo</th>
                    </tr>
                </thead>
                <tbody>
                    ${diasRestantesList.map(d => `
                        <tr style="${!d.esHabil ? 'opacity: 0.5' : ''}">
                            <td class="num highlight-cell">${d.dia}</td>
                            <td style="text-transform: capitalize">${d.dow}</td>
                            <td>
                                ${d.esHabil
                                    ? '<span style="color: var(--success-color); font-weight: 600;">✓ HÁBIL</span>'
                                    : '<span class="day-badge-modal weekend">FIN DE SEMANA</span>'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    const html = `
        <div class="modal-stats-grid">
            <div class="modal-stat-card">
                <div class="modal-stat-label">Días Transcurridos</div>
                <div class="modal-stat-value">${diasHabilesTranscurridos}</div>
                <div class="modal-stat-sub">Con datos registrados</div>
            </div>
            <div class="modal-stat-card">
                <div class="modal-stat-label">Días Restantes</div>
                <div class="modal-stat-value">${diasHabilesRestantes}</div>
                <div class="modal-stat-sub">Solo lun-vie futuros</div>
            </div>
            <div class="modal-stat-card" style="border-left-color: var(--primary-color)">
                <div class="modal-stat-label">Total Días Hábiles</div>
                <div class="modal-stat-value" style="color: var(--primary-color)">${diasHabilesTotales}</div>
                <div class="modal-stat-sub">Base de proyecciones</div>
            </div>
        </div>

        <div class="formula-box-modal">
            <span class="formula-label">Cálculo de Días Hábiles Totales</span>
            <code>transcurridos</code> = días con datos reales (sáb/dom trabajados cuentan) = <strong>${diasHabilesTranscurridos}</strong><br>
            <code>restantes</code> = lunes-viernes futuros únicamente = <strong>${diasHabilesRestantes}</strong><br>
            <code>total = ${diasHabilesTranscurridos} + ${diasHabilesRestantes} = <strong>${diasHabilesTotales}</strong></code>
        </div>

        <div class="alert-box-modal info">
            <i class="fas fa-info-circle"></i>
            <div>
                <strong>Importante:</strong><br>
                Solo los días hábiles (lun-vie) se usan para calcular las proyecciones. Los fines de semana no se cuentan 
                a menos que se registren ingresos en ellos, en cuyo caso se consideran días hábiles trabajados.
            </div>
        </div>

        ${sabDomHtml}
        ${diasRestantesHtml}
    `;

    document.getElementById('modalDiasHabilesBody').innerHTML = html;
    document.getElementById('modalDiasHabiles').style.display = 'block';
}

/**
 * Muestra el modal de promedio móvil
 */
function mostrarModalPromedioMovil() {
    const data = window.analyticsData;
    if (!data.promedioMovil) {
        console.warn('No hay datos de promedio móvil disponibles');
        return;
    }

    const { ultimos7, promedioMovil } = data.promedioMovil;
    const { diasHabilesTranscurridos, diasHabilesRestantes, diasHabilesTotales, sabDomTrabajados, mes, año } = data.diasHabiles;

    // Obtener TODOS los días del mes con datos
    const datosMensuales = consolidatedData.filter(d =>
        d.Año === año && d.Mes === mes
    ).sort((a, b) => parseDateModal(a.Fecha) - parseDateModal(b.Fecha));

    // Identificar los últimos 7 días para destacarlos
    const ultimos7Fechas = ultimos7.map(d => d.Fecha);

    const html = `
        <p style="color: var(--text-medium); margin-bottom: 20px; line-height: 1.7;">
            El promedio móvil de 7 días captura la tendencia más reciente y es más sensible a cambios que el promedio simple. 
            Se calcula tomando los últimos 7 días hábiles con datos registrados.
        </p>

        <div class="modal-stats-grid" style="grid-template-columns: repeat(3, 1fr);">
            <div class="modal-stat-card">
                <div class="modal-stat-label">Promedio Móvil 7d</div>
                <div class="modal-stat-value" style="color: var(--primary-color)">${fmtModal(promedioMovil)}</div>
                <div class="modal-stat-sub">Últimos 7 días hábiles</div>
            </div>
            <div class="modal-stat-card">
                <div class="modal-stat-label">Días del Mes</div>
                <div class="modal-stat-value">${diasHabilesTranscurridos} / ${diasHabilesTotales}</div>
                <div class="modal-stat-sub">Transcurridos / Hábiles totales</div>
            </div>
            <div class="modal-stat-card" style="border-left-color: var(--primary-color)">
                <div class="modal-stat-label">Días Restantes</div>
                <div class="modal-stat-value" style="color: var(--primary-color)">${diasHabilesRestantes}</div>
                <div class="modal-stat-sub">Lun-vie futuros</div>
            </div>
        </div>

        <h3 style="color: var(--text-dark); font-size: 16px; font-weight: 700; margin: 28px 0 16px;">
            Todos los días del mes (${mes} ${año})
        </h3>

        <div class="formula-box-modal">
            <span class="formula-label">Cálculo del Promedio Móvil</span>
            <code>promedioMovil = Σ(últimos 7 ingresos) / 7</code><br>
            <code>= (${ultimos7.map(d => fmtModal(d.Ingreso)).join(' + ')}) / 7</code><br>
            <code>= <strong>${fmtModal(promedioMovil)}</strong></code>
        </div>

        <table class="modal-data-table">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Día</th>
                    <th class="num">Ingreso</th>
                    <th class="num">% del promedio</th>
                    <th class="num">Diferencia</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
                ${datosMensuales.map(d => {
                    const pct = ((d.Ingreso / promedioMovil) * 100).toFixed(1);
                    const diff = d.Ingreso - promedioMovil;
                    const colorPct = d.Ingreso >= promedioMovil ? 'var(--success-color)' : 'var(--danger-color)';
                    const fechaObj = parseDateModal(d.Fecha);
                    const dow = fechaObj ? fechaObj.getDay() : -1;
                    const esFinDeSemana = dow === 0 || dow === 6;
                    const esUltimos7 = ultimos7Fechas.includes(d.Fecha);
                    
                    // Estilo de fila: destacar últimos 7
                    const rowStyle = esUltimos7 
                        ? 'background: rgba(99,102,241,0.08); font-weight: 600;' 
                        : 'opacity: 0.6;';
                    
                    return `
                        <tr style="${rowStyle}">
                            <td class="highlight-cell">
                                ${d.Fecha}
                                ${esFinDeSemana ? '<span class="day-badge-modal weekend">FIN DE SEMANA</span>' : ''}
                            </td>
                            <td style="text-transform: capitalize">${d.Dia}</td>
                            <td class="num highlight-cell">${fmtModal(d.Ingreso)}</td>
                            <td class="num" style="color: ${colorPct}">${pct}%</td>
                            <td class="num" style="color: ${colorPct}">${diff >= 0 ? '+' : ''}${fmtModal(diff)}</td>
                            <td style="font-size: 10px;">
                                ${esUltimos7 
                                    ? '<span style="color: var(--primary-color); font-weight: 700;">✓ EN CÁLCULO</span>' 
                                    : '<span style="color: var(--text-light);">Referencia</span>'}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
            <tfoot>
                <tr style="border-top: 2px solid rgba(255,255,255,0.1)">
                    <td colspan="2"><strong>Promedio Móvil (últimos 7)</strong></td>
                    <td class="num highlight-cell" style="color: var(--primary-color)"><strong>${fmtModal(promedioMovil)}</strong></td>
                    <td colspan="3" style="font-size: 11px; color: var(--text-light);">
                        ${sabDomTrabajados.length > 0 
                            ? `Incluye ${sabDomTrabajados.length} fin${sabDomTrabajados.length > 1 ? 'es' : ''} de semana trabajado${sabDomTrabajados.length > 1 ? 's' : ''}`
                            : 'Solo días hábiles (lun-vie)'}
                    </td>
                </tr>
            </tfoot>
        </table>

        <div class="alert-box-modal info">
            <i class="fas fa-lightbulb"></i>
            <div>
                <strong>¿Por qué usar promedio móvil?</strong><br>
                El promedio móvil es útil porque:
                <ul style="margin: 8px 0 0 20px; line-height: 1.8;">
                    <li>Refleja el comportamiento más reciente del negocio</li>
                    <li>Es más sensible a cambios y tendencias actuales</li>
                    <li>Reduce el impacto de valores atípicos antiguos</li>
                    <li>Proporciona una base más realista para proyecciones a corto plazo</li>
                </ul>
                <p style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <strong>Leyenda de la tabla:</strong><br>
                    • Filas <span style="color: var(--primary-color); font-weight: 600;">destacadas</span> = Últimos 7 días hábiles (usados en el cálculo)<br>
                    • Filas <span style="opacity: 0.6;">atenuadas</span> = Días anteriores (solo referencia)<br>
                    • Badge <span class="day-badge-modal weekend" style="font-size: 9px;">FIN DE SEMANA</span> = Sábado o domingo trabajado
                </p>
            </div>
        </div>
    `;

    document.getElementById('modalPromedioMovilBody').innerHTML = html;
    document.getElementById('modalPromedioMovil').style.display = 'block';
}

/**
 * Cierra un modal de analytics
 */
function cerrarModalAnalytics(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

/**
 * Cierra modal al hacer clic fuera de él
 */
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('analytics-modal')) {
        event.target.style.display = 'none';
    }
});

/**
 * Cierra modal con tecla ESC
 */
window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        document.querySelectorAll('.analytics-modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
});
