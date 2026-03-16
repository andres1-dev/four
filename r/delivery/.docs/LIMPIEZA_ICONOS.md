# 🧹 Limpieza de Iconos Antiguos

## Archivos que Puedes Eliminar

Ahora que tienes los nuevos iconos optimizados, puedes eliminar los archivos antiguos:

### ❌ Archivos Obsoletos

```bash
# Estos archivos ya no se usan
icons/icon.svg              # Reemplazado por icon-any.svg
icons/apple-touch-icon.svg  # Reemplazado por icon-maskable.svg
icons/alfa.svg              # No se usa
icons/github.svg            # Si existe y no se usa
```

### ✅ Archivos Nuevos (Mantener)

```bash
# Estos son los únicos iconos que necesitas
icons/icon-any.svg          # Uso general (favicon, navegador)
icons/icon-maskable.svg     # Instalación PWA (iOS, Android)
```

## 🔍 Verificar Referencias

Antes de eliminar, verifica que no haya referencias en tu código:

### Buscar referencias a iconos antiguos

```bash
# En Linux/Mac
grep -r "icon.svg" . --exclude-dir=node_modules
grep -r "apple-touch-icon.svg" . --exclude-dir=node_modules
grep -r "alfa.svg" . --exclude-dir=node_modules

# En Windows PowerShell
Select-String -Path . -Pattern "icon.svg" -Recurse -Exclude node_modules
Select-String -Path . -Pattern "apple-touch-icon.svg" -Recurse -Exclude node_modules
Select-String -Path . -Pattern "alfa.svg" -Recurse -Exclude node_modules
```

## ✅ Comandos de Limpieza

### Opción 1: Eliminar manualmente
```bash
# Navega a la carpeta icons/
cd icons/

# Elimina los archivos antiguos
rm icon.svg
rm apple-touch-icon.svg
rm alfa.svg
```

### Opción 2: Renombrar (backup)
```bash
# Si prefieres hacer backup primero
cd icons/
mv icon.svg icon.svg.old
mv apple-touch-icon.svg apple-touch-icon.svg.old
mv alfa.svg alfa.svg.old
```

### Opción 3: Mover a carpeta de backup
```bash
# Crear carpeta de backup
mkdir icons/old/

# Mover archivos antiguos
mv icons/icon.svg icons/old/
mv icons/apple-touch-icon.svg icons/old/
mv icons/alfa.svg icons/old/
```

## 🧪 Verificar Después de Limpiar

Después de eliminar los archivos antiguos:

### 1. Verificar que la app funcione
```bash
# Abrir en navegador
http://localhost:8000/

# Verificar que:
- El favicon se vea bien
- No hay errores en consola (F12)
- Las imágenes cargan correctamente
```

### 2. Ejecutar test automático
```bash
# Abrir test de PWA
http://localhost:8000/test-pwa.html

# Verificar que:
- Todos los recursos estén OK
- Los iconos carguen correctamente
```

### 3. Ejecutar test de iconos
```bash
# Abrir test de iconos
http://localhost:8000/test-icons.html

# Verificar que:
- Ambos iconos se muestren
- Las máscaras funcionen
```

## 🔄 Si Algo Sale Mal

Si después de eliminar los archivos algo no funciona:

### Restaurar desde backup
```bash
# Si hiciste backup
cd icons/
mv icon.svg.old icon.svg
mv apple-touch-icon.svg.old apple-touch-icon.svg
mv alfa.svg.old alfa.svg
```

### O desde carpeta old/
```bash
cd icons/
mv old/icon.svg .
mv old/apple-touch-icon.svg .
mv old/alfa.svg .
```

## 📊 Comparación de Tamaño

Antes y después de la limpieza:

```
ANTES:
icons/icon.svg              ~8 KB
icons/apple-touch-icon.svg  ~9 KB
icons/alfa.svg              ~8 KB
Total: ~25 KB

DESPUÉS:
icons/icon-any.svg          ~8 KB
icons/icon-maskable.svg     ~9 KB
Total: ~17 KB

Ahorro: ~8 KB (32%)
```

## ✅ Checklist Final

Antes de considerar la limpieza completa:

- [ ] Los nuevos iconos funcionan en todos los navegadores
- [ ] La PWA se instala correctamente en iOS
- [ ] La PWA se instala correctamente en Android
- [ ] El favicon se ve bien en desktop
- [ ] No hay errores en la consola
- [ ] test-pwa.html pasa todas las pruebas
- [ ] test-icons.html muestra ambos iconos
- [ ] Has hecho backup de los archivos antiguos

## 🎯 Resultado Final

Después de la limpieza, tu carpeta `icons/` debe contener solo:

```
icons/
├── icon-any.svg          ✅ Nuevo (uso general)
└── icon-maskable.svg     ✅ Nuevo (PWA)
```

Simple, limpio y optimizado. 🎉

---

**Nota:** Si tienes otros archivos en la carpeta `icons/` que sí usas (como `github.svg` para enlaces sociales), mantenlos. Solo elimina los que ya no se referencian en ningún lugar.

**Versión:** 7.3.14  
**Fecha:** 2026-02-27
