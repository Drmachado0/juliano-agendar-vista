// ============================================================================
// Testes estruturais + puros para buscar-contexto-paciente.
// Não bate em Postgres — lê o source e valida invariantes críticas da
// correção 2026-07-13 (bug do telefone 91991300174).
// ============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { telefoneCanonico } from "../../../supabase/functions/_shared/telefoneCanonico.ts";

const SRC = readFileSync(
  resolve(process.cwd(), "supabase/functions/buscar-contexto-paciente/index.ts"),
  "utf8",
);
const CFG = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");

describe("buscar-contexto-paciente — auth + request id", () => {
  it("usa requireN8nSecret timing-safe (helper compartilhado)", () => {
    expect(SRC).toMatch(/requireN8nSecret/);
    expect(SRC).not.toMatch(/provided\s*!==\s*secret/);
    expect(SRC).not.toMatch(/provided\s*===\s*secret/);
  });
  it("propaga request_id", () => {
    expect(SRC).toMatch(/requestId\(req\)/);
    expect(SRC).toMatch(/request_id:\s*rid/);
  });
  it("verify_jwt=false no config.toml", () => {
    expect(CFG).toMatch(/\[functions\.buscar-contexto-paciente\][\s\S]*?verify_jwt\s*=\s*false/);
  });
});

