// ============================================================================
// memoria-paciente
// Camada de memória (Supermemory) por paciente, para o agente n8n/ManyChat.
//
// Por que existe: buscar-contexto-paciente devolve o ESTADO estruturado do CRM
// (lead ativo, agendamento, status). O que ele não devolve é o CONTEXTO NARRATIVO
// — o que o paciente já contou ("uso colírio de glaucoma", "só posso de manhã",
// "meu filho é que agenda"). Isso hoje se perde entre sessões.
//
// Isolamento: um containerTag por paciente, derivado do telefone canônico.
//   containerTag = patient:<telefone_canonico>
// A API do Supermemory isola por tag; NUNCA consultamos cruzando tags. Essa é a
// garantia que sustenta o lado LGPD deste recurso.
//
// Não substitui buscar-contexto-paciente e não escreve no banco do CRM.
//
// Ações (POST):
//   { acao: "lembrar", telefone_whatsapp, texto, papel? }   -> grava a troca
//   { acao: "recuperar", telefone_whatsapp, pergunta? }     -> fatos relevantes
//   { acao: "perfil", telefone_whatsapp }                   -> perfil consolidado
//   { acao: "esquecer", telefone_whatsapp, consulta? }      -> LGPD, apaga fatos
//
// Segredos (Supabase secrets):
//   SUPERMEMORY_API_KEY  — chave da conta Supermemory
//   N8N_SHARED_SECRET    — já usado pelas demais funções (header x-n8n-secret)
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import { telefoneCanonico, maskTelefone } from "../_shared/telefoneCanonico.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SM = "https://api.supermemory.ai";

const BodySchema = z.object({
  acao: z.enum(["lembrar", "recuperar", "perfil", "esquecer"]),
  telefone_whatsapp: z.string().min(8),
  texto: z.string().min(1).optional(),
  papel: z.enum(["paciente", "clinica"]).optional().default("paciente"),
  pergunta: z.string().optional(),
  consulta: z.string().optional(),
  limite: z.number().int().min(1).max(25).optional().default(8),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** containerTag do paciente. Regra da API: ^[a-zA-Z0-9_:-]+$, até 100 chars. */
function containerTagDe(telCanon: string): string | null {
  const tag = `patient:${telCanon}`;
  return /^[a-zA-Z0-9_:-]+$/.test(tag) && tag.length <= 100 ? tag : null;
}

async function sm(path: string, apiKey: string, body: unknown, method = "POST") {
  const r = await fetch(`${SM}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const texto = await r.text();
  let dados: unknown = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = { raw: texto }; }
  if (!r.ok) throw new Error(`supermemory ${path} ${r.status}`);
  return dados as any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rid = requestId(req);
  const guard = await requireN8nSecret(req);
  if (!guard.ok) return unauthorizedResponse(guard.reason ?? "unauthorized", corsHeaders);

  const apiKey = Deno.env.get("SUPERMEMORY_API_KEY");
  if (!apiKey) return json({ error: "supermemory_nao_configurado", request_id: rid }, 500);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return json({ error: "payload_invalido", request_id: rid }, 400);
  }

  const telCanon = telefoneCanonico(body.telefone_whatsapp);
  if (!telCanon) return json({ error: "telefone_invalido", request_id: rid }, 400);

  const containerTag = containerTagDe(telCanon);
  if (!containerTag) return json({ error: "container_tag_invalido", request_id: rid }, 400);

  try {
    switch (body.acao) {
      case "lembrar": {
        if (!body.texto) return json({ error: "texto_obrigatorio", request_id: rid }, 400);
        const quem = body.papel === "clinica" ? "Clinica" : "Paciente";
        const r = await sm("/v3/documents", apiKey, {
          content: `${quem}: ${body.texto}`,
          containerTag,
          taskType: "memory", // extrai fato + alimenta perfil
          metadata: { canal: "whatsapp", papel: body.papel, em: new Date().toISOString() },
        });
        return json({ ok: true, documento_id: r?.id ?? null, request_id: rid });
      }

      case "recuperar": {
        const r = await sm("/v4/search", apiKey, {
          q: body.pergunta ?? "o que este paciente já contou",
          containerTag,
          limit: body.limite,
          rerank: true,
        });
        const fatos = (r?.results ?? r?.memories ?? [])
          .map((m: any) => m?.memory ?? m?.content ?? m?.text)
          .filter(Boolean);
        return json({ ok: true, fatos, total: fatos.length, request_id: rid });
      }

      case "perfil": {
        const r = await sm("/v4/profile", apiKey, { containerTag });
        return json({ ok: true, perfil: r?.profile ?? r ?? null, request_id: rid });
      }

      case "esquecer": {
        // LGPD: apaga os fatos do paciente. Sem `consulta`, apaga tudo do container.
        const r = await sm("/v4/memories/forget-matching", apiKey, {
          containerTag,
          query: body.consulta ?? "*",
          dryRun: false,
        });
        return json({ ok: true, removidos: r?.deleted ?? r?.count ?? null, request_id: rid });
      }
    }
  } catch (e) {
    // Nunca vaza PII no log nem na resposta.
    console.error(`[memoria-paciente] ${rid} tel=${maskTelefone(telCanon)} erro=${(e as Error).message}`);
    return json({ error: "falha_memoria", request_id: rid }, 500);
  }
});
