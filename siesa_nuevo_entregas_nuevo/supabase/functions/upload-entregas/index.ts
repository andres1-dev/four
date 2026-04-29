// Edge Function para subir entregas con imágenes comprimidas
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { decode } from 'https://deno.land/std@0.177.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EntregaData {
  Documento: string
  Lote: string
  Referencia: string
  Cantidad: number
  Factura: string
  Nit: string
  Usuario?: string
  imagen?: string // Base64 de la imagen
  imagenNombre?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { entrega }: { entrega: EntregaData } = await req.json()

    // Validar campos requeridos
    if (!entrega.Documento || !entrega.Lote || !entrega.Referencia || !entrega.Factura || !entrega.Nit) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Campos requeridos: Documento, Lote, Referencia, Factura, Nit' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let soporteID = null
    let urlImagen = null

    // Si hay imagen, procesarla y subirla
    if (entrega.imagen) {
      try {
        console.log('📸 Procesando imagen...')

        // Extraer el base64 (remover el prefijo data:image/... si existe)
        const base64Data = entrega.imagen.includes(',') 
          ? entrega.imagen.split(',')[1] 
          : entrega.imagen

        // Decodificar base64 a bytes
        const imageBytes = decode(base64Data)

        // Generar nombre único para la imagen con estructura de carpetas por fecha
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const timestamp = Date.now()
        
        // Limpiar nombre de archivo y obtener extensión
        let extension = 'jpg'
        if (entrega.imagenNombre) {
          const parts = entrega.imagenNombre.toLowerCase().split('.')
          if (parts.length > 1) {
            extension = parts[parts.length - 1]
          }
        }
        
        // Limpiar factura y documento de caracteres especiales
        const facturaLimpia = entrega.Factura.replace(/[^a-zA-Z0-9]/g, '-')
        const documentoLimpio = entrega.Documento.replace(/[^a-zA-Z0-9]/g, '-')
        
        // Estructura: 2026/04/29/FEV-12345_DOC-001_1714348800000.jpg
        const fileName = `${facturaLimpia}_${documentoLimpio}_${timestamp}.${extension}`
        const filePath = `${year}/${month}/${day}/${fileName}`

        console.log(`📤 Subiendo imagen: ${filePath}`)

        // Subir a Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient
          .storage
          .from('soportes-entregas')
          .upload(filePath, imageBytes, {
            contentType: `image/${extension}`,
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('❌ Error subiendo imagen:', uploadError)
          throw uploadError
        }

        // Obtener URL pública
        const { data: urlData } = supabaseClient
          .storage
          .from('soportes-entregas')
          .getPublicUrl(filePath)

        soporteID = fileName
        urlImagen = urlData.publicUrl

        console.log(`✅ Imagen subida: ${urlImagen}`)

      } catch (error: any) {
        console.error('❌ Error procesando imagen:', error)
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Error procesando imagen: ${error.message}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Insertar registro en ENTREGAS
    const entregaRecord = {
      "Registro": new Date().toISOString(), // Timestamp actual
      "Documento": entrega.Documento,
      "Lote": entrega.Lote,
      "Referencia": entrega.Referencia,
      "Cantidad": entrega.Cantidad || 0,
      "Factura": entrega.Factura,
      "Nit": entrega.Nit,
      "SoporteID": soporteID,
      "Url_Ih3": urlImagen,
      "Usuario": entrega.Usuario || null
    }

    console.log('💾 Insertando registro en ENTREGAS...')

    const { data, error } = await supabaseClient
      .from('ENTREGAS')
      .insert([entregaRecord])
      .select()

    if (error) {
      console.error('❌ Error insertando entrega:', error)
      
      // Si falla la inserción, eliminar la imagen subida
      if (soporteID) {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        await supabaseClient
          .storage
          .from('soportes-entregas')
          .remove([`${year}/${month}/${day}/${soporteID}`])
      }
      
      throw error
    }

    console.log('✅ Entrega registrada exitosamente')

    return new Response(
      JSON.stringify({
        success: true,
        data: data[0],
        soporteID,
        urlImagen
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
