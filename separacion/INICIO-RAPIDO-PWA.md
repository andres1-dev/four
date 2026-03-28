# 🚀 Inicio Rápido - PWA

## Pasos para activar la PWA (5 minutos)

### 1️⃣ Generar Iconos
```
1. Abre: icons/generate-icons.html en tu navegador
2. Clic en: "Generar y Descargar Todos los Iconos"
3. Mueve los 5 archivos PNG descargados a la carpeta icons/
```

### 2️⃣ Verificar Archivos
Asegúrate de tener estos archivos:
- ✅ `manifest.json` (raíz)
- ✅ `sw.js` (raíz)
- ✅ `js/sync-manager.js`
- ✅ `icons/favicon-16x16.png`
- ✅ `icons/favicon-32x32.png`
- ✅ `icons/apple-touch-icon.png`
- ✅ `icons/icon-192.png`
- ✅ `icons/icon-512.png`

### 3️⃣ Subir a GitHub
```bash
git add .
git commit -m "Add PWA support"
git push
```

### 4️⃣ Activar GitHub Pages
1. Ve a Settings → Pages
2. Selecciona la rama (main/master)
3. Guarda

### 5️⃣ Probar
1. Abre tu URL de GitHub Pages
2. Presiona F12 → Application → Manifest (verifica iconos)
3. Presiona F12 → Application → Service Workers (debe estar "activated")
4. Busca el ícono ➕ en la barra de direcciones para instalar

## 🔄 Sincronización en Tiempo Real

Ya está configurada! Abre la app en dos pestañas y prueba:
- Cambiar un responsable en pestaña 1
- Ver la actualización automática en pestaña 2

## 📚 Documentación Completa

Lee `PWA-SETUP.md` para más detalles.

## ❓ Problemas

- **No se registra el SW**: Verifica que uses HTTPS (GitHub Pages lo hace automáticamente)
- **No se ven los iconos**: Verifica que los PNG estén en `icons/`
- **No sincroniza**: Abre la consola y busca mensajes `[Sync]`
