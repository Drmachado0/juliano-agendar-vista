import { describe, it, expect, vi, beforeEach } from "vitest";
import { criarLead } from "@/services/leads";
import {
  PENDING_LEAD_STORAGE_KEY,
  buildFallbackWhatsAppMessage,
  clearPendingLead,
  criarLeadComRetry,
  loadPendingLead,
  retryPendingLead,
  savePendingLead,
} from "./leadRecovery";

vi.mock("@/services/leads", () => ({ criarLead: vi.fn() }));

const lead = {
  nome_completo: "Maria Souza",
  telefone_whatsapp: "91988887777",
  tipo_atendimento: "Consulta",
  local_atendimento: "Clinicor – Paragominas",
  convenio: "Particular",
};

const mocked = vi.mocked(criarLead);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("criarLeadComRetry", () => {
  it("não tenta de novo quando a primeira chamada dá certo", async () => {
    mocked.mockResolvedValueOnce({ lead_id: "abc", error: null });
    const r = await criarLeadComRetry(lead, 0);
    expect(r).toMatchObject({ lead_id: "abc", attempts: 1 });
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it("tenta uma segunda vez e aproveita o sucesso", async () => {
    mocked
      .mockResolvedValueOnce({ lead_id: null, error: new Error("network"), status: 0 })
      .mockResolvedValueOnce({ lead_id: "xyz", error: null });
    const r = await criarLeadComRetry(lead, 0);
    expect(r).toMatchObject({ lead_id: "xyz", error: null, attempts: 2 });
    expect(mocked).toHaveBeenCalledTimes(2);
  });

  it("devolve o erro e o status quando as duas falham", async () => {
    mocked.mockResolvedValue({ lead_id: null, error: new Error("500"), status: 500 });
    const r = await criarLeadComRetry(lead, 0);
    expect(r.error).toBeInstanceOf(Error);
    expect(r).toMatchObject({ status: 500, attempts: 2 });
  });
});

describe("persistência local", () => {
  it("guarda, lê e limpa o lead pendente", () => {
    savePendingLead(lead);
    expect(loadPendingLead()?.lead.nome_completo).toBe("Maria Souza");
    clearPendingLead();
    expect(loadPendingLead()).toBeNull();
  });

  it("descarta lead guardado há mais de uma semana", () => {
    localStorage.setItem(
      PENDING_LEAD_STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, lead }),
    );
    expect(loadPendingLead()).toBeNull();
    expect(localStorage.getItem(PENDING_LEAD_STORAGE_KEY)).toBeNull();
  });

  it("reenvia em segundo plano e limpa ao dar certo", async () => {
    savePendingLead(lead);
    mocked.mockResolvedValueOnce({ lead_id: "ok", error: null });
    await expect(retryPendingLead()).resolves.toBe(true);
    expect(loadPendingLead()).toBeNull();
  });

  it("mantém o guardado quando o reenvio falha", async () => {
    savePendingLead(lead);
    mocked.mockResolvedValueOnce({ lead_id: null, error: new Error("offline") });
    await expect(retryPendingLead()).resolves.toBe(false);
    expect(loadPendingLead()).not.toBeNull();
  });
});

describe("buildFallbackWhatsAppMessage", () => {
  it("inclui só os campos preenchidos", () => {
    const msg = buildFallbackWhatsAppMessage({
      nome: "Maria Souza",
      telefone: "91988887777",
      tipoAtendimento: "Consulta",
      local: "Clinicor – Paragominas",
      convenio: "Unimed",
      data: "25/09/2026",
    });
    expect(msg).toContain("Nome: Maria Souza");
    expect(msg).toContain("Data desejada: 25/09/2026");
    expect(msg).not.toContain("Horário desejado");
  });
});
