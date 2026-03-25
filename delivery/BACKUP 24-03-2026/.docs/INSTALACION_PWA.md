# Mejoras de Instalación PWA - Rutas Relativas

## Cambios Realizados

Se han actualizado todos los archivos del proyecto para usar rutas relativas, permitiendo que la PWA funcione correctamente en cualquier contexto (carpeta raíz, subcarpeta, GitHub Pages, etc.).

### Archivos Modificados

#### 1. manifest.json
- ✅ `start_url`: Cambiado de `"./index.html"` a `"./"`
- ✅ `scope`: Cambiado de `"/"` a `"./"`
- ✅ Eliminado `id: "/"` (no necesario con scope relativo)
- ✅ `icons`: Agregado `./` al inicio de todas las rutas

#### 2. index.html
- ✅ Manifest: `href="./manifest.json"`
- ✅ Iconos: `href="./icons/icon.svg"` y `href="./icons/apple-touch-icon.svg"`
- ✅ Scripts: `src="./js/core/config.js"`, `src="./js/core/biometry.js"`, etc.
- ✅ CSS: `href="./css/core/base.css"`, etc.
- ✅ Imágenes: `src="./icons/icon.svg"`

#### 3. login.html
- ✅ Manifest: `href="./manifest.json"`
- ✅ Iconos: `href="./icons/icon.svg"` y `href="./icons/apple-touch-icon.svg"`
- ✅ Scripts: `src="./js/core/config.js"`, `src="./js/core/biometry.js"`
- ✅ CSS: `href="./css/core/base.css"`, `href="./css/core/layout.css"`
- ✅ Imágenes: `src="./icons/icon.svg"`
- ✅ Redirecciones: `window.location.href = './index.html'`
- ✅ Recuperación de contraseña: URLs dinámicas basadas en `window.location`

#### 4. js/core/auth_check.js
- ✅ Redirecciones: `window.location.replace('./login.html')`

#### 5. js/core/auth.js
- ✅ Redirecciones: `window.location.replace('./login.html')`

#### 6. sw.js
- ✅ Ya usaba rutas relativas correctamente con `BASE`
- ✅ Los assets se cachean con rutas relativas

## Ventajas

### ✅ Funciona en cualquier contexto
```
https://ejemplo.com/                    ← Raíz del dominio
https://ejemplo.com/app/                ← Subcarpeta
https://ejemplo.com/proyectos/pwa/      ← Subcarpeta anidada
https://usuario.github.io/repo/         ← GitHub Pages
```

### ✅ Instalación PWA mejorada
- El navegador puede instalar la PWA desde cualquier ubicación
- El scope se ajusta automáticamente al contexto
- Los iconos se cargan correctamente sin importar la ruta

### ✅ Service Worker robusto
- Cachea correctamente todos los recursos
- Funciona offline sin problemas de rutas
- Se actualiza correctamente en cualquier contexto

## Pruebas Recomendadas

### 0. Prueba Rápida con Test Automático
```bash
# Abrir el archivo de prueba
# Navegar a: http://localhost:8000/test-pwa.html
```

Este archivo ejecuta automáticamente todas las verificaciones y muestra:
- ✅ Información de ubicación actual
- ✅ Estado del manifest.json
- ✅ Estado del Service Worker
- ✅ Disponibilidad de recursos (iconos, CSS, JS)
- ✅ Instalabilidad de la PWA

### 1. Instalación Local
```bash
# Servidor local en raíz
python -m http.server 8000
# Abrir: http://localhost:8000/
```

### 2. Instalación en Subcarpeta
```bash
# Copiar archivos a subcarpeta
mkdir -p /var/www/html/miapp
cp -r * /var/www/html/miapp/
# Abrir: http://localhost/miapp/
```

### 3. GitHub Pages
```bash
# Subir a repositorio
git add .
git commit -m "PWA con rutas relativas"
git push origin main
# Configurar GitHub Pages en Settings
# Abrir: https://usuario.github.io/repo/
```

## Verificación de Instalación

### Chrome DevTools
1. Abrir DevTools (F12)
2. Ir a Application > Manifest
3. Verificar que todos los campos se muestren correctamente
4. Verificar que los iconos carguen sin errores
5. Ir a Application > Service Workers
6. Verificar que el SW esté activo

### Lighthouse
1. Abrir DevTools (F12)
2. Ir a Lighthouse
3. Seleccionar "Progressive Web App"
4. Ejecutar auditoría
5. Verificar puntuación PWA (debe ser >90)

## Compatibilidad

- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Safari (iOS & macOS)
- ✅ Firefox
- ✅ Samsung Internet
- ✅ Opera

## Notas Técnicas

### Rutas Relativas vs Absolutas

**Antes (Problemático):**
```html
<link rel="manifest" href="manifest.json">
<script src="js/core/config.js"></script>
```

**Después (Correcto):**
```html
<link rel="manifest" href="./manifest.json">
<script src="./js/core/config.js"></script>
```

### Scope en manifest.json

**Antes:**
```json
{
  "scope": "/",
  "start_url": "./index.html"
}
```

**Después:**
```json
{
  "scope": "./",
  "start_url": "./"
}
```

El `scope: "./"` permite que la PWA funcione en cualquier subcarpeta, mientras que `scope: "/"` solo funciona en la raíz del dominio.

## Solución de Problemas

### La PWA no se instala
1. Verificar que el manifest.json se cargue correctamente
2. Verificar que los iconos existan y sean accesibles
3. Verificar que el Service Worker se registre sin errores
4. Verificar que la app se sirva por HTTPS (o localhost)

### Los recursos no cargan
1. Verificar que todas las rutas usen `./` al inicio
2. Verificar que los archivos existan en las rutas especificadas
3. Revisar la consola del navegador para errores 404
4. Verificar el cache del Service Worker

### El Service Worker no actualiza
1. Desregistrar el SW anterior en DevTools
2. Limpiar el cache del navegador
3. Hacer hard refresh (Ctrl+Shift+R)
4. Verificar que la versión del cache haya cambiado en sw.js

## Mantenimiento

Al agregar nuevos archivos, asegurarse de:
1. Usar rutas relativas con `./`
2. Agregar los archivos al array `RELATIVE_ASSETS` en `sw.js`
3. Probar en diferentes contextos (raíz y subcarpeta)

---

**Fecha de actualización:** 2026-02-27
**Versión:** 7.3.14
