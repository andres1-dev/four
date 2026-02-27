# 🔍 Por Qué Algunos SVG Transparentes Se Instalan con Fondo Blanco

## La Respuesta Corta

**Android 8.0+ automáticamente agrega un fondo blanco a los iconos transparentes que NO tienen `purpose: "maskable"`.**

## 📱 El Comportamiento por Sistema Operativo

### Android (8.0+)
```
Icono con purpose: "any" (o sin purpose)
→ Transparente = Fondo blanco automático ⚪
→ Opaco = Se usa tal cual

Icono con purpose: "maskable"
→ Se adapta a la forma del dispositivo
→ NO agrega fondo blanco
→ Requiere safe area
```

### iOS
```
apple-touch-icon
→ Siempre requiere fondo opaco
→ Si es transparente, puede verse negro o blanco
→ Depende del modo (claro/oscuro)
```

### Desktop
```
Favicon
→ Respeta la transparencia
→ Se ve bien sin fondo
```

## 🎯 Por Qué Pasa Esto

### Historia de Android

**Antes de Android 8.0:**
- Los iconos podían tener cualquier forma
- Transparencia funcionaba perfectamente
- Cada app tenía su propia forma

**Android 8.0+ (Adaptive Icons):**
- Todos los iconos deben tener la misma forma
- El sistema aplica una máscara (círculo, squircle, etc.)
- Los iconos transparentes se ven mal con la máscara
- **Solución de Android:** Agregar fondo blanco automático

### Cita de Web.dev (Google)

> "Icons that don't use this format have white backgrounds. In Android, these icons are resized on a white background."

