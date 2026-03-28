# Configuración PWA - Sistema de Gestión de Documentos

## ✅ Archivos Creados

1. **manifest.json** - Configuración de la PWA (raíz del proyecto)
2. **sw.js** - Service Worker para sincronización (raíz del proyecto, SIN CACHÉ)
3. **js/sync-manager.js** - Gestor de sincronización en tiempo real
4. **icons/generate-icons.html** - Generador de iconos con logo personalizado

## 📁 Estructura del Proyecto

```
tu-proyecto/
├── index.html
├── manifest.json
├── sw.js
├── icons/
│   ├── generate-icons.html
│   ├── favicon-16x16.png (generar)
│   ├── favicon-32x32.png (generar)
│   ├── apple-touch-icon.png (generar)
│   ├── icon-192.png (generar)
│   └── icon-512.png (generar)
├── js/
│   ├── sync-manager.js
│   └── documents-table.js
└── css/
    └── styles.css
```

## 🚀 Pasos para Activar la PWA

### 1. Generar Iconos

1. Abre `icons/generate-icons.html` en tu navegador
2. Haz clic en "Generar y Descargar Todos los Iconos"
3. Los iconos se descargarán automáticamente:
   - `favicon-16x16.png`
   - `favicon-32x32.png`
   - `apple-touch-icon.png` (180x180)
   - `icon-192.png`
   - `icon-512.png`
4. Mueve todos los archivos descargados a la carpeta `icons/`

### 2. Configurar el Servidor

El Service Worker requiere HTTPS (excepto en localhost). 

Para GitHub Pages:
- Los archivos ya están configurados con rutas relativas (`./`)
- GitHub Pages sirve automáticamente con HTTPS
- Solo necesitas hacer push de los archivos

Para servidor propio:
- Asegúrate de tener HTTPS habilitado
- Verifica que el servidor permita Service Workers

### 3. Verificar la Instalación

1. Abre la aplicación en Chrome/Edge
2. Presiona F12 para abrir DevTools
3. Ve a la pestaña "Application"
4. Verifica:
   - **Manifest**: Debe mostrar la configuración y los iconos
   - **Service Workers**: Debe aparecer como "activated"
   - **Icons**: Deben cargarse correctamente

### 4. Instalar la PWA

En Chrome/Edge (Desktop):
- Busca el ícono de instalación en la barra de direcciones (➕)
- O ve a Menú → "Instalar Sistema de Gestión de Documentos"

En móvil (Android):
- Chrome: Menú → "Añadir a pantalla de inicio"
- Aparecerá el ícono con el logo personalizado

En móvil (iOS):
- Safari: Compartir → "Añadir a pantalla de inicio"
- Aparecerá el ícono Apple Touch

## 🔄 Sincronización en Tiempo Real

### Cómo Funciona

La aplicación sincroniza cambios entre pestañas/dispositivos automáticamente:

1. **Usuario A** cambia el responsable de un documento
2. **Usuario B** (en otra pestaña/dispositivo) recibe una notificación
3. La tabla de **Usuario B** se actualiza automáticamente

### Acciones Sincronizadas

- ✅ Cambio de responsable
- ✅ Cambio de estado (Pausar, Reanudar, Finalizar)
- ✅ Restablecer documento

### Tecnologías Usadas

- **Broadcast Channel API**: Sincronización entre pestañas del mismo navegador
- **Service Worker Messages**: Comunicación entre pestañas

## ⚠️ Importante: SIN CACHÉ

El Service Worker NO cachea ningún archivo. Todo se carga siempre desde la red.
Esto garantiza que siempre tengas la versión más reciente de la aplicación.

## 🧪 Probar la Sincronización

1. Abre la aplicación en dos pestañas diferentes
2. En la pestaña 1: Cambia el responsable de un documento
3. En la pestaña 2: Verás una notificación y la tabla se actualizará automáticamente

## 🎨 Personalizar el Logo

El generador de iconos crea un logo con:
- Fondo azul con gradiente (#007bff → #0056b3)
- Ícono de firma estilizado (basado en Font Awesome fa-signature)
- Texto "SGD" en iconos grandes
- Diseño profesional y moderno

Para cambiar el logo:
1. Edita `icons/generate-icons.html`
2. Modifica la función `dibujarLogo(ctx, size)`
3. Regenera los iconos

## 🔧 Configuración Avanzada

### Modificar el Manifest

Edita `manifest.json` para cambiar:
- Nombre de la aplicación (`name`, `short_name`)
- Colores del tema (`theme_color`, `background_color`)
- Orientación de pantalla (`orientation`)
- Modo de visualización (`display`)

### Personalizar Notificaciones

Edita `js/sync-manager.js` para cambiar:
- Mensajes de notificación
- Comportamiento de sincronización
- Logging/debugging

## 📱 Compatibilidad

- ✅ Chrome/Edge (Desktop y Mobile)
- ✅ Firefox (Desktop y Mobile)
- ⚠️ Safari (Soporte limitado de Service Workers)
- ✅ Opera
- ✅ Samsung Internet

## 🐛 Solución de Problemas

### El Service Worker no se registra

1. Verifica que estés usando HTTPS (o localhost)
2. Revisa la consola del navegador para errores
3. Asegúrate de que `sw.js` esté en la raíz del proyecto
4. Verifica que la ruta en el registro sea correcta (`/sw.js`)

### Los iconos no se muestran

1. Verifica que los archivos estén en `icons/`
2. Revisa las rutas en `manifest.json` (deben ser `icons/icon-xxx.png`)
3. Asegúrate de que los archivos PNG se generaron correctamente
4. Limpia la caché del navegador (Ctrl+Shift+R)

### La sincronización no funciona

1. Abre DevTools → Application → Service Workers
2. Verifica que el SW esté "activated"
3. Revisa la consola para mensajes de `[Sync]`
4. Asegúrate de que ambas pestañas estén en el mismo origen

### La PWA no se puede instalar

1. Verifica que `manifest.json` esté correctamente vinculado en el HTML
2. Asegúrate de que los iconos existan en las rutas especificadas
3. Usa HTTPS (requerido para instalación)
4. Verifica que el manifest tenga al menos un icono de 192x192 o mayor

## 📝 Notas para GitHub

- Las rutas usan `./` para ser compatibles con subdirectorios
- El `scope` está configurado como `./` para funcionar en cualquier ruta
- Los iconos están en carpeta separada para mejor organización
- El Service Worker está en la raíz para tener acceso a todo el proyecto

## 🚀 Deploy en GitHub Pages

1. Genera los iconos y colócalos en `icons/`
2. Haz commit de todos los archivos:
   ```bash
   git add .
   git commit -m "Add PWA support with real-time sync"
   git push
   ```
3. Activa GitHub Pages en la configuración del repositorio
4. Accede a tu URL de GitHub Pages
5. La PWA estará lista para instalar
