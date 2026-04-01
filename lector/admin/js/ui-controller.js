// Control de interfaz de usuario

const UIController = {
  showFileName(name) {
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    
    fileName.textContent = name;
    fileInfo.classList.remove('hidden');
  },

  hideFileName() {
    document.getElementById('fileInfo').classList.add('hidden');
  },

  showLoading(message) {
    let loadingDiv = document.getElementById('loadingOverlay');
    
    if (!loadingDiv) {
      loadingDiv = document.createElement('div');
      loadingDiv.id = 'loadingOverlay';
      loadingDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;
      
      loadingDiv.innerHTML = `
        <div id="loadingContent" style="background: white; padding: 40px 60px; border-radius: 8px; text-align: center; min-width: 400px; max-width: 600px;">
          <div id="loadingSpinner">
            <i class="fas fa-spinner fa-spin" style="font-size: 56px; color: #2e7d32; margin-bottom: 25px;"></i>
            <p id="loadingMessage" style="font-size: 17px; color: #333; margin: 0; font-weight: 500; line-height: 1.6; white-space: pre-line;"></p>
          </div>
          <div id="resultContent" style="display: none;"></div>
        </div>
      `;
      
      document.body.appendChild(loadingDiv);
    }
    
    // Mostrar spinner y ocultar resultado
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('resultContent').style.display = 'none';
    document.getElementById('loadingMessage').textContent = message;
    loadingDiv.style.display = 'flex';
  },

  updateLoadingMessage(message) {
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
      loadingMessage.textContent = message;
    }
  },

  hideLoading() {
    const loadingDiv = document.getElementById('loadingOverlay');
    if (loadingDiv) {
      loadingDiv.style.display = 'none';
    }
  },

  showResultInModal(results) {
    const loadingDiv = document.getElementById('loadingOverlay');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const resultContent = document.getElementById('resultContent');
    
    // Ocultar spinner
    loadingSpinner.style.display = 'none';
    
    // Calcular totales
    const totalProcessed = results.success + results.failed;
    const duplicates = results.duplicates || 0;
    
    // Determinar si fue exitoso
    const isSuccess = results.failed === 0;
    const iconClass = isSuccess ? 'success' : 'error';
    const iconHtml = isSuccess 
      ? '<i class="fas fa-check-circle"></i>' 
      : '<i class="fas fa-exclamation-circle"></i>';
    const titleText = isSuccess 
      ? '¡Carga Completada Exitosamente!' 
      : 'Carga Completada con Errores';
    
    // Construir HTML del resultado
    resultContent.innerHTML = `
      <div class="modal-result-icon ${iconClass}">
        ${iconHtml}
      </div>
      <h2 class="modal-result-title">${titleText}</h2>
      
      <div class="modal-result-summary">
        <div class="modal-summary-item total">
          <i class="fas fa-file-excel"></i>
          <strong>${totalProcessed.toLocaleString()}</strong>
          <span>Total Procesados</span>
        </div>
        <div class="modal-summary-item success">
          <i class="fas fa-check-circle"></i>
          <strong>${results.success.toLocaleString()}</strong>
          <span>Subidos</span>
        </div>
        <div class="modal-summary-item duplicate">
          <i class="fas fa-copy"></i>
          <strong>${duplicates.toLocaleString()}</strong>
          <span>Repetidos</span>
        </div>
        ${results.failed > 0 ? `
        <div class="modal-summary-item error">
          <i class="fas fa-exclamation-circle"></i>
          <strong>${results.failed.toLocaleString()}</strong>
          <span>Errores</span>
        </div>
        ` : ''}
      </div>
      
      ${results.errors.length > 0 ? `
      <div class="modal-error-details">
        <h4>Detalles de Errores:</h4>
        <ul>
          ${results.errors.slice(0, 10).map(err => `<li>${err}</li>`).join('')}
          ${results.errors.length > 10 ? `<li>... y ${results.errors.length - 10} errores más</li>` : ''}
        </ul>
      </div>
      ` : ''}
      
      <button class="btn btn-primary btn-large" onclick="closeResultModal()" style="margin-top: 25px;">
        <i class="fas fa-check"></i> Aceptar
      </button>
    `;
    
    // Mostrar resultado
    resultContent.style.display = 'block';
    loadingDiv.style.display = 'flex';
  },

  showProgress(stats) {
    // Actualizar el modal en lugar de mostrar sección separada
    UIController.updateLoadingMessage(
      `Preparando subida...\n\n` +
      `Total en Excel: ${stats.total.toLocaleString()}\n` +
      `Nuevos a subir: ${stats.valid.toLocaleString()}\n` +
      `Repetidos (omitidos): ${stats.duplicates.toLocaleString()}`
    );
  },

  updateProgress(current, total, percentage) {
    // Actualizar el modal con el progreso
    UIController.updateLoadingMessage(
      `Subiendo a base de datos...\n\n` +
      `Progreso: ${percentage}%\n` +
      `${current.toLocaleString()} de ${total.toLocaleString()} registros`
    );
  },

  hideProgress() {
    // No hacer nada, el modal se encarga
  },

  showResults(results) {
    // Mostrar resultado en el modal (no ocultar progreso porque no existe)
    this.showResultInModal(results);
  }
};

function resetUpload() {
  document.getElementById('fileInput').value = '';
  FileHandler.clear();
  UIController.hideFileName();
}

function closeResultModal() {
  UIController.hideLoading();
  resetUpload();
}
