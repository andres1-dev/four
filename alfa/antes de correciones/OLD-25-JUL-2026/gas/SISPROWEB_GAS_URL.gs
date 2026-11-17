// GAS para Gestionar Datos Faltantes (SISPROWEB y COLORES)
const SPREADSHEET_ID = '133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI';

/**
 * IMPORTANTE: Para usar Sheets API v4 desde GAS, debes habilitar la API avanzada:
 * 1. En el editor de Apps Script, ve a "Servicios" (icono +)
 * 2. Busca "Google Sheets API"
 * 3. Selecciona v4 y haz clic en "Agregar"
 * 
 * Una vez habilitada, puedes usar Sheets.Spreadsheets.Values.* directamente
 */

function solicitarPermisos() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('✅ Permisos otorgados correctamente');
    return 'Permisos configurados correctamente';
  } catch (error) {
    Logger.log('❌ Error al solicitar permisos: ' + error.message);
    throw error;
  }
}

function doPost(e) {
  try {
    if (!e || !e.parameter) {
      return crearRespuesta(false, 'No se recibieron datos');
    }
    
    const action = e.parameter.action;
    const datosJSON = e.parameter.datos;
    const password = e.parameter.password;
    
    if (!action || !datosJSON) {
      return crearRespuesta(false, 'Faltan parámetros (action o datos)');
    }
    
    // Seguridad para borrado
    if (action.startsWith('delete') && password !== 'One654321') {
      return crearRespuesta(false, 'Contraseña de borrado incorrecta');
    }
    
    const datos = JSON.parse(datosJSON);
    let result;
    
    switch(action) {
      case 'appendData': result = agregarSISPROWEB(datos); break;
      case 'appendColor': result = agregarColores(datos); break;
      case 'appendUsuario': result = agregarUsuarios(datos); break;
      case 'appendCliente': result = agregarClientes(datos); break;
      case 'updateCliente': result = actualizarCliente(datos); break;
      case 'appendProveedor': result = agregarProveedores(datos); break;
      case 'appendAuditor': result = agregarAuditores(datos); break;
      case 'appendGestor': result = agregarGestores(datos); break;
      case 'deleteColor': result = eliminarGenerico('COLORES', datos.id, 0); break;
      case 'deleteUsuario': result = eliminarGenerico('USUARIOS', datos.id, 0); break;
      case 'deleteCliente': result = eliminarGenerico('CLIENTES', datos.id, 0); break;
      case 'deleteProveedor': result = eliminarGenerico('PROVEEDORES', datos.id, 0); break;
      case 'deleteAuditor': result = eliminarGenerico('AUDITORES', datos.id, 0); break;
      case 'deleteGestor': result = eliminarGenerico('GESTORES', datos.id, 0); break;
      case 'agregarPedido': result = agregarPedido(datos); break;
      case 'actualizarPedido': result = actualizarPedido(datos); break;
      case 'eliminarPedido': result = eliminarPedido(datos); break;
      case 'finalizarPedido': result = finalizarPedido(datos); break;
      case 'eliminarFinalizado': result = eliminarFinalizado(datos); break;
      default: return crearRespuesta(false, 'Acción no válida: ' + action);
    }
    
    return crearRespuesta(true, result.mensaje, result);
    
  } catch (error) {
    return crearRespuesta(false, 'Error en doPost: ' + error.message);
  }
}

/**
 * Lógica genérica para eliminar una fila por su ID
 */
function eliminarGenerico(sheetName, id, colIndex) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { mensaje: 'Hoja no encontrada', ok: false };
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]).trim().toUpperCase() === String(id).trim().toUpperCase()) {
      sheet.deleteRow(i + 1);
      return { mensaje: 'Registro eliminado con éxito', ok: true };
    }
  }
  return { mensaje: 'ID no encontrado para eliminación', ok: false };
}

/**
 * Agrega o actualiza usuarios a la hoja USUARIOS (CRUD)
 */
