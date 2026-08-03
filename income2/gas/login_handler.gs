/**
 * GAS — Login Handler
 * Spreadsheet: 133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI
 * Hoja LOGIN — columnas:
 *   A=USUARIO | B=NOMBRE | C=CORREO | D=TELEFONO | E=ROL | F=CONTRASEÑA | G=TIMESTAMP | H=ID_DEVICE | I=ACTIVO
 *
 * Token de acceso temporal:
 *   Se almacena en ScriptProperties (interno de GAS, sin Sheets).
 *   Clave: 'invite_token'  → valor JSON: { token, expires }
 *   Usuario fijo del token: 222222 (INVITADO / ADMIN)
 *
 * Desplegar: Web App · Ejecutar como: Yo · Acceso: Cualquier persona
 */

var SPREADSHEET_ID  = '133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI';
var SHEET_NAME      = 'LOGIN';
var TOKEN_TTL_MS    = 6 * 60 * 60 * 1000; // 6 horas

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var body = (e.parameter && e.parameter.action) ? e.parameter : JSON.parse(e.postData.contents);
    if (body.action === 'register_login')  return _registerLogin(body);
    if (body.action === 'logout')          return _logout(body);
    if (body.action === 'check_device')    return _checkDevice(body);
    if (body.action === 'update_user')     return _updateUser(body);
    if (body.action === 'create_user')     return _createUser(body);
    if (body.action === 'logout_user')     return _logoutUser(body);
    if (body.action === 'generate_token')  return _generateToken();
    if (body.action === 'validate_token')  return _validateToken(body);
    return _json({ ok: false, error: 'Accion desconocida: ' + body.action });
  } catch (err) {
    return _json({ ok: false, error: err.message });
  }
}

// ─── Busca la fila del usuario con Sheets v4 (servicio avanzado) ──────────────
// Lee solo col A para localizar la fila — mínimo de datos
function _findRow(id_usuario) {
  var result = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, SHEET_NAME + '!A:A');
  var values = result.values || [];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === String(id_usuario).trim()) {
      return i + 1; // Sheets 1-indexed
    }
  }
  return -1;
}

// ─── Escribe un rango con Sheets v4 (servicio avanzado, OAuth de GAS) ─────────
function _write(range, values) {
  Sheets.Spreadsheets.Values.update(
    { range: range, majorDimension: 'ROWS', values: [values] },
    SPREADSHEET_ID,
    range,
    { valueInputOption: 'RAW' }
  );
}

/**
 * register_login — escribe TIMESTAMP (G), ID_DEVICE (H), ACTIVO=1 (I)
 */
function _registerLogin(body) {
  var id_usuario = String(body.id_usuario || '').trim();
  var id_device  = String(body.id_device  || 'DESCONOCIDO').trim();
  var timestamp  = body.timestamp || new Date().toISOString();

  if (!id_usuario) return _json({ ok: false, error: 'id_usuario requerido' });

  try {
    var sheetRow = _findRow(id_usuario);
    if (sheetRow === -1) return _json({ ok: false, error: 'Usuario no encontrado: ' + id_usuario });

    var range = SHEET_NAME + '!G' + sheetRow + ':I' + sheetRow;
    _write(range, [timestamp, id_device, 1]);

    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: err.message });
  }
}

/**
 * logout — escribe ACTIVO=0 (I)
 */
function _logout(body) {
  var id_usuario = String(body.id_usuario || '').trim();
  if (!id_usuario) return _json({ ok: false, error: 'id_usuario requerido' });

  try {
    var sheetRow = _findRow(id_usuario);
    if (sheetRow === -1) return _json({ ok: false, error: 'Usuario no encontrado' });

    var range = SHEET_NAME + '!I' + sheetRow;
    _write(range, [0]);

    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: err.message });
  }
}

/**
 * check_device — verifica si el dispositivo coincide con el registrado
 * OWNER y ADMIN tienen acceso multiplataforma (siempre retorna allowed: true)
 */
function _checkDevice(body) {
  var id_usuario = String(body.id_usuario || '').trim();
  var id_device  = String(body.id_device  || '').trim();
  
  if (!id_usuario || !id_device) return _json({ ok: false, error: 'id_usuario e id_device requeridos' });

  try {
    var sheetRow = _findRow(id_usuario);
    if (sheetRow === -1) return _json({ ok: false, error: 'Usuario no encontrado' });

    // Leer ROL (E), ID_DEVICE (H), ACTIVO (I)
    var range = SHEET_NAME + '!E' + sheetRow + ':I' + sheetRow;
    var result = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, range);
    var values = result.values || [];
    
    if (values.length === 0 || values[0].length < 5) {
      return _json({ ok: false, error: 'Datos incompletos' });
    }

    var rol              = String(values[0][0] || 'USER').trim().toUpperCase();
    var registeredDevice = String(values[0][3] || '').trim();
    var isActivo         = String(values[0][4] || '0').trim() === '1';

    // OWNER y ADMIN tienen acceso multiplataforma
    if (rol === 'OWNER' || rol === 'ADMIN') {
      return _json({ ok: true, allowed: true, multiplatform: true });
    }

    // Para otros roles, validar dispositivo
    if (!isActivo) {
      return _json({ ok: true, allowed: true });
    }

    if (registeredDevice === id_device) {
      return _json({ ok: true, allowed: true });
    }

    return _json({ ok: true, allowed: false });
  } catch (err) {
    return _json({ ok: false, error: err.message });
  }
}

/**
 * update_user — actualiza datos de un usuario existente
 * Campos: usuario, nombre, correo, telefono, rol, password (opcional), activo
 */
