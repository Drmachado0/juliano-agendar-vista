import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfDay, isBefore, isSameDay } from "date-fns";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export interface DataComSlots {
  data: Date;
  slotsDisponiveis: number;
}

export interface SlotDisponivel {
  horario: string;
  disponivel: boolean;
}

export interface HorarioAlternativo {
  data: Date;
  horario: string;
  distanciaLabel: string;
}

// ─────────────────────────────────────────────
// Mapeamento Local → Clínica (mantido)
// ─────────────────────────────────────────────
export function getClinicaSlugsFromLocal(localAtendimento?: string): string[] {
  if (!localAtendimento) return [];
  const local = localAtendimento.toLowerCase();
  if (local.includes("clinicor")) return ["clinicor"];
  if (local.includes("hgp") || local.includes("hospital geral")) return ["hgp"];
  if (
    local.includes("belem") ||
    local.includes("belém") ||
    local.includes("iob") ||
    local.includes("vitria")
  )
    return ["iob", "vitria"];
  return [];
}

export async function buscarClinicaIdsPorSlugs(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const { data, error } = await supabase
    .from("clinicas")
    .select("id")
    .in("slug", slugs)
    .eq("ativo", true);
  if (error || !data) return [];
  return data.map((c) => c.id);
}

async function resolverClinicaIds(localAtendimento?: string): Promise<string[]> {
  const slugs = getClinicaSlugsFromLocal(localAtendimento);
  return buscarClinicaIdsPorSlugs(slugs);
}

// ─────────────────────────────────────────────
// Wrappers das RPCs novas
// ─────────────────────────────────────────────
async function rpcGetAvailableDays(
  mes: number,
  ano: number,
  clinicaId: string
): Promise<{ data: string; total_slots: number; slots_livres: number }[]> {
  // get_available_days espera mes 1-12; date-fns usa 0-11
  const { data, error } = await supabase.rpc("get_available_days", {
    p_month: mes + 1,
    p_year: ano,
    p_clinica_id: clinicaId,
  });
  if (error) {
    console.error("get_available_days error:", error);
    return [];
  }
  return (data as any[]) || [];
}

async function rpcGetAvailableSlots(
  dataISO: string,
  clinicaId: string
): Promise<{ hora: string; status: "livre" | "ocupado" | "bloqueado" }[]> {
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_data: dataISO,
    p_clinica_id: clinicaId,
  });
  if (error) {
    console.error("get_available_slots error:", error);
    return [];
  }
  return (data as any[]) || [];
}

async function rpcGetNextAvailableSlot(
  clinicaId: string,
  fromISO?: string
): Promise<{ data: string; hora: string } | null> {
  const { data, error } = await supabase.rpc("get_next_available_slot", {
    p_clinica_id: clinicaId,
    p_from: fromISO ?? null,
  });
  if (error) {
    console.error("get_next_available_slot error:", error);
    return null;
  }
  const arr = (data as any[]) || [];
  return arr[0] ?? null;
}

// ─────────────────────────────────────────────
// API pública (mantém assinaturas)
// ─────────────────────────────────────────────

/** Lista todas as datas abertas do mês (com slots livres > 0), considerando 1+ clínicas. */
export async function listarDatasComSlotsDisponiveis(
  mes: number,
  ano: number,
  localAtendimento?: string
): Promise<DataComSlots[]> {
  const clinicaIds = await resolverClinicaIds(localAtendimento);
  if (clinicaIds.length === 0) return [];

  // Roda em paralelo por clínica e une por data (somando livres).
  const resultados = await Promise.all(
    clinicaIds.map((cid) => rpcGetAvailableDays(mes, ano, cid))
  );

  const map = new Map<string, number>();
  for (const lista of resultados) {
    for (const row of lista) {
      const acumulado = map.get(row.data) ?? 0;
      map.set(row.data, acumulado + (row.slots_livres ?? 0));
    }
  }

  const out: DataComSlots[] = [];
  for (const [dataISO, livres] of map.entries()) {
    if (livres > 0) {
      // ISO date "YYYY-MM-DD" → Date local sem time-zone shift
      const [y, m, d] = dataISO.split("-").map(Number);
      out.push({ data: new Date(y, m - 1, d), slotsDisponiveis: livres });
    }
  }
  out.sort((a, b) => a.data.getTime() - b.data.getTime());
  return out;
}