function agregarUsuarios(datos) {
  const SHEET_NAME = 'USUARIOS';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['USUARIO', 'NOMBRE', 'ESTADO']);
  }
  
  const lastRow = sheet.getLastRow();
  const allData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 3).getValues() : [];
  
  const idRowMap = {};
  allData.forEach((r, i) => {
    const id = String(r[0] || '').trim().toUpperCase();
    if (id) idRowMap[id] = i;
  });

  const nuevos = [];
  const actualizaciones = [];
  
  datos.forEach(reg => {
    // reg: [id, nombre, estado]
    const id = String(reg[0] || '').trim().toUpperCase();
    const nombre = String(reg[1] || '').trim().toUpperCase();
    const estado = String(reg[2] || '').trim().toUpperCase();
    
    if (idRowMap.hasOwnProperty(id)) {
      const i = idRowMap[id];
      const nombreActual = String(allData[i][1] || '').trim().toUpperCase();
      const estadoActual = String(allData[i][2] || '').trim().toUpperCase();
      
      if (nombreActual !== nombre || estadoActual !== estado) {
        actualizaciones.push({ rowIndex: i + 2, valores: [id, nombre, estado] });
      }
    } else {
      nuevos.push([reg[0], reg[1], reg[2]]);
      idRowMap[id] = lastRow + nuevos.length - 1;
    }
  });
  
  if (nuevos.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, nuevos.length, 3).setValues(nuevos);
  }
  
  if (actualizaciones.length > 0) {
    actualizaciones.forEach(({ rowIndex, valores }) => {
      sheet.getRange(rowIndex, 1, 1, 3).setValues([valores]);
    });
  }
  
  return { mensaje: `Sincronización terminada: ${nuevos.length} nuevos, ${actualizaciones.length} actualizados`, ok: true };
}

/**
 * Agrega o actualiza proveedores
 */
function agregarProveedores(datos) {
  const SHEET_NAME = 'PROVEEDORES';
  return sincronizarGenerico(SHEET_NAME, datos, ['ID_PROVEEDOR', 'PROVEEDOR', 'ESTADO']);
}

/**
 * Agrega o actualiza auditores
 */
function agregarAuditores(datos) {
  const SHEET_NAME = 'AUDITORES';
  return sincronizarGenerico(SHEET_NAME, datos, ['ID_AUDITOR', 'AUDITOR', 'ESTADO']);
}

/**
 * Agrega o actualiza gestores
 */
function agregarGestores(datos) {
  const SHEET_NAME = 'GESTORES';
  return sincronizarGenerico(SHEET_NAME, datos, ['ID_GESTOR', 'GESTOR', 'ESTADO']);
}

/**
 * Lógica genérica de sincronización UPSERT para tablas ID | NOMBRE | ESTADO
 */
function sincronizarGenerico(sheetName, datos, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  
  const lastRow = sheet.getLastRow();
  const allData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 3).getValues() : [];
  
  const idRowMap = {};
  allData.forEach((r, i) => {
    const id = String(r[0] || '').trim().toUpperCase();
    if (id) idRowMap[id] = i;
  });

  const nuevos = [];
  const actualizaciones = [];
  
  datos.forEach(reg => {
    // reg: [id, nombre, estado]
    const id = String(reg[0] || '').trim().toUpperCase();
    const nombre = String(reg[1] || '').trim().toUpperCase();
    const estado = String(reg[2] || '').trim().toUpperCase();
    
    if (idRowMap.hasOwnProperty(id)) {
      const i = idRowMap[id];
      const prodActual = allData[i];
      if (String(prodActual[1]).toUpperCase() !== nombre || String(prodActual[2]).toUpperCase() !== estado) {
        actualizaciones.push({ rowIndex: i + 2, valores: [reg[0], reg[1], reg[2]] });
      }
    } else {
      nuevos.push([reg[0], reg[1], reg[2]]);
      idRowMap[id] = lastRow + nuevos.length - 1;
    }
  });
  
  if (nuevos.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, nuevos.length, 3).setValues(nuevos);
  }
  
  if (actualizaciones.length > 0) {
    actualizaciones.forEach(({ rowIndex, valores }) => {
      sheet.getRange(rowIndex, 1, 1, 3).setValues([valores]);
    });
  }
  
  return { mensaje: `${sheetName} sincronizado: ${nuevos.length} nuevos, ${actualizaciones.length} actualizados`, ok: true };
}

/**
 * Agrega o actualiza clientes a la hoja CLIENTES (CRUD)
 */
