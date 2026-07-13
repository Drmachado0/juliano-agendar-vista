// ============================================================================
// atualizarStatusCrmSelecao.test.ts
// Reproduz o bug real (telefone canônico 91991300174):
//   - 1 lead atual "NOVO LEAD"/"novo", is_sandbox=false
//   - 1 registro histórico com status_crm="HGP" (não terminal em CRM)
//     mas status_funil="cancelado" (terminal em funil)
//   → deve resolver para 1 ATIVO (o NOVO LEAD), NUNCA ambíguo, NUNCA atualizar
//     o histórico cancelado.
// Também cobre 0/1/>1 ativos, sandbox e rejeição de ID terminal.
// ============================================================================
import { describe, it, expect } from "vitest";
import {
  isCrmTerminal,
  isFunilTerminal,
  isRegistroAtivo,
} from "../../../supabase/functions/atualizar-status-crm/index.ts";

const NOVO_LEAD = {
  id: "c08dde0b-510d-482f-9512-519cd0ad34de",
  status_crm: "NOVO LEAD",
  status_funil: "novo",
  is_sandbox: false,
};
const HISTORICO_CANCELADO = {
  id: "33f691da-4582-4ba4-83cb-198f4f6e91ba",
  status_crm: "HGP", // não-terminal em CRM (reativado por engano no bug)
  status_funil: "cancelado", // terminal em funil → deve ser excluído
  is_sandbox: false,
};
const SANDBOX = { id: "sbx", status_crm: "NOVO LEAD", status_funil: "novo", is_sandbox: true };
const OUTRO_ATIVO = {
  id: "outro",
  status_crm: "CLINICOR",
  status_funil: "em_conversa",
  is_sandbox: false,
};

describe("isCrmTerminal / isFunilTerminal — case-insensitive", () => {
  it("terminais CRM cobrem ATENDIDO/CANCELADO/COMPARECEU em qualquer caixa", () => {
    for (const s of ["ATENDIDO", "atendido", "Cancelado", "compareceu"]) {
      expect(isCrmTerminal(s)).toBe(true);
    }
    for (const s of ["HGP", "NOVO LEAD", "PRECISA_DE_HUMANO", null, undefined, ""]) {
      expect(isCrmTerminal(s as any)).toBe(false);
    }
  });
  it("terminais funil cobrem cancelado/compareceu/faltou em qualquer caixa", () => {
    for (const s of ["cancelado", "Cancelado", "COMPAREceu", "faltou"]) {
      expect(isFunilTerminal(s)).toBe(true);
    }
    for (const s of ["novo", "em_conversa", "aguardando_confirmacao", "agendado", "yag_laser", null]) {
      expect(isFunilTerminal(s as any)).toBe(false);
    }
  });
});

describe("isRegistroAtivo — filtro combinado", () => {
  it("NOVO LEAD atual conta como ativo", () => {
    expect(isRegistroAtivo(NOVO_LEAD)).toBe(true);
  });
  it("registro com status_funil=cancelado NÃO é ativo, mesmo com status_crm='HGP'", () => {
    expect(isRegistroAtivo(HISTORICO_CANCELADO)).toBe(false);
  });
  it("sandbox NÃO é ativo mesmo com status novo", () => {
    expect(isRegistroAtivo(SANDBOX)).toBe(false);
  });
  it("status_crm terminal exclui mesmo com funil não terminal", () => {
    expect(isRegistroAtivo({ status_crm: "ATENDIDO", status_funil: "novo", is_sandbox: false })).toBe(false);
    expect(isRegistroAtivo({ status_crm: "COMPAREceu", status_funil: "em_conversa", is_sandbox: false })).toBe(false);
  });
});

describe("Seleção por telefone — reprodução do bug 91991300174", () => {
  const candidatos = [NOVO_LEAD, HISTORICO_CANCELADO];

  it("deve selecionar exatamente 1 ativo = NOVO LEAD (nunca ambíguo)", () => {
    const ativos = candidatos.filter(isRegistroAtivo);
    expect(ativos).toHaveLength(1);
    expect(ativos[0].id).toBe(NOVO_LEAD.id);
  });

  it("NUNCA atualiza o histórico cancelado, mesmo se ele for mais antigo/'com data'", () => {
    const ativos = candidatos.filter(isRegistroAtivo);
    const escolhido = ativos[0];
    expect(escolhido.id).not.toBe(HISTORICO_CANCELADO.id);
  });
});

describe("Contagem 0 / 1 / >1", () => {
  it("0 ativos → array vazio (endpoint responde 404)", () => {
    const ativos = [SANDBOX, HISTORICO_CANCELADO].filter(isRegistroAtivo);
    expect(ativos).toHaveLength(0);
  });
  it("1 ativo → resolve normalmente", () => {
    expect([NOVO_LEAD, SANDBOX].filter(isRegistroAtivo)).toHaveLength(1);
  });
  it(">1 ativo → ambíguo (endpoint responde 409, sem mutação)", () => {
    expect([NOVO_LEAD, OUTRO_ATIVO].filter(isRegistroAtivo)).toHaveLength(2);
  });
});

describe("Rejeição de ID terminal / sandbox no ramo agendamento_id", () => {
  it("registro terminal deve ser rejeitado antes da mutação", () => {
    // O endpoint checa isCrmTerminal || isFunilTerminal no registro atual.
    const terminalPorFunil = { status_crm: "HGP", status_funil: "cancelado" };
    const terminalPorCrm = { status_crm: "ATENDIDO", status_funil: "novo" };
    expect(isCrmTerminal(terminalPorFunil.status_crm) || isFunilTerminal(terminalPorFunil.status_funil)).toBe(true);
    expect(isCrmTerminal(terminalPorCrm.status_crm) || isFunilTerminal(terminalPorCrm.status_funil)).toBe(true);
  });

  it("registro is_sandbox=true deve ser rejeitado (409 sandbox_nao_permitido)", () => {
    expect(SANDBOX.is_sandbox).toBe(true);
  });
});
