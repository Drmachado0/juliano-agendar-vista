import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event } = await req.json().catch(() => ({}));
    if (!event || typeof event !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "missing event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.rpc("crm_emit_event", {
      p_event: event,
      p_body: { test: true, ts: new Date().toISOString() },
    });

    return new Response(
      JSON.stringify({ ok: !error, request_id: data, error: error?.message ?? null }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error ? 500 : 200,
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
