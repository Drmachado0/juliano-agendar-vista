import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireCronSecret } from "../_shared/authGuards.ts";
import { diaDaSemana } from "../_shared/agendaCore.ts";

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

/**
 * "2026-08-29" vira "sexta, 29/08".
 *
 * Reaproveita diaDaSemana de _shared/agendaCore, que ja resolve em UTC para nao sofrer com
 * o fuso do servidor. Escrever o array de dias aqui seria a terceira copia dele no
 * repositorio. Corta o "-feira" porque cabecalho de relatorio quer forma curta.
 *
 * Sem padStart: data em ISO ja vem com zero a esquerda.
 */
function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${diaDaSemana(iso).replace("-feira", "")}, ${d}/${m}`;
}

/*
  ACAO ANTES DE HISTORIA, e essa e a regra que define a ordem dos blocos. As 8 da manha o
  medico quer saber o que fazer hoje, nao o que aconteceu ontem, entao a fila acumulada vem
  primeiro e o resumo do dia depois.

  TODO NUMERO GANHA COMPARACAO. "2 novos leads" nao informa nada sozinho. Com a media de
  sete dias ao lado, vira "abaixo do normal" ou "acima do normal", que e uma leitura.

  O QUE SAIU, e por que. "Mensagens enviadas" era ruido: o numero sobe quando o proprio bot
  fala mais, o que nao diz nada sobre o negocio. E a "taxa de conversao" media errado, porque
  agendado e compareceu sao estados finais no funil, nao um fluxo do periodo, entao a conta
  divide um estoque por um fluxo.

  O BLOCO DE PENDENCIAS SO APARECE se houver pendencia. Relatorio que todo dia mostra uma
  secao com zeros ensina o leitor a pular a secao, e no dia em que ela importa ele pula
  tambem.
*/
function montarMensagem(r: any): string {
  const w = r.whatsapp;
  const c = r.crm;
  const p = r.pendencias ?? {};
  const g = r.google ?? {};

  const periodo = r.periodo.inicio === r.periodo.fim
    ? dataCurta(r.periodo.inicio)
    : `${dataCurta(r.periodo.inicio)} a ${dataCurta(r.periodo.fim)}`;

  const linhas: string[] = [`📊 *Relatório · ${periodo}*`];

  const pendencias: string[] = [];
  if (p.precisa_humano > 0) pendencias.push(`• ${fmt(p.precisa_humano)} aguardando atendimento humano`);
  // "sem movimento" e nao "sem resposta": o dado e updated_at, ou seja a linha nao foi
  // tocada. Pode ter havido resposta sem mudanca de registro.
  if (p.parados_3d > 0) pendencias.push(`• ${fmt(p.parados_3d)} parados há +3 dias sem movimento`);
  if (p.aguardando_confirmacao > 0) pendencias.push(`• ${fmt(p.aguardando_confirmacao)} aguardando confirmar consulta`);

  if (pendencias.length > 0) {
    // "(acumulado)" porque estas contas sao foto do agora, nao do periodo do cabecalho.
    // Sem a palavra, o leitor le "23 de sexta" onde o numero e a fila inteira.
    linhas.push(``, `⚠️ *Precisa de você* (acumulado)`, ...pendencias);
  }

  /*
    A SETA SO VALE PARA UM DIA. media_leads_7d e media DIARIA, e leads_novos e do PERIODO
    inteiro. Numa chamada manual pedindo uma semana, comparar os dois apontaria para cima
    sempre, o que seria pior que nao comparar.
  */
  const media = Number(c.media_leads_7d ?? 0);
  const umDiaSo = r.periodo.inicio === r.periodo.fim;
  let comparacao = "";
  if (umDiaSo) {
    // Sem guarda de media > 0. Zero e medicao legitima, e uma semana parada e justamente
    // quando "3 novos leads ↑ (média 7d: 0)" mais informa.
    const seta = c.leads_novos > media ? " ↑" : c.leads_novos < media ? " ↓" : "";
    comparacao = `${seta} (média 7d: ${fmt(media)})`;
  }

  linhas.push(
    ``,
    `📈 *No período*`,
    `• ${fmt(c.leads_novos)} novos leads${comparacao}`,
    `• ${fmt(w.mensagens_in)} mensagens recebidas`,
    `• ${fmt(c.cancelamentos ?? 0)} cancelamentos`,
  );

  if (g.nota != null) {
    const novas = Number(g.novas_no_periodo ?? 0);
    linhas.push(
      ``,
      `⭐ *Google*`,
      // toFixed devolve ponto decimal. Nota de avaliacao em portugues leva virgula.
      `• ${Number(g.nota).toFixed(1).replace(".", ",")} · ${fmt(Number(g.total ?? 0))} avaliações`,
      novas > 0 ? `• ${fmt(novas)} nova(s) no período` : `• nenhuma nova no período`,
    );
  }

  return linhas.join("\n");
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
