// Edge Function para crear un usuario en Supabase Auth
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface UserData {
  id: string
  nombre: string
  rol: string
  email: string
  phone: string
  password: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    const { user }: { user: UserData } = await req.json()

    if (!user || !user.email || !user.password) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Email y password son requeridos' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📝 Creando usuario: ${user.email}`)

    // Formatear teléfono con prefijo 57 (Colombia)
    const phoneFormatted = user.phone.startsWith('57') ? user.phone : `57${user.phone}`

    // Generar UUID v5 determinístico desde el ID legacy
    const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    const encoder = new TextEncoder()
    const data = encoder.encode(namespace + user.id)
    const hashBuffer = await crypto.subtle.digest('SHA-1', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    
    // Construir UUID v5
    hashArray[6] = (hashArray[6] & 0x0f) | 0x50
    hashArray[8] = (hashArray[8] & 0x3f) | 0x80
    
    const uuid = [
      hashArray.slice(0, 4),
      hashArray.slice(4, 6),
      hashArray.slice(6, 8),
      hashArray.slice(8, 10),
      hashArray.slice(10, 16)
    ].map(arr => arr.map(b => b.toString(16).padStart(2, '0')).join('')).join('-')

    console.log(`🔑 UUID: ${uuid} para legacy ID: ${user.id}`)

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      id: uuid,
      email: user.email,
      password: user.password,
      phone: phoneFormatted,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        display_name: user.nombre,
        role: user.rol,
        legacy_id: user.id
      }
    })

    if (authError) {
      console.error(`❌ Error creando usuario:`, authError)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: authError.message 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Usuario creado: ${user.email} (ID: ${authData.user.id})`)

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          auth_id: authData.user.id,
          email: authData.user.email,
          nombre: user.nombre,
          rol: user.rol,
          phone: user.phone,
          legacy_id: user.id
        }
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
