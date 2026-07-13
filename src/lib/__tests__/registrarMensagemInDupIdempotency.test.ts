// Testes estruturais: a Edge Function registrar-mensagem-in-n8n deve
// persistir a decisão dos guards em payload.guard_decision e devolver a
// MESMA decisão em caminhos de duplicata (sem reenviar/loggar/escalar).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../../supabase/functions/registrar-mensagem-in-n8n/index.ts"),
  "utf-8",
);

describe("registrar-mensagem-in-n8n — idempotência da decisão dos guards", () => {
  it("importa composePatientReplyValor (retomada sem 2ª IA)", () => {
    expect(SRC).toMatch(/composePatientReplyValor/);
  });

  it("define tipo GuardDecision persistível", () => {
    expect(SRC).toMatch(/type GuardDecision\s*=/);
    expect(SRC).toMatch(/handoff_required/);
    expect(SRC).toMatch(/immediate_reply/);
    expect(SRC).toMatch(/resume_agent/);
  });

  it("persiste guard_decision em mensagens_whatsapp.payload", () => {
    expect(SRC).toMatch(/guard_decision/);
    expect(SRC).toMatch(/persistirDecisao/);
  });

  it("possui helper de leitura para caminhos duplicados", () => {
    expect(SRC).toMatch(/carregarDecisaoPersistida/);
    expect(SRC).toMatch(/resolverDecisaoDuplicata/);
  });

  it("computarEPersistirDecisao aceita logSideEffects para suprimir re-log/transição", () => {
    expect(SRC).toMatch(/logSideEffects/);
    expect(SRC).toMatch(/if\s*\(\s*logSideEffects\s+&&\s+podeAlterar/);
    expect(SRC).toMatch(/if\s*\(\s*logSideEffects\s*\)\s*\{[\s\S]{0,400}handoff_exames/);
  });

  it("branches de duplicata NÃO retornam mais { duplicada:true } sem os campos de decisão", () => {
    // Toda ocorrência de `duplicada: true` deve vir acompanhada de handoff_required no mesmo objeto.
    const matches = SRC.match(/duplicada:\s*true[\s\S]{0,600}?\}/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    for (const m of matches) {
      expect(m).toMatch(/handoff_required/);
      expect(m).toMatch(/immediate_reply/);
      expect(m).toMatch(/patient_reply/);
    }
  });

  it("valor_consulta usa estado_atendimento e resume_agent=false", () => {
    // resume_agent = false quando valor.matched: garantia de "sem 2ª IA".
    expect(SRC).toMatch(/valor\.matched[\s\S]{0,400}resume_agent\s*=\s*false/);
    expect(SRC).toMatch(/composePatientReplyValor\([\s\S]*estado_atendimento/);
  });

  it("histórico de exames usa janela e exclui a mensagem atual", () => {
    expect(SRC).toMatch(/janelaMinutos:\s*45/);
    expect(SRC).toMatch(/\.neq\(\s*["']id["']\s*,\s*mensagemId\s*\)/);
    expect(SRC).toMatch(/currentMessageId:\s*mensagemId/);
    expect(SRC).toMatch(/currentCreatedAt:/);
  });
});
