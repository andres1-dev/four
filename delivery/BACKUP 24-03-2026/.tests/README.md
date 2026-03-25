# 🧪 Herramientas de Prueba

Esta carpeta contiene todas las herramientas para probar y verificar la PWA.

## 🔧 Herramientas Disponibles

### 1. test-pwa.html
**Prueba automática completa de la PWA**

```bash
# Abrir en navegador
http://localhost:8000/.tests/test-pwa.html
```

**Verifica:**
- ✅ Información de ubicación (URL, pathname, base path)
- ✅ Estado del manifest.json
- ✅ Estado del Service Worker
- ✅ Disponibilidad de recursos (iconos, CSS, JS)
- ✅ Instalabilidad de la PWA

**Características:**
- Ejecución automática al cargar
- Resultados en tiempo real
- JSON detallado de todos los tests
- Botones para verificación manual

---

### 2. test-icons.html
**Prueba visual de iconos**

```bash
# Abrir en navegador
http://localhost:8000/.tests/test-icons.html
```

**Muestra:**
- ✅ Comparación lado a lado de icon-any.svg y icon-maskable.svg
- ✅ Prueba de máscaras adaptativas (círculo, squircle, redondeado, cuadrado)
- ✅ Vista por dispositivo (iOS, Android, Samsung, Desktop)
- ✅ Tabla comparativa técnica
- ✅ Instrucciones de verificación

**Características:**
- Visualización en tiempo real
- Simulación de diferentes formas
- Información técnica detallada

---

### 3. generate-icons.html
**Generador de PNG desde SVG**

```bash
# Abrir en navegador
http://localhost:8000/.tests/generate-icons.html
```

**Genera:**
- ✅ icon-192.png (192x192px)
- ✅ icon-256.png (256x256px)
- ✅ icon-384.png (384x384px)
- ✅ icon-512.png (512x512px)

**Características:**
- Generación automática desde icon-maskable.svg
- Preview en tiempo real
- Descarga individual de cada tamaño
- Log detallado del proceso

**Uso:**
1. Clic en "Generar Todos los PNG"
2. Esperar a que se generen
3. Clic derecho en cada imagen → "Guardar imagen como..."
4. Guardar en la carpeta `icons/`

---

## 🚀 Cómo Usar

### Iniciar Servidor Local

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (con http-server)
npx http-server -p 8000
```

### Ejecutar Tests

1. **Test Completo de PWA:**
   ```
   http://localhost:8000/.tests/test-pwa.html
   ```
   - Ejecuta automáticamente al cargar
   - Revisa todos los resultados
   - Verifica que todo esté en verde

2. **Test Visual de Iconos:**
   ```
   http://localhost:8000/.tests/test-icons.html
   ```
   - Verifica que ambos iconos se vean bien
   - Prueba las máscaras adaptativas
   - Revisa la tabla comparativa

3. **Generar PNG (si es necesario):**
   ```
   http://localhost:8000/.tests/generate-icons.html
   ```
   - Solo si necesitas versiones PNG
   - Descarga y guarda en `icons/`

---

## 📊 Interpretación de Resultados

### test-pwa.html

**Estado OK (Verde):**
- ✅ Manifest carga correctamente
- ✅ Service Worker registrado y activo
- ✅ Todos los recursos disponibles
- ✅ PWA es instalable

**Estado Error (Rojo):**
- ❌ Revisar consola del navegador (F12)
- ❌ Verificar que los archivos existan
- ❌ Comprobar rutas relativas
- ❌ Limpiar cache y recargar

### test-icons.html

**Verificar:**
- Logo se ve grande (no pequeño)
- No se corta en ninguna máscara
- Fondo blanco en maskable
- Transparente en any

---

## 🔍 Troubleshooting

### Los tests no cargan
```bash
# Verificar que el servidor esté corriendo
# Verificar la URL correcta
# Abrir consola del navegador (F12)
```

### Errores 404
```bash
# Verificar que estés en la raíz del proyecto
# Las rutas son relativas a la raíz
```

### Service Worker no se registra
```bash
# Debe servirse por HTTPS o localhost
# Limpiar cache del navegador
# Desregistrar SW anterior en DevTools
```

---

## 📚 Documentación Relacionada

- [Documentación Completa](../.docs/)
- [Guía de Instalación](../.docs/INSTALACION_PWA.md)
- [Guía de Iconos](../.docs/ICONOS_PWA.md)

---

## 🎯 Checklist de Pruebas

Antes de considerar la PWA lista:

- [ ] test-pwa.html pasa todos los tests
- [ ] test-icons.html muestra ambos iconos correctamente
- [ ] Manifest carga sin errores
- [ ] Service Worker se registra correctamente
- [ ] Todos los recursos cargan (iconos, CSS, JS)
- [ ] PWA se instala en iOS
- [ ] PWA se instala en Android
- [ ] PWA se instala en Desktop
- [ ] Iconos se ven grandes (no pequeños)
- [ ] Favicon se ve bien en navegador
- [ ] Lighthouse PWA score > 90

---

**Última actualización:** 2026-02-27  
**Versión:** 7.3.14