function agregarClientes(datos) {
  const SHEET_NAME = 'CLIENTES';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', 'RAZON_SOCIAL', 'NOMBRE_CORTO', 'TIPO_CLIENTE', 'ESTADO', 'DIRECCION', 'TELEFONO', 'EMAIL', 'TIPO_EMPRESA']);
  }
  
  const lastRow = sheet.getLastRow();
  const allData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 9).getValues() : [];
  
  const idRowMap = {};
  allData.forEach((r, i) => {
    const id = String(r[0] || '').trim().toUpperCase();
    if (id) idRowMap[id] = i;
  });

  const nuevos = [];
  const actualizaciones = [];
  
  datos.forEach(reg => {
    const id = String(reg[0] || '').trim().toUpperCase();
    if (idRowMap.hasOwnProperty(id)) {
      const i = idRowMap[id];
      // Comparación simplificada (podríamos comparar columna a columna)
      actualizaciones.push({ rowIndex: i + 2, valores: reg });
    } else {
      nuevos.push(reg);
    }
  });
  
  if (nuevos.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, nuevos.length, 9).setValues(nuevos);
  }
  
  if (actualizaciones.length > 0) {
    actualizaciones.forEach(({ rowIndex, valores }) => {
      sheet.getRange(rowIndex, 1, 1, 9).setValues([valores]);
    });
  }
  
  return { mensaje: `Clientes sincronizados: ${nuevos.length} nuevos, ${actualizaciones.length} actualizados`, ok: true };
}

/**
 * Actualiza un cliente existente en CLIENTES buscando por ID (col A).
 * Recibe la fila completa: [ID, Razón Social, Nombre Corto, Tipo Cliente, Estado, Dirección, Teléfono, Email, Tipo Empresa]
 */
function actualizarCliente(fila) {
  if (!Array.isArray(fila) || fila.length < 9) {
    return { mensaje: 'Fila inválida: se esperan 9 columnas', ok: false };
  }

  const SHEET_NAME = 'CLIENTES';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { mensaje: 'Hoja CLIENTES no encontrada', ok: false };

  const idBuscado = String(fila[0] || '').trim().toUpperCase();
  if (!idBuscado) return { mensaje: 'ID vacío', ok: false };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { mensaje: 'Hoja CLIENTES sin registros', ok: false };

  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim().toUpperCase() === idBuscado) {
      const rowIndex = i + 2; // +1 por header, +1 por 1-based
      sheet.getRange(rowIndex, 1, 1, 9).setValues([fila]);
      SpreadsheetApp.flush();
      return { mensaje: `Cliente ${fila[0]} actualizado en fila ${rowIndex}`, ok: true };
    }
  }

  return { mensaje: `Cliente con ID ${fila[0]} no encontrado en CLIENTES`, ok: false };
}

/**
 * PEDIDOS_ACTIVOS: Estructura de columnas
 * ID | MAYORISTA_ID | NOMBRE_CLIENTE | OP | REFERENCIA | PRENDA | GENERO | CANTIDAD | OBS | FECHA | ESTADO
 * 
 * PEDIDOS_FINALIZADOS: Estructura de columnas
 * ID | MAYORISTA_ID | NOMBRE_CLIENTE | OP | REFERENCIA | PRENDA | GENERO | CANTIDAD | OBS | FECHA | ESTADO | FECHA_FINALIZADO
 * 
 * OPTIMIZADO: Usa Sheets API v4 para máxima velocidad
 */

function obtenerHojaActivosV4() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PEDIDOS_ACTIVOS');
  if (!sheet) {
    sheet = ss.insertSheet('PEDIDOS_ACTIVOS');
    sheet.getRange(1, 1, 1, 11).setValues([[
      'ID', 'MAYORISTA_ID', 'NOMBRE_CLIENTE', 'OP', 'REFERENCIA', 
      'PRENDA', 'GENERO', 'CANTIDAD', 'OBS', 'FECHA', 'ESTADO'
    ]]);
  }
  return sheet;
}

function obtenerHojaFinalizadosV4() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PEDIDOS_FINALIZADOS');
  if (!sheet) {
    sheet = ss.insertSheet('PEDIDOS_FINALIZADOS');
    sheet.getRange(1, 1, 1, 12).setValues([[
      'ID', 'MAYORISTA_ID', 'NOMBRE_CLIENTE', 'OP', 'REFERENCIA', 
      'PRENDA', 'GENERO', 'CANTIDAD', 'OBS', 'FECHA', 'ESTADO', 'FECHA_FINALIZADO'
    ]]);
  }
  return sheet;
}

/**
 * PEDIDOS - Operaciones en tiempo real con Sheets API v4
 */

