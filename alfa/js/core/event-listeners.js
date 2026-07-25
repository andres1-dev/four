function setupEventListeners() {
    setupFileUploadListeners();
    setupButtonListeners();
}

function setupFileUploadListeners() {
    const fileInput = document.getElementById('csvFile');
    const uploadBox = document.getElementById('uploadBox');

    if (!fileInput || !uploadBox) return;

    // Hacer que todo el upload-box sea clickeable
    uploadBox.addEventListener('click', function (e) {
        // Evitar que el click en el input file dispare dos veces
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });

    // Agregar cursor pointer para indicar que es clickeable
    uploadBox.style.cursor = 'pointer';

    fileInput.addEventListener('change', async function (e) {
        if (e.target.files.length > 0) {
            const fileName = e.target.files[0].name;
            updateStatus(`Archivo seleccionado: ${fileName}`, 'success');
            showMessage(`Archivo "${fileName}" cargado. Procesando automáticamente...`, 'success', 2000);
            setTimeout(() => processCSV(), 500);
        }
    });

    uploadBox.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadBox.style.borderColor = 'var(--primary)';
        uploadBox.style.backgroundColor = 'var(--hover)';
    });

    uploadBox.addEventListener('dragleave', function (e) {
        e.preventDefault();
        uploadBox.style.borderColor = 'var(--border)';
        uploadBox.style.backgroundColor = 'transparent';
    });

    uploadBox.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadBox.style.borderColor = 'var(--border)';
        uploadBox.style.backgroundColor = 'transparent';

        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            const fileName = e.dataTransfer.files[0].name;
            updateStatus(`Archivo listo: ${fileName}`, 'success');
            showMessage(`Archivo "${fileName}" cargado. Procesando automáticamente...`, 'success', 2000);
            setTimeout(() => processCSV(), 500);
        }
    });
}

function setupButtonListeners() {
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', showSettingsModal);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    console.log('Logout button found:', logoutBtn); // Debug
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
        console.log('Logout event listener attached'); // Debug
    }

    const exportBtn = document.getElementById('exportCancelledBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportCancelledTransfers);
    }

    const importBtn = document.getElementById('importCancelledBtn');
    if (importBtn) {
        importBtn.addEventListener('click', importCancelledTransfers);
    }
}

function handleLogout() {
    console.log('handleLogout called'); // Debug
    const confirmed = confirm('¿Estás seguro de que deseas cerrar sesión?');
    console.log('User confirmed:', confirmed); // Debug
    if (confirmed) {
        // Limpiar sessionStorage
        sessionStorage.removeItem('supabase_token');
        sessionStorage.removeItem('supabase_user');
        
        // Mostrar mensaje
        if (typeof showMessage === 'function') {
            showMessage('Sesión cerrada correctamente', 'success', 1500);
        }
        
        // Redirigir al login después de un breve delay
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    }
}

// ============================================
// EXPORTS
// ============================================

window.setupEventListeners = setupEventListeners;
window.handleLogout = handleLogout;