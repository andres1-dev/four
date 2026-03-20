let mostrarParciales = false;

function toggleParciales() {
    mostrarParciales = !mostrarParciales;
    const btn = document.getElementById('toggleParcialesBtn');
    const group = document.getElementById('optgroupParciales');
    if (group) group.hidden = !mostrarParciales;
    if (btn) {
        btn.classList.toggle('active', mostrarParciales);
        btn.innerHTML = mostrarParciales
            ? '<i class="fa-solid fa-code-branch"></i> Ocultar parciales'
            : '<i class="fa-solid fa-code-branch"></i> Ver posibles parciales';
    }
}

function displayResultsSummary(data) {
    const resultsContent = document.getElementById('resultsContent');

    const pendientes = data.filter(item => item.ESTADO === 'PENDIENTE');
    const unidadesPendientes = pendientes.reduce((sum, item) => sum + item.CANTIDAD, 0);
    const opsPendientes = new Set(pendientes.map(item => item.OP)).size;

    const totalUnidades = data.reduce((sum, item) => sum + item.CANTIDAD, 0);
    const totalOPs = new Set(data.map(item => item.OP)).size;

    resultsContent.innerHTML = `
        <div class="results-grid">
            <div class="result-card">
                <div class="result-icon success"><i class="fa-solid fa-cubes"></i></div>
                <div class="result-info">
                    <div class="result-value">${totalUnidades.toLocaleString('es-CO')}</div>
                    <div class="result-label">Unidades Totales</div>
                </div>
            </div>
            <div class="result-card">
                <div class="result-icon info"><i class="fa-solid fa-layer-group"></i></div>
                <div class="result-info">
                    <div class="result-value">${totalOPs}</div>
                    <div class="result-label">OPs Totales</div>
                </div>
            </div>
            <div class="result-card">
                <div class="result-icon warning"><i class="fa-solid fa-boxes-stacked"></i></div>
                <div class="result-info">
                    <div class="result-value">${unidadesPendientes.toLocaleString('es-CO')}</div>
                    <div class="result-label">Unidades Pendientes</div>
                </div>
            </div>
            <div class="result-card">
                <div class="result-icon error"><i class="fa-solid fa-clock-rotate-left"></i></div>
                <div class="result-info">
                    <div class="result-value">${opsPendientes}</div>
                    <div class="result-label">OPs Pendientes</div>
                </div>
            </div>
        </div>
    `;
}

function setupPendientesSection(pendientes) {
    const selectOP = document.getElementById('selectOP');
    selectOP.innerHTML = '<option value="">Seleccione una OP...</option>';

    const opGroups = {};
    pendientes.forEach(item => {
        const key = item.OP_SUFIJO || item.OP;
        if (!opGroups[key]) {
            opGroups[key] = {
                op: item.OP,
                opSufijo: item.OP_SUFIJO || item.OP,
                esParcial: item.ES_PARCIAL || false,
                referencia: item.REFERENCIA,
                prenda: item.PRENDA,
                usuario: item.USUARIO,
                fecha: item.FECHA,
                cantidad: 0,
                total: parseInt(item.TOTAL) || 0,
                items: []
            };
        }
        opGroups[key].cantidad += item.CANTIDAD;
        opGroups[key].items.push(item);
    });

    const nuevas   = Object.values(opGroups).filter(g => !g.esParcial);
    const parciales = Object.values(opGroups).filter(g => g.esParcial);

    // Notificación si hay parciales
    if (parciales.length > 0) {
        const lista = parciales.map(g => `${g.opSufijo} (${g.fecha})`).join(', ');
        showMessage(`⚠ ${parciales.length} posible(s) parcial(es): ${lista}`, 'warning', 6000);
    }

    const buildOption = (grupo) => {
        const diferencia = grupo.total - grupo.cantidad;
        const option = document.createElement('option');
        option.value = grupo.op;
        const primerItem = grupo.items[0];
        const tieneSispro = sisproMap.has(grupo.op.trim());
        const tieneColor = !primerItem.COD_COLOR || coloresMap.has(primerItem.COD_COLOR.trim());

        if (!tieneSispro || !tieneColor) {
            option.disabled = true;
            option.textContent = `✗ OP: ${grupo.opSufijo} — DESHABILITADA`;
        } else {
            const estadoIcono = diferencia === 0 ? '✓ ' : '';
            const diferenciaTexto = diferencia !== 0 ? ` ${diferencia > 0 ? '-' : '+'}${Math.abs(diferencia)}` : '';
            option.textContent = `${estadoIcono}OP: ${grupo.opSufijo} | ${grupo.fecha} | ${grupo.referencia} | ${grupo.prenda} | ${grupo.usuario} | ${grupo.cantidad}/${grupo.total}${diferenciaTexto}`;
        }
        if (grupo.esParcial) option.dataset.parcial = 'true';
        option.dataset.items = JSON.stringify(grupo.items);
        return option;
    };

    // Grupo OPs nuevas
    if (nuevas.length > 0) {
        const groupNuevas = document.createElement('optgroup');
        groupNuevas.label = `OPs Nuevas (${nuevas.length})`;
        nuevas.forEach(g => groupNuevas.appendChild(buildOption(g)));
        selectOP.appendChild(groupNuevas);
    }

    // Grupo parciales — oculto por defecto
    if (parciales.length > 0) {
        const groupParciales = document.createElement('optgroup');
        groupParciales.label = `Posibles Parciales (${parciales.length})`;
        groupParciales.id = 'optgroupParciales';
        groupParciales.hidden = !mostrarParciales;
        parciales.forEach(g => groupParciales.appendChild(buildOption(g)));
        selectOP.appendChild(groupParciales);
    }

    // Resetear botón
    mostrarParciales = false;
    const btn = document.getElementById('toggleParcialesBtn');
    if (btn) {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-solid fa-code-branch"></i> Ver posibles parciales';
        if (parciales.length === 0) btn.style.display = 'none';
        else btn.style.display = '';
    }
}