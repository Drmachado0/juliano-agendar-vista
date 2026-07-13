// ============================================================================
// Testes estruturais (source-level) para os endpoints e a migração pós-auditoria.
// Não bate em Postgres — lê os arquivos reais e valida invariantes críticas.
// ============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(p: string) {
  return readFileSync(resolve(process.cwd(), p), "utf8");
}

const INBOUND = read("supabase/functions/registrar-mensagem-in-n8n/index.ts");
const OUTBOUND = read("supabase/functions/registrar-envio-out-n8n/index.ts");
const LEGACY = read("supabase/functions/n8n-registrar-envio/index.ts");
const CFG = read("supabase/config.toml");

// Migração de ajustes (nome não muda: pega o arquivo mais recente que a contém)
import { readdirSync } from "node:fs";
const MIG = (() => {
  const files = readdirSync(resolve(process.cwd(), "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of [...files].reverse()) {
    const body = read(`supabase/migrations/${f}`);
    if (
      body.includes("in_orfas_24h") &&
      body.includes("vincular_mensagem_por_telefone")
    ) {
      return body;
    }
  }
  throw new Error("Migration de ajustes não encontrada");
})();

describe("registrar-mensagem-in-n8n (P0 + corretiva)", () => {
  it("usa requireN8nSecret timing-safe", () => {
    expect(INBOUND).toMatch(/requireN8nSecret/);
  });
  it("idempotência ANTES de qualquer mutação (busca por mensagem_externa_id)", () => {
    const idxLookup = INBOUND.indexOf(".eq(\"mensagem_externa_id\"");
    const idxInsert = INBOUND.indexOf(".insert(insertRow)");
    expect(idxLookup).toBeGreaterThan(0);
    expect(idxLookup).toBeLessThan(idxInsert);
  });
  it("quando dup existe órfã, tenta RPC de vinculação novamente", () => {
    expect(INBOUND).toMatch(/if \(!agendamentoId\)[\s\S]{0,180}tentarVinculo/);
  });
  it("insere provider='manychat' e provider_message_id", () => {
    expect(INBOUND).toMatch(/provider:\s*"manychat"/);
    expect(INBOUND).toMatch(/provider_message_id:\s*providerMessageId/);
  });
  it("não faz scan dos últimos 200 agendamentos nem match por últimos 8 dígitos", () => {
    expect(INBOUND).not.toMatch(/order\(['"]created_at['"].*\)\s*\.limit\(200\)/);
    expect(INBOUND).not.toMatch(/slice\(-8\)/);
    expect(INBOUND).not.toMatch(/\.ilike\(.*telefone.*%.*\)/i);
  });
  it("nunca cria lead diretamente (delega para RPC)", () => {
    expect(INBOUND).not.toMatch(/\.from\(["']agendamentos["']\)\s*\.insert/);
  });
  it("sanitiza payload removendo tokens/secrets", () => {
    expect(INBOUND).toMatch(/sanitizePayload/);
    expect(INBOUND).toMatch(/token\|secret\|password\|authorization\|apikey/);
  });
  it("trata erro de normalizar_telefone explicitamente (500 sem PII)", () => {
    expect(INBOUND).toMatch(/normalizar_telefone[\s\S]{0,400}telErr/);
    expect(INBOUND).toMatch(/normalizar_telefone_falhou/);
  });
  it("falha da RPC de vínculo → 500 com error=vinculo_falhou, persisted=true, mensagem_id, request_id", () => {
    // Não deve responder 200 com agendamento_id null quando RPC falhou:
    expect(INBOUND).toMatch(/error:\s*["']vinculo_falhou["']/);
    expect(INBOUND).toMatch(/persisted:\s*true/);
    // tentarVinculo devolve discriminated union { ok:false } → sem "agendamento_id null" implícito
    expect(INBOUND).toMatch(/return\s*\{\s*ok:\s*false\s*\}/);
  });
  it("nunca vaza texto bruto do erro no response body", () => {
    // Nenhum error com template literal usando .message da RPC/DB
    expect(INBOUND).not.toMatch(/error:\s*`[^`]*\$\{[^}]+\.message\}/);
    expect(INBOUND).not.toMatch(/error:\s*insErr\.message/);
    expect(INBOUND).not.toMatch(/error:\s*vErr\.message/);
  });
});

describe("registrar-envio-out-n8n (outbound corretivo)", () => {
  it("mismatch agendamento_id x telefone_canonico retorna 409", () => {
    expect(OUTBOUND).toMatch(/telefone_agendamento_mismatch/);
    expect(OUTBOUND).toMatch(/409/);
  });
  it("agendamento inexistente retorna 404", () => {
    expect(OUTBOUND).toMatch(/agendamento_not_found/);
    expect(OUTBOUND).toMatch(/404/);
  });
  it("trata erros das queries com códigos internos (sem PII/texto bruto)", () => {
    expect(OUTBOUND).toMatch(/agendamento_lookup_failed/);
    expect(OUTBOUND).toMatch(/agendamentos_lookup_failed/);
    expect(OUTBOUND).toMatch(/insert_out_falhou/);
    expect(OUTBOUND).not.toMatch(/error:\s*insErr\.message/);
    expect(OUTBOUND).not.toMatch(/error:\s*`agendamento lookup:/);
  });
  it("trata erro explícito da RPC normalizar_telefone (500)", () => {
    expect(OUTBOUND).toMatch(/normalizar_telefone[\s\S]{0,400}telErr/);
    expect(OUTBOUND).toMatch(/normalizar_telefone_falhou/);
  });
  it("telefone_canonico com erro cai em fallback local (não fatal)", () => {
    expect(OUTBOUND).toMatch(/canonicalFallback/);
    expect(OUTBOUND).toMatch(/telefone_canonico[\s\S]{0,400}fallback/i);
  });
  it("match sem agendamento_id explícito filtra ativos não-sandbox e ignora terminais (case-insensitive)", () => {
    expect(OUTBOUND).toMatch(/TERMINAIS\s*=\s*\[\s*"ATENDIDO"\s*,\s*"CANCELADO"\s*,\s*"COMPARECEU"\s*\]/);
    expect(OUTBOUND).toMatch(/is_sandbox\s*!==\s*true/);
    expect(OUTBOUND).toMatch(/toUpperCase\(\)/);
  });
  it("mascara telefone em system_logs", () => {
    expect(OUTBOUND).toMatch(/maskTelefone/);
  });
});

describe("n8n-registrar-envio (proxy legado)", () => {
  it("é proxy puro para registrar-envio-out-n8n (sem lógica duplicada)", () => {
    expect(LEGACY).toMatch(/functions\/v1\/registrar-envio-out-n8n/);
    // Sem createClient nem RPCs no legado
    expect(LEGACY).not.toMatch(/createClient\(/);
    expect(LEGACY).not.toMatch(/\.rpc\(/);
    expect(LEGACY).not.toMatch(/CONFIRMATION_TYPES/);
  });
  it("mapeia falha_envio → erro", () => {
    expect(LEGACY).toMatch(/falha_envio[\s\S]{0,60}["']erro["']/);
  });
  it("encaminha x-n8n-secret e x-request-id", () => {
    expect(LEGACY).toMatch(/x-n8n-secret/);
    expect(LEGACY).toMatch(/x-request-id/);
  });
  it("preserva status HTTP e body do canônico", () => {
    expect(LEGACY).toMatch(/status:\s*upstream\.status/);
    expect(LEGACY).toMatch(/upstream\.text\(\)/);
  });
  it("default tipo_mensagem = 'bot_agente' (nunca confirmacao_automatica)", () => {
    expect(LEGACY).toMatch(/tipo_mensagem:\s*raw\.tipo_mensagem\s*\?\?\s*["']bot_agente["']/);
    // Não pode ter default legado que altere funil
    expect(LEGACY).not.toMatch(/\?\?\s*["']confirmacao_automatica["']/);
  });
  it("proxy_upstream_unreachable não vaza detalhe bruto do erro", () => {
    expect(LEGACY).not.toMatch(/detail:\s*\(e as Error\)\.message/);
    expect(LEGACY).toMatch(/"error":\s*"proxy_upstream_unreachable"|error:\s*["']proxy_upstream_unreachable["']/);
  });

});

describe("config.toml — verify_jwt", () => {
  it("registrar-envio-out-n8n com verify_jwt=false", () => {
    expect(CFG).toMatch(
      /\[functions\.registrar-envio-out-n8n\][\s\S]*?verify_jwt\s*=\s*false/,
    );
  });
  it("registrar-mensagem-in-n8n com verify_jwt=false", () => {
    expect(CFG).toMatch(
      /\[functions\.registrar-mensagem-in-n8n\][\s\S]*?verify_jwt\s*=\s*false/,
    );
  });
});

describe("migração — vincular_mensagem_por_telefone (case-insensitive terminais)", () => {
  it("usa upper(...) para terminais case-insensitive", () => {
    expect(MIG).toMatch(/upper\(coalesce\(status_crm[^)]*\)\)\s*NOT IN\s*\('ATENDIDO','CANCELADO','COMPARECEU'\)/);
  });
  it("mantém pg_advisory_xact_lock", () => {
    expect(MIG).toMatch(/pg_advisory_xact_lock/);
  });
  it("mantém filtro is_sandbox IS NOT TRUE", () => {
    expect(MIG).toMatch(/is_sandbox IS NOT TRUE/);
  });
  it("branch ambíguo não mescla nem vincula", () => {
    expect(MIG).toMatch(/v_ambiguo\s*:=\s*true[\s\S]{0,60}v_agendamento_id\s*:=\s*NULL/);
  });
});

describe("migração — saude_integracoes", () => {
  it("out_confirmados_24h NÃO inclui 'solicitado' na cláusula IN", () => {
    const m = MIG.match(/out24 AS \(([\s\S]*?status_envio IN \([^)]+\))/);
    expect(m).toBeTruthy();
    expect(m![1]).toMatch(/status_envio IN \('enviado','entregue','lido'\)/);
    expect(m![1]).not.toMatch(/IN \([^)]*'solicitado'[^)]*\)/);
  });
  it("pacientes_ultima_msg_in agrupa por telefone_canonico (inclui órfãos)", () => {
    const m = MIG.match(/ultima_por_tel AS \(([\s\S]*?)ORDER BY telefone_canonico[^)]*\)/);
    expect(m).toBeTruthy();
    expect(m![1]).toMatch(/DISTINCT ON \(telefone_canonico\)/);
    // Não filtra agendamento_id, então inclui órfãos
    expect(m![1]).not.toMatch(/agendamento_id IS NOT NULL/);
  });
  it("adiciona in_orfas_24h ao retorno", () => {
    expect(MIG).toMatch(/in_orfas_24h\s+integer/);
    expect(MIG).toMatch(/orfas24 AS \(/);
  });
  it("mantém SECURITY DEFINER + search_path fixo + check admin", () => {
    expect(MIG).toMatch(/SECURITY DEFINER/);
    expect(MIG).toMatch(/SET search_path TO 'public','net','pg_temp'/);
    expect(MIG).toMatch(/has_role\(auth\.uid\(\), 'admin'::app_role\)/);
  });
  it("grants mínimos: revoga anon, concede authenticated/service_role", () => {
    expect(MIG).toMatch(/REVOKE ALL ON FUNCTION public\.saude_integracoes\(\) FROM PUBLIC, anon/);
    expect(MIG).toMatch(/GRANT EXECUTE ON FUNCTION public\.saude_integracoes\(\) TO authenticated, service_role/);
  });
});
