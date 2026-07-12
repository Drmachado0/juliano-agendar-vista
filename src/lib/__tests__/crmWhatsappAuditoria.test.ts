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

describe("registrar-mensagem-in-n8n (P0)", () => {
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
    expect(INBOUND).toMatch(/if \(!agendamentoId\)[\s\S]{0,120}tentarVinculo/);
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
    // Não há INSERT into agendamentos no arquivo
    expect(INBOUND).not.toMatch(/\.from\(["']agendamentos["']\)\s*\.insert/);
  });
  it("sanitiza payload removendo tokens/secrets", () => {
    expect(INBOUND).toMatch(/sanitizePayload/);
    expect(INBOUND).toMatch(/token|secret|password|authorization|apikey/);
  });
});

describe("registrar-envio-out-n8n (outbound)", () => {
  it("mismatch agendamento_id x telefone_canonico retorna 409", () => {
    expect(OUTBOUND).toMatch(/telefone_agendamento_mismatch/);
    expect(OUTBOUND).toMatch(/409/);
  });
  it("agendamento inexistente retorna 404", () => {
    expect(OUTBOUND).toMatch(/agendamento_not_found/);
    expect(OUTBOUND).toMatch(/404/);
  });
  it("trata erros das queries explicitamente", () => {
    expect(OUTBOUND).toMatch(/agendamento lookup:/);
    expect(OUTBOUND).toMatch(/agendamentos:/);
  });
  it("mascara telefone em system_logs", () => {
    expect(OUTBOUND).toMatch(/maskTelefone/);
  });
});

describe("n8n-registrar-envio (legado)", () => {
  it("default tipo_mensagem = bot_agente", () => {
    expect(LEGACY).toMatch(/tipo_mensagem:\s*z\.string\(\)\.default\(["']bot_agente["']\)/);
  });
  it("mantém requireN8nSecret timing-safe", () => {
    expect(LEGACY).toMatch(/requireN8nSecret/);
  });
  it("só altera confirmation_* para tipos de confirmação", () => {
    expect(LEGACY).toMatch(/CONFIRMATION_TYPES/);
    expect(LEGACY).toMatch(/confirmacao_automatica/);
    expect(LEGACY).toMatch(/confirmacao_consulta/);
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
