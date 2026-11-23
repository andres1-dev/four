/* ════════════════════════════════════════════════════════════════════════════
   DOMAIN — Value formatters & sanitizers
   ════════════════════════════════════════════════════════════════════════════ */

/** Escape HTML to prevent XSS in rendered output */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]
  );
}

/** Format a raw cell value from DuckDB-Arrow into a display string */
export function formatVal(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Uint8Array) return '[BINARY]';
  if (v instanceof Date) return v.toISOString();
  // Todo lo demás: String() llama toString() del objeto (Decimal, Number, String, etc.)
  return stripQuotes(String(v));
}

/** Quita comillas envolventes recurrentes (DuckDB-Arrow DECIMAL las añade) */
function stripQuotes(s) {
  while (s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') {
    s = s.slice(1, -1);
  }
  return s;
}

/** Escape a CSV cell value (RFC 4180) */
export function csvEscape(v) {
  return '"' + String(v ?? '').replace(/"/g, '""') + '"';
}
