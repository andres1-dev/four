// Edge Function: query-op-data
// Consulta eficiente on-demand de datos por OP (lote)
// Cruza SIESA + ingresos + ENTREGAS

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Tipos para las tablas
interface SiesaRecord {
  idx: number
  Estado: string
  'Nro documento': string
  Fecha: string
  'Razón social cliente factura': string
  'Docto. referencia': string
  Notas: string
  'Compáa': string
  op: string
  tipo: string
  'Valor subtotal local': string
  Referencia: string
  'Cantidad inv.': string
  referencias_detalle: any
}

interface IngresoRecord {
  idx?: number
  id_ingreso: string
  fecha_ingreso: string
  taller: string
  linea: string
  auditor: string
  gestor: string
  escaner: string
  lote: string
  refprov: string
  descripcion: string
  descripcion_larga: string
  cantidad: string
  total_relativo: string
  total_general: string
  diferencia: string
  costo_unitario: string
  costo_total: string
  auditoria: string
  orden_servicio: string
  traslado: string
  referencia: string
  tipo: string
  pvp: string
  clase: string
  prenda: string
  genero: string
  marca: string
  proveedor: string
  bolsas: string
  otros_traslados: string
  anexos: string
  hr: string
  detalle_cantidades: string
  created_at: string
  updated_at: string
  fecha_traslado: string
  total: string
  productora: string
  fuente: string
}

interface EntregaRecord {
  idx?: number
  Registro: string
  Documento: string
  Lote: string
  Referencia: string
  Cantidad: string
  Factura: string
  Nit: string
  SoporteID: string
  Url_Ih3: string
  Usuario: string
}

// Mapeo de clientes a NIT
const CLIENTS_MAP: Record<string, string> = {
  "INVERSIONES URBANA SAS": "901920844",
  "EL TEMPLO DE LA MODA FRESCA SAS": "900047252",
  "EL TEMPLO DE LA MODA SAS": "805027653",
  "ARISTIZABAL LOPEZ JESUS MARIA": "70825517",
  "QUINTERO ORTIZ JOSE ALEXANDER": "14838951",
  "QUINTERO ORTIZ PATRICIA YAMILET": "67006141",
  "ZULUAGA GOMEZ RUBEN ESTEBAN": "1007348825",
  "SON Y LIMON SAS": "900355664"
}

