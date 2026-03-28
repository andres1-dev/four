# Iconos de la PWA

Esta carpeta contiene todos los iconos necesarios para la Progressive Web App (PWA).

## 🎨 Generar Iconos

1. Abre `generate-icons.html` en tu navegador
2. Haz clic en "Generar y Descargar Todos los Iconos"
3. Guarda todos los archivos descargados en esta carpeta

## 📦 Archivos Necesarios

- `favicon-16x16.png` - Favicon pequeño para navegadores
- `favicon-32x32.png` - Favicon estándar para navegadores
- `apple-touch-icon.png` - Icono para dispositivos iOS (180x180)
- `icon-192.png` - Icono para Android y PWA (192x192)
- `icon-512.png` - Icono de alta resolución para Android (512x512)

## 🎯 Diseño del Logo

El logo incluye:
- Fondo azul con gradiente (#007bff → #0056b3)
- Ícono de firma estilizado (inspirado en Font Awesome fa-signature)
- Pluma con punta dorada
- Texto "SGD" en iconos grandes (180px+)
- Diseño profesional y moderno

## ✅ Verificar Iconos

Después de generar los iconos, verifica que todos los archivos estén en esta carpeta:

```
icons/
├── generate-icons.html
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png
├── icon-192.png
└── icon-512.png
```

## 🔧 Personalizar

Para cambiar el diseño del logo:
1. Edita `generate-icons.html`
2. Modifica la función `dibujarLogo(ctx, size)`
3. Ajusta colores, formas o texto según necesites
4. Regenera los iconos

## 📱 Uso

Los iconos se referencian automáticamente desde:
- `index.html` (favicons y apple-touch-icon)
- `manifest.json` (iconos de la PWA)

No necesitas hacer nada más después de generarlos y colocarlos aquí.
