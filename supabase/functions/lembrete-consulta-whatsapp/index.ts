import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { gerarMensagemDoTemplate, formatarData, formatarHora } from "../_shared/templateRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[lembrete-consulta] Iniciando processamento de lembretes...");

  try {
    // Validate cron secret for authentication
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("authorization");
    
    if (!cronSecret) {
      console.error("[lembrete-consulta] CRON_SECRET não configurado");
      return new Response(
        JSON.stringify({ error: "Configuração de segurança ausente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check Authorization header for Bearer token
    const expectedAuth = `Bearer ${cronSecret}`;
    if (authHeader !== expectedAuth) {
      console.error("[lembrete-consulta] Tentativa de acesso não autorizado");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_BASE_URL");
    const evolutionApiToken = Deno.env.get("EVOLUTION_API_TOKEN");
    const evolutionInstance = Deno.env.get("EVOLUTION_API_INSTANCE") || "Agente ia";

    if (!evolutionApiUrl || !evolutionApiToken) {
      console.error("[lembrete-consulta] Configuração da Evolution API ausente");
      return new Response(
        JSON.stringify({ error: "Configuração da Evolution API ausente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar consultas de amanhã
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    console.log(`[lembrete-consulta] Buscando consultas para: ${tomorrowStr}`);

    const { data: agendamentos, error: fetchError } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("data_agendamento", tomorrowStr)
      .eq("aceita_contato_whatsapp_email", true);

    if (fetchError) {
      console.error("[lembrete-consulta] Erro ao buscar agendamentos:", fetchError);
      throw fetchError;
    }

    console.log(`[lembrete-consulta] Encontradas ${agendamentos?.length || 0} consultas para amanhã`);

    if (!agendamentos || agendamentos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhuma consulta para amanhã",
          count: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let enviados = 0;
    let erros = 0;

    for (const agendamento of agendamentos) {
      try {
        // Formatar telefone
        let telefone = agendamento.telefone_whatsapp.replace(/\D/g, "");
        if (!telefone.startsWith("55")) {
          telefone = "55" + telefone;
        }

        // Gerar mensagem do template do banco
        const mensagem = await gerarMensagemDoTemplate('lembrete_24h', {
          nome: agendamento.nome_completo,
          data: formatarData(tomorrowStr),
          hora: formatarHora(agendamento.hora_agendamento),
          local: agendamento.local_atendimento,
          tipo_atendimento: agendamento.tipo_atendimento,
        });

        console.log(`[lembrete-consulta] Enviando lembrete para: ${telefone}`);

        // Enviar via Evolution API
        const evolutionResponse = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": evolutionApiToken,
          },
          body: JSON.stringify({
            number: telefone,
            text: mensagem,
          }),
        });

        if (!evolutionResponse.ok) {
          const errorText = await evolutionResponse.text();
          console.error(`[lembrete-consulta] Erro Evolution para ${telefone}:`, errorText);
          erros++;
          continue;
        }

        const evolutionData = await evolutionResponse.json();
        console.log(`[lembrete-consulta] Lembrete enviado para ${telefone}:`, evolutionData);

        // Salvar mensagem no histórico
        await supabase.from("mensagens_whatsapp").insert({
          agendamento_id: agendamento.id,
          telefone: telefone,
          direcao: "OUT",
          conteudo: mensagem,
          status_envio: "enviado",
          tipo_mensagem: "lembrete_24h",
          mensagem_externa_id: evolutionData?.key?.id || null,
        });

        enviados++;
      } catch (err) {
        console.error(`[lembrete-consulta] Erro ao processar agendamento ${agendamento.id}:`, err);
        erros++;
      }
    }

    console.log(`[lembrete-consulta] Finalizado: ${enviados} enviados, ${erros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Lembretes processados: ${enviados} enviados, ${erros} erros`,
        enviados,
        erros,
        total: agendamentos.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[lembrete-consulta] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});