import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

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
    const isCron = req.headers.get("x-cron-secret") === CRON_SECRET && !!CRON_SECRET;
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
    const { data: envio, error: envErr } = await supabase.functions.invoke("enviar-whatsapp", {
      body: { telefone, mensagem, tipo: "sistema" },
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
