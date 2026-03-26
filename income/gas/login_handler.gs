/**
 * GAS — Login Handler
 * Spreadsheet: 133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI
 * Hoja LOGIN — columnas:
 *   A=USUARIO | B=NOMBRE | C=CORREO | D=TELEFONO | E=ROL | F=CONTRASEÑA | G=TIMESTAMP | H=ID_DEVICE | I=ACTIVO
 *
 * REQUISITO: habilitar "Google Sheets API" como servicio avanzado en el proyecto GAS:
 *   Editor → Servicios (+) → Google Sheets API → Agregar
 *   Esto expone el objeto global `Sheets` con OAuth del propio GAS — sin API key, sin SpreadsheetApp.
 *
 * Acciones POST (form-urlencoded):
 *   register_login  → escribe G=TIMESTAMP, H=ID_DEVICE, I=1
 *   logout          → escribe I=0
 *
 * Desplegar: Web App · Ejecutar como: Yo · Acceso: Cualquier persona
 */

var SPREADSHEET_ID = '133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI';
var SHEET_NAME     = 'LOGIN';

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
    if (body.action === 'register_login') return _registerLogin(body);
    if (body.action === 'logout')         return _logout(body);
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
