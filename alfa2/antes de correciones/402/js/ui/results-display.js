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
    const pendientes = data.filter(item => item.ESTADO === 'PENDIENTE');
    const unidadesPendientes = pendientes.reduce((sum, item) => sum + item.CANTIDAD, 0);
    const opsPendientes = new Set(pendientes.map(item => item.OP)).size;

    updateStatusBarSummary(unidadesPendientes, opsPendientes);
}

/**
 * Actualiza el status-bar con información en tiempo real
 * Puede ser llamada desde cualquier módulo para reflejar cambios inmediatos
 */
function updateStatusBarSummary(unidadesPendientes, opsPendientes) {
    const statusMessage = document.getElementById('statusMessage');
    const statusIcon = document.getElementById('statusIcon');
    
    // Actualizar icono (quitar loading spinner si existe)
    if (statusIcon) {
        statusIcon.className = 'status-icon codicon codicon-warning';
    }
    
    if (statusMessage) {
        statusMessage.textContent = `Pendientes: ${unidadesPendientes.toLocaleString('es-CO')} unidades • ${opsPendientes} OPs`;
    }
}

/**
 * Recalcula y actualiza el status-bar basándose en el select de OPs pendientes
 * Útil para actualizaciones en tiempo real después de guardar una OP
 */
function updateStatusBarFromSelect() {
    const selectOP = document.getElementById('selectOP');
    if (!selectOP) return;

    // Contar OPs pendientes desde el select (excluyendo la opción por defecto)
    let opsPendientes = 0;
    let unidadesPendientes = 0;

    for (let i = 0; i < selectOP.options.length; i++) {
        const option = selectOP.options[i];
        if (option.value && option.dataset.items) {
            try {
                const items = JSON.parse(option.dataset.items);
                opsPendientes++;
                unidadesPendientes += items.reduce((sum, item) => sum + (parseInt(item.CANTIDAD) || 0), 0);
            } catch (e) {
                // Ignorar opciones con datos inválidos
            }
        }
    }

    updateStatusBarSummary(unidadesPendientes, opsPendientes);
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
                tipoValidacion: item.TIPO_VALIDACION || 'NUEVO',
                mensajeValidacion: item.MENSAJE_VALIDACION || '',
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

    const todasLasOPs = Object.values(opGroups);
    const parciales = todasLasOPs.filter(g => g.esParcial);

    // Notificación si hay parciales
    if (parciales.length > 0) {
        const lista = parciales.map(g => `${g.opSufijo} (${g.fecha})`).join(', ');
        showMessage(`${parciales.length} parcial(es) detectados: ${lista}`, 'warning', 6000);
    }

    const buildOption = (grupo) => {
        const diferencia = grupo.total - grupo.cantidad;
        const option = document.createElement('option');
        option.value = grupo.op;
        const primerItem = grupo.items[0];
        
        // Validar color — para BUSINT/Excel el COD_COLOR es código de barras, no está en coloresMap → siempre válido
        const tieneColor = primerItem.FUENTE === 'BUSINT'
            || !primerItem.COD_COLOR
            || coloresMap.has(primerItem.COD_COLOR.trim());

        if (!tieneColor) {
            option.disabled = true;
            option.textContent = `✗ OP: ${grupo.opSufijo} — DESHABILITADA (Color faltante)`;
        } else {
            let icono = '';
            if (grupo.esParcial) icono = '↳ ';
            else if (diferencia === 0) icono = '✔ ';
            
            const diferenciaTexto = diferencia !== 0 ? ` ${diferencia > 0 ? '-' : '+'}${Math.abs(diferencia)}` : '';
            
            option.textContent = `${icono}OP: ${grupo.opSufijo} | ${grupo.fecha} | ${grupo.referencia} | ${grupo.prenda} | ${grupo.usuario} | ${grupo.cantidad}/${grupo.total}${diferenciaTexto}`;
        }
        
        // Agregar clase CSS para parciales
        if (grupo.esParcial) {
            option.classList.add('op-parcial');
            option.dataset.parcial = 'true';
        }
        
        option.dataset.tipoValidacion = grupo.tipoValidacion;
        option.dataset.mensajeValidacion = grupo.mensajeValidacion;
        option.dataset.items = JSON.stringify(grupo.items);
        return option;
    };

    // Agregar todas las OPs directamente (sin optgroups)
    todasLasOPs.forEach(g => selectOP.appendChild(buildOption(g)));

    // Ocultar botón de toggle parciales (ya no es necesario)
    const btn = document.getElementById('toggleParcialesBtn');
    if (btn) btn.style.display = 'none';
}