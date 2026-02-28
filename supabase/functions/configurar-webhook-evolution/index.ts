import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const baseUrl = Deno.env.get("EVOLUTION_API_BASE_URL")?.replace(/\/$/, "");
    const token = Deno.env.get("EVOLUTION_API_TOKEN");
    const instance = Deno.env.get("EVOLUTION_API_INSTANCE") || "Agente ia";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!baseUrl || !token || !supabaseUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Variáveis de ambiente não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const action = body.action || "status";

    if (action === "status") {
      // Check current webhook configuration
      const response = await fetch(`${baseUrl}/webhook/find/${instance}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", apikey: token },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Webhook] Erro ao buscar webhook: ${response.status}`, errorText);
        return new Response(
          JSON.stringify({ success: false, error: `HTTP ${response.status}`, configured: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      console.log("[Webhook] Status atual:", JSON.stringify(data));

      const webhookUrl = data?.url || data?.webhook?.url || null;
      const expectedUrl = `${supabaseUrl}/functions/v1/receber-whatsapp`;
      const isConfigured = webhookUrl && webhookUrl.includes("receber-whatsapp");

      return new Response(
        JSON.stringify({
          success: true,
          configured: isConfigured,
          currentUrl: webhookUrl,
          expectedUrl,
          rawData: data,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "set") {
      const webhookUrl = `${supabaseUrl}/functions/v1/receber-whatsapp`;
      const webhookSecret = Deno.env.get("EVOLUTION_WEBHOOK_SECRET") || "";

      console.log(`[Webhook] Configurando webhook: ${webhookUrl}`);

      const response = await fetch(`${baseUrl}/webhook/set/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: token },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: [
            "MESSAGES_UPSERT",
          ],
          ...(webhookSecret ? { secret: webhookSecret } : {}),
        }),
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      if (!response.ok) {
        console.error(`[Webhook] Erro ao configurar: ${response.status}`, responseData);
        return new Response(
          JSON.stringify({ success: false, error: `HTTP ${response.status}`, details: responseData }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[Webhook] Configurado com sucesso:", responseData);

      return new Response(
        JSON.stringify({ success: true, webhook_url: webhookUrl, response: responseData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação inválida. Use 'status' ou 'set'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Webhook] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
