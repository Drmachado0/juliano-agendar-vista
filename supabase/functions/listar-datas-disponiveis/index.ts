// ============================================================================
// listar-datas-disponiveis
// Lista datas com vagas para um mês/ano, filtrando por local_atendimento.
//
// Correções 2026-07-13:
//   1) requireN8nSecret timing-safe + x-request-id (verify_jwt=false mantido).
//   2) Data atual sempre em America/Belem (UTC-3, sem DST) — nunca depende
//      do timezone do runtime (Deno = UTC).
//   3) Se mes/ano solicitado terminar no passado (mês inteiro < mês atual de
//      Belém), ajusta automaticamente para o mês atual e sinaliza
//      ajustado_periodo_passado=true. Preserva periodo_solicitado.
//   4) auto_avancar (default true): se o mês consultado não tiver datas,
//      procura os próximos meses (até 6 no total, incluindo o solicitado)
//      até achar o primeiro com agenda.
//   5) Filtro de clínica por slug estrito — HGP não mistura com Clinicor
//      nem com Belém e vice-versa. clinica_id NULL só entra quando
//      local_atendimento não foi informado.
//   6) Falha de query em clínicas/disponibilidades/bloqueios/agendamentos
//      → 500 sanitizado (não trata como lista vazia).
//   7) Agendamentos ocupados filtrados por clinica_id da unidade correta.
//   8) Resposta inclui: periodo_solicitado, periodo_consultado,
//      ajustado_periodo_passado, local_resolvido{slugs, ids},
//      datas_disponiveis, total_datas, horizonte_meses.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HORIZONTE_MESES_MAX = 6;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** {ano, mes(1-12), dia} atual em America/Belem. */
function hojeBelem(): { ano: number; mes: number; dia: number; iso: string } {
  const belem = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const ano = belem.getUTCFullYear();
  const mes = belem.getUTCMonth() + 1;
  const dia = belem.getUTCDate();
  const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return { ano, mes, dia, iso };
}

