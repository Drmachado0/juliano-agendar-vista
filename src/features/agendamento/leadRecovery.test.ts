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
  email: "maria@exemplo.com",
  data_nascimento: "1960-04-12",
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
      .mockResolvedValueOnce({ lead_id: null, error: new Error("network") })
      .mockResolvedValueOnce({ lead_id: "xyz", error: null });
    const r = await criarLeadComRetry(lead, 0);
    expect(r).toMatchObject({ lead_id: "xyz", error: null, attempts: 2 });
    expect(mocked).toHaveBeenCalledTimes(2);
  });

  it("usa o MESMO event_id nas duas tentativas, para o servidor não duplicar", async () => {
    mocked
      .mockResolvedValueOnce({ lead_id: null, error: new Error("timeout") })
      .mockResolvedValueOnce({ lead_id: "unico", error: null });
    const r = await criarLeadComRetry(lead, 0);

    const primeiroId = mocked.mock.calls[0][0].event_id;
    const segundoId = mocked.mock.calls[1][0].event_id;
    expect(primeiroId).toBeTruthy();
    expect(segundoId).toBe(primeiroId);
    expect(r.lead.event_id).toBe(primeiroId);
    // Duas chamadas com o mesmo identificador resultam num único lead.
    expect(r.lead_id).toBe("unico");
  });

  it("não repete em erro 4xx — a segunda falharia igual", async () => {
    mocked.mockResolvedValueOnce({
      lead_id: null,
      error: new Error("Campos obrigatórios faltando"),
      status: 400,
    });
    const r = await criarLeadComRetry(lead, 0);
    expect(r.attempts).toBe(1);
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it("devolve o erro e o status quando as duas falham", async () => {
    mocked.mockResolvedValue({ lead_id: null, error: new Error("500"), status: 500 });
    const r = await criarLeadComRetry(lead, 0);
    expect(r.error).toBeInstanceOf(Error);
    expect(r).toMatchObject({ status: 500, attempts: 2 });
  });
});

describe("persistência local", () => {
  it("guarda só o necessário — sem e-mail nem data de nascimento", () => {
    savePendingLead({ ...lead, event_id: "evt-1" });
    const guardado = loadPendingLead();
    expect(guardado?.lead).toMatchObject({ nome_completo: "Maria Souza", event_id: "evt-1" });
    expect(guardado?.lead).not.toHaveProperty("email");
    expect(guardado?.lead).not.toHaveProperty("data_nascimento");
    expect(localStorage.getItem(PENDING_LEAD_STORAGE_KEY)).not.toContain("maria@exemplo.com");
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

  it("reenvia com o event_id original e limpa ao dar certo", async () => {
    savePendingLead({ ...lead, event_id: "evt-2" });
    mocked.mockResolvedValueOnce({ lead_id: "ok", error: null });
    await expect(retryPendingLead()).resolves.toBe(true);
    expect(mocked.mock.calls[0][0].event_id).toBe("evt-2");
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
