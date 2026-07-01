// ============================================================================
// zapi-status — LEGACY. Mantido apenas como redirect informativo.
// Z-API foi descontinuada nesta arquitetura. O provedor oficial é n8n/ManyChat.
// Use `whatsapp-status` para o status real da integração.
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const body = {
    success: true,
    legacy: true,
    inactive: true,
    provider: "n8n_manychat",
    zapi_active: false,
    status_label: "Z-API descontinuada — provedor ativo: n8n/ManyChat",
    use_instead: "whatsapp-status",
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
