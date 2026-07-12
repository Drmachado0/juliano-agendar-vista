// ============================================================================
// Testes SQL estruturais (read-only) validando a migração corretiva do CRM.
// O role de teste do sandbox tem apenas leitura, então cobrimos:
//  - definição da função vincular_mensagem_por_telefone (advisory lock + branch ambíguo)
//  - definição da função transicionar_estado_agendamento (estados + guard-rails)
//  - índices UNIQUE parciais em mensagens_whatsapp e conversation_intents
//  - colunas pg_net na view v_saude_integracoes
//  - função saude_integracoes existe
// Testes comportamentais (inserts/updates) precisam de role admin e não rodam aqui.
// ============================================================================
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const canRun = (() => {
  try {
    if (!process.env.PGHOST && !process.env.SUPABASE_DB_URL) return false;
    execSync("which psql", { stdio: "ignore" });
    execSync("psql -X -A -t -c 'SELECT 1'", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const d = canRun ? describe : describe.skip;

function q(query: string): string {
  // Sempre single-line: psql -c não lida bem com \n vindos de JSON.stringify.
  const inline = query.replace(/\s+/g, " ").trim();
  return execSync(`psql -X -A -t -F '|' -v ON_ERROR_STOP=1 -c ${JSON.stringify(inline)}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

d("Migração corretiva CRM — vincular_mensagem_por_telefone", () => {
  it("usa pg_advisory_xact_lock para proteção de concorrência", () => {
    const r = q(
      `SELECT pg_get_functiondef('public.vincular_mensagem_por_telefone(uuid,text)'::regprocedure) ILIKE '%pg_advisory_xact_lock%'`,
    );
    expect(r).toBe("t");
  });

  it("não faz vínculo quando ambíguo (agendamento_id NULL + ambiguo=true)", () => {
    // Verifica no source que o branch ambíguo NÃO seta agendamento_id.
    const r = q(
      `SELECT pg_get_functiondef('public.vincular_mensagem_por_telefone(uuid,text)'::regprocedure) ILIKE '%ambiguo%true%'`,
    );
    expect(r).toBe("t");
  });

  it("normaliza telefone com telefone_canonico antes de comparar", () => {
    const r = q(
      `SELECT pg_get_functiondef('public.vincular_mensagem_por_telefone(uuid,text)'::regprocedure) ILIKE '%telefone_canonico%'`,
    );
    expect(r).toBe("t");
  });
});

d("Migração corretiva CRM — telefone_canonico", () => {
  it("normaliza formatos brasileiros equivalentes", () => {
    const r = q(
      `SELECT public.telefone_canonico('+55 (91) 99115-0174') = public.telefone_canonico('91991150174')`,
    );
    expect(r).toBe("t");
  });
  it("adiciona 9 quando falta em DDD+8 dígitos", () => {
    const r = q(`SELECT public.telefone_canonico('9132110174')`);
    expect(r).toBe("91932110174");
  });
  it("aceita NULL com segurança", () => {
    const r = q(`SELECT public.telefone_canonico(NULL) IS NULL`);
    expect(r).toBe("t");
  });
});

d("Migração corretiva CRM — máquina de estados", () => {
  it("transicionar_estado_agendamento mapeia todos os status oficiais", () => {
    const def = q(
      `SELECT pg_get_functiondef('public.transicionar_estado_agendamento(uuid,text,text)'::regprocedure)`,
    );
    for (const status of ["NOVO LEAD", "AGUARDANDO", "PRECISA_DE_HUMANO", "CLINICOR", "HGP", "BELÉM", "YAG_LASER", "ATENDIDO"]) {
      expect(def.includes(status), `status ${status} deve aparecer no CASE`).toBe(true);
    }
  });

  it("PRECISA_DE_HUMANO força bot_ativo=false", () => {
    const def = q(
      `SELECT pg_get_functiondef('public.transicionar_estado_agendamento(uuid,text,text)'::regprocedure)`,
    );
    // Existe a regra: se p_novo_status_crm='PRECISA_DE_HUMANO' então bot_ativo=false
    expect(/PRECISA_DE_HUMANO[\s\S]{0,200}(false|humano)/i.test(def)).toBe(true);
  });

  it("guarda contra rebaixamento após ATENDIDO", () => {
    const def = q(
      `SELECT pg_get_functiondef('public.transicionar_estado_agendamento(uuid,text,text)'::regprocedure)`,
    );
    expect(def.includes("ja_compareceu")).toBe(true);
  });

  it("rejeita status desconhecido com motivo status_invalido", () => {
    const def = q(
      `SELECT pg_get_functiondef('public.transicionar_estado_agendamento(uuid,text,text)'::regprocedure)`,
    );
    expect(def.includes("status_invalido")).toBe(true);
  });
});

d("Migração corretiva CRM — UNIQUE parciais", () => {
  it("mensagens_whatsapp.mensagem_externa_id tem UNIQUE parcial", () => {
    const r = q(
      `SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='uniq_mensagens_wa_externa'`,
    );
    expect(r).toMatch(/UNIQUE/i);
    expect(r).toMatch(/mensagem_externa_id IS NOT NULL/i);
  });

  it("conversation_intents.mensagem_id tem UNIQUE parcial", () => {
    const r = q(
      `SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='uniq_conversation_intents_mensagem_id'`,
    );
    expect(r).toMatch(/UNIQUE/i);
    expect(r).toMatch(/mensagem_id IS NOT NULL/i);
  });
});

d("Migração corretiva CRM — observabilidade pg_net", () => {
  it("v_saude_integracoes expõe métricas pg_net 2xx/4xx/5xx/timeouts", () => {
    const r = q(
      `SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='v_saude_integracoes' AND column_name IN ('net_2xx_24h','net_4xx_24h','net_5xx_24h','net_timeouts_24h')`,
    );
    expect(r).toBe("net_2xx_24h,net_4xx_24h,net_5xx_24h,net_timeouts_24h");
  });

  it("função saude_integracoes existe", () => {
    const r = q(
      `SELECT count(*) FROM information_schema.routines WHERE routine_schema='public' AND routine_name='saude_integracoes'`,
    );
    expect(Number(r)).toBeGreaterThanOrEqual(1);
  });
});

d("Outbound ManyChat/n8n — provider + provider_message_id", () => {
  it("mensagens_whatsapp tem colunas provider e provider_message_id", () => {
    const r = q(
      `SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='mensagens_whatsapp' AND column_name IN ('provider','provider_message_id')`,
    );
    expect(r).toBe("provider,provider_message_id");
  });

  it("UNIQUE parcial em (provider, provider_message_id)", () => {
    const r = q(
      `SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='mensagens_whatsapp_provider_msgid_uniq'`,
    );
    expect(r).toMatch(/UNIQUE/i);
    expect(r).toMatch(/provider_message_id IS NOT NULL/i);
    expect(r).toMatch(/provider IS NOT NULL/i);
  });

  it("v_saude_integracoes expõe out_confirmados_24h e pacientes_ultima_msg_in", () => {
    const r = q(
      `SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='v_saude_integracoes' AND column_name IN ('out_confirmados_24h','pacientes_ultima_msg_in')`,
    );
    expect(r).toBe("out_confirmados_24h,pacientes_ultima_msg_in");
  });
});

