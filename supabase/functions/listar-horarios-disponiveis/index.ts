// ============================================================================
// listar-horarios-disponiveis
// Lista horários livres em uma data específica, filtrando por local_atendimento.
//
// Correções 2026-07-13:
//   1) requireN8nSecret timing-safe + x-request-id (verify_jwt=false mantido).
//   2) Data atual e "isToday" sempre em America/Belem (UTC-3).
//   3) Rejeita data passada usando America/Belem.
//   4) Filtro por clínica estrito (slug). HGP nunca mistura Clinicor.
//   5) Agendamentos ocupados filtrados por clinica_id/local — uma unidade
//      não bloqueia horários da outra.
//   6) Falhas de query (clínicas/disponibilidades/bloqueios/agendamentos)
//      viram 500 sanitizado. Nunca são tratadas como lista vazia.
//   7) Mantém resolução de modelo_id quando hora_inicio/hora_fim vêm null.
//   8) Resposta inclui local_resolvido{slugs, ids} e request_id.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

function hojeBelemISO(): string {
  const b = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, "0")}-${String(b.getUTCDate()).padStart(2, "0")}`;
}

function belemAgoraMinutos(): number {
  const b = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return b.getUTCHours() * 60 + b.getUTCMinutes();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireN8nSecret(req);
  if (!guard.ok) return unauthorizedResponse(guard.reason ?? "unauthorized", corsHeaders);
  const rid = requestId(req);

  try {
    const body = await req.json().catch(() => ({}));
    const data: string = typeof body?.data === "string" ? body.data : "";
    const localAtendimento: string = typeof body?.local_atendimento === "string" ? body.local_atendimento : "";

    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return json({ error: 'Campo "data" obrigatório no formato YYYY-MM-DD', request_id: rid }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const hojeISO = hojeBelemISO();
    console.log(`[listar-horarios ${rid}] data=${data} local="${localAtendimento}" hojeBelem=${hojeISO}`);

    // 1) Rejeita data passada (Belém)
    if (data < hojeISO) {
      return json({
        data,
        local_atendimento: localAtendimento || null,
        horarios_disponiveis: [],
        total: 0,
        motivo: "data_no_passado",
        request_id: rid,
      });
    }

    // 2) Resolve clínicas
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
        console.error(`[listar-horarios ${rid}] clinicas_lookup_failed:`, error.message);
        return json({ error: "clinicas_lookup_failed", request_id: rid }, 500);
      }
      clinicaIds = (clinicas ?? []).map((c: { id: string }) => c.id);
      if (clinicaIds.length === 0) {
        return json({
          data,
          local_atendimento: localAtendimento || null,
          local_resolvido: { slugs, ids: [] },
          horarios_disponiveis: [],
          total: 0,
          motivo: "clinicas_nao_encontradas",
          request_id: rid,
        });
      }
    }

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
      if (!item.clinica_id && item.local_atendimento) {
        const s = getClinicaSlugsFromLocal(item.local_atendimento) ?? [];
        return s.some((x) => slugs?.includes(x));
      }
      return false;
    };

    // 3) Bloqueios dia inteiro
    const bdRes = await supabase
      .from("bloqueios_agenda")
      .select("*")
      .eq("data", data)
      .in("tipo_bloqueio", ["dia_inteiro", "feriado"]);
    if (bdRes.error) {
      console.error(`[listar-horarios ${rid}] bloqueios_dia_lookup_failed:`, bdRes.error.message);
      return json({ error: "bloqueios_lookup_failed", request_id: rid }, 500);
    }
    const bloqueiosDia = (bdRes.data ?? []).filter(filtroDispBloqueio);
    if (bloqueiosDia.length > 0) {
      return json({
        data,
        local_atendimento: localAtendimento || null,
        local_resolvido: { slugs: slugs ?? null, ids: clinicaIds },
        horarios_disponiveis: [],
        total: 0,
        motivo: bloqueiosDia[0].motivo || "Esta data está bloqueada",
        request_id: rid,
      });
    }

    // 4) Bloqueios de intervalo
    const biRes = await supabase
      .from("bloqueios_agenda")
      .select("*")
      .eq("data", data)
      .in("tipo_bloqueio", ["intervalo", "ausencia_profissional"]);
    if (biRes.error) {
      console.error(`[listar-horarios ${rid}] bloqueios_int_lookup_failed:`, biRes.error.message);
      return json({ error: "bloqueios_lookup_failed", request_id: rid }, 500);
    }
    const bloqueiosInt = (biRes.data ?? []).filter(filtroDispBloqueio);

    // 5) Disponibilidade específica
    const deRes = await supabase.from("disponibilidade_especifica").select("*").eq("data", data);
    if (deRes.error) {
      console.error(`[listar-horarios ${rid}] disponibilidades_lookup_failed:`, deRes.error.message);
      return json({ error: "disponibilidades_lookup_failed", request_id: rid }, 500);
    }
    const dispEspecifica = (deRes.data ?? []).filter(filtroDispBloqueio);
    if (dispEspecifica.length === 0) {
      return json({
        data,
        local_atendimento: localAtendimento || null,
        local_resolvido: { slugs: slugs ?? null, ids: clinicaIds },
        horarios_disponiveis: [],
        total: 0,
        motivo: "data_nao_aberta_para_agendamento",
        request_id: rid,
      });
    }

    const indisponivel = dispEspecifica.find((d) => !d.disponivel);
    if (indisponivel && !dispEspecifica.some((d) => d.disponivel)) {
      return json({
        data,
        local_atendimento: localAtendimento || null,
        local_resolvido: { slugs: slugs ?? null, ids: clinicaIds },
        horarios_disponiveis: [],
        total: 0,
        motivo: indisponivel.motivo || "Data indisponível",
        request_id: rid,
      });
    }

    // Resolve modelos referenciados
    const modeloIds = [
      ...new Set(
        dispEspecifica
          .filter((d) => d.disponivel && (!d.hora_inicio || !d.hora_fim) && d.modelo_id)
          .map((d) => d.modelo_id as string),
      ),
    ];
    const modelosMap = new Map<string, { hora_inicio: string; hora_fim: string; intervalo_minutos: number }>();
    if (modeloIds.length > 0) {
      const mRes = await supabase.from("disponibilidade_semanal").select("*").in("id", modeloIds);
      if (mRes.error) {
        console.error(`[listar-horarios ${rid}] modelos_lookup_failed:`, mRes.error.message);
        return json({ error: "disponibilidades_lookup_failed", request_id: rid }, 500);
      }
      for (const m of mRes.data ?? []) modelosMap.set(m.id, m);
    }

    let allSlots: string[] = [];
    for (const d of dispEspecifica) {
      if (!d.disponivel) continue;
      let horaIni = d.hora_inicio;
      let horaFim = d.hora_fim;
      let intervalo = d.intervalo_minutos;
      if ((!horaIni || !horaFim) && d.modelo_id) {
        const m = modelosMap.get(d.modelo_id);
        if (m) {
          horaIni = horaIni ?? m.hora_inicio;
          horaFim = horaFim ?? m.hora_fim;
          intervalo = intervalo ?? m.intervalo_minutos;
        }
      }
      if (!horaIni || !horaFim) continue;
      allSlots.push(...gerarSlots(horaIni, horaFim, intervalo ?? 30));
    }
    allSlots = [...new Set(allSlots)].sort();

    // Remove bloqueios de intervalo
    allSlots = allSlots.filter(
      (slot) => !bloqueiosInt.some((b) => horarioDentroBloqueio(slot, b.hora_inicio, b.hora_fim)),
    );

    // 6) Ocupados filtrados por clínica correta
    const agRes = await supabase
      .from("agendamentos")
      .select("hora_agendamento, clinica_id, local_atendimento, is_sandbox")
      .eq("data_agendamento", data)
      .neq("status_funil", "cancelado");
    if (agRes.error) {
      console.error(`[listar-horarios ${rid}] agendamentos_lookup_failed:`, agRes.error.message);
      return json({ error: "agendamentos_lookup_failed", request_id: rid }, 500);
    }
    const ocupados = new Set(
      (agRes.data ?? [])
        .filter(filtroAgendamento)
        .map((a) => String(a.hora_agendamento ?? "").substring(0, 5))
        .filter(Boolean),
    );
    allSlots = allSlots.filter((s) => !ocupados.has(s));

    // 7) Se for hoje (Belém), remove slots já passados (+30min de margem)
    if (data === hojeISO) {
      const minAgora = belemAgoraMinutos() + 30;
      allSlots = allSlots.filter((s) => {
        const [h, m] = s.split(":").map(Number);
        return h * 60 + m > minAgora;
      });
    }

    return json({
      data,
      local_atendimento: localAtendimento || null,
      local_resolvido: { slugs: slugs ?? null, ids: clinicaIds },
      horarios_disponiveis: allSlots,
      total: allSlots.length,
      request_id: rid,
    });
  } catch (err) {
    console.error(`[listar-horarios ${rid}] erro:`, (err as Error)?.message);
    return json({ error: "internal_error", request_id: rid }, 500);
  }
});
