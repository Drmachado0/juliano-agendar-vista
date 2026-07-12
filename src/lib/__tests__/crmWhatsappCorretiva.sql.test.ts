// ============================================================================
// Testes SQL de comportamento contra o banco real (via psql).
// Cobrem os requisitos da revisão técnica:
//  - ambiguidade sem vínculo (RPC vincular_mensagem_por_telefone)
//  - concorrência (pg_advisory_xact_lock) — checagem estrutural
//  - UNIQUE parcial em mensagens_whatsapp.mensagem_externa_id
//  - UNIQUE parcial em conversation_intents.mensagem_id
//  - máquina de estados transicionar_estado_agendamento
//  - normalização telefone_canonico
// Requer psql + PG* env (default no sandbox Lovable).
// ============================================================================
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Skip suite se psql/DB não estiverem disponíveis no ambiente de teste.
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

function sql(query: string): string {
  return execSync(`psql -X -A -t -F '|' -v ON_ERROR_STOP=1 -c ${JSON.stringify(query)}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sqlJSON(query: string): any {
  const out = sql(query);
  return out ? JSON.parse(out) : null;
}

d("SQL — telefone_canonico", () => {
  it("normaliza formatos brasileiros equivalentes", () => {
    const r = sql(`SELECT
      public.telefone_canonico('+55 (91) 99115-0174') = public.telefone_canonico('91991150174')
      AND public.telefone_canonico('9132110174') = '91932110174'
      AND public.telefone_canonico(NULL) IS NULL`);
    expect(r).toBe("t");
  });
});

d("SQL — vincular_mensagem_por_telefone (ambiguidade e lock)", () => {
  it("fonte tem pg_advisory_xact_lock (proteção de concorrência)", () => {
    const out = sql(
      `SELECT pg_get_functiondef('public.vincular_mensagem_por_telefone(uuid,text)'::regprocedure) ILIKE '%pg_advisory_xact_lock%'`,
    );
    expect(out).toBe("t");
  });

  it("N matches ativos ⇒ agendamento_id NULL, ambiguo=true (sem merge)", () => {
    // Setup isolado por telefone único
    const tel = `91${Math.floor(Math.random() * 900000000 + 100000000)}`;
    sql(`INSERT INTO public.agendamentos (nome_completo, telefone_whatsapp, tipo_atendimento, local_atendimento, convenio, status_crm, status_funil, estado_atendimento, origem)
      VALUES ('Ambig A', '${tel}', 'Consulta', 'A definir', 'Particular', 'NOVO LEAD', 'novo', 'novo', 'teste_sql'),
             ('Ambig B', '${tel}', 'Consulta', 'A definir', 'Particular', 'NOVO LEAD', 'novo', 'novo', 'teste_sql')`);
    const mid = sql(
      `INSERT INTO public.mensagens_whatsapp (telefone, direcao, conteudo, tipo_mensagem, status_envio) VALUES ('${tel}','IN','msg amb','whatsapp','recebida') RETURNING id`,
    );
    const res = sqlJSON(`SELECT public.vincular_mensagem_por_telefone('${mid}', 'Fulano')::text`);
    expect(res.ambiguo).toBe(true);
    expect(res.agendamento_id).toBeNull();
    expect(res.total_matches).toBeGreaterThanOrEqual(2);
    const orfa = sql(`SELECT agendamento_id IS NULL FROM public.mensagens_whatsapp WHERE id='${mid}'`);
    expect(orfa).toBe("t");
    // cleanup
    sql(`DELETE FROM public.mensagens_whatsapp WHERE telefone='${tel}';
         DELETE FROM public.agendamentos WHERE telefone_whatsapp='${tel}';`);
  });

  it("0 matches ⇒ cria lead novo", () => {
    const tel = `91${Math.floor(Math.random() * 900000000 + 100000000)}`;
    const mid = sql(
      `INSERT INTO public.mensagens_whatsapp (telefone, direcao, conteudo, tipo_mensagem, status_envio) VALUES ('${tel}','IN','msg new','whatsapp','recebida') RETURNING id`,
    );
    const res = sqlJSON(`SELECT public.vincular_mensagem_por_telefone('${mid}', 'Novo Contato')::text`);
    expect(res.criado).toBe(true);
    expect(res.agendamento_id).toBeTruthy();
    sql(`DELETE FROM public.mensagens_whatsapp WHERE telefone='${tel}';
         DELETE FROM public.agendamentos WHERE telefone_whatsapp='${tel}' OR telefone_canonico='${tel}';`);
  });
});

d("SQL — UNIQUE parciais (idempotência forte)", () => {
  it("mensagens_whatsapp.mensagem_externa_id tem UNIQUE parcial", () => {
    const r = sql(`SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND tablename='mensagens_whatsapp'
        AND indexname='uniq_mensagens_wa_externa'
        AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%mensagem_externa_id IS NOT NULL%'
    )`);
    expect(r).toBe("t");
  });

  it("conversation_intents.mensagem_id tem UNIQUE parcial", () => {
    const r = sql(`SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND tablename='conversation_intents'
        AND indexname='uniq_conversation_intents_mensagem_id'
        AND indexdef ILIKE '%UNIQUE%'
    )`);
    expect(r).toBe("t");
  });

  it("insert duplicado por mensagem_externa_id é rejeitado", () => {
    const tel = `91${Math.floor(Math.random() * 900000000 + 100000000)}`;
    const ext = `wamid_teste_${Date.now()}`;
    sql(
      `INSERT INTO public.mensagens_whatsapp (telefone,direcao,conteudo,tipo_mensagem,status_envio,mensagem_externa_id) VALUES ('${tel}','IN','a','whatsapp','recebida','${ext}')`,
    );
    let bloqueado = false;
    try {
      sql(
        `INSERT INTO public.mensagens_whatsapp (telefone,direcao,conteudo,tipo_mensagem,status_envio,mensagem_externa_id) VALUES ('${tel}','IN','b','whatsapp','recebida','${ext}')`,
      );
    } catch {
      bloqueado = true;
    }
    expect(bloqueado).toBe(true);
    sql(`DELETE FROM public.mensagens_whatsapp WHERE mensagem_externa_id='${ext}';`);
  });
});

d("SQL — máquina de estados transicionar_estado_agendamento", () => {
  it("mapeia todos os status oficiais e ajusta bot_ativo/estado", () => {
    const tel = `91${Math.floor(Math.random() * 900000000 + 100000000)}`;
    const id = sql(
      `INSERT INTO public.agendamentos (nome_completo, telefone_whatsapp, tipo_atendimento, local_atendimento, convenio, status_crm, status_funil, estado_atendimento, origem, bot_ativo)
       VALUES ('T', '${tel}', 'Consulta', 'A definir', 'Particular', 'NOVO LEAD', 'novo', 'novo', 'teste_sql', true)
       RETURNING id`,
    );

    // NOVO LEAD → AGUARDANDO (bot fica ativo, estado 'bot')
    let r = sqlJSON(`SELECT public.transicionar_estado_agendamento('${id}','AGUARDANDO','sug slots')::text`);
    expect(r.ok).toBe(true);
    expect(r.novo).toBe("AGUARDANDO");
    expect(r.bot_ativo).toBe(true);
    expect(r.funil).toBe("aguardando");

    // AGUARDANDO → CLINICOR (bot desativa, estado humano, funil agendado)
    r = sqlJSON(`SELECT public.transicionar_estado_agendamento('${id}','CLINICOR','conf humano')::text`);
    expect(r.novo).toBe("CLINICOR");
    expect(r.bot_ativo).toBe(false);
    expect(r.funil).toBe("agendado");
    expect(r.estado).toBe("humano");

    // Status inválido é rejeitado
    r = sqlJSON(`SELECT public.transicionar_estado_agendamento('${id}','LIMBO',NULL)::text`);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("status_invalido");

    // BELÉM (com acento) e YAG_LASER e HGP funcionam
    for (const st of ["HGP", "BELÉM", "YAG_LASER"]) {
      r = sqlJSON(`SELECT public.transicionar_estado_agendamento('${id}','${st}',NULL)::text`);
      expect(r.ok).toBe(true);
      expect(r.novo).toBe(st);
      expect(r.bot_ativo).toBe(false);
    }

    // ATENDIDO
    r = sqlJSON(`SELECT public.transicionar_estado_agendamento('${id}','ATENDIDO','ok')::text`);
    expect(r.ok).toBe(true);
    expect(r.novo).toBe("ATENDIDO");
    expect(r.funil).toBe("compareceu");

    // Não deve permitir voltar para NOVO LEAD após ATENDIDO
    r = sqlJSON(`SELECT public.transicionar_estado_agendamento('${id}','NOVO LEAD',NULL)::text`);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("ja_compareceu");

    sql(`DELETE FROM public.agendamentos WHERE id='${id}';`);
  });

  it("PRECISA_DE_HUMANO força bot_ativo=false", () => {
    const tel = `91${Math.floor(Math.random() * 900000000 + 100000000)}`;
    const id = sql(
      `INSERT INTO public.agendamentos (nome_completo, telefone_whatsapp, tipo_atendimento, local_atendimento, convenio, status_crm, status_funil, estado_atendimento, origem, bot_ativo)
       VALUES ('H', '${tel}', 'Consulta', 'A definir', 'Particular', 'AGUARDANDO', 'aguardando', 'bot', 'teste_sql', true)
       RETURNING id`,
    );
    const r = sqlJSON(`SELECT public.transicionar_estado_agendamento('${id}','PRECISA_DE_HUMANO','falha classif')::text`);
    expect(r.bot_ativo).toBe(false);
    expect(r.estado).toBe("humano");
    const dbBot = sql(`SELECT bot_ativo FROM public.agendamentos WHERE id='${id}'`);
    expect(dbBot).toBe("f");
    sql(`DELETE FROM public.agendamentos WHERE id='${id}';`);
  });
});

// Cron schema is admin-only in Supabase managed DB; skip if role can't read it.
const canReadCron = canRun && (() => {
  try {
    execSync("psql -X -A -t -c 'SELECT 1 FROM cron.job LIMIT 1'", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
const dcron = canReadCron ? describe : describe.skip;

dcron("SQL — cron legado removido", () => {
  it("jobs legados não existem mais em cron.job", () => {
    const r = sql(`SELECT count(*) FROM cron.job WHERE jobname IN (
      'enviar-boas-vindas-lead',
      'retentar-boas-vindas-pendentes-5min',
      'enviar-confirmacoes-whatsapp-15min',
      'lembrete-consulta-diario'
    )`);
    expect(r).toBe("0");
  });
});

d("SQL — v_saude_integracoes expõe métricas pg_net", () => {
  it("colunas 2xx/4xx/5xx/timeouts existem", () => {
    const r = sql(`SELECT string_agg(column_name, ',' ORDER BY column_name)
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='v_saude_integracoes'
        AND column_name IN ('net_2xx_24h','net_4xx_24h','net_5xx_24h','net_timeouts_24h')`);
    expect(r).toBe("net_2xx_24h,net_4xx_24h,net_5xx_24h,net_timeouts_24h");
  });
});
