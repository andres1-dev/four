// Gestión de datos

const DataManager = {
  addToConsolidated(item) {
    const key = `${item.id_color}-${item.talla}`;
    
    if (AppState.consolidated.has(key)) {
      const existing = AppState.consolidated.get(key);
      existing.count++;
      existing.lastScan = item.timestamp;
    } else {
      AppState.consolidated.set(key, {
        ...item,
        count: 1,
        firstScan: item.timestamp,
        lastScan: item.timestamp
      });
    }
    
    AppState.totalScans++;
    AppState.scanTimes.push(Date.now());
    AppState.lastScan = item;
    
    const oneMinuteAgo = Date.now() - 60000;
    AppState.scanTimes = AppState.scanTimes.filter(t => t > oneMinuteAgo);
  },

  clearAll() {
    if (AppState.consolidated.size === 0) return;
    
    if (confirm('¿Estás seguro de que quieres limpiar todos los datos?')) {
      AppState.consolidated.clear();
      AppState.totalScans = 0;
      AppState.scanTimes = [];
      AppState.lastScan = null;
      
      updateStats();
      UIManager.updateCurvaTable();
      
      DOM.exportCsvBtn.disabled = true;
      DOM.exportJsonBtn.disabled = true;
      
      AudioManager.playBeep(600, 100);
    }
  }
};

function updateStats() {
  document.getElementById("totalScans").textContent = AppState.totalScans;
  document.getElementById("uniqueItems").textContent = AppState.consolidated.size;
  document.getElementById("scanSpeed").textContent = AppState.scanTimes.length;
}
