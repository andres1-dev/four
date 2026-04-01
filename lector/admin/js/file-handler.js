// Manejo de archivos Excel

const FileHandler = {
  currentFile: null,
  parsedData: null,

  handleFile(file) {
    if (!this.validateFile(file)) {
      return false;
    }

    this.currentFile = file;
    UIController.showFileName(file.name);
    
    // Mostrar loading inmediatamente
    UIController.showLoading('Leyendo archivo Excel...');
    
    // Pequeña pausa para que se muestre el loading
    setTimeout(() => {
      this.readFile(file);
    }, 100);
    
    return true;
  },

  validateFile(file) {
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!validTypes.includes(file.type) && 
        !file.name.endsWith('.xls') && 
        !file.name.endsWith('.xlsx')) {
      alert('Por favor selecciona un archivo Excel válido (.xls o .xlsx)');
      return false;
    }

    return true;
  },

  readFile(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        UIController.updateLoadingMessage('Procesando archivo Excel...');
        
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        UIController.updateLoadingMessage('Extrayendo datos...');
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
          header: 1,
          defval: null 
        });

        this.parsedData = this.extractColumns(jsonData);
        
        UIController.updateLoadingMessage(`${this.parsedData.length.toLocaleString()} registros encontrados. Iniciando validación...`);
        
        // Pequeña pausa para mostrar el mensaje
        setTimeout(() => {
          uploadToDatabase();
        }, 500);
        
      } catch (error) {
        console.error('Error al leer el archivo:', error);
        UIController.hideLoading();
        alert('Error al procesar el archivo Excel: ' + error.message);
        resetUpload();
      }
    };

    reader.onerror = () => {
      UIController.hideLoading();
      alert('Error al leer el archivo');
      resetUpload();
    };

    reader.readAsArrayBuffer(file);
  },

  extractColumns(data) {
    const result = [];
    const startRow = 1;

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      
      const record = {
        rowNumber: i + 1,
        referencia: row[AdminConfig.COLUMNS.REFERENCIA],
        talla: row[AdminConfig.COLUMNS.TALLA],
        id_color: row[AdminConfig.COLUMNS.ID_COLOR],
        barcode: row[AdminConfig.COLUMNS.BARCODE]
      };

      result.push(record);
    }

    return result;
  },

  clear() {
    this.currentFile = null;
    this.parsedData = null;
  }
};

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    FileHandler.handleFile(file);
  }
}

function clearFile() {
  document.getElementById('fileInput').value = '';
  FileHandler.clear();
  UIController.hideFileName();
}