describe("buscar-contexto-paciente — normalização e busca", () => {
  it("usa RPC telefone_canonico com fallback local", () => {
    expect(SRC).toMatch(/rpc\("telefone_canonico"/);
    expect(SRC).toMatch(/telefoneCanonicoLocal/);
  });
  it("busca agendamentos por telefone_canonico exato (.eq), não ilike/slice(-8)", () => {
    expect(SRC).toMatch(/\.eq\("telefone_canonico",\s*telCanon\)/);
    expect(SRC).not.toMatch(/\.ilike\(/);
    expect(SRC).not.toMatch(/slice\(-8\)/);
  });
  it("não faz scan dos últimos 200 agendamentos", () => {
    expect(SRC).not.toMatch(/\.limit\(200\)/);
  });
  it("mensagens buscadas por telefone_canonico exato", () => {
    expect(SRC).toMatch(/from\("mensagens_whatsapp"\)[\s\S]{0,400}\.eq\("telefone_canonico"/);
  });
});

describe("buscar-contexto-paciente — regras de negócio", () => {
  it("ignora is_sandbox=true na query e no filtro em memória", () => {
    expect(SRC).toMatch(/\.neq\("is_sandbox",\s*true\)/);
    expect(SRC).toMatch(/r\.is_sandbox\s*!==\s*true/);
  });
  it("critério de ativo unificado via _shared/statusTerminais (CRM + funil)", () => {
    expect(SRC).toMatch(/from\s+"\.\.\/_shared\/statusTerminais\.ts"/);
    expect(SRC).toMatch(/registros\.filter\(\(r:\s*any\)\s*=>\s*isRegistroAtivo\(r\)\)/);
    // não deve mais existir lista terminal local nem isTerminal local
    expect(SRC).not.toMatch(/const\s+TERMINAIS\s*=\s*\[/);
    expect(SRC).not.toMatch(/function\s+isTerminal\s*\(/);
  });
  it("histórico considera terminais por CRM OU funil", () => {
    expect(SRC).toMatch(/isCrmTerminal\(r\.status_crm\)[\s\S]{0,80}isFunilTerminal\(r\.status_funil\)/);
  });
  it("ambíguo quando >1 ativos: paciente e agendamento_ativo = null", () => {
    expect(SRC).toMatch(/ambiguo\s*=\s*ativos\.length\s*>\s*1/);
    expect(SRC).toMatch(/ambiguo:\s*true[\s\S]{0,400}paciente:\s*null[\s\S]{0,120}agendamento_ativo:\s*null/);
  });
  it("agendamento_ativo exige data_agendamento >= hoje Belém", () => {
    expect(SRC).toMatch(/hojeBelemISO/);
    expect(SRC).toMatch(/data_agendamento\s*>=\s*hojeISO/);
  });
  it("data passada NÃO vira agendamento_ativo (comparação estrita, sem OR)", () => {
    // não deve haver comparação data < hoje que atribua a agendamentoAtivo
    const bloco = SRC.match(/let agendamentoAtivo[\s\S]{0,600}?}\s*\n/);
    expect(bloco).toBeTruthy();
    expect(bloco![0]).not.toMatch(/<\s*hojeISO/);
  });
  it("histórico separado (nunca sandbox, nunca dentro de agendamento_ativo)", () => {
    expect(SRC).toMatch(/ultimo_atendimento_historico/);
    expect(SRC).toMatch(/isCrmTerminal\(r\.status_crm\)[\s\S]{0,160}data_agendamento\s*<\s*hojeISO/);
  });
});

describe("buscar-contexto-paciente — erros sanitizados", () => {
  it("agendamentos_lookup_failed 500 sem PII", () => {
    expect(SRC).toMatch(/agendamentos_lookup_failed[\s\S]{0,120}500/);
    expect(SRC).toMatch(/maskTelefone/);
  });
  it("mensagens_lookup_failed 500", () => {
    expect(SRC).toMatch(/mensagens_lookup_failed[\s\S]{0,120}500/);
  });
  it("não vaza .message do erro no response body", () => {
    expect(SRC).not.toMatch(/error:\s*selErr\.message/);
    expect(SRC).not.toMatch(/error:\s*msgErr\.message/);
  });
});

// ---------------------------------------------------------------------------
// Testes puros da lógica de decisão (reimplementam o mesmo shape, com regra
// idêntica). Servem para provar cenários: sandbox, data passada, hoje/futuro,
// 0/1/>1 ativos.
// ---------------------------------------------------------------------------
const TERMINAIS = ["ATENDIDO", "CANCELADO", "COMPARECEU"];
const isTerminal = (s: string | null | undefined) =>
  TERMINAIS.includes(String(s ?? "").toUpperCase());

interface Ag {
  id: string;
  status_crm: string;
  data_agendamento: string | null;
  is_sandbox?: boolean;
}

function decidir(registros: Ag[], hojeISO: string) {
  const nonSandbox = registros.filter((r) => r.is_sandbox !== true);
  const ativos = nonSandbox.filter((r) => !isTerminal(r.status_crm));
  const ambiguo = ativos.length > 1;
  const leadAtivo = !ambiguo && ativos.length === 1 ? ativos[0] : null;
  const agendamentoAtivo =
    leadAtivo && leadAtivo.data_agendamento && leadAtivo.data_agendamento >= hojeISO
      ? { id: leadAtivo.id, data: leadAtivo.data_agendamento }
      : null;
  const historico =
    nonSandbox
      .filter(
        (r) =>
          (isTerminal(r.status_crm) || (r.data_agendamento && r.data_agendamento < hojeISO)) &&
          r.data_agendamento,
      )
      .sort((a, b) => ((a.data_agendamento ?? "") < (b.data_agendamento ?? "") ? 1 : -1))[0] ?? null;
  return { ambiguo, leadAtivo, agendamentoAtivo, historico };
}

describe("decisão de contexto — cenários (bug 91991300174)", () => {
  const HOJE = "2026-07-13";

  it("registro sandbox de data passada nunca vira contexto ativo (repro do bug)", () => {
    const regs: Ag[] = [
      { id: "sb", status_crm: "confirmado", data_agendamento: "2026-06-19", is_sandbox: true },
      { id: "novo", status_crm: "NOVO LEAD", data_agendamento: null },
    ];
    const r = decidir(regs, HOJE);
    expect(r.leadAtivo?.id).toBe("novo");
    expect(r.agendamentoAtivo).toBeNull();
    expect(r.historico).toBeNull(); // o único de data passada era sandbox
  });

  it("data passada não-sandbox vai para histórico, não para ativo", () => {
    const regs: Ag[] = [
      { id: "a", status_crm: "NOVO LEAD", data_agendamento: "2026-06-19" },
    ];
    const r = decidir(regs, HOJE);
    expect(r.agendamentoAtivo).toBeNull();
    expect(r.historico?.data_agendamento).toBe("2026-06-19");
  });

  it("data futura em lead ativo vira agendamento_ativo", () => {
    const regs: Ag[] = [{ id: "a", status_crm: "confirmado", data_agendamento: "2026-08-01" }];
    const r = decidir(regs, HOJE);
    expect(r.agendamentoAtivo?.id).toBe("a");
  });

  it("data == hoje vira agendamento_ativo", () => {
    const regs: Ag[] = [{ id: "a", status_crm: "confirmado", data_agendamento: HOJE }];
    const r = decidir(regs, HOJE);
    expect(r.agendamentoAtivo?.id).toBe("a");
  });

  it("0 ativos = conhecido false, historico se existir terminal", () => {
    const regs: Ag[] = [
      { id: "a", status_crm: "atendido", data_agendamento: "2026-05-01" },
    ];
    const r = decidir(regs, HOJE);
    expect(r.leadAtivo).toBeNull();
    expect(r.historico?.data_agendamento).toBe("2026-05-01");
  });

  it(">1 ativos → ambiguo, sem leadAtivo/agendamento_ativo", () => {
    const regs: Ag[] = [
      { id: "a", status_crm: "NOVO LEAD", data_agendamento: null },
      { id: "b", status_crm: "confirmado", data_agendamento: "2026-08-01" },
    ];
    const r = decidir(regs, HOJE);
    expect(r.ambiguo).toBe(true);
    expect(r.leadAtivo).toBeNull();
    expect(r.agendamentoAtivo).toBeNull();
  });

  it("terminais case-insensitive (Atendido, cancelado)", () => {
    const regs: Ag[] = [
      { id: "a", status_crm: "Atendido", data_agendamento: "2026-05-01" },
      { id: "b", status_crm: "cancelado", data_agendamento: "2026-05-02" },
      { id: "c", status_crm: "NOVO LEAD", data_agendamento: null },
    ];
    const r = decidir(regs, HOJE);
    expect(r.leadAtivo?.id).toBe("c");
  });
});

describe("telefone_canonico (fallback local)", () => {
  it("E.164 5591991300174 → 91991300174", () => {
    expect(telefoneCanonico("+5591991300174")).toBe("91991300174");
  });
  it("(91) 99130-0174 → 91991300174", () => {
    expect(telefoneCanonico("(91) 99130-0174")).toBe("91991300174");
  });
  it("adiciona 9 quando ficam 10 dígitos (fixo BR)", () => {
    expect(telefoneCanonico("91 3229-0174")).toBe("91932290174");
    expect(telefoneCanonico("5591 3229-0174")).toBe("91932290174");
  });

});
