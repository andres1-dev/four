// Autenticación con Supabase Auth
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Inicializar cliente de Supabase
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)

// Verificar credenciales con Supabase Auth
async function verificarCredencialesSupabase(email, password) {
    try {
        console.log('🔐 Intentando login con Supabase Auth...')

        // Intentar login con Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        })

        if (error) {
            console.error('❌ Error de autenticación:', error.message)
            return {
                success: false,
                message: 'Credenciales inválidas'
            }
        }

        if (!data.user) {
            return {
                success: false,
                message: 'Usuario no encontrado'
            }
        }

        console.log('✅ Login exitoso:', data.user.email)

        // Obtener API Key de Google Sheets desde Edge Function
        let googleSheetsApiKey = ''
        
        try {
            console.log('🔑 Solicitando API Key desde servidor...')
            const apiKeyResponse = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/get-api-keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.session.access_token}`
                }
            })
            
            console.log('📡 Respuesta del servidor:', apiKeyResponse.status)
            
            if (apiKeyResponse.ok) {
                const apiKeyData = await apiKeyResponse.json()
                console.log('📦 Datos recibidos:', apiKeyData)
                
                if (apiKeyData.google_sheets_api_key) {
                    googleSheetsApiKey = apiKeyData.google_sheets_api_key
                    console.log('✅ API Key obtenida desde servidor:', googleSheetsApiKey.substring(0, 20) + '...')
                } else {
                    console.warn('⚠️ Respuesta OK pero sin API Key')
                }
            } else {
                const errorText = await apiKeyResponse.text()
                console.error('❌ Error del servidor:', errorText)
            }
        } catch (e) {
            console.error('❌ Error obteniendo API Key:', e)
        }
        
        if (!googleSheetsApiKey) {
            console.error('❌ No se pudo obtener API Key - Los datos de Sheets no cargarán')
        }

        // Extraer datos del usuario desde metadata
        const user = {
            id: data.user.user_metadata.legacy_id || data.user.id,
            nombre: data.user.user_metadata.display_name || 'Usuario',
            rol: data.user.user_metadata.role || 'USER',
            email: data.user.email,
            phone: data.user.phone || '',
            auth_id: data.user.id
        }

        return {
            success: true,
            user: user,
            session: data.session,
            apiKey: googleSheetsApiKey
        }

    } catch (error) {
        console.error('❌ Error en verificación:', error)
        return {
            success: false,
            message: 'Error de conexión'
        }
    }
}

// Login biométrico con Supabase
async function loginBiometricoSupabase(userId) {
    try {
        console.log('🔐 Login biométrico para userId:', userId)

        // Obtener sesión actual si existe
        const { data: { session } } = await supabase.auth.getSession()

        if (session && session.user) {
            const legacyId = session.user.user_metadata.legacy_id

            if (legacyId === userId) {
                // Sesión válida encontrada
                const user = {
                    id: legacyId || session.user.id,
                    nombre: session.user.user_metadata.display_name || 'Usuario',
                    rol: session.user.user_metadata.role || 'USER',
                    email: session.user.email,
                    phone: session.user.phone || '',
                    auth_id: session.user.id
                }

                return {
                    success: true,
                    user: user,
                    session: session
                }
            }
        }

        // No hay sesión válida
        return {
            success: false,
            message: 'Sesión expirada. Por favor inicia sesión nuevamente.'
        }

    } catch (error) {
        console.error('❌ Error en login biométrico:', error)
        return {
            success: false,
            message: 'Error de autenticación'
        }
    }
}

// Recuperar contraseña
async function recuperarContrasenaSupabase(email) {
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/delivery/reset.html`
        })

        if (error) {
            return {
                success: false,
                message: 'Email no encontrado'
            }
        }

        return {
            success: true,
            message: 'Se ha enviado un enlace de recuperación a tu email'
        }

    } catch (error) {
        console.error('❌ Error en recuperación:', error)
        return {
            success: false,
            message: 'Error al enviar email de recuperación'
        }
    }
}

// Cerrar sesión
async function cerrarSesionSupabase() {
    try {
        await supabase.auth.signOut()
        console.log('✅ Sesión cerrada')
    } catch (error) {
        console.error('❌ Error al cerrar sesión:', error)
    }
}

// Verificar sesión activa
async function verificarSesionSupabase() {
    try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session && session.user) {
            const user = {
                id: session.user.user_metadata.legacy_id || session.user.id,
                nombre: session.user.user_metadata.display_name || 'Usuario',
                rol: session.user.user_metadata.role || 'USER',
                email: session.user.email,
                phone: session.user.phone || '',
                auth_id: session.user.id
            }

            return {
                success: true,
                user: user,
                session: session
            }
        }

        return {
            success: false,
            message: 'No hay sesión activa'
        }

    } catch (error) {
        console.error('❌ Error verificando sesión:', error)
        return {
            success: false,
            message: 'Error al verificar sesión'
        }
    }
}

// Exportar funciones globalmente
window.verificarCredencialesSupabase = verificarCredencialesSupabase
window.loginBiometricoSupabase = loginBiometricoSupabase
window.recuperarContrasenaSupabase = recuperarContrasenaSupabase
window.cerrarSesionSupabase = cerrarSesionSupabase
window.verificarSesionSupabase = verificarSesionSupabase
window.supabase = supabase
