# 📦 Sistema de Administración de Inventario

Sistema independiente para carga masiva de productos desde archivos Excel.

## 📁 Estructura

```
admin/
├── index.html                  # Página principal del administrador
├── css/
│   └── styles.css              # Estilos del administrador
├── js/
│   ├── app.js                  # Inicialización de la aplicación
│   ├── config.js               # Configuración (Supabase, columnas)
│   ├── file-handler.js         # Lectura y procesamiento de Excel
│   ├── data-validator.js       # Validación contra base de datos
│   ├── database-uploader.js    # Subida a Supabase
│   ├── ui-controller.js        # Control de interfaz y modal
│   └── csv-generator.js        # Generación de CSV
└── README.md                   # Esta documentación
```

## 🚀 Características

- ✅ Carga masiva desde Excel (.xls, .xlsx)
- ✅ Validación automática contra base de datos
- ✅ Detección de duplicados en tiempo real
- ✅ Subida optimizada en lotes
- ✅ Feedback visual en cada paso
- ✅ Modal único para todo el proceso
- ✅ Estadísticas detalladas
- ✅ Manejo de archivos grandes (33,000+ registros)

## 📋 Uso

1. Abrir `admin/index.html` en el navegador
2. Seleccionar archivo Excel
3. El sistema automáticamente:
   - Lee el archivo
   - Carga la base de datos
   - Valida registros
   - Detecta duplicados
   - Sube solo los nuevos
   - Muestra resultado

## 📊 Formato del Excel

### Columnas Requeridas:

| Columna | Campo | Tipo | Descripción |
|---------|-------|------|-------------|
| A | referencia | Texto | Código de referencia del producto |
| B | talla | Texto | Talla del producto |
| C | id_color | Texto | Identificador del color |
| L | barcode | Texto | Código de barras (único) |

### Ejemplo:

```
A          B    C     ...  L
REF001     M    01    ...  7501234567890
REF002     L    02    ...  7501234567891
REF003     S    03    ...  7501234567892
```

## ⚙️ Configuración

### Archivo: `js/config.js`

```javascript
const AdminConfig = {
  SUPABASE_URL: "tu-url-supabase",
  SUPABASE_KEY: "tu-key-supabase",
  
  COLUMNS: {
    REFERENCIA: 0,  // Columna A
    TALLA: 1,       // Columna B
    ID_COLOR: 2,    // Columna C
    BARCODE: 11     // Columna L
  },
  
  BATCH_SIZE: 100,
  DELAY_BETWEEN_BATCHES: 100
};
```

## 🔧 Requisitos en Supabase

### Tabla BARRAS:

```sql
CREATE TABLE "BARRAS" (
  id BIGSERIAL PRIMARY KEY,
  referencia TEXT NOT NULL,
  talla TEXT NOT NULL,
  id_color TEXT NOT NULL,
  barcode TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para rendimiento
CREATE UNIQUE INDEX idx_barras_barcode ON "BARRAS"(barcode);

-- Deshabilitar RLS (desarrollo)
ALTER TABLE "BARRAS" DISABLE ROW LEVEL SECURITY;
```

## 📈 Proceso de Carga

### 1. Lectura del Excel
- Detecta automáticamente el archivo
- Extrae columnas A, B, C, L
- Ignora primera fila (encabezado)

### 2. Validación
- Carga todos los barcodes de la BD
- Compara cada registro del Excel
- Marca duplicados y errores

### 3. Subida
- Solo sube registros únicos
- Inserta en lotes de 100
- Muestra progreso en tiempo real

### 4. Resultado
- Total procesados
- Subidos exitosamente
- Repetidos (omitidos)
- Errores (si hay)

## 🎯 Flujo de Usuario

```
1. Seleccionar archivo
   ↓
2. Modal aparece: "Leyendo archivo..."
   ↓
3. Modal actualiza: "Cargando BD..."
   ↓
4. Modal actualiza: "Validando..."
   ↓
5. Modal actualiza: "Subiendo... 50%"
   ↓
6. Modal muestra resultado final
   ↓
7. Clic en "Aceptar" → Listo para nuevo archivo
```

## 🔍 Validaciones

### Registros Válidos:
- ✅ Todos los campos completos
- ✅ Barcode NO existe en BD
- ✅ Formato correcto

### Registros Inválidos:
- ❌ Campos vacíos
- ❌ Barcode duplicado
- ❌ Datos mal formateados

## 💡 Optimizaciones

### Para Archivos Grandes:

1. **Paginación**: Carga BD en páginas de 1,000
2. **Set para búsqueda**: O(1) en validación
3. **Lotes**: Inserta 100 registros por vez
4. **Feedback**: Actualiza cada 5,000 registros

### Tiempos Estimados (33,000 registros):

- Cargar BD: 30-60 segundos
- Validar Excel: 5-10 segundos
- Subir nuevos: 2-3 minutos

## 🚨 Solución de Problemas

### "Row-level security policy"
```sql
ALTER TABLE "BARRAS" DISABLE ROW LEVEL SECURITY;
```

### "Relation does not exist"
```sql
-- Usar comillas por mayúsculas
ALTER TABLE "BARRAS" DISABLE ROW LEVEL SECURITY;
```

### "Too many requests"
- Aumentar `DELAY_BETWEEN_BATCHES` a 200ms
- Dividir archivo en partes más pequeñas

## 📦 Dependencias

- [SheetJS (xlsx)](https://sheetjs.com/) - Lectura de Excel
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [Font Awesome 6.5.1](https://fontawesome.com/)

## 🔗 Integración

Este sistema es completamente independiente del lector de código de barras.

- **Lector**: `index.html` (raíz del proyecto)
- **Admin**: `admin/index.html` (esta carpeta)

Ambos comparten la misma base de datos pero funcionan de forma independiente.

## 📝 Notas

- Primera fila del Excel se considera encabezado
- Solo el barcode debe ser único
- Los duplicados NO son errores, se omiten
- Puedes subir el mismo archivo múltiples veces
- Solo se insertarán los registros nuevos

## 🎨 Personalización

### Cambiar Colores:

En `css/styles.css`, busca:
- `#2e7d32` - Color principal (verde)
- `#f59e0b` - Color duplicados (amarillo)
- `#c62828` - Color errores (rojo)

### Cambiar Columnas:

En `js/config.js`, modifica `COLUMNS`:
```javascript
COLUMNS: {
  REFERENCIA: 0,  // Cambiar índice
  TALLA: 1,
  ID_COLOR: 2,
  BARCODE: 11
}
```

## 📄 Licencia

Proyecto privado - Todos los derechos reservados