function _updateUser(body) {
  var usuario  = String(body.usuario || '').trim();
  var nombre   = String(body.nombre || '').trim();
  var correo   = String(body.correo || '').trim();
  var telefono = String(body.telefono || '').trim();
  var rol      = String(body.rol || 'USER').trim().toUpperCase();
  var password = String(body.password || '').trim();
  var activo   = String(body.activo || '1').trim();

  if (!usuario || !nombre) {
    return _json({ success: false, message: 'Usuario y nombre son requeridos' });
  }

  try {
    var sheetRow = _findRow(usuario);
    if (sheetRow === -1) {
      return _json({ success: false, message: 'Usuario no encontrado: ' + usuario });
    }

    // Actualizar B=NOMBRE, C=CORREO, D=TELEFONO, E=ROL, I=ACTIVO
    var range = SHEET_NAME + '!B' + sheetRow + ':E' + sheetRow;
    _write(range, [nombre, correo, telefono, rol]);

    // Si se proporciona contraseña, actualizarla
    if (password) {
      var passRange = SHEET_NAME + '!F' + sheetRow;
      _write(passRange, [password]);
    }

    // Actualizar estado activo
    var activoRange = SHEET_NAME + '!I' + sheetRow;
    _write(activoRange, [activo]);

    return _json({ success: true, message: 'Usuario actualizado correctamente' });
  } catch (err) {
    return _json({ success: false, message: err.message });
  }
}

/**
 * create_user — crea un nuevo usuario
 * Campos: usuario, nombre, correo, telefono, rol, password
 */
function _createUser(body) {
  var usuario  = String(body.usuario || '').trim();
  var nombre   = String(body.nombre || '').trim();
  var correo   = String(body.correo || '').trim();
  var telefono = String(body.telefono || '').trim();
  var rol      = String(body.rol || 'USER').trim().toUpperCase();
  var password = String(body.password || '').trim();

  if (!usuario || !nombre || !password) {
    return _json({ success: false, message: 'Usuario, nombre y contraseña son requeridos' });
  }

  try {
    // Verificar si el usuario ya existe
    var existingRow = _findRow(usuario);
    if (existingRow !== -1) {
      return _json({ success: false, message: 'El usuario ya existe' });
    }

    // Obtener la última fila
    var result = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, SHEET_NAME + '!A:A');
    var values = result.values || [];
    var nextRow = values.length + 1;

    // Insertar nuevo usuario: A=USUARIO, B=NOMBRE, C=CORREO, D=TELEFONO, E=ROL, F=PASSWORD, G=TIMESTAMP, H=ID_DEVICE, I=ACTIVO
    var range = SHEET_NAME + '!A' + nextRow + ':I' + nextRow;
    var timestamp = new Date().toISOString();
    _write(range, [usuario, nombre, correo, telefono, rol, password, timestamp, '', '1']);

    return _json({ success: true, message: 'Usuario creado correctamente' });
  } catch (err) {
    return _json({ success: false, message: err.message });
  }
}

/**
 * logout_user — cierra la sesión de un usuario (limpia device y pone activo en 0)
 */
function _logoutUser(body) {
  var usuario = String(body.usuario || '').trim();
  
  if (!usuario) {
    return _json({ success: false, message: 'Usuario requerido' });
  }

  try {
    var sheetRow = _findRow(usuario);
    if (sheetRow === -1) {
      return _json({ success: false, message: 'Usuario no encontrado' });
    }

    // Limpiar H=ID_DEVICE y poner I=ACTIVO en 0
    var range = SHEET_NAME + '!H' + sheetRow + ':I' + sheetRow;
    _write(range, ['', '0']);

    return _json({ success: true, message: 'Sesión cerrada correctamente' });
  } catch (err) {
    return _json({ success: false, message: err.message });
  }
}

/**
 * generate_token — genera token y lo guarda en ScriptProperties.
 * No depende de ningún usuario en Sheets.
 */
function _generateToken() {
  try {
    var bytes = [];
    for (var i = 0; i < 32; i++) bytes.push(Math.floor(Math.random() * 256));
    var token   = bytes.map(function(b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    var expires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    PropertiesService.getScriptProperties().setProperty('invite_token', JSON.stringify({
      token:   token,
      expires: expires,
      usuario: 'INVITADO',
      nombre:  'INVITADO',
      correo:  '',
      tel:     '',
      rol:     'ADMIN'
    }));

    return _json({ ok: true, token: token });
  } catch (err) {
    return _json({ ok: false, error: err.message });
  }
}

/**
 * validate_token — verifica el token contra ScriptProperties.
 * Retorna los datos de sesión si es válido, o valid:false si venció.
 */
function _validateToken(body) {
  var token = String(body.token || '').trim();
  if (!token) return _json({ ok: false, error: 'token requerido' });

  try {
    var props = PropertiesService.getScriptProperties();
    var raw   = props.getProperty('invite_token');
    if (!raw) return _json({ ok: true, valid: false, reason: 'not_found' });

    var data = JSON.parse(raw);

    if (data.token !== token) return _json({ ok: true, valid: false, reason: 'not_found' });

    if (Date.now() > new Date(data.expires).getTime()) {
      props.deleteProperty('invite_token');
      return _json({ ok: true, valid: false, reason: 'expired' });
    }

    return _json({
      ok:      true,
      valid:   true,
      usuario: data.usuario,
      nombre:  data.nombre,
      correo:  data.correo,
      tel:     data.tel,
      rol:     data.rol,
      expires: data.expires
    });
  } catch (err) {
    return _json({ ok: false, error: err.message });
  }
}
