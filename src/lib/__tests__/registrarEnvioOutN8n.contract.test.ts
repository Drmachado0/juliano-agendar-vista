// ============================================================================
// Testes de contrato para registrar-envio-out-n8n.
// Executam em node (vitest) — validamos o body schema e a lista de tipos
// que podem alterar o funil, replicando as regras definidas no index.ts.
// Testes com hit no Supabase real vivem em src/lib/__tests__/*.sql.test.ts.
// ============================================================================
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Espelha o schema do endpoint (mantido em sincronia manualmente)
const BodySchema = z.object({
  telefone: z.string().min(8),
  agendamento_id: z.string().uuid().nullable().optional(),
  conteudo: z.string().optional(),
  tipo_mensagem: z.string().default("bot_agente"),
  canal: z.string().optional(),
  provider: z.string().optional(),
  provider_message_id: z.string().optional().nullable(),
  subscriber_id: z.string().optional().nullable(),
  flow_ns: z.string().optional().nullable(),
  status: z
    .enum(["solicitado", "enviado", "entregue", "lido", "erro"])
    .default("enviado"),
  origem: z.string().optional().nullable(),
  request_id: z.string().optional().nullable(),
  erro: z.string().optional().nullable(),
});

const CONFIRMATION_TYPES = new Set([
  "confirmacao_automatica",
  "confirmacao_consulta",
]);

describe("registrar-envio-out-n8n — body schema", () => {
  it("aceita payload mínimo com defaults corretos", () => {
    const p = BodySchema.parse({ telefone: "5591991150174" });
    expect(p.tipo_mensagem).toBe("bot_agente");
    expect(p.status).toBe("enviado");
  });

  it("rejeita telefone curto", () => {
    expect(() => BodySchema.parse({ telefone: "123" })).toThrow();
  });

  it("aceita status erro e provider_message_id", () => {
    const p = BodySchema.parse({
      telefone: "5591991150174",
      status: "erro",
      provider_message_id: "mc-abc-1",
      erro: "flow failed",
    });
    expect(p.status).toBe("erro");
    expect(p.provider_message_id).toBe("mc-abc-1");
  });

  it("rejeita agendamento_id não-uuid", () => {
    expect(() =>
      BodySchema.parse({ telefone: "5591991150174", agendamento_id: "abc" }),
    ).toThrow();
  });
});

describe("registrar-envio-out-n8n — regras de funil", () => {
  it("bot_agente NÃO pode alterar confirmation_status", () => {
    expect(CONFIRMATION_TYPES.has("bot_agente")).toBe(false);
  });

  it("boas_vindas e manual NÃO podem alterar confirmation_status", () => {
    expect(CONFIRMATION_TYPES.has("boas_vindas")).toBe(false);
    expect(CONFIRMATION_TYPES.has("manual")).toBe(false);
  });

  it("apenas confirmacao_automatica e confirmacao_consulta movem o funil", () => {
    expect(CONFIRMATION_TYPES.has("confirmacao_automatica")).toBe(true);
    expect(CONFIRMATION_TYPES.has("confirmacao_consulta")).toBe(true);
    expect(CONFIRMATION_TYPES.size).toBe(2);
  });
});
