import { describe, it, expect } from "vitest";
// O modulo vive em supabase/functions/_shared para rodar no Deno, mas e
// TypeScript puro e sem imports externos — da para exercita-lo aqui.
import { montarEventIdConfirmacao } from "../../../supabase/functions/_shared/eventIdConfirmacao";

describe("event_id do disparo de confirmacao", () => {
  it("mantem o id estavel quando ha agendamento", () => {
    // Reenviar a confirmacao do MESMO agendamento deve ser reconhecido como o
    // mesmo evento — a estabilidade aqui e proposital.
    const id = "0a4c2a1e-9d3b-4f77-8f2a-1b2c3d4e5f60";
    expect(montarEventIdConfirmacao(id)).toBe(`${id}:confirmacao_imediata`);
    expect(montarEventIdConfirmacao(id)).toBe(montarEventIdConfirmacao(id));
  });

  it("nao repete o mesmo id quando nao ha agendamento", () => {
    // Antes o valor era a literal `sem_id:confirmacao_imediata` em TODA chamada
    // avulsa: a deduplicacao por event_id descartava o 2o disparo em diante.
    const a = montarEventIdConfirmacao(null);
    const b = montarEventIdConfirmacao(undefined);
    const c = montarEventIdConfirmacao("");
    const d = montarEventIdConfirmacao("   ");

    expect(new Set([a, b, c, d]).size).toBe(4);
    for (const v of [a, b, c, d]) {
      expect(v).not.toBe("sem_id:confirmacao_imediata");
      expect(v).toMatch(/^sem_id:.+:confirmacao_imediata$/);
    }
  });

  it("aceita gerador injetado para o teste fixar o valor", () => {
    expect(montarEventIdConfirmacao(null, () => "FIXO")).toBe(
      "sem_id:FIXO:confirmacao_imediata",
    );
  });
});