/** Gera horários disponíveis (status=livre) para um dia, unindo várias clínicas. */
export async function gerarHorariosDisponiveis(
  data: Date,
  localAtendimento?: string
): Promise<SlotDisponivel[]> {
  const hoje = new Date();
  if (isBefore(startOfDay(data), startOfDay(hoje))) return [];

  const clinicaIds = await resolverClinicaIds(localAtendimento);
  if (clinicaIds.length === 0) return [];

  const dataISO = format(data, "yyyy-MM-dd");
  const resultados = await Promise.all(
    clinicaIds.map((cid) => rpcGetAvailableSlots(dataISO, cid))
  );

  // União dos horários livres (deduplicado)
  const livres = new Set<string>();
  for (const lista of resultados) {
    for (const slot of lista) {
      if (slot.status === "livre") {
        livres.add(slot.hora.slice(0, 5));
      }
    }
  }

  return Array.from(livres)
    .sort()
    .map((h) => ({ horario: h, disponivel: true }));
}

/** Próximo horário livre olhando até 90 dias. */
export async function buscarProximoHorarioLivre(
  dataReferencia: Date,
  localAtendimento?: string
): Promise<{ data: Date; horario: string } | null> {
  const clinicaIds = await resolverClinicaIds(localAtendimento);
  if (clinicaIds.length === 0) return null;

  const fromISO = format(startOfDay(dataReferencia), "yyyy-MM-dd");
  const resultados = await Promise.all(
    clinicaIds.map((cid) => rpcGetNextAvailableSlot(cid, fromISO))
  );

  const validos = resultados.filter((r): r is { data: string; hora: string } => !!r);
  if (validos.length === 0) return null;

  // pega o mais cedo (data, hora)
  validos.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const escolhido = validos[0];
  const [y, m, d] = escolhido.data.split("-").map(Number);
  return {
    data: new Date(y, m - 1, d),
    horario: escolhido.hora.slice(0, 5),
  };
}

/** Compatibilidade. */
export async function listarDatasComDisponibilidade(
  mes: number,
  ano: number,
  localAtendimento?: string
): Promise<Date[]> {
  const r = await listarDatasComSlotsDisponiveis(mes, ano, localAtendimento);
  return r.map((x) => x.data);
}

export async function verificarDataTemDisponibilidade(
  data: Date,
  localAtendimento?: string
): Promise<boolean> {
  const slots = await gerarHorariosDisponiveis(data, localAtendimento);
  return slots.length > 0;
}

// ─────────────────────────────────────────────
// Alternativas próximas (Etapa 3)
// ─────────────────────────────────────────────
function horarioParaMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function rotuloDistanciaMesmoDia(horarioRef: string, horarioAlt: string): string {
  const diffMin = horarioParaMinutos(horarioAlt) - horarioParaMinutos(horarioRef);
  if (diffMin === 0) return "Mesmo horário";
  const abs = Math.abs(diffMin);
  const horas = Math.floor(abs / 60);
  const mins = abs % 60;
  let qty = "";
  if (horas > 0) qty += `${horas}h`;
  if (mins > 0) qty += `${horas > 0 ? " " : ""}${mins}min`;
  return `Mesmo dia · ${qty} ${diffMin > 0 ? "depois" : "antes"}`;
}

function rotuloDistanciaDias(diasDiff: number): string {
  if (diasDiff === 1) return "Próximo dia útil";
  return `Em ${diasDiff} dias`;
}

export async function buscarHorariosAlternativos(
  dataRef: Date,
  horarioRef: string | null,
  localAtendimento?: string,
  limite: number = 3
): Promise<HorarioAlternativo[]> {
  const resultado: HorarioAlternativo[] = [];
  const dataInicio = startOfDay(dataRef);

  if (horarioRef) {
    const slotsMesmoDia = await gerarHorariosDisponiveis(dataInicio, localAtendimento);
    const refMin = horarioParaMinutos(horarioRef);
    const ordenados = slotsMesmoDia
      .filter((s) => s.horario !== horarioRef)
      .map((s) => ({ slot: s, diff: Math.abs(horarioParaMinutos(s.horario) - refMin) }))
      .sort((a, b) => a.diff - b.diff);

    if (ordenados.length > 0) {
      const escolhido = ordenados[0].slot;
      resultado.push({
        data: dataInicio,
        horario: escolhido.horario,
        distanciaLabel: rotuloDistanciaMesmoDia(horarioRef, escolhido.horario),
      });
    }
  }

  let dataAtual = addDays(dataInicio, 1);
  const maxDias = 60;
  let tentativas = 0;
  while (resultado.length < limite && tentativas < maxDias) {
    const slots = await gerarHorariosDisponiveis(dataAtual, localAtendimento);
    if (slots.length > 0) {
      const diffDias = Math.round(
        (dataAtual.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24)
      );
      resultado.push({
        data: dataAtual,
        horario: slots[0].horario,
        distanciaLabel: rotuloDistanciaDias(diffDias),
      });
    }
    dataAtual = addDays(dataAtual, 1);
    tentativas++;
  }

  return resultado.slice(0, limite);
}
