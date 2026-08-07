const SPREADSHEET_ID = '1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw';
const SHEET_NAME = 'SOPORTES';
const USERS_SHEET_NAME = 'USERS';
const FOLDER_ID = '1uaC605ZYOJKbdNJinVrvGAAo5tLAQRtO';

// --- UTILIDADES ---
function getFormattedDateTime(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// --- SEGURIDAD RESET PASSWORD ---

function generarPasswordTemporal() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let pass = '';
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function generarTokenSeguro() {
  return Utilities.getUuid().replace(/-/g, "") + Date.now();
}

function guardarTokenReset(userId, token) {

  const tokens = JSON.parse(
    PropertiesService.getScriptProperties().getProperty("RESET_TOKENS") || "[]"
  );

  tokens.push({
    token: token,
    userId: userId,
    expires: Date.now() + (5 * 60 * 1000), // 5 minutos
    used: false
  });

  PropertiesService.getScriptProperties()
    .setProperty("RESET_TOKENS", JSON.stringify(tokens));
}

function validarToken(token) {

  const tokens = JSON.parse(
    PropertiesService.getScriptProperties().getProperty("RESET_TOKENS") || "[]"
  );

  const data = tokens.find(t => t.token === token);

  if (!data)
    return { valid: false, message: "Token inválido" };

  if (data.used)
    return { valid: false, message: "Token ya utilizado" };

  if (Date.now() > data.expires)
    return { valid: false, message: "Token expirado" };

  return { valid: true, userId: data.userId };
}


function invalidarToken(token) {

  const tokens = JSON.parse(
    PropertiesService.getScriptProperties().getProperty("RESET_TOKENS") || "[]"
  );

  const index = tokens.findIndex(t => t.token === token);

  if (index !== -1) {
    tokens[index].used = true;

    PropertiesService.getScriptProperties()
      .setProperty("RESET_TOKENS", JSON.stringify(tokens));
  }
}

// --- MAIN GET HANDLER (Para Polling) ---
function doGet(e) {
  try {

    // VISTA RESET PASSWORD
    if (e.parameter.view === 'reset' && e.parameter.token) {
      return HtmlService.createHtmlOutput(`
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial; padding:20px; text-align:center;}
            input { padding:10px; width:80%; margin:10px 0;}
            button { padding:10px 20px; background:#2563EB; color:white; border:none; border-radius:8px;}
          </style>
        </head>
        <body>
          <h2>Cambiar contraseña</h2>
          <input type="password" id="newPass" placeholder="Nueva contraseña">
          <br>
          <button onclick="save()">Guardar</button>

          <script>
            function save(){
              const newPass = document.getElementById("newPass").value;
              fetch("?action=resetPassword&token=${e.parameter.token}&newPassword=" + encodeURIComponent(newPass), {method:"POST"})
                .then(r=>r.json())
                .then(d=>alert(d.message));
            }
          </script>
        </body>
        </html>
      `);
    }

    const action = e.parameter.action;
    

    return ContentService.createTextOutput("PandaDash API Active")
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// --- MAIN POST HANDLER ---
function doPost(e) {
  try {
    if (!e) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'No se recibió el evento de solicitud'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    let params = e.parameter || {};
    
    // Fallback para datos enviados como JSON en el cuerpo
    if (!params.action && e.postData && e.postData.contents && e.postData.contents.startsWith('{')) {
      try {
        const jsonData = JSON.parse(e.postData.contents);
        params = Object.assign({}, params, jsonData);
      } catch (err) {
        console.error("Error parseando JSON en doPost:", err);
      }
    }
    
    const action = params.action;

    // --- ACCIONES DE RESET PASSWORD ---
    if (action === "resetPassword") {
      return cambiarPassword(
        params.token,
        params.newPassword
      );
    }

    // --- ACCIONES DE USUARIO ---
    if (action === 'login') {
       return verificarCredenciales(params.id, params.password);
    } 
    else if (action === 'biometricLogin') {
       return loginBiometrico(params.id);
    } 
    else if (action === 'recover') {
       return recuperarContrasena(params.id, params.method);
    }
    else if (action === 'getUsers') {
       return listarUsuarios();
    }
    else if (action === 'saveUser') {
       return guardarUsuario(params.userData);
    }
    else if (action === 'deleteUser') {
       return eliminarUsuario(params.id);
    }
    
    // --- ACCIONES DE DATOS ---
    else if (action === 'delete') {
       return eliminarRegistro(params.factura);
    }
    

    
    // Guardar datos (Acción por defecto si no es ninguna de las anteriores)
    const datos = {
        documento: params.documento || '',
        lote: params.lote || '',
        referencia: params.referencia || '',
        cantidad: params.cantidad || 0,
        factura: params.factura || '',
        nit: params.nit || '',
        usuario: params.usuario || 'Desconocido',
        fotoUrl: ''
    };
    
    if (params.fotoBase64 && params.fotoNombre && params.fotoTipo) {
      try {
        const fotoUrl = guardarImagenEnDrive(
          params.fotoBase64,
          params.fotoNombre,
          params.fotoTipo
        );
        datos.fotoUrl = fotoUrl;
      } catch (imgError) {
        Logger.log('Error al procesar la imagen: ' + imgError.message);
      }
    }
    
    const resultado = guardarDatosAlInicio(datos);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: resultado
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error en doPost: ' + error.message);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Error: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


// --- GESTIÓN DE USUARIOS DESDE SHEETS ---

function getUsers() {
  try {
    Logger.log('=== Obteniendo usuarios con Sheets API v4 ===');
    
    // Usar Sheets API v4 (igual que en obtenerDatosDeSheet)
    const sheets = Sheets.Spreadsheets.Values;
    const range = `${USERS_SHEET_NAME}!A:F`;
    
    Logger.log('Leyendo rango: ' + range);
    
    const response = sheets.get(SPREADSHEET_ID, range);
    const data = response.values || [];
    
    Logger.log('Filas obtenidas: ' + data.length);
    
    if (data.length <= 1) {
      Logger.log('No hay usuarios en la hoja USERS (solo header o vacía)');
      return [];
    }
    
    // Convertir filas a objetos (saltar header)
    const users = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) { // Debe tener al menos ID
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
    
    Logger.log('Usuarios procesados: ' + users.length);
    return users;
    
  } catch (error) {
    Logger.log('Error obteniendo usuarios de Sheets: ' + error.message);
    
    // Si la hoja no existe, intentar crearla
    if (error.message.includes('Unable to parse range') || 
        error.message.includes('not found') ||
        error.message.includes('does not exist')) {
      Logger.log('La hoja USERS no existe. Creándola...');
      try {
        createUsersSheetV4();
        Logger.log('Hoja creada. Retornando array vacío.');
        return [];
      } catch (createError) {
        Logger.log('Error al crear hoja: ' + createError.message);
      }
    }
    
    return [];
  }
}

function saveUsers(users) {
  try {
    Logger.log('=== INICIANDO saveUsers ===');
    Logger.log('Número de usuarios a guardar: ' + users.length);
    
    // Usar Sheets API v4 (igual que guardarDatosAlInicio)
    const sheets = Sheets.Spreadsheets.Values;
    
    // Preparar datos para escribir (incluir header)
    const header = ['id', 'nombre', 'rol', 'email', 'phone', 'password'];
    const rows = users.map(u => [
      u.id,
      u.nombre,
      u.rol,
      u.email || '',
      u.phone || '',
      u.password
    ]);
    
    Logger.log('Datos preparados. Filas: ' + rows.length);
    
    // Combinar header + datos
    const allData = [header, ...rows];
    
    Logger.log('Total de filas a escribir (con header): ' + allData.length);
    
    // Limpiar toda la hoja USERS
    Logger.log('Limpiando hoja USERS...');
    try {
      sheets.clear({}, SPREADSHEET_ID, `${USERS_SHEET_NAME}!A:F`);
      Logger.log('Hoja limpiada correctamente');
    } catch (clearError) {
      Logger.log('Error al limpiar (puede que la hoja no exista): ' + clearError.message);
      // Continuar de todas formas, intentaremos escribir
    }
    
    // Escribir todos los datos
    Logger.log('Escribiendo datos en USERS!A1...');
    sheets.update(
      { values: allData }, 
      SPREADSHEET_ID, 
      `${USERS_SHEET_NAME}!A1`, 
      { valueInputOption: 'USER_ENTERED' }
    );
    
    Logger.log('Datos escritos correctamente');
    Logger.log('=== saveUsers COMPLETADO EXITOSAMENTE ===');
    return true;
    
  } catch (error) {
    Logger.log('=== ERROR EN saveUsers ===');
    Logger.log('Mensaje: ' + error.message);
    Logger.log('Stack: ' + error.stack);
    Logger.log('Nombre del error: ' + error.name);
    
    // Si el error es que la hoja no existe, intentar crearla
    if (error.message.includes('Unable to parse range') || 
        error.message.includes('not found') ||
        error.message.includes('does not exist')) {
      Logger.log('La hoja USERS no existe. Intentando crearla...');
      try {
        createUsersSheetV4();
        Logger.log('Hoja creada. Reintentando guardar...');
        return saveUsers(users); // Reintentar
      } catch (createError) {
        Logger.log('Error al crear hoja: ' + createError.message);
      }
    }
    
    return false;
  }
}

// Crear hoja USERS usando Sheets API v4
function createUsersSheetV4() {
  Logger.log('=== Creando hoja USERS con Sheets API v4 ===');
  
  try {
    // Obtener información del spreadsheet
    const spreadsheet = Sheets.Spreadsheets.get(SPREADSHEET_ID);
    Logger.log('Spreadsheet: ' + spreadsheet.properties.title);
    
    // Verificar si la hoja ya existe
    const existingSheet = spreadsheet.sheets.find(s => s.properties.title === USERS_SHEET_NAME);
    
    if (existingSheet) {
      Logger.log('La hoja USERS ya existe con ID: ' + existingSheet.properties.sheetId);
      return existingSheet.properties.sheetId;
    }
    
    // Crear nueva hoja
    const request = {
      requests: [{
        addSheet: {
          properties: {
            title: USERS_SHEET_NAME,
            gridProperties: {
              rowCount: 1000,
              columnCount: 6
            }
          }
        }
      }]
    };
    
    const response = Sheets.Spreadsheets.batchUpdate(request, SPREADSHEET_ID);
    const newSheetId = response.replies[0].addSheet.properties.sheetId;
    
    Logger.log('✅ Hoja USERS creada con ID: ' + newSheetId);
    
    // Agregar header
    const header = [['id', 'nombre', 'rol', 'email', 'phone', 'password']];
    Sheets.Spreadsheets.Values.update(
      { values: header },
      SPREADSHEET_ID,
      `${USERS_SHEET_NAME}!A1`,
      { valueInputOption: 'USER_ENTERED' }
    );
    
    Logger.log('✅ Header agregado a la hoja USERS');
    
    return newSheetId;
    
  } catch (error) {
    Logger.log('❌ Error creando hoja USERS: ' + error.message);
    throw error;
  }
}

function listarUsuarios() {
  const users = getUsers();
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    users: users
  })).setMimeType(ContentService.MimeType.JSON);
}

function guardarUsuario(userDataJson) {
  try {
    Logger.log('=== INICIANDO guardarUsuario ===');
    Logger.log('Datos recibidos: ' + userDataJson);
    
    const newUser = JSON.parse(userDataJson);
    
    // Validar datos requeridos
    if (!newUser.id || !newUser.nombre || !newUser.password) {
      Logger.log('ERROR: Datos incompletos');
      Logger.log('ID: ' + newUser.id);
      Logger.log('Nombre: ' + newUser.nombre);
      Logger.log('Password: ' + (newUser.password ? 'presente' : 'ausente'));
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Datos incompletos: se requiere id, nombre y password'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Normalizar datos
    newUser.id = String(newUser.id).trim();
    newUser.nombre = String(newUser.nombre).trim();
    newUser.rol = String(newUser.rol || 'USER').trim().toUpperCase();
    newUser.email = String(newUser.email || '').trim();
    newUser.phone = String(newUser.phone || '').trim();
    newUser.password = String(newUser.password).trim();

    Logger.log('Usuario normalizado: ' + JSON.stringify(newUser));

    // Obtener usuarios actuales
    Logger.log('Obteniendo usuarios actuales...');
    let users = getUsers();
    Logger.log('Usuarios actuales: ' + users.length);
    
    // Buscar si el usuario ya existe
    const existingIndex = users.findIndex(u => u.id === newUser.id);

    if (existingIndex >= 0) {
      // Actualizar usuario existente
      users[existingIndex] = newUser;
      Logger.log('Usuario actualizado en índice: ' + existingIndex);
    } else {
      // Agregar nuevo usuario
      users.push(newUser);
      Logger.log('Usuario nuevo agregado. Total usuarios: ' + users.length);
    }

    // Guardar en Sheets
    Logger.log('Guardando en Sheets...');
    const saved = saveUsers(users);
    
    Logger.log('Resultado de saveUsers: ' + saved);
    
    if (!saved) {
      Logger.log('ERROR: saveUsers retornó false');
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Error al guardar en Google Sheets. Revisa los logs del script para más detalles.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    Logger.log('=== guardarUsuario COMPLETADO EXITOSAMENTE ===');
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Usuario guardado correctamente'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    Logger.log('=== ERROR EN guardarUsuario ===');
    Logger.log('Mensaje: ' + e.message);
    Logger.log('Stack: ' + e.stack);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Error al guardar usuario: ' + e.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function eliminarUsuario(id) {
  try {
    Logger.log('Eliminando usuario: ' + id);
    
    let users = getUsers();
    Logger.log('Usuarios antes de eliminar: ' + users.length);
    
    const initialLength = users.length;
    users = users.filter(u => u.id !== id);

    if (users.length === initialLength) {
      Logger.log('Usuario no encontrado: ' + id);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Usuario no encontrado'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    Logger.log('Usuarios después de eliminar: ' + users.length);
    
    const saved = saveUsers(users);
    
    if (!saved) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Error al guardar cambios en Google Sheets'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Usuario eliminado correctamente'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    Logger.log('Error en eliminarUsuario: ' + e.message);
    Logger.log('Stack: ' + e.stack);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Error al eliminar: ' + e.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function loginBiometrico(id) {
  if (!id) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, message: 'ID no proporcionado'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const users = getUsers();
    const userFound = users.find(u => u.id === String(id).trim());

    if (userFound) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        apiKey: 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM',
        user: {
          id: userFound.id,
          nombre: userFound.nombre,
          rol: userFound.rol,
          email: userFound.email,
          phone: userFound.phone
        }
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, message: 'Usuario biométrico no reconocido'
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, message: 'Error en servidor biométrico: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function verificarCredenciales(id, password) {
  if (!id || !password) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, message: 'Credenciales incompletas'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const users = getUsers();
    const userFound = users.find(u => u.id === String(id).trim() && u.password === String(password).trim());

    if (userFound) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        apiKey: 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM',
        user: {
          id: userFound.id,
          nombre: userFound.nombre,
          rol: userFound.rol,
          email: userFound.email,
          phone: userFound.phone
        }
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, message: 'ID o contraseña incorrectos'
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, message: 'Error en el servidor: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function recuperarContrasena(id, method) {
  if (!id)
    return ContentService.createTextOutput(JSON.stringify({
      success: false, message: 'Se requiere ID'
    })).setMimeType(ContentService.MimeType.JSON);

  try {
    const users = getUsers();
    const user = users.find(u => u.id === String(id).trim());

    if (!user)
      return ContentService.createTextOutput(JSON.stringify({
        success: false, message: 'Usuario no encontrado'
      })).setMimeType(ContentService.MimeType.JSON);

    if (!user.email)
      return ContentService.createTextOutput(JSON.stringify({
        success: false, message: 'El usuario no tiene email registrado'
      })).setMimeType(ContentService.MimeType.JSON);

    // 🔐 GENERAMOS TOKEN PARA RESET
    const token = generarTokenSeguro();
    guardarTokenReset(user.id, token);

    const resetUrl = "https://andres1-dev.github.io/two/PandaDash/reset.html?token=" 
      + encodeURIComponent(token);

    MailApp.sendEmail({
      to: user.email,
      subject: "Restablecimiento de contraseña - PandaDash",
      htmlBody: `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Restablece tu contraseña - PandaDash</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7fb;">

    <!-- CONTENEDOR PRINCIPAL -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f7fb;">
        <tr>
            <td style="padding: 40px 20px;">

                <!-- TARJETA PRINCIPAL -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 20px 35px -8px rgba(0, 0, 0, 0.1);">

                    <!-- HEADER: Fondo sólido para compatibilidad + Logo PNG -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 36px 40px 28px; text-align: center; border-radius: 24px 24px 0 0;">
                            <!-- Logo PNG (100% compatible) -->
                            <div style="margin: 0 auto 16px; width: 88px; height: 88px; background-color: #ffffff; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 8px 18px rgba(0, 0, 0, 0.15); padding: 12px;">
                                <img src="https://lh3.googleusercontent.com/d/1RyuX2h2gPve2mk1kI5dbDDHvVhLMWcGs" alt="PandaDash" width="62" height="62" style="display: block; border: 0; width: 62px; height: 62px;">
                            </div>
                            <h1 style="margin: 0; color: rgb(37, 99, 235); font-size: 28px; font-weight: 600; letter-spacing: -0.3px;">PandaDash</h1>
                            <p style="margin: 8px 0 0; color: rgba(37, 99, 235, 0.85); font-size: 14px; font-weight: 400;">Plataforma de Gestión Inteligente</p>
                        </td>
                    </tr>

                    <!-- CUERPO DEL MENSAJE -->
                    <tr>
                        <td style="padding: 40px 40px 20px;">
                            <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 22px; font-weight: 600;">Hola ${user.nombre}</h2>
                            <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.5;">
                                Haz clic en el botón para restablecer tu contraseña.
                            </p>

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0 20px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${resetUrl}" style="display: inline-block; background: #2563EB; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: 500; box-shadow: 0 4px 8px rgba(37, 99, 235, 0.2);">Restablecer contraseña</a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 28px; color: #64748b; font-size: 15px; text-align: center;">
                                ⏳ Este enlace expira en <strong style="color: #2563EB;">5 minutos</strong>.
                            </p>

                            <!-- RECOMENDACIONES DE SEGURIDAD -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f9ff; border-radius: 16px; margin: 20px 0 10px;">
                                <tr>
                                    <td style="padding: 20px 24px;">
                                        <p style="margin: 0 0 10px; color: #1e4a6b; font-size: 15px; font-weight: 600;">🔒 Recomendaciones importantes</p>
                                        <ul style="margin: 0; padding-left: 20px; color: #2c3e50; font-size: 14px; line-height: 1.6;">
                                            <li style="margin-bottom: 8px;">Elige una contraseña segura que no hayas usado antes.</li>
                                            <li style="margin-bottom: 8px;">La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas y números.</li>
                                            <li style="margin-bottom: 0;">Si no solicitaste restablecer tu contraseña, contacta a <a href="mailto:soporte@pandadash.com" style="color: #2563EB; text-decoration: none; font-weight: 500;">soporte@pandadash.com</a>.</li>
                                        </ul>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 28px 0 0; color: #64748b; font-size: 14px; line-height: 1.5; text-align: center;">
                                ¿Tienes problemas? Escríbenos a <a href="mailto:soporte@pandadash.com" style="color: #3B82F6; text-decoration: underline; font-weight: 500;">soporte@pandadash.com</a>
                            </p>
                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 40px; border-radius: 0 0 24px 24px; border-top: 1px solid #e2e8f0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center; color: #94a3b8; font-size: 12px;">
                                        <p style="margin: 0 0 10px;">
                                            Este es un mensaje automático de <strong>PandaDash</strong>. Por favor, no respondas a este correo.
                                        </p>
                                        <p style="margin: 0;">
                                            © 2024 PandaDash. Todos los derechos reservados.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>

</body>
</html>
      `
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `Enlace enviado a ${user.email}`
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}



// --- FUNCIÓN PARA ELIMINAR REGISTRO (CON ELIMINACIÓN DE IMAGEN) ---
function eliminarRegistro(facturaEliminar) {
  if (!facturaEliminar) return ContentService.createTextOutput(JSON.stringify({success: false, message: 'No hay factura'})).setMimeType(ContentService.MimeType.JSON);

  try {
    const sheets = Sheets.Spreadsheets.Values;
    const allDataResponse = sheets.get(SPREADSHEET_ID, `${SHEET_NAME}!A:J`);
    
    if (!allDataResponse.values || allDataResponse.values.length === 0) return ContentService.createTextOutput(JSON.stringify({success: false, message: 'Hoja vacía'})).setMimeType(ContentService.MimeType.JSON);
    
    let values = allDataResponse.values;
    const headers = values[0];
    let colFactura = -1, colIdImagen = -1;
    
    for (let i = 0; i < headers.length; i++) {
        if (headers[i].toString().toUpperCase().includes('FACTURA')) colFactura = i;
        if (headers[i].toString().toUpperCase().includes('ID IMAGEN')) colIdImagen = i;
    }
    if (colFactura === -1) colFactura = 5;
    if (colIdImagen === -1) colIdImagen = 7;
    
    const newValues = [headers];
    let deletedCount = 0;
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[colFactura].toString() !== facturaEliminar.toString()) {
        newValues.push(row);
      } else {
        deletedCount++;
        // Eliminar la imagen de Drive si existe
        if (colIdImagen !== -1 && row[colIdImagen] && row[colIdImagen] !== 'Sin ID') {
          try { 
            DriveApp.getFileById(row[colIdImagen]).setTrashed(true); 
          } catch(e) {
            Logger.log('Error al eliminar imagen: ' + e.message);
          }
        }
      }
    }
    
    if (deletedCount === 0) return ContentService.createTextOutput(JSON.stringify({success: false, message: 'No se encontró factura'})).setMimeType(ContentService.MimeType.JSON);
    
    Sheets.Spreadsheets.Values.clear({}, SPREADSHEET_ID, `${SHEET_NAME}!A:J`);
    Sheets.Spreadsheets.Values.update({ values: newValues }, SPREADSHEET_ID, `${SHEET_NAME}!A1`, { valueInputOption: 'USER_ENTERED' });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true, 
      message: `Registro ${facturaEliminar} eliminado correctamente`
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
     return ContentService.createTextOutput(JSON.stringify({success: false, message: 'Error al eliminar: ' + error.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function guardarImagenEnDrive(base64Data, fileName, mimeType) {
  const decodedData = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decodedData, mimeType, fileName);
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const file = folder.createFile(blob);
  file.setName(fileName);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function guardarDatosAlInicio(datos) { 
  try {
    const fechaHora = getFormattedDateTime();
    let fileId = null, imageLink = '';
    if (datos.fotoUrl) {
      const match = datos.fotoUrl.match(/\/d\/([^/]+)\//);
      if (match && match[1]) {
        fileId = match[1];
        imageLink = `https://lh3.googleusercontent.com/d/${fileId}`;
      }
    }

    const nuevaFila = [
      fechaHora, datos.documento, datos.lote, datos.referencia, 
      datos.cantidad, datos.factura, datos.nit, fileId || 'Sin ID', imageLink, datos.usuario
    ];

    const sheets = Sheets.Spreadsheets.Values;
    const allDataResponse = sheets.get(SPREADSHEET_ID, `${SHEET_NAME}!A:J`);
    let allData = [];
    
    if (allDataResponse.values && allDataResponse.values.length > 0) {
      allData.push(allDataResponse.values[0]); // Mantener encabezados
      allData.push(nuevaFila); // Insertar nueva fila después de encabezados
      
      // Agregar el resto de los datos (excepto encabezados que ya agregamos)
      for (let i = 1; i < allDataResponse.values.length; i++) {
        allData.push(allDataResponse.values[i]);
      }
    } else {
      allData.push(['Fecha y Hora', 'Documento', 'Lote', 'Referencia', 'Cantidad', 'Factura', 'NIT', 'ID Imagen', 'Link Imagen', 'Usuario']);
      allData.push(nuevaFila);
    }
    
    sheets.update({ values: allData }, SPREADSHEET_ID, `${SHEET_NAME}!A:J`, { valueInputOption: 'USER_ENTERED' });
    return "¡Datos guardados correctamente!";

  } catch (error) {
    throw new Error('No se pudieron guardar los datos: ' + error.message);
  }
}

function cambiarPassword(token, newPassword) {

  if (!token || !newPassword)
    return ContentService.createTextOutput(JSON.stringify({
      success:false,
      message:'Datos incompletos'
    })).setMimeType(ContentService.MimeType.JSON);

  const validacion = validarToken(token);

  if (!validacion.valid)
    return ContentService.createTextOutput(JSON.stringify({
      success:false,
      message: validacion.message
    })).setMimeType(ContentService.MimeType.JSON);

  let users = getUsers();
  const index = users.findIndex(u => u.id === validacion.userId);

  if (index === -1)
    return ContentService.createTextOutput(JSON.stringify({
      success:false,
      message:'Usuario no encontrado'
    })).setMimeType(ContentService.MimeType.JSON);

  users[index].password = newPassword;
  saveUsers(users);

  invalidarToken(token);

  return ContentService.createTextOutput(JSON.stringify({
    success:true,
    message:'Contraseña actualizada correctamente'
  })).setMimeType(ContentService.MimeType.JSON);
}