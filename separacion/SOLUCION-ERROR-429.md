# 🔧 Solución al Error 429 de Google Sheets

## 🔴 El Problema

**Error 429: Too Many Requests**

Google Sheets API tiene límites:
- 100 peticiones por 100 segundos por usuario
- 500 peticiones por 100 segundos por proyecto

**Antes de Firebase:**
- Cambias algo → Solo tu pestaña recarga desde Sheets ✅

**Con Firebase (problema):**
- Cambias algo → Firebase notifica a TODAS las pestañas
- TODAS recargan desde Sheets AL MISMO TIEMPO
- 5 pestañas = 5 peticiones simultáneas
- **Resultado: Error 429** ❌

---

## ✅ La Solución: Firebase como Caché

**Nuevo sistema implementado:**

1. **Una pestaña es "líder"** (se elige automáticamente)
2. **Solo el líder** carga datos desde Google Sheets
3. **El líder guarda** los datos en Firebase
4. **Las demás pestañas** leen desde Firebase (instantáneo, sin límites)

```
Pestaña 1 (Líder) → Google Sheets → Firebase
                                        ↓
Pestaña 2 ────────────────────────→ Firebase
Pestaña 3 ────────────────────────→ Firebase
Pestaña 4 ────────────────────────→ Firebase
```

---

## 📦 Archivos Creados

- `js/firebase-cache.js` - Sistema de caché con elección de líder
- `js/main.js` - Actualizado para usar caché
- `index.html` - Actualizado con firebase-cache.js

---

## 🎯 Cómo Funciona

### 1. Elección de Líder

Cada pestaña intenta ser líder:
- La primera pestaña se convierte en líder
- El líder renueva su estado cada 5 segundos
- Si el líder se cierra, otra pestaña toma el liderazgo

### 2. Carga de Datos

**Si eres líder:**
```javascript
1. Cargar datos desde Google Sheets
2. Guardar en Firebase
3. Notificar a otras pestañas
```

**Si NO eres líder:**
```javascript
1. Verificar si hay caché en Firebase
2. Si hay caché válido (< 10 segundos), usarlo
3. Si no hay caché, esperar a que el líder lo cree
4. Leer desde Firebase (sin tocar Sheets API)
```

### 3. Caché Inteligente

- Duración del caché: 10 segundos
- Si el caché expira, el líder recarga automáticamente
- Las demás pestañas siempre leen desde Firebase

---

## 🚀 Beneficios

### Antes (con error 429):
```
5 pestañas × 3 hojas × 1 cambio = 15 peticiones a Sheets
10 cambios por minuto = 150 peticiones/minuto ❌ LÍMITE EXCEDIDO
```

### Ahora (sin error 429):
```
1 líder × 3 hojas × 1 cambio = 3 peticiones a Sheets
10 cambios por minuto = 30 peticiones/minuto ✅ DENTRO DEL LÍMITE
```

**Reducción: 80% menos peticiones a Google Sheets**

---

## 🧪 Verificar que Funciona

### En la Consola del Navegador (F12):

**Pestaña Líder:**
```
[Cache] 👑 Soy el líder - Cargaré datos desde Sheets
[Cache] 👑 Cargando datos desde Google Sheets...
[Cache] ✅ Datos guardados en Firebase
```

**Pestañas Seguidoras:**
```
[Cache] 📖 Ya no soy líder - Leeré desde Firebase
[Cache] Usando caché de Firebase (edad: 3s)
[Cache] ✅ Datos cargados desde Firebase (sin usar API de Sheets)
```

### Prueba Práctica:

1. Abre 5 pestañas de tu app
2. Haz un cambio en una
3. Verifica en la consola:
   - Solo 1 pestaña dice "Cargando desde Google Sheets"
   - Las otras 4 dicen "Datos cargados desde Firebase"
4. **Resultado: Solo 1 petición a Sheets en lugar de 5** ✅

---

## 📊 Monitoreo

### Ver Uso de Google Sheets API

1. Ve a: https://console.cloud.google.com/
2. Selecciona tu proyecto
3. Ve a **APIs y servicios** → **Panel de control**
4. Busca "Google Sheets API"
5. Verás el gráfico de peticiones

**Deberías ver una reducción drástica en las peticiones.**

### Ver Datos en Firebase

1. Ve a Firebase Console
2. Haz clic en "Realtime Database"
3. Verás:
```
sistema-documentos/
  ├── cache/
  │   ├── leader/
  │   │   ├── timestamp: 1234567890
  │   │   └── sessionId: "abc123"
  │   └── data/
  │       ├── timestamp: 1234567890
  │       ├── datosGlobales: [...]
  │       ├── datosTablaDocumentos: [...]
  │       └── responsables: [...]
  └── sync-events/
      └── ...
```

---

## ⚙️ Configuración

### Ajustar Duración del Caché

En `js/firebase-cache.js`:

```javascript
this.CACHE_DURATION = 10000; // 10 segundos (actual)
```

Puedes cambiar a:
- `5000` = 5 segundos (más actualizado, más peticiones)
- `30000` = 30 segundos (menos actualizado, menos peticiones)
- `60000` = 1 minuto (para uso muy bajo)

### Ajustar Timeout de Líder

```javascript
this.LEADER_TIMEOUT = 15000; // 15 segundos
```

Si el líder no renueva en 15 segundos, otro toma el liderazgo.

---

## 🐛 Solución de Problemas

### Sigo viendo Error 429

**Posibles causas:**

1. **Firebase no configurado**
   - Verifica que `js/firebase-config.js` tenga tus credenciales
   - Abre la consola y busca "[Firebase] ✅ Conectado"

2. **Caché no funcionando**
   - Verifica en Firebase Console que exista `sistema-documentos/cache`
   - Revisa la consola para ver si hay errores

3. **Múltiples líderes**
   - Cierra todas las pestañas
   - Abre una nueva
   - Verifica que solo una diga "Soy el líder"

### Datos no se actualizan

**Si los datos parecen viejos:**

1. Verifica la edad del caché en la consola:
   ```
   [Cache] Usando caché de Firebase (edad: 45s)
   ```

2. Si es mayor a 10 segundos, el líder debería recargar
3. Cierra y abre la pestaña líder para forzar recarga

### No hay líder

**Si ninguna pestaña es líder:**

1. Verifica que Firebase esté conectado
2. Revisa las reglas de Firebase (deben permitir escritura)
3. Cierra todas las pestañas y abre una nueva

---

## 📈 Resultados Esperados

### Antes:
- ❌ Error 429 frecuente
- ❌ Múltiples peticiones simultáneas
- ❌ Lentitud al sincronizar

### Después:
- ✅ Sin error 429
- ✅ Solo 1 petición a Sheets por cambio
- ✅ Sincronización instantánea desde Firebase
- ✅ 80% menos uso de Sheets API

---

## 🎉 Resumen

**Problema:** Firebase causaba demasiadas peticiones a Google Sheets

**Solución:** Firebase ahora actúa como caché inteligente

**Resultado:** 
- Solo el líder toca Google Sheets
- Los demás leen desde Firebase
- Sin error 429
- Sincronización más rápida

---

**¿Funciona?** Abre la consola (F12) y verifica los mensajes de [Cache]
