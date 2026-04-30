// Edge Function para gestionar usuarios en Supabase Auth (CRUD)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

    const { action, userId, userData } = await req.json()

    // Listar usuarios
    if (action === 'list') {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers()

      if (error) throw error

      // Formatear usuarios
      const users = data.users.map(u => ({
        id: u.user_metadata.legacy_id || u.id,
        auth_id: u.id,
        nombre: u.user_metadata.display_name || 'Usuario',
        rol: u.user_metadata.role || 'USER',
        email: u.email,
        phone: u.phone || ''
      }))

      return new Response(
        JSON.stringify({ success: true, users }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear usuario
    if (action === 'create') {
      const phoneFormatted = userData.phone.startsWith('57') ? userData.phone : `57${userData.phone}`

      // Generar UUID v5 desde legacy ID
      const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
      const encoder = new TextEncoder()
      const data = encoder.encode(namespace + userData.id)
      const hashBuffer = await crypto.subtle.digest('SHA-1', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      
      hashArray[6] = (hashArray[6] & 0x0f) | 0x50
      hashArray[8] = (hashArray[8] & 0x3f) | 0x80
      
      const uuid = [
        hashArray.slice(0, 4),
        hashArray.slice(4, 6),
        hashArray.slice(6, 8),
        hashArray.slice(8, 10),
        hashArray.slice(10, 16)
      ].map(arr => arr.map(b => b.toString(16).padStart(2, '0')).join('')).join('-')

      const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
        id: uuid,
        email: userData.email,
        password: userData.password,
        phone: phoneFormatted,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          display_name: userData.nombre,
          role: userData.rol,
          legacy_id: userData.id
        }
      })

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, user: newUser }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Actualizar usuario
    if (action === 'update') {
      const phoneFormatted = userData.phone?.startsWith('57') ? userData.phone : `57${userData.phone}`

      const updateData: any = {
        user_metadata: {
          display_name: userData.nombre,
          role: userData.rol,
          legacy_id: userData.id
        }
      }

      if (userData.email) updateData.email = userData.email
      if (userData.phone) updateData.phone = phoneFormatted
      if (userData.password) updateData.password = userData.password

      const { data: updatedUser, error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        updateData
      )

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, user: updatedUser }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Eliminar usuario
    if (action === 'delete') {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no válida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
