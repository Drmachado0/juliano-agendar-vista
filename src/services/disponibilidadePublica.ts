import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfDay, isBefore, isSameDay, startOfMonth, endOfMonth, getDay } from "date-fns";

// Interface para data com quantidade de slots
export interface DataComSlots {
  data: Date;
  slotsDisponiveis: number;
}

// Mapeia o valor do local de atendimento para o(s) slug(s) da clínica
export function getClinicaSlugsFromLocal(localAtendimento?: string): string[] {
  if (!localAtendimento) return [];
  
  const local = localAtendimento.toLowerCase();
  
  if (local.includes('clinicor')) {
    return ['clinicor'];
  } else if (local.includes('hgp') || local.includes('hospital geral')) {
    return ['hgp'];
  } else if (local.includes('belem') || local.includes('belém') || local.includes('iob') || local.includes('vitria')) {
    return ['iob', 'vitria'];
  }
  
  return [];
}

// Busca os IDs das clínicas pelos slugs
export async function buscarClinicaIdsPorSlugs(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  
  const { data, error } = await supabase
    .from('clinicas')
    .select('id')
    .in('slug', slugs)
    .eq('ativo', true);
  
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

interface DisponibilidadeSemanal {
  id: string;
  clinica_id: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  intervalo_minutos: number;
  ativo: boolean;
}

interface DisponibilidadeEspecifica {
  id: string;
  data: string;
  clinica_id: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  intervalo_minutos: number | null;
  disponivel: boolean;
  // Note: motivo field excluded from public queries for security
}

interface Bloqueio {
  id: string;
  clinica_id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  tipo_bloqueio: string;
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

// Busca disponibilidade semanal para múltiplas clínicas
async function buscarDisponibilidadeSemanalMulti(clinicaIds: string[]): Promise<DisponibilidadeSemanal[]> {
  if (clinicaIds.length === 0) {
    // Busca global se não houver clínica específica
    const { data, error } = await supabase
      .from('disponibilidade_semanal')
      .select('*')
      .is('clinica_id', null)
      .eq('ativo', true);
    
    if (error || !data) return [];
    return data as DisponibilidadeSemanal[];
  }
  
  const { data, error } = await supabase
    .from('disponibilidade_semanal')
    .select('*')
    .in('clinica_id', clinicaIds)
    .eq('ativo', true);
  
  if (error || !data) return [];
  return data as DisponibilidadeSemanal[];
}

// Busca horários ocupados para um período via SECURITY DEFINER function
async function buscarAgendamentosPeriodo(
  dataInicio: string, 
  dataFim: string, 
  clinicaIds: string[]
): Promise<Map<string, Set<string>>> {
  const { data, error } = await supabase.rpc('horarios_ocupados', {
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
    p_clinica_ids: clinicaIds.length > 0 ? clinicaIds : null
  });
  
  if (error || !data) {
    console.error('Erro ao buscar horários ocupados:', error);
    return new Map();
  }
  
  // Mapa: data -> Set de horários ocupados
  const agendamentosMap = new Map<string, Set<string>>();
  
  for (const ag of data as { data_agendamento: string; hora_agendamento: string; clinica_id: string | null }[]) {
    const dataKey = ag.data_agendamento;
    if (!agendamentosMap.has(dataKey)) {
      agendamentosMap.set(dataKey, new Set());
    }
    agendamentosMap.get(dataKey)!.add(ag.hora_agendamento.slice(0, 5));
  }
  
  return agendamentosMap;
}

// Busca bloqueios para um período
async function buscarBloqueiosPeriodo(
  dataInicio: string, 
  dataFim: string, 
  clinicaIds: string[]
): Promise<Bloqueio[]> {
  if (clinicaIds.length === 0) return [];
  
  const { data, error } = await supabase
    .from('bloqueios_agenda')
    .select('*')
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .in('clinica_id', clinicaIds);
  
  if (error || !data) {
    console.error('Erro ao buscar bloqueios:', error);
    return [];
  }
  
  return data as Bloqueio[];
}

// Verifica se um horário está bloqueado
function horarioBloqueado(horario: string, bloqueios: Bloqueio[]): boolean {
  for (const bloqueio of bloqueios) {
    // Bloqueio de dia inteiro ou feriado
    if (bloqueio.tipo_bloqueio === 'dia_inteiro' || bloqueio.tipo_bloqueio === 'feriado') {
      return true;
    }
    
    // Bloqueio de intervalo
    if (bloqueio.hora_inicio && bloqueio.hora_fim) {
      const inicio = bloqueio.hora_inicio.slice(0, 5);
      const fim = bloqueio.hora_fim.slice(0, 5);
      if (horario >= inicio && horario < fim) {
        return true;
      }
    }
  }
  return false;
}

// Gera horários disponíveis para um dia específico
export async function gerarHorariosDisponiveis(data: Date, localAtendimento?: string): Promise<SlotDisponivel[]> {
  const dataStr = format(data, 'yyyy-MM-dd');
  const diaSemana = getDay(data);
  const hoje = new Date();
  const isHoje = isSameDay(data, hoje);
  
  // Verifica se a data é passada
  if (isBefore(startOfDay(data), startOfDay(hoje))) {
    return [];
  }
  
  // Busca clinica_ids
  const slugs = getClinicaSlugsFromLocal(localAtendimento);
  const clinicaIds = await buscarClinicaIdsPorSlugs(slugs);
  
  // Busca disponibilidade semanal para TODAS as clínicas selecionadas
  const disponibilidadeSemanal = await buscarDisponibilidadeSemanalMulti(clinicaIds);
  
  // Filtrar para o dia da semana
  const dispDia = disponibilidadeSemanal.filter(d => d.dia_semana === diaSemana);
  
  if (dispDia.length === 0) {
    return [];
  }
  
  // Busca disponibilidade específica (exclude 'motivo' field for security)
  let queryEspecifica = supabase
    .from('disponibilidade_especifica')
    .select('id, data, clinica_id, hora_inicio, hora_fim, intervalo_minutos, disponivel')
    .eq('data', dataStr);
  
  if (clinicaIds.length > 0) {
    queryEspecifica = queryEspecifica.in('clinica_id', clinicaIds);
  }
  
  const { data: dispEspecificas } = await queryEspecifica;
  
  // Se há disponibilidade específica marcando como indisponível
  const indisponivel = (dispEspecificas || []).find(d => d.disponivel === false);
  if (indisponivel) {
    return [];
  }
  
  // Busca bloqueios do dia
  const bloqueios = await buscarBloqueiosPeriodo(dataStr, dataStr, clinicaIds);
  
  // Verificar se TODAS as clínicas estão bloqueadas no dia inteiro
  // Para Belém, se apenas uma clínica estiver disponível, ainda temos horários
  if (clinicaIds.length > 0) {
    const clinicasBloqueadas = new Set<string>();
    for (const b of bloqueios) {
      if (b.tipo_bloqueio === 'dia_inteiro' || b.tipo_bloqueio === 'feriado') {
        clinicasBloqueadas.add(b.clinica_id);
      }
    }
    // Se todas as clínicas estão bloqueadas, retorna vazio
    if (clinicasBloqueadas.size >= clinicaIds.length) {
      return [];
    }
  }
  
  // Busca agendamentos do dia
  const agendamentosMap = await buscarAgendamentosPeriodo(dataStr, dataStr, clinicaIds);
  const horariosOcupados = agendamentosMap.get(dataStr) || new Set<string>();
  
  // Gerar slots baseado na disponibilidade
  // Usar a disponibilidade específica se existir, senão usar semanal
  const dispEspecificaAtiva = (dispEspecificas || []).find(d => 
    d.disponivel !== false && d.hora_inicio && d.hora_fim
  );
  
  let horaInicio: string;
  let horaFim: string;
  let intervalo: number;
  
  if (dispEspecificaAtiva && dispEspecificaAtiva.hora_inicio && dispEspecificaAtiva.hora_fim) {
    horaInicio = dispEspecificaAtiva.hora_inicio;
    horaFim = dispEspecificaAtiva.hora_fim;
    intervalo = dispEspecificaAtiva.intervalo_minutos || 30;
  } else {
    // Para múltiplas clínicas, pegar o intervalo mais amplo
    const primeiraDisp = dispDia[0];
    horaInicio = primeiraDisp.hora_inicio;
    horaFim = primeiraDisp.hora_fim;
    intervalo = primeiraDisp.intervalo_minutos;
    
    for (const d of dispDia) {
      if (d.hora_inicio < horaInicio) horaInicio = d.hora_inicio;
      if (d.hora_fim > horaFim) horaFim = d.hora_fim;
    }
  }
  
  const todosSlots = gerarSlots(horaInicio, horaFim, intervalo);
  
  // Filtrar slots disponíveis
  const slotsDisponiveis: SlotDisponivel[] = [];
  const horaAtualMinutos = hoje.getHours() * 60 + hoje.getMinutes();
  
  for (const slot of todosSlots) {
    // Verificar se já passou (para hoje)
    if (isHoje) {
      const [h, m] = slot.split(':').map(Number);
      const slotMinutos = h * 60 + m;
      if (slotMinutos <= horaAtualMinutos + 30) { // 30 min de margem
        continue;
      }
    }
    
    // Verificar se está ocupado
    if (horariosOcupados.has(slot)) {
      continue;
    }
    
    // Verificar se está bloqueado
    if (horarioBloqueado(slot, bloqueios)) {
      continue;
    }
    
    slotsDisponiveis.push({
      horario: slot,
      disponivel: true
    });
  }
  
  return slotsDisponiveis;
}

// Busca próximo horário livre a partir de uma data
export async function buscarProximoHorarioLivre(
  dataReferencia: Date,
  localAtendimento?: string
): Promise<{ data: Date; horario: string } | null> {
  let dataAtual = startOfDay(dataReferencia);
  const maxDias = 60;
  
  for (let i = 0; i < maxDias; i++) {
    const slots = await gerarHorariosDisponiveis(dataAtual, localAtendimento);
    
    if (slots.length > 0) {
      return {
        data: dataAtual,
        horario: slots[0].horario
      };
    }
    
    dataAtual = addDays(dataAtual, 1);
  }
  
  return null;
}

// Lista datas com disponibilidade e quantidade de slots - VERSÃO OTIMIZADA
export async function listarDatasComSlotsDisponiveis(
  mes: number,
  ano: number,
  localAtendimento?: string
): Promise<DataComSlots[]> {
  const primeiroDia = startOfMonth(new Date(ano, mes));
  const ultimoDia = endOfMonth(new Date(ano, mes));
  const hoje = startOfDay(new Date());
  
  const dataInicio = format(primeiroDia, 'yyyy-MM-dd');
  const dataFim = format(ultimoDia, 'yyyy-MM-dd');
  
  // Busca clinica_ids
  const slugs = getClinicaSlugsFromLocal(localAtendimento);
  const clinicaIds = await buscarClinicaIdsPorSlugs(slugs);
  
  // Buscar dados em batch para otimização
  const [disponibilidadeSemanal, bloqueios, agendamentosMap] = await Promise.all([
    buscarDisponibilidadeSemanalMulti(clinicaIds),
    buscarBloqueiosPeriodo(dataInicio, dataFim, clinicaIds),
    buscarAgendamentosPeriodo(dataInicio, dataFim, clinicaIds)
  ]);
  
  // Buscar disponibilidades específicas do mês (exclude 'motivo' field for security)
  let queryEspecifica = supabase
    .from('disponibilidade_especifica')
    .select('id, data, clinica_id, hora_inicio, hora_fim, intervalo_minutos, disponivel')
    .gte('data', dataInicio)
    .lte('data', dataFim);
  
  if (clinicaIds.length > 0) {
    queryEspecifica = queryEspecifica.in('clinica_id', clinicaIds);
  }
  
  const { data: dispEspecificas } = await queryEspecifica;
  
  // Mapear por data
  const dispEspecificasMap = new Map<string, DisponibilidadeEspecifica[]>();
  for (const de of (dispEspecificas || [])) {
    const key = de.data;
    if (!dispEspecificasMap.has(key)) {
      dispEspecificasMap.set(key, []);
    }
    dispEspecificasMap.get(key)!.push(de as DisponibilidadeEspecifica);
  }
  
  // Mapear bloqueios por data
  const bloqueiosMap = new Map<string, Bloqueio[]>();
  for (const b of bloqueios) {
    const key = b.data;
    if (!bloqueiosMap.has(key)) {
      bloqueiosMap.set(key, []);
    }
    bloqueiosMap.get(key)!.push(b);
  }
  
  const resultado: DataComSlots[] = [];
  let dataAtual = new Date(primeiroDia);
  
  while (dataAtual <= ultimoDia) {
    // Ignorar datas passadas
    if (isBefore(dataAtual, hoje)) {
      dataAtual = addDays(dataAtual, 1);
      continue;
    }
    
    const dataStr = format(dataAtual, 'yyyy-MM-dd');
    const diaSemana = getDay(dataAtual);
    
    // Verificar disponibilidade semanal
    const dispDia = disponibilidadeSemanal.filter(d => d.dia_semana === diaSemana);
    
    if (dispDia.length === 0) {
      dataAtual = addDays(dataAtual, 1);
      continue;
    }
    
    // Verificar disponibilidade específica
    const dispEspecificasDia = dispEspecificasMap.get(dataStr) || [];
    const indisponivel = dispEspecificasDia.find(d => d.disponivel === false);
    
    if (indisponivel) {
      dataAtual = addDays(dataAtual, 1);
      continue;
    }
    
    // Verificar bloqueios do dia
    const bloqueiosDia = bloqueiosMap.get(dataStr) || [];
    
    // Para múltiplas clínicas, verificar se TODAS estão bloqueadas
    if (clinicaIds.length > 0) {
      const clinicasBloqueadas = new Set<string>();
      for (const b of bloqueiosDia) {
        if (b.tipo_bloqueio === 'dia_inteiro' || b.tipo_bloqueio === 'feriado') {
          clinicasBloqueadas.add(b.clinica_id);
        }
      }
      if (clinicasBloqueadas.size >= clinicaIds.length) {
        dataAtual = addDays(dataAtual, 1);
        continue;
      }
    }
    
    // Gerar slots e contar disponíveis
    const dispEspecificaAtiva = dispEspecificasDia.find(d => 
      d.disponivel !== false && d.hora_inicio && d.hora_fim
    );
    
    let horaInicio: string;
    let horaFim: string;
    let intervalo: number;
    
    if (dispEspecificaAtiva && dispEspecificaAtiva.hora_inicio && dispEspecificaAtiva.hora_fim) {
      horaInicio = dispEspecificaAtiva.hora_inicio;
      horaFim = dispEspecificaAtiva.hora_fim;
      intervalo = dispEspecificaAtiva.intervalo_minutos || 30;
    } else {
      const primeiraDisp = dispDia[0];
      horaInicio = primeiraDisp.hora_inicio;
      horaFim = primeiraDisp.hora_fim;
      intervalo = primeiraDisp.intervalo_minutos;
      
      for (const d of dispDia) {
        if (d.hora_inicio < horaInicio) horaInicio = d.hora_inicio;
        if (d.hora_fim > horaFim) horaFim = d.hora_fim;
      }
    }
    
    const todosSlots = gerarSlots(horaInicio, horaFim, intervalo);
    const horariosOcupados = agendamentosMap.get(dataStr) || new Set<string>();
    const agora = new Date();
    const horaAtualMinutos = agora.getHours() * 60 + agora.getMinutes();
    const isHoje = isSameDay(dataAtual, agora);
    
    // Contar slots disponíveis
    let slotsDisponiveis = 0;
    
    for (const slot of todosSlots) {
      // Verificar se já passou (para hoje)
      if (isHoje) {
        const [h, m] = slot.split(':').map(Number);
        const slotMinutos = h * 60 + m;
        if (slotMinutos <= horaAtualMinutos + 30) {
          continue;
        }
      }
      
      // Verificar se está ocupado
      if (horariosOcupados.has(slot)) {
        continue;
      }
      
      // Verificar se está bloqueado
      if (horarioBloqueado(slot, bloqueiosDia)) {
        continue;
      }
      
      slotsDisponiveis++;
    }
    
    if (slotsDisponiveis > 0) {
      resultado.push({
        data: new Date(dataAtual),
        slotsDisponiveis
      });
    }
    
    dataAtual = addDays(dataAtual, 1);
  }
  
  return resultado;
}

// Lista datas com disponibilidade em um mês (mantida para compatibilidade)
export async function listarDatasComDisponibilidade(
  mes: number,
  ano: number,
  localAtendimento?: string
): Promise<Date[]> {
  const datasComSlots = await listarDatasComSlotsDisponiveis(mes, ano, localAtendimento);
  return datasComSlots.map(d => d.data);
}

// Verifica se uma data específica tem disponibilidade
export async function verificarDataTemDisponibilidade(data: Date, localAtendimento?: string): Promise<boolean> {
  const slots = await gerarHorariosDisponiveis(data, localAtendimento);
  return slots.length > 0;
}
