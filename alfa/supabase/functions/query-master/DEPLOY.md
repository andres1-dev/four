# Despliegue: query-master

## Qué hace
Consulta DIRECTA al proyecto secundario `zpikjjcbievfpzegupmw` (catálogo master de OPs).
Sin tabla local `master`. Sin sync. Solo lectura on-demand.

## Despliegue
```bash
supabase functions deploy query-master --project-ref lklojwgmzimzojsrcdlz
```

## Variable de entorno requerida
La anon key del proyecto master va hardcodeada como fallback, pero si quieres
configurarla como secreto:
```bash
supabase secrets set MASTER_ANON_KEY="eyJhbGci..." --project-ref lklojwgmzimzojsrcdlz
```

## Acciones

| Acción | Usado por | Payload | Devuelve |
|---|---|---|---|
| `get_lineas_by_ops` | Procesador CSV | `{ ops: string[] }` | `[{ op, linea }]` |
| `get_ops_detail` | Módulo Pedidos | `{ ops: string[] }` | `[{ op, referencia, prenda, linea, genero }]` |

## Test rápido desde consola
```javascript
const TOKEN = sessionStorage.getItem('supabase_token');
fetch('https://lklojwgmzimzojsrcdlz.supabase.co/functions/v1/query-master', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
    'apikey': 'sb_publishable_7E9EJj5znx0FttkmWC0oVQ_K4co45Ox'
  },
  body: JSON.stringify({
    action: 'get_ops_detail',
    payload: { ops: ['6264', '6265'] }
  })
}).then(r => r.json()).then(console.log);
```

## Qué se puede eliminar ahora
- Tabla `master` local en Supabase principal (ya no se usa)
- EF `sync-master` (ya no se invoca)
- Cases `get_master_ops` y `sync_master` en `api-gateway` (ya eliminados del código local)