**Fuente:** [web.dev/maskable-icon](https://web.dev/articles/maskable-icon)

## 🔧 Cómo Funciona el `purpose`

### `purpose: "any"` (Default)
```json
{
  "src": "./icons/icon.svg",
  "purpose": "any"
}
```

**Comportamiento:**
- ✅ Desktop: Transparencia respetada
- ❌ Android: Fondo blanco agregado automáticamente
- ⚠️ iOS: Puede verse negro o blanco según modo

### `purpose: "maskable"`
```json
{
  "src": "./icons/icon-maskable.svg",
  "purpose": "maskable"
}
```

**Comportamiento:**
- ✅ Android: Se adapta a la forma, sin fondo blanco
- ✅ iOS: Funciona si tiene fondo opaco
- ❌ Desktop: No se usa (necesita "any")

### `purpose: "any maskable"` (Ambos)
```json
{
  "src": "./icons/icon.svg",
  "purpose": "any maskable"
}
```

**Comportamiento:**
- ✅ Funciona en todos lados
- ⚠️ Pero el icono DEBE tener:
  - Fondo opaco (para iOS)
  - Safe area (para Android maskable)

## 📊 Tabla de Comportamiento

| Icono | Purpose | Android | iOS | Desktop |
|-------|---------|---------|-----|---------|
| Transparente | `any` | Fondo blanco ⚪ | Fondo negro/blanco | Transparente ✅ |
| Transparente | `maskable` | Se adapta ✅ | Fondo negro ❌ | No se usa |
| Con fondo | `any` | Fondo visible ✅ | Fondo visible ✅ | Fondo visible ⚠️ |
| Con fondo | `maskable` | Se adapta ✅ | Funciona ✅ | No se usa |
| Con fondo | `any maskable` | Se adapta ✅ | Funciona ✅ | Fondo visible ⚠️ |

## 💡 Por Qué Algunos SVG "Funcionan" con Transparencia

Hay casos donde parece que un SVG transparente funciona bien:

### 1. El navegador agrega el fondo automáticamente
```
Tu SVG transparente
↓
Android detecta transparencia
↓
Agrega fondo blanco automático
↓
Se ve "bien" (pero con fondo blanco)
```

### 2. El icono tiene fondo en el SVG mismo
```xml
<svg>
  <rect fill="#FFFFFF"/> <!-- Fondo blanco en el SVG -->
  <path fill="#2563eb"/> <!-- Tu logo -->
</svg>
```
Aunque el PNG sea "transparente", el SVG tiene fondo interno.

### 3. Uso de `purpose: "any maskable"`
Si usas ambos purposes, Android puede elegir el comportamiento maskable.

## 🎨 La Solución Correcta

### Estrategia de Dos Iconos

```json
{
  "icons": [
    {
      "src": "./icons/icon-maskable.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "maskable"
    },
    {
      "src": "./icons/icon-any.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

**icon-maskable.svg:**
- ✅ Fondo blanco sólido
- ✅ Safe area de 40px
- ✅ Para Android e iOS

**icon-any.svg:**
- ✅ Transparente
- ✅ Para Desktop/Favicon
- ⚠️ Android le agregará fondo blanco (pero no importa porque usará el maskable)

## 🔍 Cómo Verificar el Comportamiento

### Chrome DevTools
```
1. F12 → Application → Manifest
2. Ver "Icons" section
3. Chrome muestra cómo se verá en Android
```

### Maskable.app
```
https://maskable.app/editor
1. Subir tu icono
2. Ver cómo se adapta a diferentes formas
3. Verificar safe area
```

## 📝 Especificación Oficial

### Minimum Safe Zone (Maskable Icons)

```
┌─────────────────────────────┐
│ ░░░░░░ 10% Edge ░░░░░░░░░░ │ ← Puede cortarse
│ ░░┌─────────────────────┐░░ │
│ ░░│                     │░░ │
│ ░░│   Safe Zone (80%)   │░░ │ ← Siempre visible
│ ░░│   Radius = 40%      │░░ │
│ ░░│                     │░░ │
│ ░░└─────────────────────┘░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────┘
```

**Fuente:** [W3C Manifest Spec](https://w3c.github.io/manifest/#icon-masks)

## ⚠️ Errores Comunes

### Error 1: Usar solo icono transparente
```json
{
  "icons": [
    {
      "src": "./icons/icon.svg",
      "purpose": "any"
    }
  ]
}
```
**Resultado:** Fondo blanco en Android ❌

### Error 2: Usar maskable sin safe area
```xml
<svg viewBox="0 0 512 512">
  <!-- Logo ocupa todo el espacio -->
  <!-- Sin padding -->
</svg>
```
**Resultado:** Logo cortado en Android ❌

### Error 3: Usar transparente en iOS
```html
<link rel="apple-touch-icon" href="transparent-icon.svg">
```
**Resultado:** Fondo negro o blanco según modo ❌

## ✅ Solución Correcta

### Manifest
```json
{
  "icons": [
    {
      "src": "./icons/icon-maskable.svg",
      "sizes": "192x192 512x512",
      "type": "image/svg+xml",
      "purpose": "maskable"
    },
    {
      "src": "./icons/icon-any.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

### HTML
```html
<!-- Desktop/Favicon -->
<link rel="icon" type="image/svg+xml" href="./icons/icon-any.svg">

<!-- iOS específico -->
<link rel="apple-touch-icon" href="./icons/icon-maskable.svg">
<link rel="apple-touch-icon" sizes="180x180" href="./icons/icon-maskable.svg">
```

## 🎯 Conclusión

**Por qué algunos SVG transparentes "funcionan":**

1. **Android agrega fondo blanco automáticamente** a iconos con `purpose: "any"`
2. **El SVG puede tener fondo interno** aunque parezca transparente
3. **El navegador puede elegir** el icono maskable si está disponible

**La solución correcta:**
- Usar **dos iconos**: uno maskable (con fondo) y uno any (transparente)
- El sistema operativo elegirá el apropiado
- Así tienes lo mejor de ambos mundos

---

**Referencias:**
- [Web.dev - Maskable Icons](https://web.dev/articles/maskable-icon)
- [W3C Manifest Spec](https://w3c.github.io/manifest/)
- [Maskable.app](https://maskable.app/)

**Versión:** 7.3.14  
**Fecha:** 2026-02-27
