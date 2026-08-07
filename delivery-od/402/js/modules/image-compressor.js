/**
 * Módulo de compresión de imágenes
 * Objetivo: Comprimir imágenes a ~70KB para maximizar el 1GB gratuito de Supabase
 * Con 70KB promedio por imagen = ~14,600 imágenes en 1GB
 * Máximo 100KB por imagen
 */

const ImageCompressor = {
  /**
   * Configuración de compresión
   */
  config: {
    maxWidth: 1000,        // Ancho máximo en píxeles (reducido de 1200)
    maxHeight: 1400,       // Alto máximo en píxeles (reducido de 1600)
    quality: 0.6,          // Calidad JPEG (60% - reducido de 70%)
    targetSizeKB: 70,      // Tamaño objetivo en KB (reducido de 150)
    maxSizeKB: 100,        // Tamaño máximo permitido en KB (reducido de 200)
    format: 'image/jpeg'   // Formato de salida
  },

  /**
   * Comprime una imagen desde un File o Blob
   * @param {File|Blob} file - Archivo de imagen
   * @returns {Promise<{blob: Blob, base64: string, sizeKB: number}>}
   */
  async compress(file) {
    try {
      console.log(`📸 Comprimiendo imagen: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)

      // Cargar imagen
      const img = await this.loadImage(file)
      
      // Calcular nuevas dimensiones manteniendo aspect ratio
      const { width, height } = this.calculateDimensions(img.width, img.height)
      
      // Comprimir con calidad inicial
      let result = await this.compressWithQuality(img, width, height, this.config.quality)
      
      // Si es muy grande, reducir calidad iterativamente
      let quality = this.config.quality
      while (result.sizeKB > this.config.maxSizeKB && quality > 0.2) {
        quality -= 0.05
        console.log(`🔄 Recomprimiendo con calidad ${(quality * 100).toFixed(0)}%...`)
        result = await this.compressWithQuality(img, width, height, quality)
      }
      
      console.log(`✅ Imagen comprimida: ${result.sizeKB.toFixed(2)} KB (${((1 - result.sizeKB / (file.size / 1024)) * 100).toFixed(1)}% reducción)`)
      
      return result

    } catch (error) {
      console.error('❌ Error comprimiendo imagen:', error)
      throw error
    }
  },

  /**
   * Carga una imagen desde un File/Blob
   */
  loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Error cargando imagen'))
      }
      
      img.src = url
    })
  },

  /**
   * Calcula nuevas dimensiones manteniendo aspect ratio
   */
  calculateDimensions(width, height) {
    let newWidth = width
    let newHeight = height
    
    // Reducir si excede el ancho máximo
    if (newWidth > this.config.maxWidth) {
      newHeight = (newHeight * this.config.maxWidth) / newWidth
      newWidth = this.config.maxWidth
    }
    
    // Reducir si excede el alto máximo
    if (newHeight > this.config.maxHeight) {
      newWidth = (newWidth * this.config.maxHeight) / newHeight
      newHeight = this.config.maxHeight
    }
    
    return {
      width: Math.round(newWidth),
      height: Math.round(newHeight)
    }
  },

  /**
   * Comprime la imagen con una calidad específica
   */
  async compressWithQuality(img, width, height, quality) {
    // Crear canvas
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    
    const ctx = canvas.getContext('2d')
    
    // Dibujar imagen redimensionada
    ctx.drawImage(img, 0, 0, width, height)
    
    // Convertir a blob
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, this.config.format, quality)
    })
    
    // Convertir a base64
    const base64 = await this.blobToBase64(blob)
    
    return {
      blob,
      base64,
      sizeKB: blob.size / 1024,
      width,
      height,
      quality
    }
  },

  /**
   * Convierte un Blob a Base64
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  },

  /**
   * Valida si un archivo es una imagen válida
   */
  isValidImage(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    return validTypes.includes(file.type)
  },

  /**
   * Obtiene información de una imagen sin cargarla completamente
   */
  async getImageInfo(file) {
    const img = await this.loadImage(file)
    return {
      width: img.width,
      height: img.height,
      sizeKB: file.size / 1024,
      type: file.type
    }
  }
}

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageCompressor
}
