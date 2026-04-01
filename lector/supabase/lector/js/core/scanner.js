// Procesamiento de escaneos

async function processScan(code) {
  if (!AppState.sessionActive) return;
  
  DOM.input.value = "";
  
  DOM.status.className = "status searching";
  DOM.status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
  
  try {
    // Buscar en los detalles de la OP
    // Estructura: [id_color, color, referencia, talla, cantidad, barcode]
    const detail = AppState.opDetails.find(d => d[5] === code);

    if (!detail) {
      UIManager.showError("Código no encontrado en esta OP");
      AudioManager.playBeep(400, 200);
      return;
    }

    const item = {
      barcode: code,
      id_color: detail[0],
      color: detail[1],
      referencia: detail[2],
      talla: detail[3],
      cantidad_esperada: detail[4],
      timestamp: new Date()
    };

    // Verificar si ya se alcanzó el límite
    const key = `${item.id_color}-${item.talla}`;
    const current = AppState.consolidated.get(key);
    
    if (current && current.count >= item.cantidad_esperada) {
      UIManager.showError(`Límite alcanzado para ${item.color} - ${item.talla} (${item.cantidad_esperada})`);
      AudioManager.playBeep(400, 300);
      return;
    }

    DataManager.addToConsolidated(item);
    UIManager.showSuccess(item);
    updateStats();
    UIManager.updateCurvaTable();
    AudioManager.playBeep(1000, 100);
    
  } catch (err) {
    console.error(err);
    UIManager.showError("Error al procesar");
    AudioManager.playBeep(400, 200);
  }
}
