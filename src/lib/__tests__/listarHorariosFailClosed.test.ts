// ============================================================================
// Fail-closed em listarHorariosDisponiveis: erro em bloqueios_agenda ou em
// agendamentos NÃO pode virar lista vazia silenciosa e nem "todos os slots
// livres". A função retorna [] e loga o código, sem PII.
// ============================================================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listarHorariosDisponiveis } from "../../../supabase/functions/_shared/validarDisponibilidade.ts";

// Mock builder mínimo — só o subset usado pela função.
type Row = Record<string, any>;
function makeSupabase(handlers: {
  disponibilidade_especifica?: () => Promise<{ data: Row[] | null; error: any }>;
  disponibilidade_semanal?: () => Promise<{ data: Row[] | null; error: any }>;
  bloqueios_agenda?: () => Promise<{ data: Row[] | null; error: any }>;
  agendamentos?: () => Promise<{ data: Row[] | null; error: any }>;
}) {
  const build = (table: string) => {
    const chain: any = {
      _table: table,
      select: () => chain,
      eq: () => chain,
      neq: () => chain,
      in: () => chain,
      then: (resolve: any, reject: any) => {
        const h = (handlers as any)[table];
        if (!h) return resolve({ data: [], error: null });
        return h().then(resolve, reject);
      },
    };
    return chain;
  };
  return { from: (t: string) => build(t) } as any;
}

// disp_especifica com uma clínica válida e slots 09:00-10:00, intervalo 30.
const DISP_OK = [
  {
    clinica_id: "657e4784-e292-45c6-a033-40f3d115f984",
    hora_inicio: "09:00",
    hora_fim: "10:00",
    intervalo_minutos: 30,
    clinicas: { id: "657e4784-e292-45c6-a033-40f3d115f984", nome: "Clinicor – Paragominas" },
  },
];

let errSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { errSpy = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); });

describe("listarHorariosDisponiveis — fail-closed", () => {
  const dataFutura = "2099-01-15";

  it("caso feliz: retorna os slots quando não há erros", async () => {
    const supa = makeSupabase({
      disponibilidade_especifica: async () => ({ data: DISP_OK, error: null }),
      bloqueios_agenda: async () => ({ data: [], error: null }),
      agendamentos: async () => ({ data: [], error: null }),
    });
    const slots = await listarHorariosDisponiveis(supa, dataFutura, "Clinicor");
    expect(slots.length).toBeGreaterThan(0);
  });

  it("erro em bloqueios_agenda → retorna [] e loga código sanitizado", async () => {
    const supa = makeSupabase({
      disponibilidade_especifica: async () => ({ data: DISP_OK, error: null }),
      bloqueios_agenda: async () => ({ data: null, error: { code: "PGRST500", message: "boom PII" } }),
      agendamentos: async () => ({ data: [], error: null }),
    });
    const slots = await listarHorariosDisponiveis(supa, dataFutura, "Clinicor");
    expect(slots).toEqual([]);
    expect(errSpy).toHaveBeenCalled();
    const logged = errSpy.mock.calls.flat().map(String).join("|");
    expect(logged).toMatch(/bloqueios_err/);
    expect(logged).not.toMatch(/boom PII/);
  });

  it("erro em agendamentos → retorna [] e loga código sanitizado", async () => {
    const supa = makeSupabase({
      disponibilidade_especifica: async () => ({ data: DISP_OK, error: null }),
      bloqueios_agenda: async () => ({ data: [], error: null }),
      agendamentos: async () => ({ data: null, error: { code: "PGRST501", message: "leak 999" } }),
    });
    const slots = await listarHorariosDisponiveis(supa, dataFutura, "Clinicor");
    expect(slots).toEqual([]);
    const logged = errSpy.mock.calls.flat().map(String).join("|");
    expect(logged).toMatch(/agendamentos_err/);
    expect(logged).not.toMatch(/leak 999/);
  });
});
