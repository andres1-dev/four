// Subida a base de datos vía CSV

const DatabaseUploader = {
  async uploadCSV(csvContent) {
    try {
      // Parsear CSV
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',');
      
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = this.parseCSVLine(lines[i]);
        records.push({
          referencia: values[0],
          talla: values[1],
          id_color: values[2],
          barcode: values[3]
        });
      }

      // Insertar en lotes
      const results = {
        total: records.length,
        success: 0,
        failed: 0,
        errors: []
      };

      const batchSize = 100;
      const batches = this.createBatches(records, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        try {
          const { data, error } = await supabaseAdmin
            .from('BARRAS')
            .insert(batch);

          if (error) throw error;

          results.success += batch.length;
          
        } catch (error) {
          console.error('Error en lote:', error);
          results.failed += batch.length;
          results.errors.push(`Lote ${i + 1}: ${error.message}`);
        }

        // Actualizar progreso
        const progress = Math.round(((i + 1) / batches.length) * 100);
        UIController.updateProgress(results.success + results.failed, results.total, progress);
        
        // Pausa entre lotes
        if (i < batches.length - 1) {
          await this.delay(100);
        }
      }

      return results;
      
    } catch (error) {
      console.error('Error subiendo CSV:', error);
      throw error;
    }
  },

  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  },

  createBatches(array, size) {
    const batches = [];
    for (let i = 0; i < array.length; i += size) {
      batches.push(array.slice(i, i + size));
    }
    return batches;
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Función global para subir (ahora automática)
async function uploadToDatabase() {
  if (!FileHandler.parsedData) {
    alert('No hay datos para subir');
    return;
  }

  try {
    UIController.showLoading('Cargando base de datos...');

    const existingCount = await DataValidator.loadExistingBarcodes();
    console.log(`Cargados ${existingCount} barcodes existentes`);

    UIController.updateLoadingMessage('Validando registros...');
    const validatedData = DataValidator.validate(FileHandler.parsedData);
    const stats = DataValidator.getStats(validatedData);

    UIController.hideLoading();

    if (stats.valid === 0) {
      alert(`No hay registros nuevos para subir.\n\n` +
            `Total: ${stats.total.toLocaleString()}\n` +
            `Duplicados: ${stats.duplicates.toLocaleString()}\n` +
            `Errores: ${stats.errors.toLocaleString()}`);
      resetUpload();
      return;
    }

    const validRecords = DataValidator.getValidRecords(validatedData);
    const csvContent = CSVGenerator.generate(validRecords);

    UIController.showProgress(stats);

    const results = await DatabaseUploader.uploadCSV(csvContent);
    
    // Agregar duplicados al resultado
    results.duplicates = stats.duplicates;
    
    UIController.showResults(results);

  } catch (error) {
    console.error('Error en la carga:', error);
    alert('Error: ' + error.message);
    UIController.hideProgress();
    UIController.hideLoading();
    resetUpload();
  }
}
