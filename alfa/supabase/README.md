# Proyecto Nuevo (lklojwgmzimzojsrcdlz)

Esta carpeta contiene el código limpio de la aplicación configurado para el proyecto nuevo de Supabase (`lklojwgmzimzojsrcdlz`).

---

## Contenido de `supabase/`

- **`functions/`**:
  - `on-demand-query`: Consultas bajo demanda por IDs.
  - `api-gateway`: Ruteo transaccional de ingresos, distribuciones y RPCs.
  - `query-master`: Conexión al catálogo maestro externo.
  - `sync-master`: Sincronización batch del catálogo maestro.

- **`sql/`**:
  - `funciones_rpc.sql`: Contiene **únicamente** las funciones PL/pgSQL y RPC necesarias en la base de datos (sin sentencias `CREATE TABLE`).
