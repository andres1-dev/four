# 📱 PWA - Sistema de Gestión de Documentos

## 🎯 Características

✅ **Progressive Web App (PWA)** - Instalable en cualquier dispositivo  
✅ **Sincronización en Tiempo Real** - Cambios instantáneos entre pestañas  
✅ **Sin Caché** - Siempre la versión más reciente  
✅ **Logo Personalizado** - Diseño profesional con ícono de firma  
✅ **Compatible con GitHub Pages** - Listo para deploy  

## 📂 Estructura de Archivos PWA

```
proyecto/
│
├── 📄 index.html (actualizado con manifest y favicons)
├── 📄 manifest.json (configuración PWA)
├── 📄 sw.js (Service Worker sin caché)
├── 📄 .nojekyll (para GitHub Pages)
│
├── 📁 icons/
│   ├── 🎨 generate-icons.html (generador de iconos)
│   ├── 📋 CHECKLIST.md (lista de verificación)
│   ├── 📖 README.md (documentación de iconos)
│   ├── 🖼️ favicon-16x16.png (generar)
│   ├── 🖼️ favicon-32x32.png (generar)
│   ├── 🖼️ apple-touch-icon.png (generar)
│   ├── 🖼️ icon-192.png (generar)
│   └── 🖼️ icon-512.png (generar)
│
└── 📁 js/
    ├── 🔄 sync-manager.js (sincronización en tiempo real)
    └── 📊 documents-table.js (actualizado con notificaciones)
```

## 🚀 Inicio Rápido (3 pasos)

### 1. Generar Iconos
```bash
# Abre en tu navegador:
icons/generate-icons.html

# Descarga los 5 iconos PNG y muévelos a icons/
```

### 2. Subir a GitHub
```bash
git add .
git commit -m "Add PWA with real-time sync"
git push
```

### 3. Activar GitHub Pages
- Settings → Pages → Selecciona rama → Save

## 🔄 Sincronización en Tiempo Real

### ¿Cómo funciona?

```
Pestaña A                    Pestaña B
    │                            │
    │ Cambiar responsable        │
    ├──────────────────────────► │
    │                            │ ✅ Notificación
    │                            │ 🔄 Actualización automática
    │                            │
```

### Acciones sincronizadas:
- Asignar/cambiar responsable
- Pausar documento
- Reanudar documento
- Finalizar documento
- Restablecer documento

## 🎨 Logo Personalizado

El generador crea iconos con:
- 🎨 Gradiente azul profesional
- ✍️ Ícono de firma estilizado
- 🖊️ Pluma con punta dorada
- 📝 Texto "SGD" en iconos grandes

## 📱 Instalación

### Desktop (Chrome/Edge)
1. Abre la aplicación
2. Busca el ícono ➕ en la barra de direcciones
3. Clic en "Instalar"

### Android
1. Abre en Chrome
2. Menú → "Añadir a pantalla de inicio"

### iOS
1. Abre en Safari
2. Compartir → "Añadir a pantalla de inicio"

## 🧪 Probar Sincronización

```bash
# Paso 1: Abre dos pestañas con la aplicación
# Paso 2: En pestaña 1, cambia un responsable
# Paso 3: En pestaña 2, verás la actualización automática
```

## 📚 Documentación

- `INICIO-RAPIDO-PWA.md` - Guía de inicio rápido
- `PWA-SETUP.md` - Documentación completa
- `icons/README.md` - Información sobre iconos
- `icons/CHECKLIST.md` - Lista de verificación

## 🔧 Tecnologías

- **Manifest.json** - Configuración PWA
- **Service Worker** - Sincronización (sin caché)
- **Broadcast Channel API** - Comunicación entre pestañas
- **Canvas API** - Generación de iconos

## ⚠️ Requisitos

- ✅ HTTPS (GitHub Pages lo proporciona automáticamente)
- ✅ Navegador moderno (Chrome, Edge, Firefox, Safari)
- ✅ Iconos generados en carpeta `icons/`

## 🐛 Solución de Problemas

| Problema | Solución |
|----------|----------|
| SW no se registra | Verifica HTTPS y consola del navegador |
| Iconos no aparecen | Genera los PNG y colócalos en `icons/` |
| No sincroniza | Verifica que el SW esté "activated" en DevTools |
| No se puede instalar | Verifica manifest.json y que tengas iconos 192x192+ |

## 📊 Estado del Proyecto

- ✅ PWA configurada
- ✅ Service Worker implementado
- ✅ Sincronización en tiempo real activa
- ✅ Generador de iconos listo
- ✅ Compatible con GitHub Pages
- ⏳ Iconos pendientes de generar (usa `icons/generate-icons.html`)

## 🎯 Próximos Pasos

1. [ ] Generar iconos con `icons/generate-icons.html`
2. [ ] Verificar con `icons/CHECKLIST.md`
3. [ ] Hacer commit y push a GitHub
4. [ ] Activar GitHub Pages
5. [ ] Probar instalación de PWA
6. [ ] Probar sincronización en dos pestañas

## 💡 Notas

- El Service Worker NO cachea archivos (siempre carga desde red)
- La sincronización funciona solo entre pestañas abiertas
- Los iconos se generan localmente (no están en el repo por defecto)
- Compatible con múltiples proyectos en el mismo repositorio

---

**¿Necesitas ayuda?** Lee la documentación completa en `PWA-SETUP.md`
