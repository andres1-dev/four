# 🔧 Comandos Git para PWA

## 📦 Subir PWA por Primera Vez

```bash
# 1. Generar iconos primero (abre icons/generate-icons.html)

# 2. Verificar archivos
git status

# 3. Agregar todos los archivos
git add .

# 4. Hacer commit
git commit -m "Add PWA support with real-time sync and custom icons"

# 5. Subir a GitHub
git push origin main
# o si tu rama es master:
git push origin master
```

## 🔄 Actualizar PWA

```bash
# Después de hacer cambios en el código
git add .
git commit -m "Update PWA: [descripción del cambio]"
git push
```

## 🎨 Actualizar Solo Iconos

```bash
# Después de regenerar iconos
git add icons/*.png
git commit -m "Update PWA icons"
git push
```

## 📱 Activar GitHub Pages

### Opción 1: Desde la Web
1. Ve a tu repositorio en GitHub
2. Settings → Pages
3. Source: Deploy from a branch
4. Branch: main (o master) → / (root)
5. Save

### Opción 2: Desde GitHub CLI (si tienes gh instalado)
```bash
gh repo edit --enable-pages --pages-branch main
```

## 🔍 Verificar Estado

```bash
# Ver archivos modificados
git status

# Ver diferencias
git diff

# Ver historial
git log --oneline

# Ver archivos en el último commit
git show --name-only
```

## 🌐 URL de GitHub Pages

Tu PWA estará disponible en:
```
https://[tu-usuario].github.io/[nombre-repo]/
```

Por ejemplo:
```
https://juanperez.github.io/sistema-documentos/
```

## 🔄 Forzar Actualización del Service Worker

Si haces cambios en `sw.js`:

```bash
# 1. Actualizar versión en sw.js
# Cambia: const SW_VERSION = 'v1.0.0';
# Por:    const SW_VERSION = 'v1.0.1';

# 2. Commit y push
git add sw.js
git commit -m "Update Service Worker version"
git push

# 3. En el navegador:
# - Ctrl+Shift+R (hard refresh)
# - O DevTools → Application → Service Workers → Unregister
```

## 🐛 Solución de Problemas Git

### Conflictos al hacer push
```bash
# Traer cambios remotos
git pull origin main

# Resolver conflictos manualmente
# Luego:
git add .
git commit -m "Resolve conflicts"
git push
```

### Deshacer último commit (sin perder cambios)
```bash
git reset --soft HEAD~1
```

### Deshacer cambios en un archivo
```bash
git checkout -- nombre-archivo.js
```

### Ver qué archivos están en .gitignore
```bash
git status --ignored
```

## 📋 Checklist Pre-Push

Antes de hacer push, verifica:

- [ ] Iconos generados y en carpeta `icons/`
- [ ] `manifest.json` apunta a rutas correctas
- [ ] `sw.js` tiene versión actualizada
- [ ] `index.html` tiene links a manifest y favicons
- [ ] No hay errores en consola del navegador
- [ ] Service Worker se registra correctamente

## 🚀 Deploy Completo

```bash
# Script completo para deploy
git add .
git status
git commit -m "Deploy PWA with sync support"
git push origin main

# Luego activa GitHub Pages desde Settings
```

## 📝 Mensajes de Commit Sugeridos

```bash
# Primera vez
git commit -m "Add PWA support with real-time sync"

# Actualizar iconos
git commit -m "Update PWA icons with new design"

# Actualizar Service Worker
git commit -m "Update Service Worker: improve sync performance"

# Actualizar manifest
git commit -m "Update manifest: change app name and colors"

# Fix bugs
git commit -m "Fix: resolve sync issue in Safari"

# Mejoras
git commit -m "Improve: optimize icon generation"
```

## 🔐 Configurar Git (si es primera vez)

```bash
# Configurar nombre y email
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Verificar configuración
git config --list
```

## 📊 Ver Tamaño del Repositorio

```bash
# Ver tamaño de archivos
git ls-files | xargs ls -lh

# Ver tamaño total
du -sh .git
```

## 🎯 Comandos Útiles

```bash
# Clonar tu repo en otra máquina
git clone https://github.com/[usuario]/[repo].git

# Ver ramas
git branch -a

# Crear nueva rama
git checkout -b feature/nueva-funcionalidad

# Cambiar de rama
git checkout main

# Mergear rama
git merge feature/nueva-funcionalidad
```

---

**Tip:** Usa `git status` frecuentemente para saber qué archivos están modificados.
