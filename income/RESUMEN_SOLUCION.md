# 🔧 Solución al Problema del Link ih3 en iOS PWA

## 📋 Resumen Ejecutivo

**Problema:** El link ih3 no aparece en WhatsApp cuando se envía desde iOS PWA.

**Causa:** 
- Imagen demasiado grande (~8.8 MB)
- iOS PWA bloquea peticiones POST con base64 directo (error CORS)

**Solución:**
1. Reducir tamaño de imagen (PNG → JPEG, calidad 0.7)
2. Usar FormData en lugar de base64 directo
3. Actualizar Google Apps Script para manejar FormData

---

## ✅ PASOS PARA IMPLEMENTAR (EN ORDEN)

### 1️⃣ Actualizar Google Apps Script (CRÍTICO)

**Ubicación:** https://script.google.com

**Acción:**
1. Abre tu proyecto de Google Apps Script
2. Reemplaza TODO el código con el contenido de `google-apps-script-actualizado.js`
3. Guarda (Ctrl+S)
4. **IMPORTANTE:** Implementar nueva versión:
   - Clic en "Implementar" → "Administrar implementaciones"
   - Clic en ícono de lápiz (editar)
   - En "Versión" → "Nueva versión"
   - Clic en "Implementar"

**Verificación:** La URL debe seguir siendo la misma:
```
https://script.google.com/macros/s/AKfycbz6sUS28Xza02Kjwg-Eez1TPn4BBj2XcZGF8gKxEHr4Fsxz4eqYoQYHCqx5NWaOP1OR8g/exec
```

---

### 2️⃣ Subir Cambios a GitHub

Los archivos ya están actualizados en tu workspace local. Necesitas hacer commit y push:

```bash
git add .
git commit -m "Fix: Solución para link ih3 en iOS PWA - FormData y JPEG"
git push origin main
```

---

### 3️⃣ Actualizar PWA en iOS

**Opción A - Forzar actualización:**
1. Cierra completamente la app PWA
2. Espera 10 segundos
3. Vuelve a abrir

**Opción B - Reinstalar (más seguro):**
1. Mantén presionado el ícono de la app
2. "Eliminar app"
3. Abre Safari
4. Ve a: https://andres1-dev.github.io/four/income/
5. Botón compartir → "Añadir a pantalla de inicio"

---

### 4️⃣ Probar

1. Abre la app PWA en iOS
2. Toca el botón 🐛 (esquina inferior derecha)
3. Envía un informe
4. Verifica los logs:

**✅ Logs de éxito esperados:**
```
Tamaño de imagen (base64): ~2000000 caracteres (antes: 8885020)
Tamaño del blob: ~1500000 bytes
Respuesta HTTP status: 200
✓ URL de imagen obtenida exitosamente: https://lh3.googleusercontent.com/d/...
Link ih3 incluido: SÍ
```

**❌ Si ves esto, algo salió mal:**
```
ERROR: ✗ Error en la petición a Drive: TypeError: Load failed
Link ih3 incluido: NO
```

---

## 🎯 Cambios Principales

### Archivo: `js/ui/capture.js`

**Antes:**
```javascript
// PNG grande
const imageData = canvas.toDataURL('image/png', 1.0);

// POST directo con base64
fetch(url, {
    method: 'POST',
    body: base64Image
});
```

**Ahora:**
```javascript
// JPEG comprimido
const imageData = canvas.toDataURL('image/jpeg', 0.7);

// FormData con Blob
const blob = new Blob([byteArray], { type: 'image/jpeg' });
const formData = new FormData();
formData.append('image', blob, 'reporte.jpg');
formData.append('action', 'uploadImage');

fetch(url, {
    method: 'POST',
    body: formData
});
```

### Archivo: `google-apps-script-actualizado.js`

**Nuevo:**
```javascript
function handleImageUploadFromFormData(e) {
    const imageBlob = e.parameters.image[0];
    const file = folder.createFile(imageBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const imageUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    return imageUrl;
}
```

---

## 🐛 Herramienta de Debug

**Botón 🐛** en esquina inferior derecha:
- Muestra consola en pantalla
- Información del entorno (iOS, PWA, Safari)
- Logs de todas las operaciones

**Cómo usar:**
1. Toca el botón 🐛
2. Verás un panel negro en la parte inferior
3. Todos los logs aparecerán ahí
4. Toma captura de pantalla si hay errores

---

## 📊 Comparación de Tamaños

| Método | Formato | Calidad | Tamaño Aprox. |
|--------|---------|---------|---------------|
| Antes  | PNG     | 1.0     | ~8.8 MB       |
| Ahora  | JPEG    | 0.7     | ~2-3 MB       |

**Reducción:** ~70% menos tamaño

---

## ❓ Preguntas Frecuentes

**P: ¿La calidad de la imagen se verá afectada?**
R: Sí, ligeramente, pero será imperceptible en WhatsApp. JPEG 0.7 es más que suficiente para compartir.

**P: ¿Funcionará en PC también?**
R: Sí, el código es compatible con todos los navegadores. PC seguirá funcionando igual.

**P: ¿Qué pasa si no actualizo Google Apps Script?**
R: El código JavaScript intentará usar FormData, pero el servidor no lo entenderá y fallará.

**P: ¿Puedo revertir los cambios?**
R: Sí, el código mantiene compatibilidad con el método antiguo (base64). Pero no hay razón para revertir.

---

## 🆘 Si Algo Sale Mal

1. **Verifica que Google Apps Script esté actualizado**
   - Debe tener la función `handleImageUploadFromFormData`

2. **Verifica que la PWA esté actualizada**
   - Mira el número de versión en los scripts: `?v=12`

3. **Revisa los logs del botón 🐛**
   - Toma captura de pantalla
   - Comparte los logs completos

4. **Prueba desde PC primero**
   - Si funciona en PC pero no en iOS, es un problema de iOS específico
   - Si no funciona en ninguno, es un problema del servidor

---

## 📞 Contacto

Si después de seguir todos los pasos el problema persiste, comparte:
1. Captura de pantalla de los logs del botón 🐛
2. Versión de iOS
3. ¿Se abre WhatsApp? (Sí/No)
4. ¿Qué parte del mensaje aparece?

---

**Última actualización:** 27 de febrero de 2026
**Versión del código:** v12
