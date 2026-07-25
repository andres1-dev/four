/**
 * Main.js - Orquestador de la UI para la Migración Global
 */
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const resultsArea = document.getElementById('resultsArea');
    const jsonContent = document.getElementById('jsonContent');
    const rowCount = document.getElementById('rowCount');

    let rawData = [];
    let excelWorker = null;

    // Manejo de Archivos
    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        handleFile(e.dataTransfer.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border)';
    });

    // Inicializar Worker
    function initWorker() {
        if (!excelWorker) {
            excelWorker = new Worker('js/excel-worker.js');
            excelWorker.onmessage = (e) => {
                const { success, data, headers, count, error } = e.data;
                showLoader(false);

                if (success) {
                    rawData = data;
                    renderUI(data, headers);
                } else {
                    console.error('Error en worker', error);
                    alert('Error procesando el archivo: ' + error);
                }
            };
        }
    }

    async function handleFile(file) {
        if (!file) return;
        
        initWorker();
        showLoader(true, 'Analizando estructura...');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            excelWorker.postMessage({ 
                type: 'PARSE', 
                data: e.target.result 
            });
        };
        reader.readAsArrayBuffer(file);
    }

    function renderUI(data, headers) {
        resultsArea.style.display = 'grid';
        rowCount.textContent = `${data.length} filas cargadas`;
        
        // Vista previa limitada para no saturar el DOM (JSON)
        jsonContent.textContent = JSON.stringify(data.slice(0, 100), null, 2);
        
        renderTable(data, headers);
    }

    function renderTable(data, headers) {
        if (!data || data.length === 0) return;
        
        const tableHeader = document.getElementById('tableHeader');
        const tableBody = document.getElementById('tableBody');
        
        const cols = headers || Object.keys(data[0]);
        tableHeader.innerHTML = `<tr>${cols.map(h => `<th>${h}</th>`).join('')}</tr>`;
        
        // Renderizar solo las primeras 100 filas para previsualización rápida
        tableBody.innerHTML = data.slice(0, 100).map(row => {
            return `<tr>${cols.map(h => `<td>${row[h] !== undefined ? row[h] : ''}</td>`).join('')}</tr>`;
        }).join('');
    }

    function showLoader(show, message = 'Procesando...') {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
            const msgEl = loader.querySelector('p');
            if (msgEl) msgEl.textContent = message;
        }
    }
});
