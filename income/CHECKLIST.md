# ✅ Checklist de Implementación - Fix Link ih3 iOS PWA

## 📝 Lista de Verificación

### Fase 1: Actualizar Google Apps Script
- [ ] Abrir https://script.google.com
- [ ] Abrir el proyecto actual
- [ ] Copiar TODO el código de `google-apps-script-actualizado.js`
- [ ] Pegar en el editor (reemplazar todo)
- [ ] Guardar (Ctrl+S o Cmd+S)
- [ ] Clic en "Implementar" → "Administrar implementaciones"
- [ ] Clic en ícono de lápiz (editar) en la implementación actual
- [ ] Seleccionar "Nueva versión" en el dropdown
- [ ] Clic en "Implementar"
- [ ] Verificar que la URL sigue siendo la misma
- [ ] ✅ **Google Apps Script actualizado**

---

### Fase 2: Subir Cambios a GitHub
- [ ] Abrir terminal en el proyecto
- [ ] Ejecutar: `git status` (verificar archivos modificados)
- [ ] Ejecutar: `git add .`
- [ ] Ejecutar: `git commit -m "Fix: Solución para link ih3 en iOS PWA"`
- [ ] Ejecutar: `git push origin main`
- [ ] Esperar 1-2 minutos para que GitHub Pages se actualice
- [ ] ✅ **Código subido a GitHub**

---

### Fase 3: Verificar en PC (Opcional pero Recomendado)
- [ ] Abrir https://andres1-dev.github.io/four/income/ en Chrome/Edge
- [ ] Abrir DevTools (F12)
- [ ] Ir a la pestaña Console
- [ ] Enviar un informe de prueba
- [ ] Verificar que aparece: "✓ URL de imagen obtenida exitosamente"
- [ ] Verificar que el link ih3 aparece en WhatsApp Web
- [ ] ✅ **Funciona en PC**

---

### Fase 4: Actualizar PWA en iOS

#### Opción A: Forzar Actualización (Rápido)
- [ ] Cerrar completamente la app PWA (deslizar hacia arriba)
- [ ] Esperar 10 segundos
- [ ] Volver a abrir la app
- [ ] Verificar que aparece el botón 🐛 en la esquina
- [ ] Si NO aparece el botón 🐛, ir a Opción B

#### Opción B: Reinstalar (Más Seguro)
- [ ] Mantener presionado el ícono de la app
- [ ] Seleccionar "Eliminar app"
- [ ] Confirmar eliminación
- [ ] Abrir Safari
- [ ] Ir a: https://andres1-dev.github.io/four/income/
- [ ] Tocar botón compartir (cuadrado con flecha)
- [ ] Seleccionar "Añadir a pantalla de inicio"
- [ ] Confirmar
- [ ] Abrir la nueva app
- [ ] Verificar que aparece el botón 🐛
- [ ] ✅ **PWA actualizada en iOS**

---

### Fase 5: Probar Envío de Informe
- [ ] Abrir la app PWA en iOS
- [ ] Tocar el botón 🐛 (esquina inferior derecha)
- [ ] Verificar información del entorno:
  - [ ] iOS: true
  - [ ] PWA Mode: true
  - [ ] Safari: true
- [ ] Tocar botón de WhatsApp o captura
- [ ] Ingresar contraseña: "One"
- [ ] Observar los logs en el panel negro

---

### Fase 6: Verificar Logs

#### ✅ Logs de Éxito (Buscar estos mensajes)
- [ ] "Subiendo imagen a Drive..."
- [ ] "Tamaño de imagen (base64): ~2000000 caracteres" (NO 8885020)
- [ ] "Tamaño del blob: ~1500000 bytes"
- [ ] "Respuesta HTTP status: 200"
- [ ] "✓ URL de imagen obtenida exitosamente: https://lh3..."
- [ ] "Link ih3 incluido: SÍ"
- [ ] "Abriendo WhatsApp - iOS: true PWA: true"

#### ❌ Logs de Error (Si ves estos, algo salió mal)
- [ ] "ERROR: ✗ Error en la petición a Drive: TypeError: Load failed"
- [ ] "Link ih3 incluido: NO"
- [ ] "Tamaño de imagen (base64): 8885020 caracteres" (muy grande)

---

### Fase 7: Verificar en WhatsApp
- [ ] WhatsApp se abre correctamente
- [ ] El mensaje contiene el texto del informe
- [ ] El mensaje contiene: "☆ Link a la aplicación: https://..."
- [ ] El mensaje contiene: "★ Resumen visual: https://lh3.googleusercontent.com/d/..."
- [ ] ✅ **Link ih3 aparece en WhatsApp**

---

## 🎉 ¡Éxito!

Si todos los checkboxes están marcados, el problema está resuelto.

---

## 🚨 Troubleshooting

### Problema: El botón 🐛 no aparece
**Solución:** La PWA no se actualizó. Reinstalar (Opción B de Fase 4).

### Problema: Sigue apareciendo "TypeError: Load failed"
**Solución:** Google Apps Script no está actualizado. Verificar Fase 1.

### Problema: "Tamaño de imagen: 8885020 caracteres"
**Solución:** El código JavaScript no se actualizó. Verificar Fase 2 y Fase 4.

### Problema: "Link ih3 incluido: NO" pero no hay error
**Solución:** Google Apps Script no está devolviendo la URL correctamente. Revisar el código del script.

### Problema: WhatsApp no se abre
**Solución:** Verificar que WhatsApp esté instalado. Probar con otro número.

---

## 📸 Capturas de Pantalla Útiles

Si necesitas ayuda, toma capturas de:
1. Panel de logs del botón 🐛 (completo)
2. Mensaje de WhatsApp (mostrando qué aparece y qué no)
3. Consola de Google Apps Script (si hay errores)

---

**Tiempo estimado total:** 15-20 minutos
**Dificultad:** Media
**Requiere:** Acceso a Google Apps Script, GitHub, dispositivo iOS
