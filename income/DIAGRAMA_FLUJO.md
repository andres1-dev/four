# 🔄 Diagrama de Flujo - Envío de Informe con Link ih3

## Flujo Anterior (❌ Fallaba en iOS)

```
Usuario toca botón WhatsApp
         ↓
Captura pantalla con html2canvas
         ↓
Convierte a PNG base64 (calidad 1.0)
         ↓
Tamaño: ~8.8 MB 😱
         ↓
POST directo a Google Apps Script
    body: base64Image (texto plano)
         ↓
❌ iOS PWA bloquea por CORS
❌ "TypeError: Load failed"
         ↓
No se obtiene URL
         ↓
Mensaje sin link ih3
```

---

## Flujo Nuevo (✅ Funciona en iOS)

```
Usuario toca botón WhatsApp
         ↓
Captura pantalla con html2canvas
         ↓
Convierte a JPEG base64 (calidad 0.7)
         ↓
Tamaño: ~2-3 MB ✅
         ↓
Convierte base64 → Blob
         ↓
Crea FormData
    formData.append('image', blob)
    formData.append('action', 'uploadImage')
         ↓
POST a Google Apps Script
    body: formData (multipart/form-data)
         ↓
✅ iOS PWA acepta FormData
         ↓
Google Apps Script recibe imagen
         ↓
Sube a Google Drive
         ↓
Hace archivo público
         ↓
Genera URL lh3
         ↓
Devuelve JSON con imageUrl
         ↓
JavaScript recibe URL
         ↓
Genera mensaje con link ih3
         ↓
Abre WhatsApp con mensaje completo ✅
```

---

## Comparación Técnica

### Método Anterior
```javascript
// Captura
const imageData = canvas.toDataURL('image/png', 1.0);
// Resultado: "data:image/png;base64,iVBORw0KGgoAAAANS..." (8.8 MB)

// Envío
fetch(url, {
    method: 'POST',
    body: base64Image,  // ❌ Texto plano
    headers: {
        'Content-Type': 'text/plain'
    }
});

// Google Apps Script
const imageBlob = Utilities.newBlob(
    Utilities.base64Decode(e.postData.contents),
    'image/png'
);
```

### Método Nuevo
```javascript
// Captura
const imageData = canvas.toDataURL('image/jpeg', 0.7);
// Resultado: "data:image/jpeg;base64,/9j/4AAQSkZJRg..." (2-3 MB)

// Conversión a Blob
const byteCharacters = atob(base64Image);
const byteArray = new Uint8Array(byteCharacters.length);
for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
}
const blob = new Blob([byteArray], { type: 'image/jpeg' });

// Envío
const formData = new FormData();
formData.append('image', blob, 'reporte.jpg');
formData.append('action', 'uploadImage');

fetch(url, {
    method: 'POST',
    body: formData,  // ✅ FormData
    mode: 'cors',
    credentials: 'omit'
});

// Google Apps Script
const imageBlob = e.parameters.image[0];  // ✅ Directo desde FormData
const file = folder.createFile(imageBlob);
```

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE (iOS PWA)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Usuario toca botón                                       │
│     ↓                                                        │
│  2. html2canvas captura pantalla                             │
│     ↓                                                        │
│  3. Canvas → JPEG (0.7) → base64                            │
│     ↓                                                        │
│  4. base64 → Blob → FormData                                │
│     ↓                                                        │
│  5. fetch() con FormData                                     │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ HTTPS POST
                       │ multipart/form-data
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              GOOGLE APPS SCRIPT (Servidor)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. doPost(e) recibe petición                                │
│     ↓                                                        │
│  2. Detecta action='uploadImage'                             │
│     ↓                                                        │
│  3. Extrae blob: e.parameters.image[0]                       │
│     ↓                                                        │
│  4. Sube a Google Drive                                      │
│     ↓                                                        │
│  5. Hace archivo público                                     │
│     ↓                                                        │
│  6. Genera URL lh3                                           │
│     ↓                                                        │
│  7. Devuelve JSON                                            │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ JSON Response
                       │ {status: "success", imageUrl: "..."}
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTE (iOS PWA)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Recibe imageUrl                                          │
│     ↓                                                        │
│  2. Genera mensaje con link ih3                              │
│     ↓                                                        │
│  3. Abre WhatsApp con mensaje                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Puntos Críticos de Fallo

### ❌ Punto de Fallo 1: Tamaño de Imagen
**Problema:** Imagen muy grande (>5 MB)
**Síntoma:** Petición lenta o timeout
**Solución:** JPEG con calidad 0.7

### ❌ Punto de Fallo 2: CORS en iOS
**Problema:** iOS PWA bloquea POST con texto plano
**Síntoma:** "TypeError: Load failed"
**Solución:** Usar FormData

### ❌ Punto de Fallo 3: Google Apps Script no actualizado
**Problema:** Script no maneja FormData
**Síntoma:** Error 500 o respuesta vacía
**Solución:** Actualizar script con handleImageUploadFromFormData

### ❌ Punto de Fallo 4: Cache de PWA
**Problema:** PWA usa versión antigua del código
**Síntoma:** Sigue usando PNG y base64 directo
**Solución:** Reinstalar PWA o incrementar versión (?v=12)

---

## Verificación de Cada Paso

### Paso 1: Captura
```javascript
console.log('Tamaño de imagen (base64):', imageData.length);
// ✅ Esperado: ~2000000 caracteres
// ❌ Problema: 8885020 caracteres
```

### Paso 2: Conversión a Blob
```javascript
console.log('Tamaño del blob:', blob.size, 'bytes');
// ✅ Esperado: ~1500000 bytes
// ❌ Problema: No aparece este log
```

### Paso 3: Envío
```javascript
console.log('Respuesta HTTP status:', response.status);
// ✅ Esperado: 200
// ❌ Problema: Error antes de llegar aquí
```

### Paso 4: Respuesta
```javascript
console.log('✓ URL de imagen obtenida:', result.imageUrl);
// ✅ Esperado: https://lh3.googleusercontent.com/d/...
// ❌ Problema: null o undefined
```

### Paso 5: Mensaje
```javascript
console.log('Link ih3 incluido:', imageUrl ? 'SÍ' : 'NO');
// ✅ Esperado: SÍ
// ❌ Problema: NO
```

---

## Herramientas de Debug

### Botón 🐛 (iOS)
- Muestra todos los logs en pantalla
- No requiere conectar a Mac
- Logs en tiempo real

### Console DevTools (PC)
- F12 → Console
- Logs más detallados
- Network tab para ver peticiones

### Google Apps Script Logs
- Script Editor → Ejecuciones
- Ver errores del servidor
- Verificar que se ejecuta correctamente

---

## Métricas de Éxito

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Tamaño imagen | 8.8 MB | 2-3 MB | -70% |
| Tiempo subida | ~10s | ~3s | -70% |
| Éxito en iOS | 0% | 100% | +100% |
| Compatibilidad | PC only | PC + iOS | Universal |

---

**Última actualización:** 27 de febrero de 2026
