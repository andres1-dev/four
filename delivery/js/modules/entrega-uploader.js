/**
 * Módulo para subir entregas con imágenes a Supabase
 */

const EntregaUploader = {
  /**
   * URL de la Edge Function
   */
  FUNCTION_URL: 'https://ymaojqjdnrpfkrtuezcw.supabase.co/functions/v1/upload-entregas',

  /**
   * Sube una entrega con imagen comprimida
   * @param {Object} entregaData - Datos de la entrega
   * @param {File} imageFile - Archivo de imagen (opcional)
   * @returns {Promise<Object>}
   */
  async upload(entregaData, imageFile = null) {
    try {
      console.log('📦 Preparando entrega para subir...')

      // Validar datos requeridos
      this.validateEntregaData(entregaData)

      // Preparar payload
      const payload = {
        entrega: {
          Documento: entregaData.documento,
          Lote: entregaData.lote,
          Referencia: entregaData.referencia,
          Cantidad: parseFloat(entregaData.cantidad) || 0,
          Factura: entregaData.factura,
          Nit: entregaData.nit,
          Usuario: entregaData.usuario || null
        }
      }

      // Si hay imagen, comprimirla y agregarla
      if (imageFile) {
        console.log('📸 Comprimiendo imagen...')
        
        // Validar que sea una imagen
        if (!ImageCompressor.isValidImage(imageFile)) {
          throw new Error('El archivo debe ser una imagen (JPG, PNG, WEBP)')
        }

        // Comprimir imagen
        const compressed = await ImageCompressor.compress(imageFile)
        
        payload.entrega.imagen = compressed.base64
        payload.entrega.imagenNombre = imageFile.name

        console.log(`✅ Imagen comprimida: ${compressed.sizeKB.toFixed(2)} KB`)
      }

      // Enviar a la Edge Function
      console.log('📤 Enviando entrega a Supabase...')
      
      // Obtener token de autenticación
      const { data: { session } } = await window.supabase.auth.getSession();
      const authHeader = session ? { 'Authorization': `Bearer ${session.access_token}` } : {};

      const response = await fetch(this.FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify(payload)
      })


      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP ${response.status}`)
      }

      console.log('✅ Entrega subida exitosamente')

      return {
        success: true,
        data: result.data,
        soporteID: result.soporteID,
        urlImagen: result.urlImagen
      }

    } catch (error) {
      console.error('❌ Error subiendo entrega:', error)
      throw error
    }
  },

  /**
   * Valida los datos de la entrega
   */
  validateEntregaData(data) {
    const required = ['documento', 'lote', 'referencia', 'factura', 'nit']
    
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Campo requerido: ${field}`)
      }
    }
  },

  /**
   * Sube múltiples entregas en lote
   * @param {Array} entregas - Array de {entregaData, imageFile}
   * @param {Function} onProgress - Callback de progreso (current, total)
   * @returns {Promise<Object>}
   */
  async uploadBatch(entregas, onProgress = null) {
    const results = {
      total: entregas.length,
      success: 0,
      failed: 0,
      errors: []
    }

    for (let i = 0; i < entregas.length; i++) {
      const { entregaData, imageFile } = entregas[i]
      
      try {
        await this.upload(entregaData, imageFile)
        results.success++
      } catch (error) {
        results.failed++
        results.errors.push({
          index: i,
          factura: entregaData.factura,
          error: error.message
        })
      }

      // Callback de progreso
      if (onProgress) {
        onProgress(i + 1, entregas.length)
      }
    }

    return results
  },

  /**
   * Estima cuántas imágenes caben en el storage gratuito
   * @param {number} avgSizeKB - Tamaño promedio por imagen en KB
   * @returns {number}
   */
  estimateCapacity(avgSizeKB = 70) {
    const freeStorageGB = 1
    const freeStorageKB = freeStorageGB * 1024 * 1024
    return Math.floor(freeStorageKB / avgSizeKB)
  }
}

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EntregaUploader
}
