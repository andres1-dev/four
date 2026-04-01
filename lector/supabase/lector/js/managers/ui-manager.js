// Gestión de interfaz de usuario

const UIManager = {
  showSuccess(item) {
    DOM.status.className = "status success flash";
    DOM.status.innerHTML = `<i class="fas fa-check-circle"></i> ${item.color} - ${item.talla} escaneado`;
    
    setTimeout(() => {
      DOM.status.className = "status";
      DOM.status.innerHTML = '<i class="fas fa-qrcode"></i> Listo para escanear';
    }, 1500);
  },

  showError(message) {
    DOM.status.className = "status error flash";
    DOM.status.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    
    setTimeout(() => {
      DOM.status.className = "status";
      DOM.status.innerHTML = '<i class="fas fa-qrcode"></i> Listo para escanear';
    }, 2000);
  },

  renderCurvaTable() {
    if (!AppState.opDetails || AppState.opDetails.length === 0) {
      DOM.curvaTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <i class="fas fa-inbox"></i>
            No hay detalles de curva
          </td>
        </tr>
      `;
      return;
    }

    // Agrupar por color y talla
    const rows = AppState.opDetails.map(detail => {
      const [id_color, color, referencia, talla, cantidad, barcode] = detail;
      const key = `${id_color}-${talla}`;
      const scanned = AppState.consolidated.get(key);
      const contado = scanned ? scanned.count : 0;
      const faltante = cantidad - contado;
      const percentage = Math.round((contado / cantidad) * 100);
      
      let rowClass = '';
      if (contado >= cantidad) rowClass = 'complete';
      if (contado > cantidad) rowClass = 'over-limit';
      
      return {
        key,
        id_color,
        color,
        talla,
        cantidad,
        contado,
        faltante,
        percentage,
        rowClass
      };
    });

    DOM.curvaTableBody.innerHTML = rows.map(row => `
      <tr class="${row.rowClass}" data-key="${row.key}">
        <td class="color-cell">${row.color}</td>
        <td class="talla-cell">${row.talla}</td>
        <td class="number-cell esperado-cell">${row.cantidad}</td>
        <td class="number-cell contado-cell">${row.contado}</td>
        <td class="number-cell faltante-cell">${row.faltante}</td>
        <td class="progress-cell">
          <div class="progress-bar-mini">
            <div class="progress-bar-mini-fill ${row.percentage >= 100 ? 'complete' : ''} ${row.percentage > 100 ? 'over' : ''}" 
                 style="width: ${Math.min(row.percentage, 100)}%"></div>
          </div>
          <div class="progress-text-mini">${row.percentage}%</div>
        </td>
      </tr>
    `).join('');
  },

  updateCurvaTable() {
    if (!AppState.opDetails || AppState.opDetails.length === 0) return;

    AppState.opDetails.forEach(detail => {
      const [id_color, color, referencia, talla, cantidad, barcode] = detail;
      const key = `${id_color}-${talla}`;
      const scanned = AppState.consolidated.get(key);
      const contado = scanned ? scanned.count : 0;
      const faltante = cantidad - contado;
      const percentage = Math.round((contado / cantidad) * 100);
      
      const row = DOM.curvaTableBody.querySelector(`tr[data-key="${key}"]`);
      if (!row) return;
      
      // Actualizar clase
      row.className = '';
      if (contado >= cantidad) row.classList.add('complete');
      if (contado > cantidad) row.classList.add('over-limit');
      
      // Actualizar valores
      row.querySelector('.contado-cell').textContent = contado;
      row.querySelector('.faltante-cell').textContent = faltante;
      
      // Actualizar barra de progreso
      const progressFill = row.querySelector('.progress-bar-mini-fill');
      progressFill.style.width = Math.min(percentage, 100) + '%';
      progressFill.className = 'progress-bar-mini-fill';
      if (percentage >= 100) progressFill.classList.add('complete');
      if (percentage > 100) progressFill.classList.add('over');
      
      row.querySelector('.progress-text-mini').textContent = percentage + '%';
      
      // Animación flash
      row.style.animation = 'flash 0.3s';
      setTimeout(() => {
        row.style.animation = '';
      }, 300);
    });
  }
};
