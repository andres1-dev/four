# 🔥 Configuración de Firebase - Paso a Paso

## Paso 1: Crear Proyecto en Firebase (5 minutos)

### 1.1 Ir a Firebase Console
1. Abre tu navegador y ve a: https://console.firebase.google.com/
2. Inicia sesión con tu cuenta de Google
3. Haz clic en **"Agregar proyecto"** o **"Add project"**

### 1.2 Configurar el Proyecto
1. **Nombre del proyecto**: Escribe `sistema-documentos` (o el nombre que prefieras)
2. Haz clic en **"Continuar"**
3. **Google Analytics**: Puedes desactivarlo (no lo necesitamos)
4. Haz clic en **"Crear proyecto"**
5. Espera 30 segundos mientras se crea
6. Haz clic en **"Continuar"**

---

## Paso 2: Configurar Realtime Database (3 minutos)

### 2.1 Crear la Base de Datos
1. En el menú lateral izquierdo, busca **"Realtime Database"**
2. Haz clic en **"Crear base de datos"** o **"Create database"**
3. **Ubicación**: Selecciona `United States (us-central1)` (o la más cercana)
4. Haz clic en **"Siguiente"**

### 2.2 Configurar Reglas de Seguridad
1. Selecciona **"Comenzar en modo de prueba"** o **"Start in test mode"**
   - Esto permite lectura/escritura sin autenticación (perfecto para empezar)
2. Haz clic en **"Habilitar"**
3. Espera unos segundos mientras se crea la base de datos

### 2.3 Ajustar Reglas (Importante)
1. Ve a la pestaña **"Reglas"** o **"Rules"**
2. Verás algo como esto:
```json
{
  "rules": {
    ".read": "now < 1234567890000",
    ".write": "now < 1234567890000"
  }
}
```
3. **Reemplázalo** con esto (para que no expire):
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
4. Haz clic en **"Publicar"** o **"Publish"**

⚠️ **Nota de Seguridad**: Estas reglas permiten acceso público. Más adelante puedes agregar autenticación.

---

## Paso 3: Obtener Configuración de Firebase (2 minutos)

### 3.1 Registrar tu App Web
1. En la página principal del proyecto, busca el ícono **</>** (Web)
2. Haz clic en él
3. **Nombre de la app**: Escribe `sistema-documentos-web`
4. **NO** marques "Firebase Hosting"
5. Haz clic en **"Registrar app"**

### 3.2 Copiar la Configuración
Verás un código como este:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "tu-proyecto.firebaseapp.com",
  databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

### 3.3 Guardar la Configuración
1. **COPIA TODO** el objeto `firebaseConfig`
2. Lo necesitarás en el siguiente paso
3. Haz clic en **"Continuar a la consola"**

---

## Paso 4: Configurar tu Aplicación (1 minuto)

### 4.1 Editar firebase-config.js
1. Abre el archivo `js/firebase-config.js` en tu proyecto
2. Verás esto:
```javascript
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "TU_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://TU_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT_ID.appspot.com",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};
```

3. **REEMPLAZA** todo el objeto con el que copiaste de Firebase
4. **GUARDA** el archivo

---

## Paso 5: Verificar que Funciona (1 minuto)

### 5.1 Subir a GitHub
```bash
git add .
git commit -m "Add Firebase sync"
git push
```

### 5.2 Esperar y Probar
1. Espera 1-2 minutos para que GitHub Pages actualice
2. Abre tu app en el navegador
3. Abre la consola (F12)
4. Deberías ver:
```
[Firebase] Conectado a Firebase
[Firebase] Escuchando cambios en tiempo real
```

### 5.3 Probar Sincronización
1. Abre la app en tu PC
2. Abre la app en tu celular (o en otra PC)
3. Haz un cambio en una
4. ¡Verás el cambio instantáneamente en la otra!

---

## 🎉 ¡Listo!

Tu aplicación ahora sincroniza en tiempo real entre:
- ✅ Diferentes pestañas
- ✅ Diferentes navegadores
- ✅ Diferentes PCs
- ✅ Diferentes dispositivos móviles
- ✅ Cualquier lugar del mundo

---

## 🔧 Solución de Problemas

### Error: "Permission denied"
- Ve a Firebase Console → Realtime Database → Reglas
- Asegúrate de que las reglas sean:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

### No se conecta a Firebase
- Verifica que copiaste bien el `firebaseConfig`
- Revisa la consola del navegador (F12) para ver errores
- Asegúrate de que el `databaseURL` esté correcto

### Los cambios no se sincronizan
- Abre la consola (F12) en ambos dispositivos
- Verifica que ambos muestren "Conectado a Firebase"
- Revisa que no haya errores en rojo

---

## 📊 Ver los Datos en Firebase

1. Ve a Firebase Console
2. Haz clic en "Realtime Database"
3. Verás los datos en tiempo real:
```
sistema-documentos/
  └── sync-events/
      └── [timestamp]/
          ├── action: "cambiarResponsable"
          ├── rec: "12345"
          └── timestamp: 1234567890
```

---

## 🔐 Seguridad (Opcional - Para Después)

Actualmente cualquiera puede leer/escribir. Para producción:

1. Ve a Firebase Console → Realtime Database → Reglas
2. Cambia a:
```json
{
  "rules": {
    "sistema-documentos": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```
3. Implementa Firebase Authentication

Pero por ahora, con las reglas públicas está bien para probar.

---

## 💰 Límites Gratuitos de Firebase

- ✅ 100 conexiones simultáneas
- ✅ 1 GB de almacenamiento
- ✅ 10 GB de transferencia/mes
- ✅ Más que suficiente para tu uso

---

## 📝 Resumen de lo que Hiciste

1. ✅ Creaste un proyecto en Firebase
2. ✅ Configuraste Realtime Database
3. ✅ Obtuviste las credenciales
4. ✅ Las pegaste en tu app
5. ✅ Subiste a GitHub
6. ✅ ¡Ahora tienes sincronización en tiempo real!

---

**¿Necesitas ayuda?** Revisa la consola del navegador (F12) para ver mensajes de error.
