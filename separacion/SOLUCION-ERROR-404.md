# 🔧 Solución: Error 404 en Service Worker

## ❌ Error Original

```
A bad HTTP response code (404) was received when fetching the script.
Failed to register a ServiceWorker for scope ('https://andres1-dev.github.io/') 
with script ('https://andres1-dev.github.io/sw.js')
```

## 🎯 Causa del Problema

El Service Worker estaba buscando `sw.js` en la raíz del dominio:
```
https://andres1-dev.github.io/sw.js  ❌ (no existe aquí)
```

Pero tu proyecto está en un subdirectorio:
```
https://andres1-dev.github.io/[nombre-proyecto]/sw.js  ✅ (aquí está)
```

## ✅ Solución Implementada

Se actualizó `js/sync-manager.js` para detectar automáticamente la ruta base del proyecto:

```javascript
// ANTES (ruta absoluta - no funciona en subdirectorios)
this.swRegistration = await navigator.serviceWorker.register('/sw.js');

// DESPUÉS (ruta relativa - funciona en cualquier subdirectorio)
const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
const swPath = basePath + 'sw.js';

this.swRegistration = await navigator.serviceWorker.register(swPath, {
  scope: basePath
});
```

## 🔍 Cómo Funciona

1. **Detecta la ruta actual**: `window.location.pathname`
   - Ejemplo: `/mi-proyecto/index.html`

2. **Extrae la ruta base**: Hasta el último `/`
   - Resultado: `/mi-proyecto/`

3. **Construye la ruta del SW**: `basePath + 'sw.js'`
   - Resultado: `/mi-proyecto/sw.js` ✅

4. **Registra con scope correcto**: El SW solo controla su subdirectorio

## 🧪 Verificar la Solución

### Opción 1: Usar el Verificador
```
Abre: verificar-pwa.html
```

El verificador mostrará:
- ✅ Ruta base detectada: `/tu-proyecto/`
- ✅ sw.js encontrado en: `/tu-proyecto/sw.js`
- ✅ Service Worker registrado exitosamente

### Opción 2: Consola del Navegador
```javascript
// Abre la consola (F12) y ejecuta:
console.log('Ruta base:', window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1));
```

Deberías ver algo como:
```
[Sync] Service Worker registrado en: /tu-proyecto/sw.js
```

### Opción 3: DevTools
1. F12 → Application → Service Workers
2. Verifica que aparezca registrado
3. El "Scope" debe ser tu subdirectorio

## 📁 Estructura Correcta

Tu proyecto debe tener esta estructura:

```
tu-proyecto/
├── index.html
├── sw.js ⬅️ Debe estar aquí (mismo nivel que index.html)
├── manifest.json
├── verificar-pwa.html
├── js/
│   └── sync-manager.js ⬅️ Actualizado
└── icons/
    └── ...
```

## ✅ Checklist de Verificación

- [ ] `sw.js` está en la raíz del proyecto (mismo nivel que `index.html`)
- [ ] `js/sync-manager.js` tiene el código actualizado
- [ ] Hiciste commit y push de los cambios
- [ ] Esperaste unos minutos para que GitHub Pages se actualice
- [ ] Hiciste hard refresh (Ctrl+Shift+R) en el navegador
- [ ] Abriste `verificar-pwa.html` y todo está ✅

## 🚀 Después de la Solución

Una vez corregido, deberías ver en la consola:

```
✅ [Sync] Service Worker registrado en: /tu-proyecto/sw.js
✅ [SW] Instalado: v1.0.0
✅ [SW] Activado: v1.0.0
✅ [Sync] Sistema de sincronización inicializado
```

## 🔄 Si Aún No Funciona

### 1. Verifica que sw.js esté subido
```bash
# En tu repositorio local
ls -la sw.js

# Debe mostrar el archivo
```

### 2. Verifica en GitHub
- Ve a tu repositorio en GitHub
- Busca el archivo `sw.js` en la raíz
- Si no está, súbelo:
```bash
git add sw.js
git commit -m "Add Service Worker"
git push
```

### 3. Limpia el caché
```
1. F12 → Application → Service Workers
2. Clic en "Unregister" si hay alguno registrado
3. F12 → Application → Clear storage → Clear site data
4. Ctrl+Shift+R (hard refresh)
```

### 4. Espera la actualización de GitHub Pages
- GitHub Pages puede tardar 1-5 minutos en actualizar
- Verifica en: Settings → Pages → "Your site is live at..."

## 📝 Notas Importantes

- ✅ La solución funciona en localhost
- ✅ La solución funciona en subdirectorios de GitHub Pages
- ✅ La solución funciona en dominios personalizados
- ✅ No necesitas cambiar nada más en tu código
- ✅ El Broadcast Channel sigue funcionando independientemente

## 🎉 Resultado Final

Con esta corrección, tu PWA funcionará correctamente en:
- `https://usuario.github.io/proyecto/` ✅
- `https://usuario.github.io/` ✅
- `http://localhost:8000/proyecto/` ✅
- `https://tu-dominio.com/` ✅

---

**¿Sigue sin funcionar?** Abre `verificar-pwa.html` y revisa qué elemento está marcado con ❌
