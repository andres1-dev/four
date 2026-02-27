/**
 * Google Apps Script - Versión Actualizada
 * Compatible con iOS PWA y FormData
 */

function doGet(e) {
  // Esta función maneja las solicitudes GET
  return ContentService.createTextOutput("Esta API solo acepta solicitudes POST");
}

function doPost(e) {
  try {
    // Verificar si es una solicitud de email (viene como FormData con parámetros)
    if (e.parameter && e.parameter.action === 'sendEmail') {
      return sendEmailWithoutImage(e.parameter);
    }
    
    // Verificar si es una solicitud de subida de imagen con FormData
    if (e.parameter && e.parameter.action === 'uploadImage') {
      return handleImageUploadFromFormData(e);
    }
    
    // Si no tiene parámetro action, asumir que es el método antiguo (base64 directo)
    // Esto mantiene compatibilidad con versiones anteriores
    if (e.postData && e.postData.contents) {
      return handleImageUploadFromBase64(e.postData.contents);
    }
    
    // Si llegamos aquí, no sabemos qué hacer con esta petición
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Formato de petición no reconocido"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Manejar errores
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.message,
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Maneja la subida de imagen desde FormData (nuevo método, compatible con iOS)
 */
function handleImageUploadFromFormData(e) {
  try {
    // Obtener el archivo de la petición
    const imageBlob = e.parameters.image[0];
    
    if (!imageBlob) {
      throw new Error("No se recibió ninguna imagen");
    }
    
    // Renombrar el blob
    const renamedBlob = imageBlob.setName('reporte_' + new Date().getTime() + '.jpg');
    
    // Subir a la carpeta específica de Drive
    const folderId = "1HuC5GlMg1hdziLS08bhw4EkMrcmxQ5u0";
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(renamedBlob);
    
    // Hacer el archivo público
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Obtener el ID del archivo
    const fileId = file.getId();
    
    // Crear el enlace público (lh3)
    const imageUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    
    // Devolver la respuesta con el enlace
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      imageUrl: imageUrl,
      fileId: fileId,
      method: "formdata"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Error en handleImageUploadFromFormData: " + error.message,
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Maneja la subida de imagen desde base64 (método antiguo, para compatibilidad)
 */
function handleImageUploadFromBase64(base64Data) {
  try {
    const imageBlob = Utilities.newBlob(
      Utilities.base64Decode(base64Data), 
      'image/jpeg', 
      'reporte_' + new Date().getTime() + '.jpg'
    );
    
    // Subir a la carpeta específica de Drive
    const folderId = "1HuC5GlMg1hdziLS08bhw4EkMrcmxQ5u0";
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(imageBlob);
    
    // Hacer el archivo público
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Obtener el ID del archivo
    const fileId = file.getId();
    
    // Crear el enlace público (lh3)
    const imageUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    
    // Devolver la respuesta con el enlace
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      imageUrl: imageUrl,
      fileId: fileId,
      method: "base64"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Error en handleImageUploadFromBase64: " + error.message,
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Envía email sin imagen adjunta
 */
function sendEmailWithoutImage(data) {
  try {
    const recipients = data.to; // Puede ser múltiples separados por coma
    const cc = data.cc || ''; // Destinatarios en copia
    const bcc = data.bcc || ''; // Destinatarios en copia oculta
    const subject = data.subject;
    const htmlBody = data.body;
    
    // Configurar opciones de email
    const emailOptions = {
      htmlBody: htmlBody,
      name: 'Ingresos Marca Propia'
    };
    
    // Agregar CC si existe
    if (cc) {
      emailOptions.cc = cc;
    }
    
    // Agregar BCC si existe
    if (bcc) {
      emailOptions.bcc = bcc;
    }
    
    // Enviar el email
    GmailApp.sendEmail(recipients, subject, '', emailOptions);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      status: "success",
      message: 'Email enviado correctamente a ' + recipients
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      status: "error",
      message: 'Error al enviar email: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
