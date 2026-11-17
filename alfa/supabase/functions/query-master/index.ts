// ============================================================
// EDGE FUNCTION: query-master  (index.ts)
// Ruta: supabase/functions/query-master/index.ts
//
// Consulta DIRECTA al proyecto secundario zpikjjcbievfpzegupmw.
// No usa tabla master local. No hace sync. Solo lee.
//
// ACCIONES:
//
//   get_lineas_by_ops   → solo id_master + cuento (LINEA)
//     Usado por el procesador CSV para obtener la línea de cada OP.
//     Retorna: [{ op: string, linea: string }]
//
//   get_ops_detail      → id_master + referencia + descripcion + cuento + genero
//     Usado por el módulo de Pedidos para autocompletar el formulario.
//     Retorna: [{ op, referencia, prenda, linea, genero }]
//
// URL: https://lklojwgmzimzojsrcdlz.supabase.co/functions/v1/query-master
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Proyecto LOCAL (para verificar autenticación del usuario) ─
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// ── Proyecto MASTER EXTERNO (solo lectura, catálogo de OPs) ──
const MASTER_URL = "https://zpikjjcbievfpzegupmw.supabase.co";
const MASTER_KEY = Deno.env.get("MASTER_ANON_KEY")
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(data: unknown) {
  return new Response(JSON.stringify({ data, error: null }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(status: number, message: string) {
  return new Response(JSON.stringify({ data: null, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Consulta directa al proyecto master externo ───────────────
async function fetchMaster(ops: string[], fields: string): Promise<Record<string, string>[]> {
  if (!ops.length) return [];

  const opsClean = [...new Set(ops.map(String).map(s => s.trim()).filter(Boolean))];
  const inFilter = opsClean.join(",");
  const url = `${MASTER_URL}/rest/v1/master?select=${fields}&id_master=in.(${inFilter})`;

  const res = await fetch(url, {
    headers: {
      "apikey":        MASTER_KEY,
      "Authorization": `Bearer ${MASTER_KEY}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`master project HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  console.log(`[query-master] fetchMaster: pedidos=${opsClean.length} devueltos=${Array.isArray(data) ? data.length : 0}`);
  return Array.isArray(data) ? data : [];
}

// ── Servidor ──────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth: verificar token del usuario ─────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return err(401, "Falta token Bearer");

    const userToken = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return err(401, "Token inválido o expirado");

    // ── Body ──────────────────────────────────────────────────
    const { action, payload } = await req.json() as {
      action: string;
      payload: { ops?: string[] };
    };
    if (!action) return err(400, "Se requiere 'action'");

    const ops: string[] = payload?.ops ?? [];
    if (!ops.length) return ok([]);

    // ── ACCIÓN 1: get_lineas_by_ops ───────────────────────────
    // Para el procesador CSV — solo necesita la línea (cuento).
    // Retorna: [{ op: string, linea: string }]
    if (action === "get_lineas_by_ops") {
      const rows = await fetchMaster(ops, "id_master,cuento");
      const result = rows.map(r => ({
        op:    String(r.id_master ?? "").trim(),
        linea: String(r.cuento   ?? "").trim(),
      })).filter(r => r.op);
      return ok(result);
    }

    // ── ACCIÓN 2: get_ops_detail ──────────────────────────────
    // Para el módulo de Pedidos — necesita todos los campos.
    // Retorna: [{ op, referencia, prenda, linea, genero }]
    if (action === "get_ops_detail") {
      const rows = await fetchMaster(ops, "id_master,referencia,descripcion,cuento,genero");
      const result = rows.map(r => ({
        op:         String(r.id_master   ?? "").trim(),
        referencia: String(r.referencia  ?? "").trim(),
        prenda:     String(r.descripcion ?? "").trim(),
        linea:      String(r.cuento      ?? "").trim(),
        genero:     String(r.genero      ?? "").trim(),
      })).filter(r => r.op);
      return ok(result);
    }

    return err(404, `Acción desconocida: ${action}`);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[query-master] Error:", msg);
    return err(500, msg);
  }
});
