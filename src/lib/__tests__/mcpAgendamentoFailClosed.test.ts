/**
 * Teste estrutural rev-3 (2026-07-13): garante que mcp-agendamento cumpre
 * o contrato fail-closed:
 *   - agendamento_id UUID obrigatório em criar_agendamento
 *   - nenhum match por últimos 8 dígitos (last8) do telefone
 *   - update SOMENTE por .eq("id", ...)
 *   - divergência de telefone canônico ⇒ risco_paciente_errado
 *   - card sandbox/terminal rejeitado
 *   - clinica_id sempre vem do resolverClinica canônico
 *   - notificações aguardadas via Promise.allSettled + notificacoes_ok
 *   - GET público reduzido (sem listar tools/headers)
 * E também que validarDisponibilidade.ts:
 *   - exclui terminais case-insensitive (CANCELADO, ATENDIDO, ...)
 *   - usa America/Belem (UTC-3) para "hoje" e margem de 1h
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(p: string) {
  return readFileSync(resolve(__dirname, "../../..", p), "utf8");
}

describe("mcp-agendamento — fail-closed rev-3", () => {
  const src = read("supabase/functions/mcp-agendamento/index.ts");

  it("não contém encontrarLeadSemData nem match por last8", () => {
    expect(src).not.toMatch(/encontrarLeadSemData/);
    expect(src).not.toMatch(/last8/);
    expect(src).not.toMatch(/slice\(-8\)/);
    // Não deve mais escanear ordenando por created_at para deduzir card.
    expect(src).not.toMatch(/\.limit\(200\)/);
  });

  it("agendamento_id UUID é obrigatório e retorna motivo canônico", () => {
    expect(src).toMatch(/agendamento_id/);
    expect(src).toMatch(/"agendamento_id"/);
    expect(src).toMatch(/agendamento_id_obrigatorio/);
    expect(src).toMatch(/UUID_RE/);
  });

  it("update é feito somente por .eq('id', agendamento_id)", () => {
    // .from("agendamentos").update(...).eq("id", ...) — nunca por telefone.
    expect(src).toMatch(/\.update\(patch\)\s*\n\s*\.eq\("id",\s*agendamento_id\)/);
    // não deve haver update por telefone_whatsapp/canonico
    expect(src).not.toMatch(/\.update\([^)]*\)\s*\.eq\("telefone/);
  });

  it("valida telefone canônico exato e devolve risco_paciente_errado", () => {
    expect(src).toMatch(/telefoneCanonico/);
    expect(src).toMatch(/risco_paciente_errado/);
  });

  it("rejeita card sandbox e status terminal", () => {
    expect(src).toMatch(/card_sandbox/);
    expect(src).toMatch(/card_terminal/);
    expect(src).toMatch(/isCrmTerminal/);
    expect(src).toMatch(/isFunilTerminal/);
  });

  it("resolverClinica canônico e clinica_id no patch", () => {
    expect(src).toMatch(/resolverClinica/);
    expect(src).toMatch(/clinica_desconhecida/);
    expect(src).toMatch(/clinica_id: clinica\.id/);
  });

  it("notificações são aguardadas via Promise.allSettled e reportam notificacoes_ok", () => {
    expect(src).toMatch(/await\s+Promise\.allSettled/);
    expect(src).toMatch(/notificacoes_ok/);
  });

  it("GET público é um health check mínimo (sem tools/headers/config)", () => {
    // Deve ter o payload mínimo e NÃO expor tools/auth_headers/configured/secret_source.
    expect(src).toMatch(/service:\s*"mcp-agendamento"/);
    const getBlock = src.split('req.method === "GET"')[1]?.split("req.method !==")[0] ?? "";
    expect(getBlock).not.toMatch(/auth_headers_accepted/);
    expect(getBlock).not.toMatch(/secret_source/);
    expect(getBlock).not.toMatch(/tools:\s*TOOLS/);
    expect(getBlock).not.toMatch(/configured/);
  });
});

describe("validarDisponibilidade — terminais e timezone Belém", () => {
  const src = read("supabase/functions/_shared/validarDisponibilidade.ts");

  it("exclui terminais uppercase reais (não apenas 'cancelado')", () => {
    expect(src).toMatch(/CANCELADO/);
    expect(src).toMatch(/ATENDIDO/);
    expect(src).toMatch(/COMPARECEU/);
    expect(src).toMatch(/FALTOU/);
    expect(src).toMatch(/EXCLUIDO/);
    // Não deve mais usar o filtro antigo baseado em 'cancelado' minúsculo no SQL.
    expect(src).not.toMatch(/\.not\("status_crm",\s*"in",\s*"\(cancelado\)"\)/);
  });

  it("usa America/Belem (UTC-3) para 'hoje' e margem de 1h", () => {
    expect(src).toMatch(/nowBelemDateStr/);
    expect(src).toMatch(/nowBelemMs/);
    expect(src).toMatch(/hojeBelem/);
    // Comparação nova, sem toISOString().split("T")[0] baseado em UTC.
    expect(src).not.toMatch(/new Date\(\)\.toISOString\(\)\.split\("T"\)\[0\]/);
  });
});

describe("statusTerminais — inclui FALTOU e EXCLUIDO", () => {
  const src = read("supabase/functions/_shared/statusTerminais.ts");
  it("TERMINAIS_CRM cobre 5 status", () => {
    expect(src).toMatch(/"ATENDIDO",\s*"CANCELADO",\s*"COMPARECEU",\s*"FALTOU",\s*"EXCLUIDO"/);
  });
});
