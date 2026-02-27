# Instrucciones para Diagnosticar el Problema del Link ih3 en iOS PWA

## Problema Identificado
El link ih3 (URL de la imagen en Drive) no aparece en el mensaje de WhatsApp cuando se envía desde iOS en modo PWA, pero funciona correctamente en PC.

## Cambios Realizados

### 1. Función `openWhatsApp` Mejorada (js/ui/capture.js)
- Detecta específicamente iOS y modo PWA
- Usa `window.open()` en lugar de eventos sintéticos para iOS PWA
- Fallback a `window.location.href` si `window.open` es bloqueado
- Logs detallados para diagnóstico

### 2. Función `uploadImageToDrive` Mejorada (js/ui/capture.js)
- Logs más detallados del proceso de subida
- Mejor manejo de errores
- Validación de la respuesta del servidor
- Logs del tamaño de la imagen y estado HTTP

### 3. Proceso de Captura Mejorado (js/ui/capture.js)
- Indicador de progreso más detallado
- Logs del mensaje completo generado
- Verificación explícita de si el link ih3 está incluido
- Manejo de caso cuando no se obtiene URL

### 4. Herramienta de Debug para iOS (js/utils/ios_debug.js)
- Botón flotante 🐛 en la esquina inferior derecha
- Consola en pantalla para ver logs en iOS
- Intercepta console.log, console.error y console.warn
- Muestra información del entorno (iOS, PWA, Safari, etc.)

## Cómo Probar

### Paso 1: Actualizar la PWA en iOS
1. Abre Safari en tu iPhone/iPad
2. Ve a la aplicación instalada
3. Cierra completamente la app (desliza hacia arriba desde el dock)
4. Vuelve a abrir la app
5. Si no se actualiza automáticamente, desinstala y reinstala la PWA

### Paso 2: Activar el Debug
1. Abre la aplicación
2. Verás un botón flotante 🐛 en la esquina inferior derecha
3. Toca el botón para abrir la consola de debug
4. Verás información del entorno (iOS, PWA Mode, etc.)

### Paso 3: Intentar Enviar el Informe
1. Toca el botón de WhatsApp o el botón de captura
2. Ingresa la contraseña cuando se solicite
3. Observa los logs en la consola de debug (panel negro en la parte inferior)

### Paso 4: Revisar los Logs
Busca estos mensajes clave en la consola:

```
✓ Mensajes de éxito:
- "Subiendo imagen a Drive..."
- "Tamaño de imagen (base64): XXXXX caracteres"
- "Respuesta HTTP status: 200"
- "✓ URL de imagen obtenida exitosamente: [URL]"
- "Link ih3 incluido: SÍ"
- "Abriendo WhatsApp - iOS: true, PWA: true"

✗ Mensajes de error a buscar:
- "✗ Error al subir la imagen: [mensaje]"
- "✗ Error en la petición a Drive: [error]"
- "Link ih3 incluido: NO"
- "No se pudo obtener URL de imagen"
```

## Posibles Causas del Problema

### 1. La imagen NO se está subiendo a Drive
**Síntomas:**
- Log: "✗ Error al subir la imagen"
- Log: "Link ih3 incluido: NO"

**Solución:**
- Verificar conexión a internet en iOS
- Verificar que el script de Google Apps Script esté funcionando
- Revisar permisos de CORS en el servidor

### 2. La imagen SÍ se sube pero el link no aparece en WhatsApp
**Síntomas:**
- Log: "✓ URL de imagen obtenida exitosamente"
- Log: "Link ih3 incluido: SÍ"
- Pero el mensaje de WhatsApp no tiene el link

**Solución:**
- El problema está en la función `openWhatsApp`
- iOS puede estar truncando el mensaje por ser muy largo
- Verificar que el mensaje no exceda el límite de caracteres de WhatsApp

### 3. WhatsApp no se abre correctamente
**Síntomas:**
- La app no redirige a WhatsApp
- Se queda en la misma pantalla

**Solución:**
- Verificar que WhatsApp esté instalado
- Verificar permisos de la PWA para abrir otras apps

## Información Adicional para Compartir

Si el problema persiste, por favor comparte:

1. **Logs completos** de la consola de debug (toma captura de pantalla)
2. **Información del entorno** (aparece al tocar el botón 🐛)
3. **Versión de iOS** (Ajustes > General > Información)
4. **¿El mensaje de WhatsApp se abre?** (Sí/No)
5. **¿Qué parte del mensaje aparece?** (¿Solo el texto? ¿Falta solo el link ih3?)

## Solución Temporal

Si el problema persiste, puedes:
1. Usar la versión web en Safari (no PWA) para enviar informes
2. Enviar el informe desde PC
3. Descargar la imagen y compartirla manualmente por WhatsApp

## Notas Técnicas

- El link ih3 es generado por Google Drive después de subir la imagen
- La función `uploadImageToDrive` hace un POST a Google Apps Script
- El script debe devolver un objeto JSON con `{status: "success", imageUrl: "https://..."}`
- iOS PWA tiene restricciones de seguridad más estrictas que Safari normal
- `window.open()` puede ser bloqueado por el navegador si no es una acción directa del usuario
