// ============================================================
// EDGE FUNCTION: sync-master (index.ts)
// Ruta: supabase/functions/sync-master/index.ts
//
// Sincroniza el catálogo master desde el proyecto externo
// (zpikjjcbievfpzegupmw) hacia la tabla master LOCAL.
// Se llama desde api-gateway (action: "sync_master") o 
// directamente con service_role desde cron/admin.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Proyecto MASTER externo (solo lectura)
const MASTER_URL = "https://zpikjjcbievfpzegupmw.supabase.co";
// La anon key del master solo se usa para leer catálogo público
const MASTER_ANON_KEY = Deno.env.get("MASTER_ANON_KEY") 
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g";

const PAGE_SIZE = 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Cliente local con service_role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Parsear opciones (ops específicas o sincronización completa)
    let body: { ops?: string[] } = {};
    try { body = await req.json(); } catch (_) { /* ok, body vacío */ }
    const specificOps: string[] = body?.ops ?? [];

    let allRecords: Array<{
      id_master: string;
      referencia: string;
      descripcion: string;
      cuento: string;
      genero: string;
    }> = [];

    if (specificOps.length > 0) {
      // Modo bajo demanda: solo las OPs solicitadas
      const inFilter = specificOps.join(",");
      const url = `${MASTER_URL}/rest/v1/master?select=id_master,referencia,descripcion,cuento,genero&id_master=in.(${inFilter})`;
      const res = await fetch(url, {
        headers: {
          "apikey": MASTER_ANON_KEY,
          "Authorization": `Bearer ${MASTER_ANON_KEY}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Master project HTTP ${res.status}`);
      }
      allRecords = await res.json();
    } else {
      // Modo sincronización completa con paginación
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const offset = page * PAGE_SIZE;
        const url = `${MASTER_URL}/rest/v1/master?select=id_master,referencia,descripcion,cuento,genero&limit=${PAGE_SIZE}&offset=${offset}`;
        const res = await fetch(url, {
          headers: {
            "apikey": MASTER_ANON_KEY,
            "Authorization": `Bearer ${MASTER_ANON_KEY}`,
          },
        });
        if (!res.ok) break;
        const pageData = await res.json();
        if (!Array.isArray(pageData) || pageData.length === 0) {
          hasMore = false;
        } else {
          allRecords = allRecords.concat(pageData);
          hasMore = pageData.length === PAGE_SIZE;
          page++;
        }
      }
    }

    if (allRecords.length === 0) {
      return new Response(
        JSON.stringify({ success: true, count: 0, message: "No hay registros para sincronizar", elapsed_ms: Date.now() - startTime }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert batch usando la función PL/pgSQL
    const { data: count, error } = await supabase.rpc("sync_master_batch", {
      p_records: allRecords,
    });

    if (error) throw error;

    const elapsed = Date.now() - startTime;
    console.log(`[sync-master] ${count} registros sincronizados en ${elapsed}ms`);

    return new Response(
      JSON.stringify({ success: true, count: count ?? allRecords.length, elapsed_ms: elapsed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-master] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

