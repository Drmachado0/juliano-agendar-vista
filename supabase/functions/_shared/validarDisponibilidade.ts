// supabase/functions/_shared/validarDisponibilidade.ts
// Lógica adaptada ao schema do LOVABLE
// Tabelas: disponibilidade_semanal, bloqueios_agenda, agendamentos, clinicas

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─────────────────────────────────────────────
// IDs das clínicas no banco do Lovable
// ─────────────────────────────────────────────
export const CLINICAS: Record<string, { id: string; nome: string }> = {
  clinicor: {
    id: "657e4784-e292-45c6-a033-40f3d115f984",
    nome: "Clinicor – Paragominas",
  },
  hgp: {
    id: "5f2f3bcb-5945-4220-912a-4d7c79b9b056",
    nome: "Hospital Geral de Paragominas",
  },
  iob: {
    id: "f72d4685-7e91-4b27-b4e6-8c47db742bef",
    nome: "Instituto de Olhos de Belém (IOB)",
  },
  vitria: {
    id: "dee8244b-a4f0-492a-aa59-89cfb8848463",
    nome: "Vitria Oftalmologia",
  },
};

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export interface SlotDisponivel {
  horario: string;       // HH:MM
  data_hora: string;     // ISO 8601
  local: string;         // Nome da clínica
  clinica_id: string;
  dia_semana: string;
}

export interface ResultadoValidacao {
  disponivel: boolean;
  motivo?: string;
}

export interface ResultadoAgendamento {
  sucesso: boolean;
  agendamento_id?: string;
  mensagem: string;
  detalhes?: Record<string, unknown>;
  erro?: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const DIAS_SEMANA: Record<number, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
};

export function getNomeDiaSemana(dia: number): string {
  return DIAS_SEMANA[dia] || "Desconhecido";
}

