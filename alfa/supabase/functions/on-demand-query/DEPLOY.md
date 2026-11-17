# Despliegue: on-demand-query

## Qué es
Edge Function nueva, **completamente independiente** de `api-gateway`.
No toca, no reemplaza, no modifica nada de lo que ya funciona.

## Pasos para desplegar

### 1. Copiar la EF al proyecto Supabase local
```bash
# Desde la raíz del proyecto Supabase (donde está supabase/)
cp -r <este-directorio>/on-demand-query  supabase/functions/on-demand-query
```

### 2. Correr las RPCs SQL
En el SQL Editor de Supabase (proyecto lklojwgmzimzojsrcdlz), ejecutar en orden:
```
migration/sql/on-demand/001_rpc_get_colores_by_ids.sql
migration/sql/on-demand/002_rpc_get_precios_by_refs.sql
migration/sql/on-demand/003_rpc_get_historicas_by_refprovs.sql
migration/sql/on-demand/004_rpc_get_barras_by_refprovs.sql
migration/sql/on-demand/005_rpc_get_global_maps_by_ids.sql
```

### 3. Desplegar la EF
```bash
supabase functions deploy on-demand-query --project-ref lklojwgmzimzojsrcdlz
```

### 4. Verificar despliegue
```bash
supabase functions list --project-ref lklojwgmzimzojsrcdlz
```
Debe aparecer `on-demand-query` con status `ACTIVE`.

## Variables de entorno necesarias
La EF usa las variables automáticas de Supabase:
- `SUPABASE_URL` ← inyectada automáticamente
- `SUPABASE_ANON_KEY` ← inyectada automáticamente  
- `SUPABASE_SERVICE_ROLE_KEY` ← inyectada automáticamente

No necesitas configurar nada adicional.

## Probar desde el navegador

1. Abre la app e inicia sesión.
2. Abre DevTools → Console.
3. La EF se llama desde `on-demand-service.js` y se prueba con `on-demand-test.js`.
4. Si los archivos JS no están cargados, pégalos en la consola o añádelos al HTML temporalmente.

```javascript
// Test rápido desde consola (sin cargar archivos):
const TOKEN = sessionStorage.getItem('supabase_token');
const EF = 'https://lklojwgmzimzojsrcdlz.supabase.co/functions/v1/on-demand-query';

fetch(EF, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
    'apikey': 'sb_publishable_7E9EJj5znx0FttkmWC0oVQ_K4co45Ox'
  },
  body: JSON.stringify({
    action: 'get_colores_by_ids',
    payload: { ids: ['001','002','003'], productora: '900616124' }
  })
}).then(r => r.json()).then(console.log);
```

## Qué NO hace esta EF
- NO descarga catálogos completos
- NO toca `api-gateway`
- NO modifica datos
- NO reemplaza ninguna función existente

## Acciones disponibles

| Acción | Payload | Devuelve |
|---|---|---|
| `get_colores_by_ids` | `{ ids: string[], productora?: string }` | `[{id_color, nombre_color, productora}]` |
| `get_precios_by_refs` | `{ refs: string[] }` | `[{referencia, pvp}]` |
| `get_historicas_by_refprovs` | `{ refprovs: string[], productora?: string }` | `[{refprov, referencia, productora}]` |
| `get_barras_by_refprovs` | `{ refprovs: string[] }` | `[{refprov, talla, id_color, barra}]` |
| `get_global_maps_by_ids` | `{ taller_ids, linea_ids, auditor_ids, usuario_ids }` | `{ talleres, lineas, auditores, usuarios }` |
