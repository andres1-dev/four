// Autenticación con Google Sheets
// Lee usuarios directamente desde la hoja USERS

// Función para obtener usuarios desde Google Sheets
async function obtenerUsuariosDeSheets() {
    const API_KEY = 'AIzaSyC1QqwUAZmDbOVrOo3Iwq90J_lJ5PmAYVg';
    const SPREADSHEET_ID = CONFIG.USERS_SPREADSHEET_ID;
    const SHEET_NAME = CONFIG.USERS_SHEET_NAME;
    const range = `${SHEET_NAME}!A:F`; // id, nombre, rol, email, phone, password

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;

    try {
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}`);
        }

        const data = await response.json();
        const values = data.values || [];

        if (values.length <= 1) {
            console.warn("No hay usuarios en la hoja USERS");
            return [];
        }

        // Convertir filas a objetos (saltar header)
        const users = [];
        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            if (row.length >= 6 && row[0]) { // Debe tener al menos id y password
                users.push({
                    id: String(row[0] || '').trim(),
                    nombre: String(row[1] || '').trim(),
                    rol: String(row[2] || 'USER').trim().toUpperCase(),
                    email: String(row[3] || '').trim(),
                    phone: String(row[4] || '').trim(),
                    password: String(row[5] || '').trim()
                });
            }
        }

        console.log(`✅ Usuarios cargados desde Sheets: ${users.length}`);
        return users;

    } catch (error) {
        console.error("❌ Error obteniendo usuarios de Sheets:", error);
        throw error;
    }
}

// Función para verificar credenciales contra Google Sheets
async function verificarCredencialesSheets(id, password) {
    if (!id || !password) {
        return {
            success: false,
            message: 'Credenciales incompletas'
        };
    }

    try {
        const users = await obtenerUsuariosDeSheets();

        const userFound = users.find(u =>
            u.id === String(id).trim() &&
            u.password === String(password).trim()
        );

        if (userFound) {
            return {
                success: true,
                user: {
                    id: userFound.id,
                    nombre: userFound.nombre,
                    rol: userFound.rol,
                    email: userFound.email,
                    phone: userFound.phone
                },
                apiKey: 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM'
            };
        } else {
            return {
                success: false,
                message: 'ID o contraseña incorrectos'
            };
        }

    } catch (error) {
        console.error("Error en verificación:", error);
        return {
            success: false,
            message: 'Error de conexión con el servidor'
        };
    }
}

// Función para login biométrico (solo valida que el usuario exista)
async function loginBiometricoSheets(id) {
    if (!id) {
        return {
            success: false,
            message: 'ID no proporcionado'
        };
    }

    try {
        const users = await obtenerUsuariosDeSheets();

        const userFound = users.find(u => u.id === String(id).trim());

        if (userFound) {
            return {
                success: true,
                user: {
                    id: userFound.id,
                    nombre: userFound.nombre,
                    rol: userFound.rol,
                    email: userFound.email,
                    phone: userFound.phone
                },
                apiKey: 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM'
            };
        } else {
            return {
                success: false,
                message: 'Usuario biométrico no reconocido'
            };
        }

    } catch (error) {
        console.error("Error en login biométrico:", error);
        return {
            success: false,
            message: 'Error de conexión con el servidor'
        };
    }
}

// Función para recuperar contraseña (buscar usuario por ID)
async function recuperarContrasenaSheets(id) {
    if (!id) {
        return {
            success: false,
            message: 'Se requiere ID'
        };
    }

    try {
        const users = await obtenerUsuariosDeSheets();

        const userFound = users.find(u => u.id === String(id).trim());

        if (userFound) {
            if (!userFound.email) {
                return {
                    success: false,
                    message: 'El usuario no tiene email registrado'
                };
            }

            return {
                success: true,
                user: userFound,
                message: 'Usuario encontrado'
            };
        } else {
            return {
                success: false,
                message: 'Usuario no encontrado'
            };
        }

    } catch (error) {
        console.error("Error en recuperación:", error);
        return {
            success: false,
            message: 'Error de conexión con el servidor'
        };
    }
}

// Exponer funciones globalmente
if (typeof window !== 'undefined') {
    window.obtenerUsuariosDeSheets = obtenerUsuariosDeSheets;
    window.verificarCredencialesSheets = verificarCredencialesSheets;
    window.loginBiometricoSheets = loginBiometricoSheets;
    window.recuperarContrasenaSheets = recuperarContrasenaSheets;

    console.log("auth_sheets.js cargado - Autenticación con Google Sheets activa");
}
