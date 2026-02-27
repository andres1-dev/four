# ❓ Preguntas Frecuentes - Fix Link ih3 iOS PWA

## General

### ¿Qué es el link ih3?
Es la URL de la imagen del informe subida a Google Drive. Tiene el formato:
```
https://lh3.googleusercontent.com/d/[ID_DEL_ARCHIVO]
```

### ¿Por qué no funcionaba en iOS?
iOS PWA tiene restricciones de seguridad más estrictas que bloquean peticiones POST con contenido base64 muy grande. El error específico era "TypeError: Load failed".

### ¿Funcionará en Android?
Sí, la solución es compatible con todos los navegadores y sistemas operativos.

---

## Implementación

### ¿Tengo que actualizar Google Apps Script obligatoriamente?
**Sí, es crítico.** Sin actualizar el script, el servidor no entenderá el nuevo formato FormData y fallará.

### ¿Puedo mantener el formato PNG?
No es recomendable. PNG genera archivos muy grandes que causan problemas en iOS. JPEG con calidad 0.7 es suficiente para WhatsApp.

### ¿Qué pasa si no actualizo la PWA en iOS?
La app seguirá usando el código antiguo y el problema persistirá. Debes reinstalar o forzar la actualización.

### ¿Cuánto tiempo tarda en actualizarse GitHub Pages?
Normalmente 1-2 minutos después del push. Puedes verificar abriendo la URL en modo incógnito.

---

## Calidad de Imagen

### ¿La calidad de la imagen se verá afectada?
Sí, pero mínimamente. JPEG con calidad 0.7 es más que suficiente para compartir en WhatsApp. La diferencia es imperceptible en pantallas móviles.

### ¿Puedo aumentar la calidad?
Sí, pero no es recomendable. Valores mayores a 0.8 pueden causar problemas de tamaño en iOS. El valor 0.7 es el balance óptimo.

### ¿Por qué JPEG y no PNG?
JPEG tiene mejor compresión para imágenes con muchos colores (como capturas de pantalla). PNG es mejor para gráficos simples, pero genera archivos más grandes.

---

## Troubleshooting

### El botón 🐛 no aparece
**Causa:** La PWA no se actualizó.
**Solución:** Reinstalar la PWA (eliminar y volver a instalar).

### Sigue apareciendo "TypeError: Load failed"
**Causa:** Google Apps Script no está actualizado.
**Solución:** Verificar que implementaste la nueva versión del script.

### "Tamaño de imagen: 8885020 caracteres"
**Causa:** El código JavaScript no se actualizó.
**Solución:** Verificar que hiciste push a GitHub y reinstalaste la PWA.

### "Link ih3 incluido: NO" pero no hay error
**Causa:** Google Apps Script no está devolviendo la URL.
**Solución:** Revisar los logs de Google Apps Script (Ejecuciones).

### WhatsApp no se abre
**Causa:** Problema con la función openWhatsApp.
**Solución:** Verificar que WhatsApp esté instalado. Probar con otro número.

### La imagen se sube pero el link no aparece en WhatsApp
**Causa:** El mensaje puede ser demasiado largo.
**Solución:** Verificar que el mensaje completo se está generando correctamente.

---

## Google Apps Script

### ¿Cómo sé si el script está actualizado?
Abre el script y busca la función `handleImageUploadFromFormData`. Si no existe, no está actualizado.

### ¿Tengo que cambiar la URL del script?
No, la URL debe seguir siendo la misma. Solo actualizas el código y creas una nueva versión.

### ¿Qué permisos necesita el script?
- Acceso a Google Drive (para subir archivos)
- Acceso a Gmail (para enviar emails)

### ¿Puedo tener múltiples versiones del script?
Sí, pero solo una estará activa. La última versión implementada es la que se usa.

---

## Seguridad

### ¿Los archivos en Drive son públicos?
Sí, el script hace los archivos públicos con el enlace. Cualquiera con el link puede verlos.

### ¿Puedo hacer los archivos privados?
Sí, pero entonces el link ih3 no funcionará en WhatsApp. WhatsApp necesita acceso público para mostrar la vista previa.

### ¿Cuánto tiempo permanecen los archivos en Drive?
Permanentemente, a menos que los elimines manualmente. Considera limpiar archivos antiguos periódicamente.

---

