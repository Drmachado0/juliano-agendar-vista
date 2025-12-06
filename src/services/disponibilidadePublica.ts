import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfDay, isBefore, isSameDay } from "date-fns";

// Mapeia o valor do local de atendimento para o(s) slug(s) da clínica
function getClinicaSlugsFromLocal(localAtendimento?: string): string[] {
  if (!localAtendimento) return [];
  
  const locationMap: Record<string, string[]> = {
    clinicor: ["clinicor"],
    hgp: ["hgp"],
    belem: ["iob", "vitria"], // Belém inclui IOB e Vitria
  };
  
  return locationMap[localAtendimento] || [];
}

// Busca os IDs das clínicas pelos slugs
async function buscarClinicaIdsPorSlugs(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  
  const { data, error } = await supabase
    .from('clinicas')
    .select('id')
    .in('slug', slugs);
  
  if (error || !data) {
    console.error('Erro ao buscar clínicas:', error);
    return [];
  }
  
  return data.map(c => c.id);
}

export interface SlotDisponivel {
  horario: string;
  disponivel: boolean;
}

export interface DisponibilidadeSemanal {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  intervalo_minutos: number;
  ativo: boolean;
}

export interface DisponibilidadeEspecifica {
  id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  intervalo_minutos: number;
  disponivel: boolean;
  motivo: string | null;
}

// Gera lista de horários entre início e fim com intervalo especificado
function gerarSlots(horaInicio: string, horaFim: string, intervaloMinutos: number): string[] {
  const slots: string[] = [];
  const [inicioHora, inicioMin] = horaInicio.split(':').map(Number);
  const [fimHora, fimMin] = horaFim.split(':').map(Number);
  
  let currentMinutes = inicioHora * 60 + inicioMin;
  const endMinutes = fimHora * 60 + fimMin;
  
  while (currentMinutes < endMinutes) {
    const hora = Math.floor(currentMinutes / 60);
    const minuto = currentMinutes % 60;
    slots.push(`${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`);
    currentMinutes += intervaloMinutos;
  }
  
  return slots;
}

