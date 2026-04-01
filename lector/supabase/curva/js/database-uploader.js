// Subida a base de datos CURVA

const DatabaseUploaderCurva = {
  async uploadRecords(records) {
    try {
      console.log('📤 Iniciando subida de registros...');
      
      // Iniciar paso 4
      UIController.startStep4();
      
      // Preparar registros para inserción
      const recordsToInsert = records.map(r => ({
        op: r.op,
        referencia: r.referencia,
        descripcion: r.descripcion,
        cantidad: r.cantidad_total,
        detalles: r.detalles  // Array de arrays con barcodes
      }));

      console.log('📦 Total de registros a insertar:', recordsToInsert.length);
      console.log('📦 Ejemplo de registro:', recordsToInsert[0]);

      // Insertar en lotes
      const results = {
        total: recordsToInsert.length,
        success: 0,
        failed: 0,
        errors: []
      };

      const batchSize = 50;
      const batches = this.createBatches(recordsToInsert, batchSize);
      
      console.log(`📚 Total de lotes: ${batches.length} (${batchSize} registros por lote)`);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        console.log(`📤 Subiendo lote ${i + 1}/${batches.length} (${batch.length} registros)...`);
        
        try {
          const { data, error } = await supabaseCurva
            .from('CURVA')
            .insert(batch);

          if (error) {
            console.error(`❌ Error en lote ${i + 1}:`, error);
            throw error;
          }

          results.success += batch.length;
          console.log(`✅ Lote ${i + 1} completado`);
          
        } catch (error) {
          console.error('❌ Error en lote:', error);
          console.error('Detalles del error:', error.message, error.details, error.hint);
          results.failed += batch.length;
          results.errors.push(`Lote ${i + 1}: ${error.message}`);
        }

        // Actualizar progreso del paso 4
        const progress = Math.round(((i + 1) / batches.length) * 100);
        UIController.updateStep4Progress(progress);
        
        // Pausa entre lotes
        if (i < batches.length - 1) {
          await this.delay(100);
        }
      }

      return results;
      
    } catch (error) {
      console.error('Error subiendo registros:', error);
      
      return {
        total: 0,
        success: 0,
        failed: 0,
        errors: [error.message]
      };
    }
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

// Función global para subir
async function uploadToDatabase() {
  if (!FileHandlerCurva.parsedData) {
    console.error('❌ No hay datos para subir');
    return;
  }

  try {
    console.log('🚀 Iniciando proceso de carga...');
    console.log('📊 Registros a procesar:', FileHandlerCurva.parsedData.length);
    
    const existingCount = await DataValidatorCurva.loadExistingRecords();
    console.log(`✅ Cargados ${existingCount} registros existentes`);

    console.log('🔍 Validando datos...');
    const validatedData = DataValidatorCurva.validate(FileHandlerCurva.parsedData);
    const stats = DataValidatorCurva.getStats(validatedData);
    
    console.log('📈 Estadísticas de validación:', stats);

    // Completar paso 3
    UIController.completeStep3(stats);

    if (stats.valid === 0) {
      // No hay registros nuevos
      UIController.setStepActive(4);
      UIController.setStepComplete(4);
      UIController.updateStepDetails(4, '<i class="fas fa-info-circle"></i> No hay registros nuevos para subir');
      
      const results = {
        total: stats.total,
        success: 0,
        failed: 0,
        duplicates: stats.duplicates,
        errors: []
      };
      
      document.getElementById('statSuccess').textContent = '0';
      document.getElementById('statErrors').textContent = stats.errors.toLocaleString();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      UIController.completeProcess(results);
      return;
    }

    // Pequeña pausa para animación
    await new Promise(resolve => setTimeout(resolve, 500));

    const validRecords = DataValidatorCurva.getValidRecords(validatedData);
    console.log('📤 Registros válidos a subir:', validRecords.length);
    
    if (validRecords.length > 0) {
      console.log('📦 Ejemplo de registro a subir:', validRecords[0]);
    }
    
    const results = await DatabaseUploaderCurva.uploadRecords(validRecords);
    
    console.log('📊 Resultados de la carga:', results);
    
    // Agregar duplicados al resultado
    results.duplicates = stats.duplicates;
    
    // Completar paso 4
    UIController.completeStep4(results.success);
    
    // Pequeña pausa para animación
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Completar proceso (paso 5)
    UIController.completeProcess(results);

  } catch (error) {
    console.error('Error en la carga:', error);
    
    const statusDiv = document.getElementById('trackingStatus');
    statusDiv.className = 'tracking-status error';
    statusDiv.querySelector('.status-text').textContent = 'Error';
    
    const activeStep = document.querySelector('.timeline-item.active');
    if (activeStep) {
      const stepDetails = activeStep.querySelector('.timeline-details');
      if (stepDetails) {
        stepDetails.innerHTML = `<div style="color: #c62828;"><i class="fas fa-exclamation-circle"></i> ${error.message}</div>`;
      }
    }
    
    document.getElementById('actionFooter').style.display = 'block';
  }
}