function agregarPedido(pedido) {
  obtenerHojaActivosV4();
  
  var values = [[
    pedido.id || '',
    pedido.mayoristaId || '',
    pedido.nombreCliente || '',
    pedido.op || '',
    pedido.referencia || '',
    pedido.prenda || '',
    pedido.genero || '',
    pedido.cantidad || 0,
    pedido.obs || '',
    pedido.fecha || '',
    pedido.estado || 'PENDIENTE'
  ]];
  
  var valueRange = Sheets.newValueRange();
  valueRange.values = values;
  Sheets.Spreadsheets.Values.append(valueRange, SPREADSHEET_ID, 'PEDIDOS_ACTIVOS!A:K', {
    valueInputOption: 'RAW'
  });
  
  return { mensaje: 'Pedido agregado', ok: true };
}

function actualizarPedido(pedido) {
  var sheet = obtenerHojaActivosV4();
  var data = sheet.getDataRange().getValues();
  
  // Buscar la fila del pedido por ID
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === pedido.id) {
      var range = 'PEDIDOS_ACTIVOS!A' + (i + 1) + ':K' + (i + 1);
      var values = [[
        pedido.id || '',
        pedido.mayoristaId || '',
        pedido.nombreCliente || '',
        pedido.op || '',
        pedido.referencia || '',
        pedido.prenda || '',
        pedido.genero || '',
        pedido.cantidad || 0,
        pedido.obs || '',
        pedido.fecha || '',
        pedido.estado || 'PENDIENTE'
      ]];
      
      var valueRange = Sheets.newValueRange();
      valueRange.values = values;
      Sheets.Spreadsheets.Values.update(valueRange, SPREADSHEET_ID, range, {
        valueInputOption: 'RAW'
      });
      
      return { mensaje: 'Pedido actualizado', ok: true };
    }
  }
  
  return { mensaje: 'Pedido no encontrado', ok: false };
}

function eliminarPedido(datos) {
  var sheet = obtenerHojaActivosV4();
  var data = sheet.getDataRange().getValues();
  
  // Buscar la fila del pedido por ID
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === datos.id) {
      sheet.deleteRow(i + 1);
      return { mensaje: 'Pedido eliminado', ok: true };
    }
  }
  
  return { mensaje: 'Pedido no encontrado', ok: false };
}

function finalizarPedido(pedido) {
  var sheetActivos = obtenerHojaActivosV4();
  var sheetFinalizados = obtenerHojaFinalizadosV4();
  var data = sheetActivos.getDataRange().getValues();
  
  // Buscar el pedido en activos
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === pedido.id) {
      // Agregar a finalizados
      var values = [[
        pedido.id || '',
        pedido.mayoristaId || '',
        pedido.nombreCliente || '',
        pedido.op || '',
        pedido.referencia || '',
        pedido.prenda || '',
        pedido.genero || '',
        pedido.cantidad || 0,
        pedido.obs || '',
        pedido.fecha || '',
        'COMPLETADO',
        pedido.fechaFin || ''
      ]];
      
      var valueRange = Sheets.newValueRange();
      valueRange.values = values;
      Sheets.Spreadsheets.Values.append(valueRange, SPREADSHEET_ID, 'PEDIDOS_FINALIZADOS!A:L', {
        valueInputOption: 'RAW'
      });
      
      // Eliminar de activos
      sheetActivos.deleteRow(i + 1);
      
      return { mensaje: 'Pedido finalizado', ok: true };
    }
  }
  
  return { mensaje: 'Pedido no encontrado', ok: false };
}

function eliminarFinalizado(datos) {
  var sheet = obtenerHojaFinalizadosV4();
  var data = sheet.getDataRange().getValues();
  
  // Buscar la fila del pedido por ID
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === datos.id) {
      sheet.deleteRow(i + 1);
      return { mensaje: 'Finalizado eliminado', ok: true };
    }
  }
  
  return { mensaje: 'Finalizado no encontrado', ok: false };
}

/**
 * Agrega registros a la hoja SISPROWEB evitando duplicados por Columna C.
 * Si el registro ya existe pero col E (referencia) está vacía, la actualiza.
 */