// ─────────────────────────────────────────────
// Timezone America/Belem (UTC-3, sem DST)
// ─────────────────────────────────────────────
export function nowBelemDateStr(now: Date = new Date()): string {
  // desloca -3h e usa componentes UTC
  const t = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
export function nowBelemMs(now: Date = new Date()): number {
  // instante atual em ms UTC; comparações abaixo usam data_hora com offset -03:00
  return now.getTime();
}

/** Resolve nome do local para clinica_id */
export function resolverClinica(local: string): { id: string; nome: string } | null {
  const key = local.toLowerCase().trim()
    .replace("hospital geral de paragominas", "hgp")
    .replace("clinicor – paragominas", "clinicor")
    .replace("clinicor - paragominas", "clinicor");

  // Busca direta
  if (CLINICAS[key]) return CLINICAS[key];

  // Busca parcial
  for (const [k, v] of Object.entries(CLINICAS)) {
    if (key.includes(k) || v.nome.toLowerCase().includes(key)) return v;
  }

  return null;
}

/** Gera slots baseado na disponibilidade_semanal */
export function gerarSlots(
  data: string,
  horaInicio: string,
  horaFim: string,
  intervaloMinutos: number,
  clinicaId: string,
  clinicaNome: string,
  diaSemana: string
): SlotDisponivel[] {
  const slots: SlotDisponivel[] = [];
  const [hI, mI] = horaInicio.split(":").map(Number);
  const [hF, mF] = horaFim.split(":").map(Number);

  let minAtual = hI * 60 + mI;
  const minFim = hF * 60 + mF;

  while (minAtual + intervaloMinutos <= minFim) {
    const h = String(Math.floor(minAtual / 60)).padStart(2, "0");
    const m = String(minAtual % 60).padStart(2, "0");
    slots.push({
      horario: `${h}:${m}`,
      data_hora: `${data}T${h}:${m}:00-03:00`,
      local: clinicaNome,
      clinica_id: clinicaId,
      dia_semana: diaSemana,
    });
    minAtual += intervaloMinutos;
  }
  return slots;
}

// ─────────────────────────────────────────────
// Funções principais
// ─────────────────────────────────────────────

export function criarClienteSupabase(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

/** Lista horários disponíveis para uma data */
export async function listarHorariosDisponiveis(
  supabase: SupabaseClient,
  data: string,
  local?: string,
  excluirAgendamentoId?: string,
): Promise<SlotDisponivel[]> {
  const dataObj = new Date(data + "T12:00:00-03:00");
  const diaSemana = dataObj.getUTCDay();
  const nomeDia = getNomeDiaSemana(diaSemana);

  // "Hoje" em America/Belem (UTC-3, sem DST).
  const hojeBelem = nowBelemDateStr();
  if (data < hojeBelem) return [];

  // Resolver clinica_id se local foi informado
  let clinicaFilter: { id: string; nome: string } | null = null;
  if (local) {
    clinicaFilter = resolverClinica(local);
    if (!clinicaFilter) return [];
  }

  // 1. Buscar disponibilidade_especifica (data aberta manualmente pelo admin)
  // Política: sem disponibilidade_especifica = dia fechado. Modelos semanais
  // são apenas templates e NÃO abrem agenda automaticamente.
  let especQuery = supabase
    .from("disponibilidade_especifica")
    .select("*, clinicas(id, nome)")
    .eq("data", data)
    .eq("disponivel", true);

  if (clinicaFilter) {
    especQuery = especQuery.eq("clinica_id", clinicaFilter.id);
  }

  const { data: especificas, error: errE } = await especQuery;
  if (errE) {
    console.error("[listarHorariosDisponiveis] especificas_err", { code: (errE as any).code });
    return [];
  }
  if (!especificas?.length) return [];

  // Para cada disp_especifica sem hora_inicio/hora_fim explícito, resolve via modelo_id
  const modeloIds = (especificas as any[])
    .filter((e) => !e.hora_inicio && e.modelo_id)
    .map((e) => e.modelo_id);

  let modelosMap = new Map<string, any>();
  if (modeloIds.length) {
    const { data: modelos, error: errM } = await supabase
      .from("disponibilidade_semanal")
      .select("*")
      .in("id", modeloIds);
    if (errM) {
      console.error("[listarHorariosDisponiveis] modelos_err", { code: (errM as any).code });
      return [];
    }
    for (const m of (modelos as any[]) || []) modelosMap.set(m.id, m);
  }

  const disponibilidades = (especificas as any[]).map((e) => {
    if (e.hora_inicio && e.hora_fim) return e;
    const m = e.modelo_id ? modelosMap.get(e.modelo_id) : null;
    if (m) {
      return {
        ...e,
        hora_inicio: m.hora_inicio,
        hora_fim: m.hora_fim,
        intervalo_minutos: e.intervalo_minutos || m.intervalo_minutos,
      };
    }
    return null;
  }).filter(Boolean);

  if (!disponibilidades.length) return [];


  // 2. Buscar bloqueios para esta data — fail-closed em erro.
  const { data: bloqueios, error: errB } = await supabase
    .from("bloqueios_agenda")
    .select("clinica_id, hora_inicio, hora_fim")
    .eq("data", data);
  if (errB) {
    console.error("[listarHorariosDisponiveis] bloqueios_err", { code: (errB as any).code });
    return [];
  }

  // 3. Buscar agendamentos existentes nesta data (descontando o próprio, se for edição).
  //    Excluímos TODOS os status terminais reais (uppercase) e também a variante
  //    'cancelado' minúscula legada — cancelados não ocupam slot.
  let agQuery = supabase
    .from("agendamentos")
    .select("id, hora_agendamento, clinica_id, status_crm, status_funil, is_sandbox")
    .eq("data_agendamento", data);
  if (excluirAgendamentoId) {
    agQuery = agQuery.neq("id", excluirAgendamentoId);
  }
  const { data: agendamentosRaw, error: errAg } = await agQuery;
  if (errAg) {
    console.error("[listarHorariosDisponiveis] agendamentos_err", { code: (errAg as any).code });
    return [];
  }
  const TERMINAIS_UP = new Set(["CANCELADO", "ATENDIDO", "COMPARECEU", "FALTOU", "EXCLUIDO"]);
  const TERMINAIS_LOW = new Set(["cancelado", "atendido", "compareceu", "faltou", "excluido"]);
  const agendamentos = (agendamentosRaw || []).filter((a: any) => {
    if (a.is_sandbox === true) return false;
    const sc = String(a.status_crm ?? "").toUpperCase();
    if (TERMINAIS_UP.has(sc)) return false;
    const sf = String(a.status_funil ?? "").toLowerCase();
    if (TERMINAIS_LOW.has(sf)) return false;
    return true;
  });

  const ocupados = new Set(
    (agendamentos || []).map((a: any) => {
      const h = String(a.hora_agendamento).substring(0, 5); // "HH:MM"
      return `${a.clinica_id}|${h}`;
    })
  );

  // 4. Gerar slots e filtrar
  const todosSlots: SlotDisponivel[] = [];

  for (const d of disponibilidades as any[]) {
    const clinicaId = d.clinica_id;
    const clinicaNome = d.clinicas?.nome || local || "Clínica";

    // Verificar bloqueio total do dia para esta clínica
    const bloqueioTotal = (bloqueios || []).some(
      (b: any) =>
        (b.clinica_id === clinicaId || b.clinica_id === null) &&
        b.hora_inicio === null
    );
    if (bloqueioTotal) continue;

    const slots = gerarSlots(
      data,
      d.hora_inicio,
      d.hora_fim,
      d.intervalo_minutos || 30,
      clinicaId,
      clinicaNome,
      nomeDia
    );

    for (const slot of slots) {
      const chave = `${clinicaId}|${slot.horario}`;

      // Pular se ocupado
      if (ocupados.has(chave)) continue;

      // Pular se bloqueado parcialmente
      const bloqueado = (bloqueios || []).some((b: any) => {
        if (b.clinica_id !== clinicaId && b.clinica_id !== null) return false;
        if (!b.hora_inicio || !b.hora_fim) return false;
        const bInicio = b.hora_inicio.substring(0, 5);
        const bFim = b.hora_fim.substring(0, 5);
        return slot.horario >= bInicio && slot.horario < bFim;
      });
      if (bloqueado) continue;

      // Se for hoje (em America/Belem), pular horários passados (margem de 1h).
      if (data === hojeBelem) {
        const agora = nowBelemMs();
        const slotDate = new Date(slot.data_hora);
        if (slotDate.getTime() - agora < 60 * 60 * 1000) continue;
      }

      todosSlots.push(slot);
    }
  }

  return todosSlots.sort((a, b) =>
    a.local === b.local
      ? a.horario.localeCompare(b.horario)
      : a.local.localeCompare(b.local)
  );
}

/** Valida se um horário específico está disponível */
export async function validarDisponibilidade(
  supabase: SupabaseClient,
  data: string,
  hora: string,
  local: string,
  excluirAgendamentoId?: string,
): Promise<ResultadoValidacao> {
  const clinica = resolverClinica(local);
  if (!clinica) {
    return { disponivel: false, motivo: `Clínica "${local}" não encontrada.` };
  }

  const slots = await listarHorariosDisponiveis(supabase, data, local, excluirAgendamentoId);
  const encontrado = slots.find(
    (s) => s.horario === hora && s.clinica_id === clinica.id
  );

  if (encontrado) {
    return { disponivel: true };
  }

  const alternativas = slots
    .filter((s) => s.clinica_id === clinica.id)
    .slice(0, 5)
    .map((s) => s.horario);

  return {
    disponivel: false,
    motivo: `Horário ${hora} no ${clinica.nome} em ${data} não está disponível.${
      alternativas.length > 0
        ? ` Horários livres: ${alternativas.join(", ")}`
        : " Nenhum horário livre nesta data."
    }`,
  };
}

/** Cria agendamento usando schema do Lovable */
export async function criarAgendamento(
  supabase: SupabaseClient,
  params: {
    nome_completo: string;
    telefone_whatsapp: string;
    tipo_atendimento: string;
    local_atendimento: string;
    convenio: string;
    data_agendamento: string;
    hora_agendamento: string;
  }
): Promise<ResultadoAgendamento> {
  const clinica = resolverClinica(params.local_atendimento);
  if (!clinica) {
    return {
      sucesso: false,
      mensagem: "Clínica não encontrada",
      erro: `"${params.local_atendimento}" não é uma clínica válida. Use: HGP, Clinicor, IOB ou Vitria.`,
    };
  }

  // 1. Validar disponibilidade
  const validacao = await validarDisponibilidade(
    supabase,
    params.data_agendamento,
    params.hora_agendamento,
    params.local_atendimento
  );

  if (!validacao.disponivel) {
    return {
      sucesso: false,
      mensagem: "Horário indisponível",
      erro: validacao.motivo,
    };
  }

  // 2. Definir convênio
  const conveniosAceitos = ["bradesco", "unimed", "cassi", "sulamerica", "sulamérica"];
  const convNorm = params.convenio.toLowerCase().replace(/\s/g, "");
  const isConvenio = conveniosAceitos.includes(convNorm);

  // 3. Inserir no schema do Lovable
  const { data: agendamento, error: errA } = await supabase
    .from("agendamentos")
    .insert({
      nome_completo: params.nome_completo,
      telefone_whatsapp: params.telefone_whatsapp,
      tipo_atendimento: params.tipo_atendimento || "consulta",
      local_atendimento: clinica.nome,
      clinica_id: clinica.id,
      convenio: isConvenio ? params.convenio : null,
      data_agendamento: params.data_agendamento,
      hora_agendamento: params.hora_agendamento,
      status_crm: "agendado",
      origem: "mcp",
      aceita_contato_whatsapp_email: true,
      observacoes_internas: `Agendado via WhatsApp (Sofia IA) - ${new Date().toISOString()}`,
    })
    .select("id")
    .single();

  if (errA || !agendamento) {
    return {
      sucesso: false,
      mensagem: "Erro ao criar agendamento",
      erro: errA?.message || "Falha no insert",
    };
  }

  const diaSemana = new Date(params.data_agendamento + "T12:00:00-03:00").getUTCDay();
  const nomeDia = getNomeDiaSemana(diaSemana);
  const dataFormatada = params.data_agendamento.split("-").reverse().join("/");

  return {
    sucesso: true,
    agendamento_id: agendamento.id,
    mensagem: `Consulta agendada com sucesso! ${nomeDia}, ${dataFormatada} às ${params.hora_agendamento} na ${clinica.nome}.`,
    detalhes: {
      data: dataFormatada,
      horario: params.hora_agendamento,
      local: clinica.nome,
      clinica_id: clinica.id,
      tipo: params.tipo_atendimento,
      convenio: isConvenio ? params.convenio : "particular",
      origem: "mcp",
    },
  };
}
