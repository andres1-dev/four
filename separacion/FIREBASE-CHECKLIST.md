# ✅ Checklist Firebase

Marca cada paso cuando lo completes:

## Configuración en Firebase Console

- [ ] Abrí https://console.firebase.google.com/
- [ ] Inicié sesión con mi cuenta Google
- [ ] Creé un nuevo proyecto
- [ ] Creé Realtime Database
- [ ] Configuré las reglas como públicas (read: true, write: true)
- [ ] Registré una app web
- [ ] Copié el objeto `firebaseConfig`

## Configuración en mi Proyecto

- [ ] Abrí `js/firebase-config.js`
- [ ] Pegué mi configuración de Firebase
- [ ] Guardé el archivo
- [ ] Verifiqué que no diga "TU_API_KEY_AQUI"

## Subir a GitHub

- [ ] Ejecuté `git add .`
- [ ] Ejecuté `git commit -m "Add Firebase sync"`
- [ ] Ejecuté `git push`
- [ ] Esperé 1-2 minutos para que GitHub Pages actualice

## Verificación

- [ ] Abrí `test-firebase.html` en mi navegador
- [ ] Hice clic en "Probar Conexión"
- [ ] Vi el mensaje "✅ Firebase funcionando correctamente"
- [ ] Abrí la consola (F12) y no vi errores en rojo

## Prueba de Sincronización

- [ ] Abrí la app en mi PC
- [ ] Abrí la app en mi celular (o en otra PC)
- [ ] Hice un cambio en una
- [ ] Vi el cambio instantáneamente en la otra

## 🎉 ¡Listo!

Si todos los pasos están marcados, ¡Firebase está funcionando!

---

## 🐛 Si algo no funciona:

### Error: "Permission denied"
→ Ve a Firebase Console → Realtime Database → Reglas
→ Asegúrate de que sean:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

### Error: "Firebase not initialized"
→ Verifica que editaste `js/firebase-config.js`
→ Asegúrate de que pegaste TU configuración (no la de ejemplo)

### No sincroniza entre dispositivos
→ Abre la consola (F12) en ambos dispositivos
→ Verifica que ambos digan "[Firebase] ✅ Conectado a Firebase"
→ Verifica que ambos digan "[Firebase] ✅ Escuchando cambios"

### Los cambios tardan mucho
→ Firebase es instantáneo (menos de 1 segundo)
→ Si tarda más, revisa tu conexión a internet
→ Abre test-firebase.html y envía un evento de prueba

---

## 📊 Ver los Datos en Firebase

1. Ve a Firebase Console
2. Haz clic en "Realtime Database"
3. Verás algo como:
```
sistema-documentos/
  └── sync-events/
      └── -NXxxx.../
          ├── action: "cambiarResponsable"
          ├── rec: "12345"
          ├── timestamp: 1234567890
          └── id: "..."
```

Estos son los eventos de sincronización en tiempo real.

---

## 🎯 Siguiente Paso

Una vez que todo funcione, puedes:
- Eliminar `test-firebase.html` (ya no lo necesitas)
- Eliminar `FIREBASE-SETUP.md` (si ya lo leíste)
- Eliminar este checklist

O déjalos para referencia futura.
