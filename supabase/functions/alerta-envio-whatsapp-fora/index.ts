// Alerta por email quando o envio outbound de WhatsApp para de funcionar.
//
// Por que existe: em 25/08/2026 o workflow n8n que atende
// POST /webhook/enviar-whatsapp foi despublicado. O n8n passou a responder
// 404 "The requested webhook is not registered" e NENHUMA mensagem chegou ao
// paciente — mas o registro continuava sendo gravado em `mensagens_whatsapp`,
// entao no inbox do admin a conversa parecia entregue. A falha ficou invisivel
// por ~1h e so apareceu porque alguem abriu o tooltip de um card do Kanban.
//
// Por que roda no Supabase e nao no n8n: a falha que estamos vigiando E o n8n
// perder um workflow. Um monitor hospedado no proprio n8n morreria junto com o
// que ele deveria vigiar. Email (Resend) tambem e caminho independente do
// WhatsApp, que e justamente o canal quebrado nesse cenario.
//
// O que NAO dispara alerta: `status_envio='erro'` tambem marca recusas
// esperadas e por paciente — telefone interno da clinica, numero sem WhatsApp.
// Alertar nesses casos geraria ruido diario e treinaria o leitor a ignorar o
// alerta. So falha de infraestrutura (HTTP 4xx/5xx, webhook nao registrado)
// conta aqui.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireCronSecret } from "../_shared/authGuards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const DESTINATARIO = "julianosmachado@gmail.com";
const REMETENTE = "Alerta CRM <contato@send.drjulianomachado.com>";

const JANELA_MIN = 30;      // olha falhas dos ultimos 30 minutos
const DEDUP_HORAS = 6;      // nao repete o mesmo alerta antes disso
const TIPO_ALERTA = "envio_whatsapp_fora";

/** Falha de infraestrutura — nao recusa esperada de um paciente especifico. */
const PADRAO_INFRA = /not registered|HTTP\s*[45]\d\d|ECONNREFUSED|ETIMEDOUT|fetch failed|502|503|504/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronGuard = await requireCronSecret(req);
  if (!cronGuard.ok) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1) Falhas recentes. O filtro fino e em JS de proposito: montar ILIKE/OR
    //    no PostgREST para varios padroes e fragil, e o volume aqui e baixo.
    const desdeIso = new Date(Date.now() - JANELA_MIN * 60_000).toISOString();
    const { data: recentes, error: errBusca } = await supabase
      .from("mensagens_whatsapp")
      .select("id, tipo_mensagem, error_message, created_at")
      .eq("direcao", "OUT")
      .eq("status_envio", "erro")
      .gte("created_at", desdeIso)
      .order("created_at", { ascending: false })
      .limit(100);

    if (errBusca) {
      console.error("[alerta-envio] erro ao buscar falhas:", errBusca);
      return json({ error: errBusca.message }, 500);
    }

    const infra = (recentes ?? []).filter((m) =>
      PADRAO_INFRA.test(m.error_message ?? "")
    );

    if (infra.length === 0) {
      return json({ alertou: false, motivo: "sem_falha_de_infra", analisadas: recentes?.length ?? 0 });
    }

    // 2) Dedup: uma queda longa nao deve gerar um email a cada 15 minutos.
    const dedupIso = new Date(Date.now() - DEDUP_HORAS * 3_600_000).toISOString();
    const { data: jaAlertado } = await supabase
      .from("alertas_sistema")
      .select("id")
      .eq("tipo", TIPO_ALERTA)
      .gte("created_at", dedupIso)
      .limit(1);

    if (jaAlertado && jaAlertado.length > 0) {
      return json({ alertou: false, motivo: "dedup", falhas: infra.length });
    }

    if (!RESEND_API_KEY) {
      console.error("[alerta-envio] RESEND_API_KEY nao configurada");
      return json({ error: "RESEND_API_KEY nao configurada" }, 500);
    }

    // 3) Email. Mostra o motivo bruto porque e ele que aponta a causa
    //    (ex.: "not registered" = workflow n8n despublicado).
    const motivos = [...new Set(infra.map((m) => (m.error_message ?? "").slice(0, 200)))];
    const porTipo = infra.reduce<Record<string, number>>((acc, m) => {
      const k = m.tipo_mensagem || "(sem tipo)";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

    const html = `
      <h2>Envio de WhatsApp falhando</h2>
      <p><strong>${infra.length}</strong> mensagem(ns) nao entregue(s) nos ultimos
      ${JANELA_MIN} minutos por falha de infraestrutura.</p>
      <p><strong>Atencao:</strong> essas mensagens aparecem normalmente no inbox do
      admin, mas <strong>nao chegaram ao paciente</strong>.</p>
      <h3>Por tipo</h3>
      <ul>${Object.entries(porTipo).map(([k, v]) => `<li>${k}: ${v}</li>`).join("")}</ul>
      <h3>Motivos</h3>
      <ul>${motivos.map((m) => `<li><code>${m}</code></li>`).join("")}</ul>
      <h3>O que verificar</h3>
      <ol>
        <li>Se o motivo diz <code>not registered</code>: o workflow n8n
        <em>"Enviar WhatsApp (saida) - Edge Functions -&gt; ManyChat"</em>
        (<code>NCPpWQJqu0lwCa2X</code>) esta despublicado. Republique.</li>
        <li>Confira <code>activeVersionId</code> — <code>active</code> da API do n8n
        nao e confiavel.</li>
      </ol>
      <p style="color:#888;font-size:12px">Proximo alerta deste tipo so daqui a
      ${DEDUP_HORAS}h. Gerado por <code>alerta-envio-whatsapp-fora</code>.</p>
    `;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: REMETENTE,
        to: [DESTINATARIO],
        subject: `[CRM] Envio de WhatsApp falhando — ${infra.length} mensagem(ns)`,
        html,
      }),
    });

    const respBody = await resp.json();
    if (!resp.ok) {
      console.error("[alerta-envio] Resend recusou:", respBody);
      return json({ error: "falha ao enviar email", detalhe: respBody }, 502);
    }

    // 4) So marca depois do email sair. Se o Resend falhar, a proxima execucao
    //    tenta de novo em vez de engolir a queda silenciosamente.
    await supabase.from("alertas_sistema").insert({
      tipo: TIPO_ALERTA,
      detalhe: `${infra.length} falha(s): ${motivos.join(" | ")}`.slice(0, 1000),
    });

    console.warn(`[alerta-envio] 🚨 alerta enviado — ${infra.length} falha(s)`);
    return json({ alertou: true, falhas: infra.length, motivos });
  } catch (e) {
    console.error("[alerta-envio] excecao:", e);
    return json({ error: String(e) }, 500);
  }
});
