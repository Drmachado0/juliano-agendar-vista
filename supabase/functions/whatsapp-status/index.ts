// ============================================================================
// whatsapp-status — status oficial do provedor de WhatsApp.
// Arquitetura atual: n8n → ManyChat. Z-API não é mais usada.
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

  const webhookConfigured = !!(Deno.env.get("N8N_WHATSAPP_WEBHOOK_URL") || "").trim();

  const body = {
    success: true,
    provider: "n8n_manychat",
    configured: webhookConfigured,
    webhook_configured: webhookConfigured,
    send_path: "webhook_n8n",
    status_label: webhookConfigured
      ? "WhatsApp via n8n/ManyChat configurado"
      : "WhatsApp via n8n/ManyChat: webhook não configurado (defina N8N_WHATSAPP_WEBHOOK_URL)",
    zapi_active: false,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
