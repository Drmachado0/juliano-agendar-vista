// TEMPORÁRIO: chama hermes-whatsapp-webhook usando o segredo do env.
// Útil para QA. Não expõe o valor do secret.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const secret = Deno.env.get("HERMES_WEBHOOK_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  if (!secret || !url) {
    return new Response(JSON.stringify({ error: "missing env" }), { status: 500, headers: corsHeaders });
  }
  const body = await req.text();
  const r = await fetch(`${url}/functions/v1/hermes-whatsapp-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hermes-secret": secret },
    body,
  });
  const txt = await r.text();
  return new Response(
    JSON.stringify({ status: r.status, body: txt }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