const BASE_IMAGE_URL = "https://lh3.googleusercontent.com/d/"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Obtener parámetros de la consulta
    const url = new URL(req.url)
    const op = url.searchParams.get('op')
    
    if (!op) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Parámetro "op" requerido' 
        }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      )
    }

    // Crear cliente de Supabase con permisos de servicio
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log(`🔍 Consultando datos para OP: ${op}`)
    const startTime = Date.now()

    // CONSULTA 1: SIESA - Filtrar por OP
    const { data: siesaData, error: siesaError } = await supabaseAdmin
      .from('SIESA')
      .select('*')
      .eq('op', op)
      .order('Fecha', { ascending: false })

    if (siesaError) {
      console.error('Error consultando SIESA:', siesaError)
      throw new Error(`Error en SIESA: ${siesaError.message}`)
    }

    // CONSULTA 2: ingresos - Filtrar por lote
    const { data: ingresosData, error: ingresosError } = await supabaseAdmin
      .from('ingresos')
      .select('*')
      .eq('lote', op)

    if (ingresosError) {
      console.error('Error consultando ingresos:', ingresosError)
      throw new Error(`Error en ingresos: ${ingresosError.message}`)
    }

    // CONSULTA 3: ENTREGAS - Filtrar por Lote
    const { data: entregasData, error: entregasError } = await supabaseAdmin
      .from('ENTREGAS')
      .select('*')
      .eq('Lote', op)

    if (entregasError) {
      console.error('Error consultando ENTREGAS:', entregasError)
      throw new Error(`Error en ENTREGAS: ${entregasError.message}`)
    }

    const queryTime = Date.now() - startTime
    console.log(`✅ Consultas completadas en ${queryTime}ms`)

    // PROCESAMIENTO: Crear mapas para cruce eficiente
    const processingStart = Date.now()

    // Mapa de entregas por factura (key = factura)
    const entregasMap: Record<string, EntregaRecord> = {}
    if (entregasData) {
      entregasData.forEach((entrega: EntregaRecord) => {
        const factura = String(entrega.Factura || '').trim()
        if (factura) {
          entregasMap[factura] = entrega
        }
      })
    }

    // Procesar datos de SIESA y cruzarlos con entregas
    const datosCombinados = (siesaData || []).map((siesa: SiesaRecord) => {
      const factura = siesa['Nro documento']
      const entrega = entregasMap[factura]
      
      // Procesar referencias_detalle
      let referencias: string[] = []
      if (siesa.referencias_detalle) {
        try {
          const refDetalle = typeof siesa.referencias_detalle === 'string' 
            ? JSON.parse(siesa.referencias_detalle) 
            : siesa.referencias_detalle
          referencias = refDetalle.map((d: any) => d.referencia)
        } catch (e) {
          referencias = [siesa.Referencia]
        }
      } else {
        referencias = [siesa.Referencia]
      }

      // Determinar referencia final
      let referenciaFinal: string
      if (referencias.length === 1) {
        referenciaFinal = referencias[0]
      } else if (referencias.length > 1) {
        referenciaFinal = "RefVar"
      } else {
        referenciaFinal = siesa.Referencia || "SIN_REF"
      }

      // Obtener NIT del cliente
      const nitCliente = CLIENTS_MAP[siesa['Razón social cliente factura']] || ''

      // Construir objeto con datos cruzados
      return {
        // Datos de SIESA
        estado: siesa.Estado,
        factura: factura,
        fecha: siesa.Fecha,
        cliente: siesa['Razón social cliente factura'],
        nit: nitCliente,
        lote: siesa.op,
        tipo: siesa.tipo,
        valorBruto: parseFloat(siesa['Valor subtotal local'] || '0'),
        cantidad: parseInt(siesa['Cantidad inv.'] || '0'),
        referencia: referenciaFinal,
        referencias: referencias,
        compania: siesa['Compáa'],
        doctoReferencia: siesa['Docto. referencia'],
        notas: siesa.Notas,
        proovedor: '',  // Campo legacy requerido por UI
        
        // Datos de entrega (si existe)
        confirmacion: entrega ? 'ENTREGADO' : '',
        fechaEntrega: entrega?.Registro || '',
        Ih3: entrega?.Url_Ih3 || (entrega?.SoporteID ? BASE_IMAGE_URL + entrega.SoporteID : ''),
        documento: entrega?.Documento || '',
        usuarioEntrega: entrega?.Usuario || '',
        cantidadEntregada: entrega?.Cantidad || '',
        
        // Metadata
        _tieneEntrega: !!entrega,
        _tieneIngreso: false // Se actualizará después
      }
    })

    // Agregar información de ingresos
    const ingresosMap: Record<string, IngresoRecord[]> = {}
    if (ingresosData) {
      ingresosData.forEach((ingreso: IngresoRecord) => {
        const ref = ingreso.referencia || ingreso.refprov
        if (ref) {
          if (!ingresosMap[ref]) {
            ingresosMap[ref] = []
          }
          ingresosMap[ref].push(ingreso)
        }
      })
    }

    // Enriquecer datos combinados con información de ingresos
    datosCombinados.forEach((dato: any) => {
      const ingresosPorRef = ingresosMap[dato.referencia] || []
      if (ingresosPorRef.length > 0) {
        dato._tieneIngreso = true
        dato.datosIngreso = ingresosPorRef[0] // Tomar el primer ingreso matching
      }
    })

    const processingTime = Date.now() - processingStart
    const totalTime = Date.now() - startTime

    // Estadísticas
    const stats = {
      op: op,
      totalFacturas: datosCombinados.length,
      facturasEntregadas: datosCombinados.filter((d: any) => d._tieneEntrega).length,
      facturasPendientes: datosCombinados.filter((d: any) => !d._tieneEntrega).length,
      registrosIngresos: ingresosData?.length || 0,
      registrosEntregas: entregasData?.length || 0,
      tiempoConsulta: `${queryTime}ms`,
      tiempoProcesamiento: `${processingTime}ms`,
      tiempoTotal: `${totalTime}ms`
    }

    console.log('📊 Estadísticas:', stats)

    return new Response(
      JSON.stringify({
        success: true,
        data: datosCombinados,
        ingresos: ingresosData || [],
        entregas: entregasData || [],
        stats: stats,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )

  } catch (error) {
    console.error('❌ Error en query-op-data:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )
  }
})
