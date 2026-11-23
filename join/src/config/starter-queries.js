/* ════════════════════════════════════════════════════════════════════════════
   CONFIG — Starter queries
   Carga automáticamente TODOS los archivos .sql de /queries/
   ════════════════════════════════════════════════════════════════════════════ */

// Índice de consultas disponibles.
// Solo debes agregar aquí los archivos nuevos.
const QUERY_FILES = [
  '04_resumen_join_sheets.sql',
  // Puedes agregar más archivos aquí.
];

export async function loadStarterQueries() {
  const results = [];

  const files = [...QUERY_FILES];

  for (const file of files) {
    try {
      const res = await fetch(`queries/${file}`);

      if (!res.ok) {
        console.warn(`No se pudo cargar ${file}: HTTP ${res.status}`);
        continue;
      }

      const sql = await res.text();

      if (!sql.trim()) continue;

      // Generar nombre automáticamente desde el archivo
      const name = file
        .replace(/\.sql$/i, '')
        .replace(/_/g, ' ')
        .replace(/^\d+\s*/, '')
        .replace(/\b\w/g, c => c.toUpperCase());

      results.push({
        file,
        name,
        sql: sql.trim()
      });

    } catch (e) {
      console.warn(`No se pudo cargar ${file}:`, e.message);
    }
  }

  return results;
}