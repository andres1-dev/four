// Gestión de interfaz de usuario

const UIManager = {
  showSuccess(item) {
    DOM.status.className = "status success flash";
    DOM.status.innerHTML = `<i class="fas fa-check-circle"></i> ¡Escaneado correctamente!`;
    
    DOM.lastScanArea.innerHTML = `
      <div class="last-scan pulse">
        <div class="info-row">
          <strong><i class="fas fa-tag"></i> Referencia:</strong>
          <span>${item.referencia}</span>
        </div>
        <div class="info-row">
          <strong><i class="fas fa-ruler"></i> Talla:</strong>
          <span>${item.talla}</span>
        </div>
        <div class="info-row">
          <strong><i class="fas fa-palette"></i> Color:</strong>
          <span>${item.color}</span>
        </div>
        <div class="info-row">
          <strong><i class="fas fa-barcode"></i> Código:</strong>
          <span>${item.barcode}</span>
        </div>
      </div>
    `;
    
    setTimeout(() => {
      DOM.status.className = "status";
      DOM.status.innerHTML = '<i class="fas fa-qrcode"></i> Listo para escanear';
    }, 2000);
  },

  showError(message) {
    DOM.status.className = "status error flash";
    DOM.status.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    
    setTimeout(() => {
      DOM.status.className = "status";
      DOM.status.innerHTML = '<i class="fas fa-qrcode"></i> Listo para escanear';
    }, 2000);
  },

  renderConsolidated() {
    if (AppState.consolidated.size === 0) {
      DOM.consolidatedList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-box-open"></i>
          No hay items escaneados
        </div>
      `;
      return;
    }

    const items = Array.from(AppState.consolidated.values())
      .sort((a, b) => b.count - a.count);

    DOM.consolidatedList.innerHTML = items.map(item => `
      <div class="item-card">
        <div class="item-header">
          <span class="item-ref"><i class="fas fa-box"></i> ${item.referencia}</span>
          <span class="item-count">${item.count}</span>
        </div>
        <div class="item-details">
          <span><i class="fas fa-ruler"></i> ${item.talla}</span>
          <span><i class="fas fa-palette"></i> ${item.color}</span>
          <span><i class="fas fa-clock"></i> ${Utils.formatTime(item.lastScan)}</span>
        </div>
      </div>
    `).join('');
  }
};
