// Validación de datos contra base de datos

const DataValidator = {
  existingBarcodes: new Set(),

  async loadExistingBarcodes() {
    try {
      console.log('Cargando todos los barcodes de la base de datos...');
      
      let allBarcodes = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      let totalLoaded = 0;
      let pageNumber = 0;

      // Cargar todos los barcodes con paginación
      while (hasMore) {
        pageNumber++;
        
        const { data, error } = await supabaseAdmin
          .from('BARRAS')
          .select('barcode')
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allBarcodes = allBarcodes.concat(data);
          totalLoaded += data.length;
          from += pageSize;
          
          // Actualizar mensaje cada página
          UIController.updateLoadingMessage(
            `Cargando base de datos...\n` +
            `Página ${pageNumber}: ${totalLoaded.toLocaleString()} registros cargados`
          );
          
          // Si obtuvimos menos registros que el tamaño de página, ya no hay más
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      this.existingBarcodes = new Set(allBarcodes.map(item => String(item.barcode).trim()));
      
      console.log(`✅ Total de barcodes cargados: ${this.existingBarcodes.size.toLocaleString()}`);
      
      UIController.updateLoadingMessage(
        `✓ Base de datos cargada: ${this.existingBarcodes.size.toLocaleString()} registros`
      );
      
      // Pequeña pausa para mostrar el mensaje
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return this.existingBarcodes.size;
      
    } catch (error) {
      console.error('Error cargando barcodes:', error);
      throw new Error('No se pudo cargar la base de datos para validación: ' + error.message);
    }
  },

  validate(records) {
    const totalRecords = records.length;
    console.log(`Validando ${totalRecords.toLocaleString()} registros del Excel...`);
    
    const validated = records.map((record, index) => {
      // Actualizar progreso cada 5000 registros
      if (index > 0 && index % 5000 === 0) {
        const percentage = Math.round((index / totalRecords) * 100);
        UIController.updateLoadingMessage(
          `Validando registros...\n` +
          `${index.toLocaleString()} / ${totalRecords.toLocaleString()} (${percentage}%)`
        );
      }

      const errors = [];
      const barcode = String(record.barcode || '').trim();

      // Validar referencia
      if (!record.referencia || String(record.referencia).trim() === '') {
        errors.push('Referencia vacía');
      }

      // Validar talla
      if (!record.talla || String(record.talla).trim() === '') {
        errors.push('Talla vacía');
      }

      // Validar id_color
      if (record.id_color === null || record.id_color === undefined || String(record.id_color).trim() === '') {
        errors.push('ID Color vacío');
      }

      // Validar barcode
      if (!barcode) {
        errors.push('Barcode vacío');
      } else if (this.existingBarcodes.has(barcode)) {
        errors.push('Barcode ya existe en BD');
      }

      return {
        ...record,
        isValid: errors.length === 0,
        errors: errors
      };
    });

    console.log(`✅ Validación completada`);
    return validated;
  },

  getStats(validatedData) {
    const total = validatedData.length;
    const valid = validatedData.filter(r => r.isValid).length;
    const errors = total - valid;
    const duplicates = validatedData.filter(r => 
      r.errors.includes('Barcode ya existe en BD')
    ).length;

    return { total, valid, errors, duplicates };
  },

  getValidRecords(validatedData) {
    return validatedData.filter(r => r.isValid);
  }
};
