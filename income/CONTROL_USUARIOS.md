# Sistema de Control de Usuarios - OWNER

## Descripción

Sistema completo de gestión de usuarios para el rol OWNER en la aplicación de Ingresos de Marca Propia. Permite administrar usuarios, roles, permisos y sesiones activas.

## Características

### 1. Acceso Exclusivo OWNER
- Solo los usuarios con rol OWNER pueden acceder al sistema de gestión
- El botón de "Gestión de Usuarios" solo aparece en el perfil de usuarios OWNER

### 2. Gestión de Usuarios
- **Ver lista de usuarios**: Tabla completa con todos los usuarios registrados
- **Crear usuarios**: Formulario para agregar nuevos usuarios al sistema
- **Editar usuarios**: Modificar información de usuarios existentes
- **Activar/Desactivar**: Control de estado activo/inactivo de usuarios
- **Cerrar sesiones**: Forzar cierre de sesión de usuarios conectados

### 3. Información Mostrada
- Usuario (nombre de usuario único)
- Nombre completo
- Correo electrónico
- Teléfono
- Rol (OWNER, ADMIN, USER)
- Estado (Activo/Inactivo)
- Sesión (En línea/Desconectado)

### 4. Roles Disponibles
- **OWNER**: Acceso total, gestión de usuarios, acceso multiplataforma
- **ADMIN**: Acceso administrativo, acceso multiplataforma
- **USER**: Acceso estándar, limitado a un dispositivo

## Estructura de Archivos

### Frontend
```
js/ui/user_management.js       - Lógica de gestión de usuarios
css/components/user_management.css  - Estilos del sistema
```

### Backend (Google Apps Script)
```
gas/login_handler.gs           - Funciones de gestión en GAS
```

### Funciones GAS Agregadas
- `_updateUser(body)` - Actualizar datos de usuario
- `_createUser(body)` - Crear nuevo usuario
- `_logoutUser(body)` - Cerrar sesión de usuario

## Uso

### Acceder al Sistema
1. Iniciar sesión con un usuario OWNER
2. Hacer clic en el botón de perfil (icono de usuario en el header)
3. Hacer clic en "Gestión de Usuarios"

### Crear Usuario
1. En el modal de gestión, hacer clic en "Nuevo Usuario"
2. Completar el formulario:
   - Usuario (requerido, único)
   - Nombre completo (requerido)
   - Correo electrónico (opcional)
   - Teléfono (opcional)
   - Rol (requerido)
   - Contraseña (requerida)
3. Hacer clic en "Crear Usuario"

### Editar Usuario
1. En la tabla de usuarios, hacer clic en el botón de editar (icono de lápiz)
2. Modificar los campos deseados
3. Opcionalmente cambiar la contraseña (dejar vacío para no cambiar)
4. Hacer clic en "Guardar Cambios"

### Cerrar Sesión de Usuario
1. En la tabla de usuarios, identificar usuarios "En línea"
2. Hacer clic en el botón de cerrar sesión (icono de salida)
3. Confirmar la acción
4. El usuario será desconectado y deberá iniciar sesión nuevamente

### Activar/Desactivar Usuario
1. En la tabla de usuarios, hacer clic en el botón de activar/desactivar
2. Confirmar la acción
3. Los usuarios inactivos no podrán iniciar sesión

## Estructura de Datos (Google Sheets)

### Hoja LOGIN
Columnas:
- A: USUARIO
- B: NOMBRE
- C: CORREO
- D: TELEFONO
- E: ROL
- F: CONTRASEÑA
- G: TIMESTAMP
- H: ID_DEVICE
- I: ACTIVO

## API Endpoints (GAS)

### update_user
Actualiza información de un usuario existente.

**Parámetros:**
- action: "update_user"
- usuario: nombre de usuario
- nombre: nombre completo
- correo: correo electrónico
- telefono: teléfono
- rol: rol del usuario
- password: nueva contraseña (opcional)
- activo: estado (1=activo, 0=inactivo)

### create_user
Crea un nuevo usuario.

**Parámetros:**
- action: "create_user"
- usuario: nombre de usuario (único)
- nombre: nombre completo
- correo: correo electrónico
- telefono: teléfono
- rol: rol del usuario
- password: contraseña

### logout_user
Cierra la sesión de un usuario.

**Parámetros:**
- action: "logout_user"
- usuario: nombre de usuario

## Seguridad

### Validaciones
- Solo usuarios OWNER pueden acceder al sistema
- Los nombres de usuario son únicos
- Las contraseñas se almacenan en texto plano (considerar encriptación en producción)
- Los usuarios inactivos no pueden iniciar sesión

### Permisos por Rol
- **OWNER**: Gestión completa de usuarios, acceso multiplataforma
- **ADMIN**: Acceso multiplataforma, sin gestión de usuarios
- **USER**: Acceso limitado a un dispositivo

## Mejoras Futuras

1. **Encriptación de contraseñas**: Implementar hash de contraseñas
2. **Historial de cambios**: Registro de modificaciones de usuarios
3. **Permisos granulares**: Control más detallado de permisos por rol
4. **Búsqueda y filtros**: Filtrar usuarios por rol, estado, etc.
5. **Exportar datos**: Exportar lista de usuarios a CSV/Excel
6. **Notificaciones**: Enviar notificaciones por correo al crear/modificar usuarios
7. **Auditoría**: Registro de acciones realizadas por OWNER

## Notas Técnicas

- El sistema usa Google Sheets API v4 para lectura de datos
- Las escrituras se realizan mediante Google Apps Script
- Los modales usan animaciones CSS para mejor UX
- El diseño es responsive y se adapta a móviles
- Compatible con temas claro y oscuro

## Soporte

Para reportar problemas o sugerencias, contactar al desarrollador:
- Andrés Mendoza
- nixandres2@gmail.com