## Rendimiento

### ¿Cuánto tarda en subir la imagen?
Con la nueva solución: ~3 segundos en buena conexión.
Con la solución anterior: ~10 segundos o timeout.

### ¿Funciona sin internet?
No, necesitas conexión para subir la imagen a Drive y abrir WhatsApp.

### ¿Puedo usar la app offline?
Puedes ver los datos, pero no enviar informes sin conexión.

---

## Compatibilidad

### ¿Funciona en Safari normal (no PWA)?
Sí, funciona en todos los navegadores.

### ¿Funciona en iPad?
Sí, iPad usa el mismo motor que iPhone.

### ¿Funciona en versiones antiguas de iOS?
Debería funcionar en iOS 12+. Versiones más antiguas no están probadas.

### ¿Funciona en Chrome iOS?
Sí, pero Chrome en iOS usa el motor de Safari, así que es lo mismo.

---

## Desarrollo

### ¿Puedo modificar la calidad de la imagen?
Sí, cambia el valor en `capture.js`:
```javascript
const imageQuality = isMobile ? 0.7 : 0.85;
```

### ¿Puedo cambiar el formato de vuelta a PNG?
Sí, pero no es recomendable:
```javascript
const imageData = canvas.toDataURL('image/png', 0.9);
```

### ¿Puedo desactivar el botón de debug?
Sí, elimina o comenta la línea en `index.html`:
```html
<!-- <script src="js/utils/ios_debug.js?v=12"></script> -->
```

### ¿Cómo agrego más logs?
Usa `console.log()` en cualquier parte del código. El botón 🐛 los mostrará automáticamente.

---

## Costos

### ¿Tiene algún costo esta solución?
No, todo es gratuito:
- Google Apps Script: Gratis
- Google Drive: 15 GB gratis
- GitHub Pages: Gratis

### ¿Qué pasa si lleno los 15 GB de Drive?
Puedes:
1. Eliminar archivos antiguos
2. Comprar más espacio (Google One)
3. Usar otra carpeta de Drive

---

## Mantenimiento

### ¿Necesito actualizar el código regularmente?
No, a menos que haya nuevos problemas o quieras agregar funcionalidades.

### ¿Cómo limpio archivos antiguos de Drive?
Manualmente desde Google Drive, o crea un script para eliminar archivos con más de X días.

### ¿Cómo monitoreo errores?
Revisa los logs de Google Apps Script regularmente (Ejecuciones).

---

## Migración

### ¿Puedo revertir a la versión anterior?
Sí, pero no hay razón para hacerlo. La nueva versión es mejor en todos los aspectos.

### ¿Afectará a usuarios que ya tienen la app instalada?
Sí, necesitarán actualizar o reinstalar la PWA para obtener los cambios.

### ¿Puedo tener ambas versiones funcionando?
No es recomendable. Mantén solo la nueva versión.

---

## Soporte

### ¿Dónde puedo ver los logs completos?
- iOS: Botón 🐛 en la app
- PC: DevTools (F12) → Console
- Servidor: Google Apps Script → Ejecuciones

### ¿Cómo reporto un bug?
Comparte:
1. Captura de pantalla de los logs
2. Versión de iOS
3. Pasos para reproducir el problema

### ¿Hay documentación adicional?
Sí, revisa:
- `RESUMEN_SOLUCION.md` - Resumen ejecutivo
- `CHECKLIST.md` - Lista de verificación
- `DIAGRAMA_FLUJO.md` - Flujo técnico
- `INSTRUCCIONES_DEBUG_IOS.md` - Guía de debug

---

## Casos Especiales

### ¿Qué pasa si el usuario no tiene WhatsApp?
La app intentará abrir WhatsApp. Si no está instalado, mostrará un error del sistema.

### ¿Puedo enviar a otro número de WhatsApp?
Sí, cambia el número en `capture.js`:
```javascript
const phoneNumber = "573168007979"; // Tu número aquí
```

### ¿Puedo enviar por Telegram en lugar de WhatsApp?
Sí, pero necesitarás modificar la función `openWhatsApp` para usar la API de Telegram.

### ¿Puedo enviar múltiples imágenes?
No con la implementación actual. Necesitarías modificar el código para subir múltiples archivos.

---

**Última actualización:** 27 de febrero de 2026
**Versión:** 1.0
