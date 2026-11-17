// ============================================================
// EDGE FUNCTION: on-demand-query  (index.ts)
// Ruta de despliegue: supabase/functions/on-demand-query/index.ts
//
// PROPÓSITO: Carga estricta on-demand para CSV y Excel.
//   Solo devuelve los registros cuyos IDs se reciben en el payload.
//   NUNCA descarga catálogos completos.
//
// Esta EF es INDEPENDIENTE de api-gateway.
//   - No comparte switch/cases con api-gateway.
//   - Tiene su propio endpoint y autenticación.
//   - Puede desplegarse, testearse y revertirse sin afectar nada.
//
// URL: https://lklojwgmzimzojsrcdlz.supabase.co/functions/v1/on-demand-query
//
// ACCIONES disponibles:
//   get_colores_by_ids        → colores WHERE id_color IN (...)
//   get_precios_by_refs       → precios WHERE referencia IN (...)
//   get_historicas_by_refprovs → historicas WHERE refprov IN (...) [+ productora]
//   get_barras_by_refprovs    → barras WHERE refprov IN (...)
//   get_global_maps_by_ids    → global_talleres/lineas/auditores/usuarios WHERE id IN (...)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SVC_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ data, error: null }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ data: null, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Servidor ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Autenticación ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return err(401, "Falta token Bearer");

    const userToken = authHeader.replace("Bearer ", "");

    // Verificar token del usuario (cliente anon)
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return err(401, "Token inválido o expirado");

    // Cliente service_role para bypass de RLS en lecturas
    const db = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

    // ── Body ──────────────────────────────────────────────────
    const { action, payload } = await req.json() as { action: string; payload: Record<string, unknown> };
    if (!action) return err(400, "Se requiere 'action' en el body");

    // ── Router ────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────────
    // ACCIÓN 1: get_colores_by_ids
    //   payload: { ids: string[], productora?: string }
    //   Devuelve solo los colores cuyos id_color están en `ids`.
    //   Si se envía productora, filtra además por ese NIT.
    // ──────────────────────────────────────────────────────────
    if (action === "get_colores_by_ids") {
      const ids = (payload?.ids as string[] | undefined) ?? [];
      if (!ids.length) return ok([]);

      const idsClean = [...new Set(ids.map(String).map(s => s.trim()).filter(Boolean))];

      let q = db
        .from("colores")
        .select("id_color, nombre_color, productora")
        .in("id_color", idsClean);

      if (payload?.productora) {
        q = q.eq("productora", String(payload.productora));
      }

      const { data, error } = await q;
      if (error) throw error;

      console.log(`[on-demand-query] get_colores_by_ids: pedidos=${idsClean.length} devueltos=${data?.length ?? 0} productora=${payload?.productora ?? "sin filtro"}`);
      return ok(data);
    }

    // ──────────────────────────────────────────────────────────
    // ACCIÓN 2: get_precios_by_refs
    //   payload: { refs: string[] }
    //   Devuelve solo los precios cuyas referencias están en `refs`.
    // ──────────────────────────────────────────────────────────
    if (action === "get_precios_by_refs") {
      const refs = (payload?.refs as string[] | undefined) ?? [];
      if (!refs.length) return ok([]);

      const refsClean = [...new Set(refs.map(String).map(s => s.trim()).filter(Boolean))];

      const { data, error } = await db
        .from("precios")
        .select("referencia, pvp")
        .in("referencia", refsClean);

      if (error) throw error;

      console.log(`[on-demand-query] get_precios_by_refs: pedidos=${refsClean.length} devueltos=${data?.length ?? 0}`);
      return ok(data);
    }

    // ──────────────────────────────────────────────────────────
    // ACCIÓN 3: get_historicas_by_refprovs
    //   payload: { refprovs: string[], productora?: string }
    //   Devuelve historicas WHERE refprov IN (refprovs).
    //   Si se envía productora, filtra además por ese NIT.
    // ──────────────────────────────────────────────────────────
    if (action === "get_historicas_by_refprovs") {
      const refprovs = (payload?.refprovs as string[] | undefined) ?? [];
      if (!refprovs.length) return ok([]);

      const rpsClean = [...new Set(refprovs.map(String).map(s => s.trim()).filter(Boolean))];

      let q = db
        .from("historicas")
        .select("refprov, referencia, productora")
        .in("refprov", rpsClean);

      if (payload?.productora) {
        q = q.eq("productora", String(payload.productora));
      }

      const { data, error } = await q;
      if (error) throw error;

      console.log(`[on-demand-query] get_historicas_by_refprovs: pedidos=${rpsClean.length} devueltos=${data?.length ?? 0} productora=${payload?.productora ?? "sin filtro"}`);
      return ok(data);
    }

    // ──────────────────────────────────────────────────────────
    // ACCIÓN 4: get_barras_by_refprovs
    //   payload: { refprovs: string[] }
    //   Devuelve barras WHERE refprov IN (refprovs).
    // ──────────────────────────────────────────────────────────
    if (action === "get_barras_by_refprovs") {
      const refprovs = (payload?.refprovs as string[] | undefined) ?? [];
      if (!refprovs.length) return ok([]);

      const rpsClean = [...new Set(refprovs.map(String).map(s => s.trim()).filter(Boolean))];

      const { data, error } = await db
        .from("barras")
        .select("refprov, talla, id_color, barra")
        .in("refprov", rpsClean);

      if (error) throw error;

      console.log(`[on-demand-query] get_barras_by_refprovs: pedidos=${rpsClean.length} devueltos=${data?.length ?? 0}`);
      return ok(data);
    }

    // ──────────────────────────────────────────────────────────
    // ACCIÓN 5: get_global_maps_by_ids
    //   payload: {
    //     taller_ids?:  string[],
    //     linea_ids?:   string[],
    //     auditor_ids?: string[],
    //     usuario_ids?: string[]
    //   }
    //   Devuelve solo los registros de las tablas globales
    //   cuyos IDs aparecen en el Excel subido.
    //   Si un array viene vacío, esa tabla devuelve [].
    // ──────────────────────────────────────────────────────────
    if (action === "get_global_maps_by_ids") {
      const tallerIds  = [...new Set(((payload?.taller_ids  as string[] | undefined) ?? []).map(String).map(s => s.trim()).filter(Boolean))];
      const lineaIds   = [...new Set(((payload?.linea_ids   as string[] | undefined) ?? []).map(String).map(s => s.trim()).filter(Boolean))];
      const auditorIds = [...new Set(((payload?.auditor_ids as string[] | undefined) ?? []).map(String).map(s => s.trim()).filter(Boolean))];
      const usuarioIds = [...new Set(((payload?.usuario_ids as string[] | undefined) ?? []).map(String).map(s => s.trim()).filter(Boolean))];

      const [talleres, lineas, auditores, usuarios] = await Promise.all([
        tallerIds.length
          ? db.from("global_talleres").select("id_taller, taller").in("id_taller", tallerIds)
          : Promise.resolve({ data: [], error: null }),
        lineaIds.length
          ? db.from("global_lineas").select("id_linea, linea").in("id_linea", lineaIds)
          : Promise.resolve({ data: [], error: null }),
        auditorIds.length
          ? db.from("global_auditores").select("id_auditor, auditor").in("id_auditor", auditorIds)
          : Promise.resolve({ data: [], error: null }),
        usuarioIds.length
          ? db.from("global_usuarios").select("id_usuario, usuario").in("id_usuario", usuarioIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (talleres.error)  throw talleres.error;
      if (lineas.error)    throw lineas.error;
      if (auditores.error) throw auditores.error;
      if (usuarios.error)  throw usuarios.error;

      console.log(
        `[on-demand-query] get_global_maps_by_ids: ` +
        `talleres=${talleres.data?.length ?? 0} lineas=${lineas.data?.length ?? 0} ` +
        `auditores=${auditores.data?.length ?? 0} usuarios=${usuarios.data?.length ?? 0}`
      );

      return ok({
        talleres:  talleres.data  ?? [],
        lineas:    lineas.data    ?? [],
        auditores: auditores.data ?? [],
        usuarios:  usuarios.data  ?? [],
      });
    }

    return err(404, `Acción desconocida: ${action}`);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[on-demand-query] Error:", msg);
    return err(500, msg);
  }
});
