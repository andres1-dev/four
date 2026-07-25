import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { records } = await req.json()

    if (!records || !Array.isArray(records)) {
      return new Response(JSON.stringify({ error: 'Invalid request: records array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Crear cliente con service_role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Borrar todos los registros de fuente SISPRO
    const { error: deleteError } = await supabase
      .from('ingresos')
      .delete()
      .eq('fuente', 'SISPRO')

    if (deleteError) {
      return new Response(JSON.stringify({ error: 'Error deleting SISPRO records', details: deleteError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Insertar nuevos registros en lotes
    const BATCH_SIZE = 50
    let inserted = 0
    let errors = 0
    const errorDetails: Array<{ ids: string[]; message: string; code?: string; details?: string; hint?: string }> = []

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await supabase
        .from('ingresos')
        .insert(batch)

      if (insertError) {
        errors += batch.length
        const failedIds = batch.map((r: { id_ingreso: string }) => r.id_ingreso)
        console.error(`Error inserting batch ${i / BATCH_SIZE}:`, insertError)
        errorDetails.push({
          ids: failedIds,
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        })
      } else {
        inserted += batch.length
      }
    }

    return new Response(JSON.stringify({
      success: true,
      inserted,
      errors,
      total: records.length,
      errorDetails
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