// Busca disponibilidade semanal com filtro opcional por clínica
async function buscarDisponibilidadeSemanal(clinicaId?: string): Promise<DisponibilidadeSemanal[]> {
  let query = supabase
    .from('disponibilidade_semanal')
    .select('*')
    .eq('ativo', true);
  
  if (clinicaId) {
    query = query.eq('clinica_id', clinicaId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Erro ao buscar disponibilidade semanal:', error);
    return [];
  }
  
  return (data || []) as DisponibilidadeSemanal[];
}

// Busca disponibilidade específica para uma data com filtro opcional por clínica
async function buscarDisponibilidadeEspecifica(data: string, clinicaId?: string): Promise<DisponibilidadeEspecifica | null> {
  let query = supabase
    .from('disponibilidade_especifica')
    .select('*')
    .eq('data', data);
  
  if (clinicaId) {
    query = query.eq('clinica_id', clinicaId);
  }
  
  const { data: result, error } = await query.maybeSingle();
  
  if (error) {
    console.error('Erro ao buscar disponibilidade específica:', error);
    return null;
  }
  
  return result as DisponibilidadeEspecifica | null;
}

// Busca agendamentos existentes para uma data
async function buscarAgendamentosData(data: string): Promise<string[]> {
  const { data: agendamentos, error } = await supabase
    .from('agendamentos')
    .select('hora_agendamento')
    .eq('data_agendamento', data);
  
  if (error) {
    console.error('Erro ao buscar agendamentos:', error);
    return [];
  }
  
  return (agendamentos || []).map(a => a.hora_agendamento.substring(0, 5));
}

// Gera horários disponíveis para um dia específico
export async function gerarHorariosDisponiveis(data: Date, localAtendimento?: string): Promise<SlotDisponivel[]> {
  const dataStr = format(data, 'yyyy-MM-dd');
  const diaSemana = data.getDay();
  const hoje = new Date();
  const isHoje = isSameDay(data, hoje);
  
  // Verifica se a data é passada
  if (isBefore(startOfDay(data), startOfDay(hoje))) {
    return [];
  }
  
  // Busca clinica_ids se localAtendimento foi fornecido
  let clinicaIds: string[] = [];
  const slugs = getClinicaSlugsFromLocal(localAtendimento);
  if (slugs.length > 0) {
    clinicaIds = await buscarClinicaIdsPorSlugs(slugs);
  }
  const clinicaId = clinicaIds.length > 0 ? clinicaIds[0] : undefined;
  
  // Busca disponibilidade específica primeiro
  const especifica = await buscarDisponibilidadeEspecifica(dataStr, clinicaId);
  
  let slots: string[] = [];
  
  if (especifica) {
    // Se há disponibilidade específica
    if (!especifica.disponivel) {
      return []; // Dia bloqueado
    }
    if (especifica.hora_inicio && especifica.hora_fim) {
      slots = gerarSlots(especifica.hora_inicio, especifica.hora_fim, especifica.intervalo_minutos);
    } else {
      return []; // Sem horários definidos
    }
  } else {
    // Busca disponibilidade semanal
    const semanal = await buscarDisponibilidadeSemanal(clinicaId);
    const config = semanal.find(s => s.dia_semana === diaSemana);
    
    if (!config || !config.ativo) {
      return []; // Dia sem disponibilidade
    }
    
    slots = gerarSlots(config.hora_inicio, config.hora_fim, config.intervalo_minutos);
  }
  
  // Busca agendamentos existentes
  const agendamentosExistentes = await buscarAgendamentosData(dataStr);
  
  // Filtra horários já ocupados e horários passados (se for hoje)
  const horaAtual = hoje.getHours() * 60 + hoje.getMinutes();
  
  return slots.map(horario => {
    const [h, m] = horario.split(':').map(Number);
    const horarioMinutos = h * 60 + m;
    
    // Se for hoje, verifica se o horário já passou
    if (isHoje && horarioMinutos <= horaAtual + 30) { // 30 min de margem
      return { horario, disponivel: false };
    }
    
    // Verifica se já está ocupado
    const ocupado = agendamentosExistentes.includes(horario);
    
    return { horario, disponivel: !ocupado };
  }).filter(slot => slot.disponivel);
}

// Busca próximo horário livre a partir de uma data
export async function buscarProximoHorarioLivre(
  dataReferencia: Date,
  localAtendimento?: string
): Promise<{ data: Date; horario: string } | null> {
  let dataAtual = startOfDay(dataReferencia);
  const maxDias = 60; // Busca até 60 dias no futuro
  
  for (let i = 0; i < maxDias; i++) {
    const slots = await gerarHorariosDisponiveis(dataAtual, localAtendimento);
    const slotLivre = slots.find(s => s.disponivel);
    
    if (slotLivre) {
      return {
        data: dataAtual,
        horario: slotLivre.horario
      };
    }
    
    dataAtual = addDays(dataAtual, 1);
  }
  
  return null;
}

// Lista datas com disponibilidade em um mês
export async function listarDatasComDisponibilidade(
  mes: number,
  ano: number,
  localAtendimento?: string
): Promise<Date[]> {
  const datasDisponiveis: Date[] = [];
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);
  const hoje = startOfDay(new Date());
  
  // Busca clinica_ids se localAtendimento foi fornecido
  let clinicaIds: string[] = [];
  const slugs = getClinicaSlugsFromLocal(localAtendimento);
  if (slugs.length > 0) {
    clinicaIds = await buscarClinicaIdsPorSlugs(slugs);
  }
  const clinicaId = clinicaIds.length > 0 ? clinicaIds[0] : undefined;
  
  // Busca disponibilidade semanal
  const semanal = await buscarDisponibilidadeSemanal(clinicaId);
  const diasSemanaAtivos = semanal.filter(s => s.ativo).map(s => s.dia_semana);
  
  // Busca todas as disponibilidades específicas do mês
  let queryEspecificas = supabase
    .from('disponibilidade_especifica')
    .select('*')
    .gte('data', format(primeiroDia, 'yyyy-MM-dd'))
    .lte('data', format(ultimoDia, 'yyyy-MM-dd'));
  
  if (clinicaId) {
    queryEspecificas = queryEspecificas.eq('clinica_id', clinicaId);
  }
  
  const { data: especificas } = await queryEspecificas;
  
  const especificasMap = new Map<string, DisponibilidadeEspecifica>();
  (especificas || []).forEach(e => {
    especificasMap.set(e.data, e as DisponibilidadeEspecifica);
  });
  
  // Itera por cada dia do mês
  let dataAtual = primeiroDia;
  while (dataAtual <= ultimoDia) {
    // Ignora datas passadas
    if (!isBefore(dataAtual, hoje)) {
      const dataStr = format(dataAtual, 'yyyy-MM-dd');
      const especifica = especificasMap.get(dataStr);
      const diaSemana = dataAtual.getDay();
      
      if (especifica) {
        // Se há config específica, verifica se está disponível
        if (especifica.disponivel && especifica.hora_inicio && especifica.hora_fim) {
          datasDisponiveis.push(new Date(dataAtual));
        }
      } else {
        // Usa disponibilidade semanal
        if (diasSemanaAtivos.includes(diaSemana)) {
          datasDisponiveis.push(new Date(dataAtual));
        }
      }
    }
    
    dataAtual = addDays(dataAtual, 1);
  }
  
  return datasDisponiveis;
}

// Verifica se uma data específica tem disponibilidade
export async function verificarDataTemDisponibilidade(data: Date, localAtendimento?: string): Promise<boolean> {
  const slots = await gerarHorariosDisponiveis(data, localAtendimento);
  return slots.some(s => s.disponivel);
}
