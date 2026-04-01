// Procesamiento de escaneos

async function processScan(code) {
  if (!AppState.sessionActive) return;
  
  DOM.input.value = "";
  
  DOM.status.className = "status searching";
  DOM.status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
  
  try {
    const { data: barra, error } = await supabaseClient
      .from('BARRAS')
      .select('*')
      .eq('barcode', code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        UIManager.showError("Código no encontrado");
      } else {
        throw error;
      }
      AudioManager.playBeep(400, 200);
      return;
    }

    const { data: colorData } = await supabaseClient
      .from('COLORES')
      .select('color')
      .eq('id_color', barra.id_color)
      .maybeSingle();

    const item = {
      barcode: code,
      referencia: barra.referencia,
      talla: barra.talla,
      color: colorData?.color || "Sin color",
      id_color: barra.id_color,
      timestamp: new Date()
    };

    DataManager.addToConsolidated(item);
    UIManager.showSuccess(item);
    updateStats();
    UIManager.renderConsolidated();
    AudioManager.playBeep(1000, 100);
    
  } catch (err) {
    console.error(err);
    UIManager.showError("Error al procesar");
    AudioManager.playBeep(400, 200);
  }
}
