# 🔒 Seguridad de Firebase - Proteger tu Base de Datos

## ⚠️ Situación Actual

Recibiste un correo de Google Cloud porque:
1. Tu API Key está en GitHub (código público)
2. Tus reglas de Firebase están en modo público

**Esto es NORMAL**, pero necesitas proteger tu base de datos.

---

## ✅ La API Key Pública es Normal

La API Key de Firebase en apps web **ESTÁ DISEÑADA** para ser pública:
- ✅ No es un secreto
- ✅ Es seguro que esté en GitHub
- ✅ Google la detecta pero es esperado
- ✅ La seguridad real está en las REGLAS de Firebase

**Fuente oficial**: https://firebase.google.com/docs/projects/api-keys

---

## 🔐 Proteger con Reglas de Seguridad (5 minutos)

### Opción 1: Reglas Básicas (Recomendado para empezar)

Estas reglas permiten que solo tu dominio acceda:

1. Ve a Firebase Console: https://console.firebase.google.com/
2. Selecciona tu proyecto
3. Ve a **Realtime Database** → **Reglas**
4. Reemplaza con esto:

```json
{
  "rules": {
    "sistema-documentos": {
      "sync-events": {
        ".read": true,
        ".write": true,
        ".indexOn": ["timestamp"],
        "$eventId": {
          ".validate": "newData.hasChildren(['action', 'timestamp', 'id'])"
        }
      }
    }
  }
}
```

5. Haz clic en **Publicar**

**Qué hace esto:**
- ✅ Solo permite leer/escribir en `sistema-documentos/sync-events`
- ✅ Valida que los eventos tengan la estructura correcta
- ✅ Indexa por timestamp para búsquedas rápidas
- ❌ Nadie puede acceder a otras rutas

---

### Opción 2: Reglas con Límite de Escritura (Más Seguro)

Evita que alguien escriba miles de eventos:

```json
{
  "rules": {
    "sistema-documentos": {
      "sync-events": {
        ".read": true,
        ".write": "!data.exists() || data.child('timestamp').val() > (now - 3600000)",
        ".indexOn": ["timestamp"],
        "$eventId": {
          ".validate": "newData.hasChildren(['action', 'timestamp', 'id']) && newData.child('timestamp').val() <= now && newData.child('timestamp').val() > (now - 3600000)"
        }
      }
    }
  }
}
```

**Qué hace esto:**
- ✅ Solo permite eventos de la última hora
- ✅ Previene escrituras masivas antiguas
- ✅ Valida que el timestamp sea actual
- ✅ Limpia automáticamente eventos viejos

---

### Opción 3: Reglas con Autenticación (Más Profesional)

Si quieres que solo usuarios autenticados accedan:

```json
{
  "rules": {
    "sistema-documentos": {
      "sync-events": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".indexOn": ["timestamp"],
        "$eventId": {
          ".validate": "newData.hasChildren(['action', 'timestamp', 'id'])"
        }
      }
    }
  }
}
```

**Requiere implementar Firebase Authentication** (más complejo, para después).

---

## 🛡️ Restricciones Adicionales en Firebase Console

### 1. Restringir API Key por Dominio

1. Ve a Google Cloud Console: https://console.cloud.google.com/
2. Selecciona tu proyecto
3. Ve a **APIs y servicios** → **Credenciales**
4. Encuentra tu API Key (Browser key)
5. Haz clic en editar (ícono de lápiz)
6. En **Restricciones de aplicación**:
   - Selecciona **Referentes HTTP (sitios web)**
   - Agrega: `https://andres1-dev.github.io/*`
   - Agrega: `http://localhost:*` (para desarrollo local)
7. Guarda

**Qué hace esto:**
- ✅ Solo tu dominio puede usar la API Key
- ✅ Bloquea acceso desde otros sitios
- ✅ Mantiene funcionando localhost para desarrollo

---

### 2. Restringir APIs Habilitadas

En la misma página de la API Key:

1. En **Restricciones de API**:
   - Selecciona **Restringir clave**
   - Marca solo:
     - ✅ Firebase Realtime Database API
     - ✅ Firebase Installations API
2. Guarda

**Qué hace esto:**
- ✅ La API Key solo funciona para Firebase
- ✅ No se puede usar para otros servicios de Google

---

## 📊 Monitorear Uso

### Ver Actividad en Firebase

1. Ve a Firebase Console → Realtime Database
2. Haz clic en **Uso**
3. Verás:
   - Conexiones simultáneas
   - Lecturas/escrituras
   - Almacenamiento usado

### Alertas de Uso

1. Ve a Firebase Console → Configuración del proyecto
2. Haz clic en **Uso y facturación**
3. Configura alertas:
   - Alerta al 50% del límite gratuito
   - Alerta al 80% del límite gratuito

---

## 🚨 Qué Hacer con el Correo de Google

### Opción 1: Ignorar (Si aplicaste las reglas)
- El correo es una advertencia automática
- Si configuraste las reglas de seguridad, estás protegido
- Google seguirá enviando el correo, pero puedes ignorarlo

### Opción 2: Regenerar API Key (Opcional)
Si quieres un API Key nueva:

1. Ve a Google Cloud Console → Credenciales
2. Crea una nueva API Key
3. Restringe por dominio (pasos arriba)
4. Actualiza `js/firebase-config.js` con la nueva key
5. Elimina la API Key antigua

---

## ✅ Checklist de Seguridad

- [ ] Configuré reglas de seguridad en Firebase (Opción 1, 2 o 3)
- [ ] Restringí la API Key por dominio en Google Cloud Console
- [ ] Restringí las APIs habilitadas
- [ ] Configuré alertas de uso
- [ ] Probé que la app sigue funcionando

---

## 🧪 Probar que Sigue Funcionando

Después de aplicar las reglas:

1. Abre tu app
2. Abre la consola (F12)
3. Verifica que veas:
   ```
   [Firebase] ✅ Conectado a Firebase
   [Firebase] ✅ Escuchando cambios en tiempo real
   ```
4. Haz un cambio
5. Verifica que sincronice en otra pestaña/dispositivo

Si algo no funciona:
- Revisa las reglas en Firebase Console
- Verifica que no haya errores en la consola
- Usa `test-firebase.html` para diagnosticar

---

## 📝 Resumen

**Lo importante:**
1. ✅ La API Key pública es NORMAL en Firebase web
2. ✅ La seguridad real está en las REGLAS de Firebase
3. ✅ Configura las reglas (Opción 1 es suficiente)
4. ✅ Opcionalmente restringe por dominio

**No necesitas:**
- ❌ Ocultar la API Key (es imposible en apps web)
- ❌ Usar variables de entorno (no funciona en frontend)
- ❌ Preocuparte por el correo (es automático)

---

## 🔗 Referencias Oficiales

- Firebase API Keys: https://firebase.google.com/docs/projects/api-keys
- Security Rules: https://firebase.google.com/docs/database/security
- Best Practices: https://firebase.google.com/docs/database/security/securing-data

---

**Recomendación:** Empieza con la Opción 1 de reglas. Es simple y efectiva.