function ymd(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  // mes 1..12 — usa Date UTC do dia 0 do mês seguinte
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function proximoMes(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

function mesEhPassado(ano: number, mes: number, hoje: { ano: number; mes: number }): boolean {
  return ano < hoje.ano || (ano === hoje.ano && mes < hoje.mes);
}

/** Resolve slugs de clínicas a partir de local_atendimento. Retorna null se
 *  local não informado (sem filtro). Retorna array vazio se local não bater. */
export function getClinicaSlugsFromLocal(local: string | null | undefined): string[] | null {
  if (!local) return null;
  const l = local.toLowerCase().trim();
  if (!l) return null;
  if (l.includes("clinicor")) return ["clinicor"];
  if (l.includes("hgp") || l.includes("hospital geral")) return ["hgp"];
  // Belém deve ser checado ANTES de iob/vitria isolados, pois a string
  // "Belém (IOB / Vitria)" contém ambos.
  if (l.includes("belém") || l.includes("belem")) return ["iob", "vitria"];
  if (l.includes("iob")) return ["iob"];
  if (l.includes("vitria")) return ["vitria"];
  return [];
}

export function gerarSlots(horaInicio: string, horaFim: string, intervaloMin: number): string[] {
  const slots: string[] = [];
  const [hI, mI] = horaInicio.split(":").map(Number);
  const [hF, mF] = horaFim.split(":").map(Number);
  let min = hI * 60 + mI;
  const fim = hF * 60 + mF;
  const step = intervaloMin > 0 ? intervaloMin : 30;
  while (min + step <= fim) {
    const h = String(Math.floor(min / 60)).padStart(2, "0");
    const m = String(min % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
    min += step;
  }
  return slots;
}

function horarioDentroBloqueio(slot: string, inicio: string | null, fim: string | null): boolean {
  if (!inicio || !fim) return false;
  const s = slot.substring(0, 5);
  return s >= inicio.substring(0, 5) && s < fim.substring(0, 5);
}

interface CalcularMesInput {
  ano: number;
  mes: number;
  clinicaIds: string[];
  temFiltroLocal: boolean;
  hoje: { ano: number; mes: number; dia: number; iso: string };
  supabase: ReturnType<typeof createClient>;
  rid: string;
}

async function calcularDatasDoMes(input: CalcularMesInput): Promise<
  | { ok: true; datas: { data: string; slots_disponiveis: number }[] }
  | { ok: false; erro: string }
> {
  const { ano, mes, clinicaIds, temFiltroLocal, hoje, supabase, rid } = input;
  const ultDia = ultimoDiaDoMes(ano, mes);

  const dataInicio =
    ano === hoje.ano && mes === hoje.mes ? hoje.iso : ymd(ano, mes, 1);
  const dataFim = ymd(ano, mes, ultDia);

  // Falhas de query NÃO viram lista vazia — sanitizamos 500.
  const [bdRes, biRes, deRes, dsRes, agRes] = await Promise.all([
    supabase
      .from("bloqueios_agenda")
      .select("*")
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .in("tipo_bloqueio", ["dia_inteiro", "feriado"]),
    supabase
      .from("bloqueios_agenda")
      .select("*")
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .in("tipo_bloqueio", ["intervalo", "ausencia_profissional"]),
    supabase.from("disponibilidade_especifica").select("*").gte("data", dataInicio).lte("data", dataFim),
    supabase.from("disponibilidade_semanal").select("*").eq("ativo", true),
    supabase
      .from("agendamentos")
      .select("data_agendamento, hora_agendamento, clinica_id, local_atendimento, is_sandbox")
      .gte("data_agendamento", dataInicio)
      .lte("data_agendamento", dataFim)
      .neq("status_funil", "cancelado"),
  ]);

  for (const [nome, r] of [
    ["bloqueios_dia", bdRes],
    ["bloqueios_intervalo", biRes],
    ["disponibilidade_especifica", deRes],
    ["disponibilidade_semanal", dsRes],
    ["agendamentos", agRes],
  ] as const) {
    if (r.error) {
      console.error(`[listar-datas ${rid}] falha ${nome}:`, r.error.message);
      return { ok: false, erro: `${nome}_lookup_failed` };
    }
  }

  // Filtro por clínica: quando local foi informado, aplica strict:
  // aceita apenas registros das clínicas resolvidas OU (para disponibilidade/
  // bloqueios) sem clínica (regra global). Agendamentos exigem clinica_id
  // batendo para não bloquear a outra unidade.
  const filtroDispBloqueio = (item: { clinica_id?: string | null }) => {
    if (!temFiltroLocal) return true;
    if (item.clinica_id === null || item.clinica_id === undefined) return true;
    return clinicaIds.includes(item.clinica_id);
  };
  const filtroAgendamento = (item: {
    clinica_id?: string | null;
    local_atendimento?: string | null;
    is_sandbox?: boolean | null;
  }) => {
    if (item.is_sandbox === true) return false;
    if (!temFiltroLocal) return true;
    if (item.clinica_id && clinicaIds.includes(item.clinica_id)) return true;
    // Fallback textual: agendamentos legados sem clinica_id vinculado.
    if (!item.clinica_id && item.local_atendimento) {
      const slugsDoRegistro = getClinicaSlugsFromLocal(item.local_atendimento) ?? [];
      return slugsDoRegistro.some((s) => clinicaIds.includes(s) || false);
    }
    return false;
  };

  const bloqueiosDiaMap = new Map<string, boolean>();
  for (const b of (bdRes.data ?? []).filter(filtroDispBloqueio)) {
    bloqueiosDiaMap.set(b.data, true);
  }

  const bloqueiosIntMap = new Map<string, Array<Record<string, unknown>>>();
  for (const b of (biRes.data ?? []).filter(filtroDispBloqueio)) {
    const arr = bloqueiosIntMap.get(b.data) ?? [];
    arr.push(b);
    bloqueiosIntMap.set(b.data, arr);
  }

  const dispEspecificaMap = new Map<string, Array<Record<string, unknown>>>();
  for (const d of (deRes.data ?? []).filter(filtroDispBloqueio)) {
    const arr = dispEspecificaMap.get(d.data) ?? [];
    arr.push(d);
    dispEspecificaMap.set(d.data, arr);
  }

  const modelosMap = new Map<string, Record<string, unknown>>();
  for (const m of dsRes.data ?? []) modelosMap.set(m.id, m);

  const agendamentosMap = new Map<string, Set<string>>();
  for (const a of (agRes.data ?? []).filter(filtroAgendamento)) {
    if (!a.data_agendamento || !a.hora_agendamento) continue;
    const set = agendamentosMap.get(a.data_agendamento) ?? new Set();
    set.add(String(a.hora_agendamento).substring(0, 5));
    agendamentosMap.set(a.data_agendamento, set);
  }

  const datasDisponiveis: { data: string; slots_disponiveis: number }[] = [];
  const belemAgoraMin = (() => {
    const b = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return b.getUTCHours() * 60 + b.getUTCMinutes() + 30;
  })();

  for (let dia = 1; dia <= ultDia; dia++) {
    // Datas passadas (em Belém) são ignoradas.
    if (ano === hoje.ano && mes === hoje.mes && dia < hoje.dia) continue;

    const dataStr = ymd(ano, mes, dia);
    if (bloqueiosDiaMap.has(dataStr)) continue;

    const especifica = dispEspecificaMap.get(dataStr);
    if (!especifica || especifica.length === 0) continue; // sem abertura = fechado

    const indisponivel = especifica.find((d) => !(d as { disponivel: boolean }).disponivel);
    if (indisponivel && !especifica.some((d) => (d as { disponivel: boolean }).disponivel)) continue;

    let slots: string[] = [];
    for (const d of especifica) {
      const disp = d as {
        disponivel: boolean;
        hora_inicio: string | null;
        hora_fim: string | null;
        intervalo_minutos: number | null;
        modelo_id: string | null;
      };
      if (!disp.disponivel) continue;
      let horaIni = disp.hora_inicio;
      let horaFim = disp.hora_fim;
      let intervalo = disp.intervalo_minutos;
      if ((!horaIni || !horaFim) && disp.modelo_id) {
        const m = modelosMap.get(disp.modelo_id) as
          | { hora_inicio: string; hora_fim: string; intervalo_minutos: number }
          | undefined;
        if (m) {
          horaIni = horaIni ?? m.hora_inicio;
          horaFim = horaFim ?? m.hora_fim;
          intervalo = intervalo ?? m.intervalo_minutos;
        }
      }
      if (!horaIni || !horaFim) continue;
      slots.push(...gerarSlots(horaIni, horaFim, intervalo ?? 30));
    }

    slots = [...new Set(slots)].sort();

    const bInt = bloqueiosIntMap.get(dataStr) ?? [];
    if (bInt.length > 0) {
      slots = slots.filter(
        (s) =>
          !bInt.some((b) =>
            horarioDentroBloqueio(
              s,
              (b as { hora_inicio: string | null }).hora_inicio,
              (b as { hora_fim: string | null }).hora_fim,
            ),
          ),
      );
    }

    const ocupados = agendamentosMap.get(dataStr);
    if (ocupados) slots = slots.filter((s) => !ocupados.has(s));

    if (ano === hoje.ano && mes === hoje.mes && dia === hoje.dia) {
      slots = slots.filter((s) => {
        const [h, m] = s.split(":").map(Number);
        return h * 60 + m > belemAgoraMin;
      });
    }

    if (slots.length > 0) datasDisponiveis.push({ data: dataStr, slots_disponiveis: slots.length });
  }

  return { ok: true, datas: datasDisponiveis };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireN8nSecret(req);
  if (!guard.ok) return unauthorizedResponse(guard.reason ?? "unauthorized", corsHeaders);
  const rid = requestId(req);

  try {
    const body = await req.json().catch(() => ({}));
    const mesRaw = body?.mes;
    const anoRaw = body?.ano;
    const localAtendimento: string = typeof body?.local_atendimento === "string" ? body.local_atendimento : "";
    const autoAvancar: boolean = body?.auto_avancar !== false; // default true

    const hoje = hojeBelem();

    // 1) Validação tolerante: ausente/inválido → default seguro (mês atual Belém)
    const mesNum = Number(mesRaw);
    const anoNum = Number(anoRaw);
    const mesAusente = mesRaw === undefined || mesRaw === null || mesRaw === "";
    const anoAusente = anoRaw === undefined || anoRaw === null || anoRaw === "";
    const mesInvalido = !mesAusente && (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12);
    const anoInvalido = !anoAusente && (!Number.isInteger(anoNum) || anoNum < 2000 || anoNum > 2100);

    let anoBase: number;
    let mesBase: number;
    let periodoAjustado = false;
    let motivoAjuste: string | null = null;
    let ajustadoPeriodoPassado = false;

    if (mesAusente || anoAusente) {
      anoBase = hoje.ano;
      mesBase = hoje.mes;
      periodoAjustado = true;
      motivoAjuste = "periodo_ausente";
    } else if (mesInvalido || anoInvalido) {
      anoBase = hoje.ano;
      mesBase = hoje.mes;
      periodoAjustado = true;
      motivoAjuste = "periodo_invalido";
    } else if (mesEhPassado(anoNum, mesNum, hoje)) {
      anoBase = hoje.ano;
      mesBase = hoje.mes;
      periodoAjustado = true;
      ajustadoPeriodoPassado = true;
      motivoAjuste = "periodo_passado";
    } else {
      anoBase = anoNum;
      mesBase = mesNum;
    }

    // periodo_solicitado preserva o que veio (null quando ausente/não numérico)
    const periodoSolicitado = {
      ano: Number.isInteger(anoNum) ? anoNum : null,
      mes: Number.isInteger(mesNum) ? mesNum : null,
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    console.log(`[listar-datas ${rid}] req=${anoRaw}-${mesRaw} base=${anoBase}-${String(mesBase).padStart(2, "0")} ajuste=${motivoAjuste ?? "nenhum"} local="${localAtendimento}" hojeBelem=${hoje.iso}`);

    // 2) Filtro por clínica
    const slugs = getClinicaSlugsFromLocal(localAtendimento);
    const temFiltroLocal = slugs !== null;
    let clinicaIds: string[] = [];
    if (slugs && slugs.length > 0) {
      const { data: clinicas, error } = await supabase
        .from("clinicas")
        .select("id, slug")
        .in("slug", slugs)
        .eq("ativo", true);
      if (error) {
        console.error(`[listar-datas ${rid}] clinicas_lookup_failed:`, error.message);
        return json({ error: "clinicas_lookup_failed", request_id: rid }, 500);
      }
      clinicaIds = (clinicas ?? []).map((c: { id: string }) => c.id);
      if (clinicaIds.length === 0) {
        return json(
          {
            periodo_solicitado: periodoSolicitado,
            periodo_consultado: { ano: anoBase, mes: mesBase },
            periodo_ajustado: periodoAjustado,
            ajustado_periodo_passado: ajustadoPeriodoPassado,
            motivo_ajuste: motivoAjuste,
            local_atendimento: localAtendimento || null,
            local_resolvido: { slugs, ids: [] },
            datas_disponiveis: [],
            total_datas: 0,
            horizonte_meses: 0,
            motivo: "clinicas_nao_encontradas",
            request_id: rid,
          },
          200,
        );
      }
    }

    // 3) Loop com auto_avancar (máx 6 meses a partir do mesBase)
    let anoAtual = anoBase;
    let mesAtual = mesBase;
    let datasFinal: { data: string; slots_disponiveis: number }[] = [];
    let periodoConsultado = { ano: anoBase, mes: mesBase };
    let mesesTentados = 0;
    let encontrou = false;

    for (let i = 0; i < HORIZONTE_MESES_MAX; i++) {
      mesesTentados++;
      periodoConsultado = { ano: anoAtual, mes: mesAtual };
      const res = await calcularDatasDoMes({
        ano: anoAtual,
        mes: mesAtual,
        clinicaIds,
        temFiltroLocal,
        hoje,
        supabase,
        rid,
      });
      if (!res.ok) return json({ error: res.erro, request_id: rid }, 500);
      if (res.datas.length > 0) {
        datasFinal = res.datas;
        encontrou = true;
        break;
      }
      if (!autoAvancar) break;
      // Não avança no último ciclo — periodo_consultado permanece no 6º mês.
      if (i === HORIZONTE_MESES_MAX - 1) break;
      const nx = proximoMes(anoAtual, mesAtual);
      anoAtual = nx.ano;
      mesAtual = nx.mes;
    }

    const motivo = encontrou
      ? null
      : (autoAvancar ? "sem_disponibilidade_no_horizonte" : "sem_disponibilidade_no_periodo");

    console.log(`[listar-datas ${rid}] ${datasFinal.length} datas em ${periodoConsultado.ano}-${String(periodoConsultado.mes).padStart(2, "0")} (tentados=${mesesTentados}, motivo=${motivo ?? "ok"})`);

    return json({
      periodo_solicitado: periodoSolicitado,
      periodo_consultado: periodoConsultado,
      periodo_ajustado: periodoAjustado,
      ajustado_periodo_passado: ajustadoPeriodoPassado,
      motivo_ajuste: motivoAjuste,
      local_atendimento: localAtendimento || null,
      local_resolvido: { slugs: slugs ?? null, ids: clinicaIds },
      datas_disponiveis: datasFinal,
      total_datas: datasFinal.length,
      horizonte_meses: mesesTentados,
      auto_avancar: autoAvancar,
      motivo,
      timezone: "America/Belem",
      request_id: rid,
    });
  } catch (err) {
    console.error(`[listar-datas ${rid}] erro:`, (err as Error)?.message);
    return json({ error: "internal_error", request_id: rid }, 500);
  }
});
