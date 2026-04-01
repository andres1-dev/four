// Validación de datos contra base de datos

const DataValidatorCurva = {
  existingRecords: new Set(),
  barcodesMap: new Map(),  // Mapa para buscar barcodes

  async loadBarcodes() {
    try {
      console.log('🔍 Cargando barcodes de la tabla BARRAS...');
      
      let allBarcodes = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      let totalLoaded = 0;

      while (hasMore) {
        const { data, error } = await supabaseCurva
          .from('BARRAS')
          .select('referencia, talla, id_color, barcode')
          .range(from, from + pageSize - 1);

        if (error) {
          console.error('❌ Error cargando barcodes:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allBarcodes = allBarcodes.concat(data);
          totalLoaded += data.length;
          from += pageSize;
          
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      // Crear mapa: "referencia-talla-id_color" => barcode
      this.barcodesMap = new Map();
      for (const item of allBarcodes) {
        const key = `${String(item.referencia).trim()}-${String(item.talla).trim()}-${String(item.id_color).trim()}`;
        this.barcodesMap.set(key, item.barcode);
      }
      
      console.log(`✅ Total de barcodes cargados: ${this.barcodesMap.size.toLocaleString()}`);
      
      return this.barcodesMap.size;
      
    } catch (error) {
      console.error('Error cargando barcodes:', error);
      throw new Error('No se pudo cargar los barcodes: ' + error.message);
    }
  },

  async loadExistingRecords() {
    try {
      console.log('🔄 Cargando OPs existentes de CURVA...');
      
      // Iniciar paso 2
      UIController.startStep2();
      
      let allOPs = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      let totalLoaded = 0;
      let pageNumber = 0;

      // Cargar todas las OPs
      while (hasMore) {
        pageNumber++;
        
        console.log(`📄 Cargando página ${pageNumber} de OPs...`);
        
        const { data, error } = await supabaseCurva
          .from('CURVA')
          .select('op')
          .range(from, from + pageSize - 1);

        if (error) {
          console.error('❌ Error en Supabase:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allOPs = allOPs.concat(data);
          totalLoaded += data.length;
          from += pageSize;
          
          UIController.updateStep2Progress(pageNumber, totalLoaded);
          
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      this.existingRecords = new Set(
        allOPs.map(item => String(item.op).trim())
      );
      
      console.log(`✅ Total de OPs cargadas: ${this.existingRecords.size.toLocaleString()}`);
      
      // Ahora cargar todos los barcodes de la tabla BARRAS
      console.log('🔄 Cargando barcodes de BARRAS...');
      
      let allBarcodes = [];
      from = 0;
      hasMore = true;
      pageNumber = 0;

      while (hasMore) {
        pageNumber++;
        
        console.log(`📄 Cargando página ${pageNumber} de barcodes...`);
        
        const { data, error } = await supabaseCurva
          .from('BARRAS')
          .select('referencia, talla, id_color, barcode')
          .range(from, from + pageSize - 1);

        if (error) {
          console.error('❌ Error cargando barcodes:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allBarcodes = allBarcodes.concat(data);
          totalLoaded += data.length;
          from += pageSize;
          
          UIController.updateStep2Progress(pageNumber, totalLoaded);
          
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      // Crear mapa de barcodes: "referencia-talla-id_color" => barcode
      this.barcodeMap = new Map();
      for (const item of allBarcodes) {
        const key = `${String(item.referencia).trim()}-${String(item.talla).trim()}-${String(item.id_color).trim()}`;
        this.barcodeMap.set(key, item.barcode);
      }
      
      console.log(`✅ Total de barcodes cargados: ${this.barcodeMap.size.toLocaleString()}`);
      
      // Completar paso 2
      UIController.completeStep2(this.existingRecords.size);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return this.existingRecords.size;
      
    } catch (error) {
      console.error('Error cargando registros:', error);
      throw new Error('No se pudo cargar la base de datos para validación: ' + error.message);
    }
  },

  getBarcodeForItem(referencia, talla, id_color) {
    const key = `${String(referencia).trim()}-${String(talla).trim()}-${String(id_color).trim()}`;
    return this.barcodeMap.get(key) || null;
  },

  validate(records) {
    const totalRecords = records.length;
    console.log(`Validando ${totalRecords.toLocaleString()} OPs del Excel...`);
    
    // Iniciar paso 3
    UIController.startStep3();
    
    const validated = records.map((record, index) => {
      // Actualizar progreso cada 100 registros
      if (index > 0 && index % 100 === 0) {
        const percentage = Math.round((index / totalRecords) * 100);
        UIController.updateStep3Progress(index, totalRecords, percentage);
      }

      const errors = [];

      // Validar referencia
      if (!record.referencia || String(record.referencia).trim() === '') {
        errors.push('Referencia vacía');
      }

      // Validar descripcion
      if (!record.descripcion || String(record.descripcion).trim() === '') {
        errors.push('Descripción vacía');
      }

      // Validar op
      if (!record.op || String(record.op).trim() === '') {
        errors.push('OP vacía');
      }

      // Validar items
      if (!record.items || record.items.length === 0) {
        errors.push('Sin items de colores/tallas');
      }

      // Verificar si ya existe (por OP)
      const key = String(record.op).trim();
      if (this.existingRecords.has(key)) {
        errors.push('OP ya existe en BD');
      }

      // Buscar barcodes para cada item y completar el array
      const itemsWithBarcodes = [];
      let missingBarcodes = 0;
      
      for (const item of record.items) {
        // item es [id_color, color, referencia, talla, cantidad, null]
        const barcode = this.getBarcodeForItem(item[2], item[3], item[0]);
        
        if (!barcode) {
          missingBarcodes++;
        }
        
        // Actualizar el barcode en la posición 5
        itemsWithBarcodes.push([
          item[0],  // id_color
          item[1],  // color
          item[2],  // referencia
          item[3],  // talla
          item[4],  // cantidad
          barcode || null  // barcode
        ]);
      }
      
      // Si hay items sin barcode, marcar como inválido
      if (missingBarcodes > 0) {
        errors.push(`${missingBarcodes} items sin barcode en BD`);
        console.warn(`⚠️ OP ${record.op}: ${missingBarcodes} items sin barcode - NO SE SUBIRÁ`);
      }

      return {
        op: record.op,
        referencia: record.referencia,
        descripcion: record.descripcion,
        cantidad_total: record.cantidad_total,
        detalles: itemsWithBarcodes,  // Array de arrays con barcodes
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
      r.errors.includes('OP ya existe en BD')
    ).length;

    return { total, valid, errors, duplicates };
  },

  getValidRecords(validatedData) {
    return validatedData.filter(r => r.isValid);
  }
};