function agregarSISPROWEB(datos) {
  const SHEET_NAME = 'SISPROWEB';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Columna C', 'Columna AJ', 'Columna AK', 'Columna AL', 'Columna B']);
  }

  const lastRow = sheet.getLastRow();
  // Leer cols A-E de todas las filas existentes en una sola llamada
  const allData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 5).getValues() : [];

  // Mapa: OP -> índice 0-based
  const opRowMap = {};
  allData.forEach((r, i) => {
    const op = String(r[0] || '').trim().toUpperCase();
    if (op) opRowMap[op] = i;
  });

  const nuevos = [];
  const actualizaciones = [];
  let duplicados = 0;

  datos.forEach(reg => {
    const id = String(reg['Columna C'] || '').trim().toUpperCase();
    if (!id || isNaN(id)) return;

    const referencia = String(reg['Columna B'] || '').trim();

    if (opRowMap.hasOwnProperty(id)) {
      const i = opRowMap[id];
      const refActual = String(allData[i][4] || '').trim(); // col E = índice 4
      if (!refActual && referencia) {
        actualizaciones.push({ rowIndex: i + 2, referencia }); // i+2: 1-based + header
      } else {
        duplicados++;
      }
    } else {
      nuevos.push([
        reg['Columna C'] || '',
        reg['Columna AJ'] || '',
        reg['Columna AK'] || '',
        reg['Columna AL'] || '',
        referencia
      ]);
      opRowMap[id] = lastRow + nuevos.length - 1;
    }
  });

  if (nuevos.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, nuevos.length, 5).setValues(nuevos);
  }

  if (actualizaciones.length > 0) {
    actualizaciones.forEach(({ rowIndex, referencia }) => {
      sheet.getRange(rowIndex, 5).setValue(referencia);
    });
    SpreadsheetApp.flush();
  }

  return {
    mensaje: `${nuevos.length} nuevos, ${actualizaciones.length} referencias actualizadas, ${duplicados} sin cambios`,
    registrosNuevos: nuevos.length,
    referenciasActualizadas: actualizaciones.length,
    registrosDuplicados: duplicados
  };
}

/**
 * Agrega registros a la hoja COLORES evitando duplicados por Código
 */
function agregarColores(datos) {
  const SHEET_NAME = 'COLORES';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['CODIGO', 'COLOR']);
  }
  
  const lastRow = sheet.getLastRow();
  const allData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 2).getValues() : [];
  
  const idRowMap = {};
  allData.forEach((r, i) => {
    const id = String(r[0] || '').trim().toUpperCase();
    if (id) idRowMap[id] = i;
  });

  const nuevos = [];
  const actualizaciones = [];
  let sinCambios = 0;
  
  datos.forEach(reg => {
    const id = String(reg.codigo || '').trim().toUpperCase();
    const nombre = String(reg.nombre || '').trim().toUpperCase();
    
    if (idRowMap.hasOwnProperty(id)) {
      const i = idRowMap[id];
      const nombreActual = String(allData[i][1] || '').trim().toUpperCase();
      if (nombreActual !== nombre) {
        actualizaciones.push({ rowIndex: i + 2, nombre });
      } else {
        sinCambios++;
      }
    } else {
      nuevos.push([reg.codigo, reg.nombre]);
      idRowMap[id] = lastRow + nuevos.length - 1;
    }
  });
  
  if (nuevos.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, nuevos.length, 2).setValues(nuevos);
  }
  
  if (actualizaciones.length > 0) {
    actualizaciones.forEach(({ rowIndex, nombre }) => {
      sheet.getRange(rowIndex, 2).setValue(nombre);
    });
    SpreadsheetApp.flush();
  }
  
  return {
    mensaje: `Proceso completado: ${nuevos.length} nuevos, ${actualizaciones.length} actualizados, ${sinCambios} sin cambios`,
    ok: true
  };
}

/**
 * Utilidad para obtener un Set de valores existentes en una columna
 */
function obtenerSetExistentes(sheet, colIndex) {
  const total = sheet.getLastRow();
  const set = new Set();
  if (total > 1) {
    const data = sheet.getRange(2, colIndex, total - 1, 1).getValues();
    data.forEach(r => {
      if (r[0]) set.add(String(r[0]).trim().toUpperCase());
    });
  }
  return set;
}

function crearRespuesta(success, message, data = {}) {
  return ContentService.createTextOutput(JSON.stringify({
    success: success,
    message: message,
    data: data
  })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return crearRespuesta(true, 'Servicio de Datos Activo');
}