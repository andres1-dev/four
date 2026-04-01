// Gestión de sesión

function startSession() {
  AppState.sessionActive = true;
  AppState.sessionStartTime = new Date();
  AppState.sessionEndTime = null;
  
  DOM.startBtn.disabled = true;
  DOM.endBtn.disabled = false;
  DOM.input.disabled = false;
  DOM.input.focus();
  
  DOM.status.className = "status";
  DOM.status.innerHTML = '<i class="fas fa-qrcode"></i> Listo para escanear';
  
  AppState.timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
  
  AudioManager.playBeep(1000, 100);
}

function endSession() {
  if (!confirm('¿Finalizar la sesión de conteo?')) return;
  
  AppState.sessionActive = false;
  AppState.sessionEndTime = new Date();
  
  DOM.startBtn.disabled = false;
  DOM.endBtn.disabled = true;
  DOM.input.disabled = true;
  DOM.input.value = "";
  
  DOM.status.className = "status idle";
  DOM.status.innerHTML = '<i class="fas fa-check-circle"></i> Sesión finalizada';
  
  if (AppState.timerInterval) {
    clearInterval(AppState.timerInterval);
    AppState.timerInterval = null;
  }
  
  if (AppState.consolidated.size > 0) {
    DOM.exportCsvBtn.disabled = false;
    DOM.exportJsonBtn.disabled = false;
    DOM.clearBtn.disabled = false;
  }
  
  AudioManager.playBeep(800, 150);
}

function updateTimer() {
  if (!AppState.sessionStartTime) return;
  
  const now = AppState.sessionEndTime || new Date();
  const diff = now - AppState.sessionStartTime;
  
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  DOM.sessionTimer.textContent = 
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
