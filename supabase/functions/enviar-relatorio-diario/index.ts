import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireCronSecret } from "../_shared/authGuards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  telefone?: string;
  data_inicio?: string;
  data_fim?: string;
}

function fmt(n: number) { return n.toLocaleString("pt-BR"); }

function montarMensagem(r: any): string {
  const w = r.whatsapp; const c = r.crm;
  const periodo = r.periodo.inicio === r.periodo.fim
    ? r.periodo.inicio
    : `${r.periodo.inicio} a ${r.periodo.fim}`;
  const taxaConv = c.leads_novos > 0
    ? Math.round((c.conversoes / c.leads_novos) * 100)
    : 0;

  return [
    `📊 *Relatório · ${periodo}*`,
    ``,
    `💬 *WhatsApp*`,
    `• Total: ${fmt(w.total)} (recebidas ${fmt(w.mensagens_in)} / enviadas ${fmt(w.mensagens_out)})`,
    ``,
    `👥 *CRM*`,
    `• Novos leads: ${fmt(c.leads_novos)}`,
    `• Conversões: ${fmt(c.conversoes)} (${taxaConv}%)`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    /*
      QUEM CHAMA E O CRON DAS 8H, e ate 30/08/2026 isso era decidido comparando
      o header com Deno.env.get("CRON_SECRET"). Essa variavel nunca foi
      configurada neste projeto, entao isCron era sempre falso e o relatorio
      diario nunca saiu como relatorio diario: usava a data de HOJE em vez da de
      ontem e nem procurava o telefone de destino.

      E nao dava erro em lugar nenhum. Diferente das outras funcoes, esta nao
      responde 401 quando nao reconhece o chamador, ela so muda de
      comportamento. Falha silenciosa e o pior tipo.

      requireCronSecret le o segredo de integracao_secrets, a mesma fonte que
      _cron_headers() usa do lado do banco, com Deno.env apenas como ultimo
      recurso. Aceita x-cron-secret ou Authorization Bearer.
    */
    const guardCron = await requireCronSecret(req);
    const isCron = guardCron.ok;

    // O log existe porque esta funcao nao tem 401 onde pendurar o motivo. Sem
    // ele, a proxima configuracao errada volta a produzir uma execucao de cara
    // bem sucedida com a data errada, que foi exatamente o que aconteceu aqui.
    if (!isCron) {
      console.log('[enviar-relatorio-diario] chamada nao reconhecida como cron:', guardCron.reason);
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let body: Body = {};
    try { body = await req.json(); } catch { /* sem body */ }

    const hoje = new Date().toISOString().slice(0, 10);
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const data_inicio = body.data_inicio || (isCron ? ontem : hoje);
    const data_fim = body.data_fim || (isCron ? ontem : hoje);

    // Telefone destino
    let telefone = body.telefone;
    if (!telefone && isCron) {
      const { data: cfg } = await supabase
        .from("templates_whatsapp")
        .select("conteudo")
        .eq("nome", "RELATORIO_DIARIO_DESTINO")
        .maybeSingle();
      telefone = cfg?.conteudo?.trim();
    }
    if (!telefone) {
      return new Response(JSON.stringify({ error: "telefone obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gera relatório (RPC bypass RLS via service role; assumimos chamador admin/cron)
    const { data: rel, error } = await supabase.rpc("relatorio_diario", {
      p_data_inicio: data_inicio, p_data_fim: data_fim,
    });
    if (error) throw error;

    const mensagem = montarMensagem(rel);

    // Envia via edge function existente
    const { getN8nSharedSecret } = await import("../_shared/n8nSecret.ts");
    const secret = await getN8nSharedSecret();
    const { data: envio, error: envErr } = await supabase.functions.invoke("enviar-whatsapp", {
      body: { telefone, mensagem, tipo: "sistema" },
      headers: secret ? { "x-n8n-secret": secret } : undefined,
    });
    if (envErr) throw envErr;

    return new Response(JSON.stringify({ sucesso: true, telefone, periodo: { data_inicio, data_fim }, envio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[enviar-relatorio-diario]", err);
    return new Response(JSON.stringify({ error: err?.message ?? "erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
