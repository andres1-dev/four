// Script para cambiar el rol de un usuario a OWNER
// Ejecutar esta función UNA VEZ para actualizar el rol en Google Sheets

function cambiarUsuarioAOwner() {
  const SPREADSHEET_ID = '1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw';
  const USERS_SHEET_NAME = 'USERS';
  
  try {
    Logger.log('=== Cambiando usuario a OWNER ===');
    
    // Leer todos los usuarios
    const sheets = Sheets.Spreadsheets.Values;
    const range = `${USERS_SHEET_NAME}!A:F`;
    const response = sheets.get(SPREADSHEET_ID, range);
    const data = response.values || [];
    
    if (data.length <= 1) {
      Logger.log('❌ No hay usuarios en la hoja');
      return;
    }
    
    Logger.log('Total de filas: ' + data.length);
    
    // CAMBIAR AQUÍ: Ingresa el ID del usuario que quieres convertir a OWNER
    const USER_ID_TO_CHANGE = '1007348825'; // <-- CAMBIA ESTE ID
    
    let found = false;
    let rowIndex = -1;
    
    // Buscar el usuario (empezar desde fila 2, índice 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && String(row[0]).trim() === USER_ID_TO_CHANGE) {
        found = true;
        rowIndex = i + 1; // +1 porque las hojas empiezan en 1
        Logger.log('✅ Usuario encontrado en fila: ' + rowIndex);
        Logger.log('Datos actuales: ' + JSON.stringify(row));
        
        // Actualizar el rol (columna C, índice 2)
        row[2] = 'OWNER';
        data[i] = row;
        
        Logger.log('Datos actualizados: ' + JSON.stringify(row));
        break;
      }
    }
    
    if (!found) {
      Logger.log('❌ Usuario con ID ' + USER_ID_TO_CHANGE + ' no encontrado');
      Logger.log('Usuarios disponibles:');
      for (let i = 1; i < data.length; i++) {
        Logger.log('  - ID: ' + data[i][0] + ' | Nombre: ' + data[i][1] + ' | Rol: ' + data[i][2]);
      }
      return;
    }
    
    // Escribir todos los datos de vuelta
    Logger.log('Escribiendo cambios en la hoja...');
    sheets.update(
      { values: data },
      SPREADSHEET_ID,
      `${USERS_SHEET_NAME}!A1`,
      { valueInputOption: 'USER_ENTERED' }
    );
    
    Logger.log('✅ ROL CAMBIADO A OWNER EXITOSAMENTE');
    Logger.log('Usuario: ' + USER_ID_TO_CHANGE + ' ahora es OWNER');
    Logger.log('');
    Logger.log('IMPORTANTE: Cierra sesión y vuelve a iniciar sesión para que los cambios surtan efecto.');
    
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.message);
    Logger.log('Stack: ' + error.stack);
  }
}

// Función para listar todos los usuarios y sus roles actuales
function listarTodosLosUsuarios() {
  const SPREADSHEET_ID = '1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw';
  const USERS_SHEET_NAME = 'USERS';
  
  try {
    Logger.log('=== LISTADO DE USUARIOS ===');
    
    const sheets = Sheets.Spreadsheets.Values;
    const range = `${USERS_SHEET_NAME}!A:F`;
    const response = sheets.get(SPREADSHEET_ID, range);
    const data = response.values || [];
    
    if (data.length <= 1) {
      Logger.log('No hay usuarios en la hoja');
      return;
    }
    
    Logger.log('');
    Logger.log('ID | NOMBRE | ROL | EMAIL');
    Logger.log('----------------------------------------');
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      Logger.log(row[0] + ' | ' + row[1] + ' | ' + row[2] + ' | ' + (row[3] || 'Sin email'));
    }
    
    Logger.log('');
    Logger.log('Total de usuarios: ' + (data.length - 1));
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
  }
}

// Función para crear un usuario OWNER desde cero
function crearUsuarioOwner() {
  const SPREADSHEET_ID = '1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw';
  const USERS_SHEET_NAME = 'USERS';
  
  // CONFIGURAR AQUÍ LOS DATOS DEL NUEVO USUARIO OWNER
  const nuevoOwner = {
    id: '1007348825',           // <-- CAMBIAR
    nombre: 'Super Admin',      // <-- CAMBIAR
    rol: 'OWNER',
    email: 'admin@example.com', // <-- CAMBIAR
    phone: '3001234567',        // <-- CAMBIAR
    password: 'owner123'        // <-- CAMBIAR
  };
  
  try {
    Logger.log('=== Creando usuario OWNER ===');
    Logger.log('Datos: ' + JSON.stringify(nuevoOwner));
    
    // Leer usuarios actuales
    const sheets = Sheets.Spreadsheets.Values;
    const range = `${USERS_SHEET_NAME}!A:F`;
    const response = sheets.get(SPREADSHEET_ID, range);
    const data = response.values || [];
    
    // Verificar si el ID ya existe
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).trim() === nuevoOwner.id) {
        Logger.log('❌ ERROR: Ya existe un usuario con ID ' + nuevoOwner.id);
        Logger.log('Usa la función cambiarUsuarioAOwner() para cambiar su rol.');
        return;
      }
    }
    
    // Agregar nuevo usuario
    const nuevaFila = [
      nuevoOwner.id,
      nuevoOwner.nombre,
      nuevoOwner.rol,
      nuevoOwner.email,
      nuevoOwner.phone,
      nuevoOwner.password
    ];
    
    data.push(nuevaFila);
    
    // Escribir de vuelta
    Logger.log('Escribiendo en la hoja...');
    sheets.update(
      { values: data },
      SPREADSHEET_ID,
      `${USERS_SHEET_NAME}!A1`,
      { valueInputOption: 'USER_ENTERED' }
    );
    
    Logger.log('✅ USUARIO OWNER CREADO EXITOSAMENTE');
    Logger.log('ID: ' + nuevoOwner.id);
    Logger.log('Nombre: ' + nuevoOwner.nombre);
    Logger.log('Password: ' + nuevoOwner.password);
    Logger.log('');
    Logger.log('Ya puedes iniciar sesión con estas credenciales.');
    
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.message);
    Logger.log('Stack: ' + error.stack);
  }
}
