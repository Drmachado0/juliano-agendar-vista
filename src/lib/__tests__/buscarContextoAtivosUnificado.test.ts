// ============================================================================
// Regressão do bug 91991300174 (2026-07-14):
// buscar-contexto-paciente contava como "ativo" um registro com
// status_crm='HGP' + status_funil='cancelado', gerando ambiguo=true.
// Fix: unificar critério via _shared/statusTerminais.isRegistroAtivo.
// ============================================================================
import { describe, it, expect } from "vitest";
import {
  isRegistroAtivo,
  isCrmTerminal,
  isFunilTerminal,
} from "../../../supabase/functions/_shared/statusTerminais.ts";

const HGP_CANCELADO = {
  id: "ff5ee055-58fe-40ca-a7df-3ddcdd661177",
  status_crm: "HGP",
  status_funil: "cancelado",
  is_sandbox: false,
};
const NOVO_LEAD_HUMANO = {
  id: "24bd6d23-115b-47b5-91f0-6485015ccb97",
  status_crm: "PRECISA_DE_HUMANO",
  status_funil: "novo",
  is_sandbox: false,
};

describe("buscar-contexto — critério ativo unificado", () => {
  it("HGP/cancelado NÃO conta como ativo (bug 91991300174)", () => {
    expect(isRegistroAtivo(HGP_CANCELADO)).toBe(false);
    // motivo: funil é terminal, mesmo com CRM não terminal
    expect(isCrmTerminal("HGP")).toBe(false);
    expect(isFunilTerminal("cancelado")).toBe(true);
  });

  it("par HGP/cancelado + PRECISA_DE_HUMANO/novo → exatamente 1 ativo, não ambíguo", () => {
    const ativos = [HGP_CANCELADO, NOVO_LEAD_HUMANO].filter(isRegistroAtivo);
    expect(ativos).toHaveLength(1);
    expect(ativos[0].id).toBe(NOVO_LEAD_HUMANO.id);
  });

  it("regressão simétrica: ATENDIDO/novo (terminal por CRM) não é ativo", () => {
    expect(isRegistroAtivo({ status_crm: "ATENDIDO", status_funil: "novo" })).toBe(false);
  });

  it("regressão simétrica: HGP/faltou (terminal por funil) não é ativo", () => {
    expect(isRegistroAtivo({ status_crm: "HGP", status_funil: "faltou" })).toBe(false);
  });

  it("case-insensitive: cancelado/CANCELADO/Cancelado equivalentes", () => {
    for (const s of ["cancelado", "CANCELADO", "Cancelado"]) {
      expect(isFunilTerminal(s)).toBe(true);
    }
  });
});
