// ============================================================
// EDGE FUNCTION: api-gateway  (index.ts)
// Ruta: supabase/functions/api-gateway/index.ts
//
// Gateway central para operaciones que requieren service_role.
// Lecturas on-demand → on-demand-query / query-master (EFs separadas).
// Este gateway maneja SOLO:
//   • Lecturas que necesitan RPC con lógica server-side (data2, distribución)
//   • Todas las escrituras / upserts de tablas maestras e ingresos
//
// URL: https://lklojwgmzimzojsrcdlz.supabase.co/functions/v1/api-gateway
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Autenticación ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return err(401, "Falta token Bearer");

    const userToken = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return err(401, "Token inválido o expirado");

    // Cliente service_role — bypass RLS para escrituras y RPCs
    const db = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

    const { action, payload } = await req.json() as { action: string; payload: Record<string, unknown> };
    if (!action) return err(400, "Se requiere 'action'");

    let result: unknown;

    switch (action) {

      // ── LECTURAS CON RPC ────────────────────────────────────

      // Ingresos confirmados para los lotes del CSV/Excel (on-demand)
      case "get_lotes_data2": {
        const rawLotes = (payload?.lotes ?? []) as unknown[];
        const lotes = rawLotes.map(Number).filter(n => !isNaN(n) && n > 0);
        const ids = ((payload?.ids as unknown[]) ?? rawLotes)
          .map(String)
          .map(s => s.trim())
          .filter(Boolean);

        if (!lotes.length && !ids.length) { result = []; break; }
        const { data, error } = await db.rpc("get_lotes_data2", { p_lotes: lotes, p_ids: ids });
        if (error) throw error;
        result = data;
        break;
      }

      // Datos de distribución por productora
      case "get_distribution_data": {
        const { data, error } = await db.rpc("get_distribution_data", {
          p_productora: payload?.productora ?? null,
        });
        if (error) throw error;
        result = data;
        break;
      }

      // ── INGRESOS ────────────────────────────────────────────

      case "upsert_ingreso": {
        const { data, error } = await db.rpc("upsert_ingreso", { p_data: payload });
        if (error) throw error;
        result = data;
        break;
      }

      case "get_ingreso": {
        const { data, error } = await db
          .from("ingresos")
          .select("*")
          .eq("id_ingreso", payload.id_ingreso)
          .limit(10);
        if (error) throw error;
        result = data;
        break;
      }

      case "delete_ingreso": {
        const { error } = await db
          .from("ingresos")
          .delete()
          .eq("id_ingreso", payload.id_ingreso)
          .eq("productora", payload.productora);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ── DISTRIBUCIONES ──────────────────────────────────────

      case "upsert_distribucion": {
        const { data: existing } = await db
          .from("distribuciones")
          .select("id_distribucion, created_at")
          .eq("id_distribucion", payload.id_distribucion)
          .eq("productora", payload.productora)
          .limit(1);

        const hasExisting = Array.isArray(existing) && existing.length > 0;
        const record = {
          ...payload,
          created_at: hasExisting ? (existing as Record<string, unknown>[])[0].created_at : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await db
          .from("distribuciones")
          .upsert(record, { onConflict: "id_distribucion,productora" })
          .select()
          .single();
        if (error) throw error;
        result = { success: true, isUpdate: hasExisting, data };
        break;
      }

      case "update_distribucion_estado": {
        const updateData: Record<string, unknown> = {
          estado: payload.estado,
          updated_at: new Date().toISOString(),
        };
        if (payload.estado === "FINALIZADO") updateData.fin = new Date().toISOString();
        const { error } = await db
          .from("distribuciones")
          .update(updateData)
          .eq("id_distribucion", payload.id_distribucion)
          .eq("productora", payload.productora);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ── UPSERTS MAESTROS ────────────────────────────────────

      case "upsert_usuario": {
        const { data, error } = await db
          .from("usuarios").upsert(payload, { onConflict: "id_usuario" }).select();
        if (error) throw error;
        result = data;
        break;
      }

      case "upsert_proveedor": {
        const { data, error } = await db
          .from("proveedores").upsert(payload, { onConflict: "id_proveedor" }).select();
        if (error) throw error;
        result = data;
        break;
      }

      case "upsert_auditor": {
        const { data, error } = await db
          .from("auditores").upsert(payload, { onConflict: "id_auditor" }).select();
        if (error) throw error;
        result = data;
        break;
      }

      case "upsert_gestor": {
        const { data, error } = await db
          .from("gestores").upsert(payload, { onConflict: "id_gestor" }).select();
        if (error) throw error;
        result = data;
        break;
      }

      case "upsert_color": {
        const { data, error } = await db
          .from("colores").upsert(payload, { onConflict: "id_color,productora" }).select();
        if (error) throw error;
        result = data;
        break;
      }

      case "upsert_cliente": {
        const { data, error } = await db
          .from("clientes").upsert(payload, { onConflict: "id_cliente" }).select();
        if (error) throw error;
        result = data;
        break;
      }

      case "upsert_pedido": {
        const { data, error } = await db
          .from("pedidos").upsert(payload, { onConflict: "id_pedido" }).select();
        if (error) throw error;
        result = data;
        break;
      }

      case "delete_pedido": {
        const { error } = await db
          .from("pedidos").delete().eq("id_pedido", payload.id_pedido);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "upsert_precio": {
        const { data, error } = await db
          .from("precios").upsert(payload, { onConflict: "referencia" }).select();
        if (error) throw error;
        result = data;
        break;
      }

      case "upsert_barra": {
        const { data, error } = await db
          .from("barras").upsert(payload, { onConflict: "refprov,talla,id_color" }).select();
        if (error) throw error;
        result = data;
        break;
      }

      case "upsert_historica": {
        const { data, error } = await db
          .from("historicas").upsert(payload, { onConflict: "refprov,productora" }).select();
        if (error) throw error;
        result = data;
        break;
      }

      default:
        return err(404, `Acción desconocida: ${action}`);
    }

    return ok(result);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api-gateway] Error:", msg);
    return err(500, msg);
  }
});
