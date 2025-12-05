import { supabase } from "@/integrations/supabase/client";
import { Agendamento } from "./agendamentos";
import { Bloqueio } from "./disponibilidade";

export interface SlotAgenda {
  hora: string;
  minuto: number;
  horaFormatada: string;
  status: 'livre' | 'ocupado' | 'bloqueado' | 'passado';
  agendamento?: Agendamento;
  bloqueio?: Bloqueio;
  motivoBloqueio?: string;
}

interface DisponibilidadeSemanal {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  intervalo_minutos: number;
  ativo: boolean;
  clinica_id: string | null;
}

export async function verificarDiaAtivo(data: Date, clinicaId?: string): Promise<{ ativo: boolean; horaInicio?: string; horaFim?: string }> {
  const diaSemana = data.getDay();
  
  let query = supabase
    .from('disponibilidade_semanal')
    .select('*')
    .eq('dia_semana', diaSemana);
  
  if (clinicaId) {
    query = query.eq('clinica_id', clinicaId);
  }
  
  const { data: disponibilidade, error } = await query.maybeSingle();
  
  if (error) {
    console.error('Erro ao verificar disponibilidade semanal:', error);
    return { ativo: true }; // Em caso de erro, assume ativo
  }
  
  if (!disponibilidade || !disponibilidade.ativo) {
    return { ativo: false };
  }
  
  return { 
    ativo: true, 
    horaInicio: disponibilidade.hora_inicio,
    horaFim: disponibilidade.hora_fim
  };
}

export function gerarSlots(
  duracaoMin: number = 30,
  horaInicio: number = 8,
  horaFim: number = 18
): { hora: number; minuto: number; horaFormatada: string }[] {
  const slots: { hora: number; minuto: number; horaFormatada: string }[] = [];
  
  let horaAtual = horaInicio;
  let minutoAtual = 0;

  while (horaAtual < horaFim || (horaAtual === horaFim && minutoAtual === 0)) {
    const horaFormatada = `${String(horaAtual).padStart(2, '0')}:${String(minutoAtual).padStart(2, '0')}`;
    slots.push({ hora: horaAtual, minuto: minutoAtual, horaFormatada });

    minutoAtual += duracaoMin;
    if (minutoAtual >= 60) {
      horaAtual += Math.floor(minutoAtual / 60);
      minutoAtual = minutoAtual % 60;
    }
  }

  return slots;
}

export async function listarAgendamentosDia(
  data: string,
  clinicaId?: string,
  localAtendimento?: string
): Promise<{ data: Agendamento[]; error: Error | null }> {
  try {
    let query = supabase
      .from('agendamentos')
      .select('*')
      .eq('data_agendamento', data)
      .order('hora_agendamento', { ascending: true });

    if (clinicaId) {
      query = query.eq('clinica_id', clinicaId);
    } else if (localAtendimento) {
      query = query.eq('local_atendimento', localAtendimento);
    }

    const { data: agendamentos, error } = await query;

    if (error) throw error;

    return { data: agendamentos as Agendamento[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar agendamentos do dia:', err);
    return { data: [], error: err };
  }
}

export async function listarBloqueiosDia(
  data: string,
  clinicaId: string
): Promise<{ data: Bloqueio[]; error: Error | null }> {
  try {
    const { data: bloqueios, error } = await supabase
      .from('bloqueios_agenda')
      .select('*')
      .eq('clinica_id', clinicaId)
      .eq('data', data);

    if (error) throw error;

    return { data: bloqueios as Bloqueio[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar bloqueios do dia:', err);
    return { data: [], error: err };
  }
}

export function montarGradeAgenda(
  slots: { hora: number; minuto: number; horaFormatada: string }[],
  agendamentos: Agendamento[],
  bloqueios: Bloqueio[],
  dataAtual: Date,
  diaAtivo: boolean = true,
  horaInicioDisp?: string,
  horaFimDisp?: string
): SlotAgenda[] {
  const agora = new Date();
  const isHoje = dataAtual.toDateString() === agora.toDateString();
  const horaAgora = agora.getHours();
  const minutoAgora = agora.getMinutes();

  return slots.map(slot => {
    // Verificar se o slot é passado (somente se for hoje)
    const slotPassado = isHoje && (
      slot.hora < horaAgora || 
      (slot.hora === horaAgora && slot.minuto < minutoAgora)
    );

    if (slotPassado) {
      return {
        hora: String(slot.hora),
        minuto: slot.minuto,
        horaFormatada: slot.horaFormatada,
        status: 'passado' as const,
      };
    }

    // Se o dia não está ativo (ex: domingo), todos os slots são bloqueados
    if (!diaAtivo) {
      return {
        hora: String(slot.hora),
        minuto: slot.minuto,
        horaFormatada: slot.horaFormatada,
        status: 'bloqueado' as const,
        motivoBloqueio: 'Dia não disponível',
      };
    }

    // Verificar se o slot está fora do horário de funcionamento do dia
    if (horaInicioDisp && horaFimDisp) {
      const slotTime = slot.horaFormatada;
      if (slotTime < horaInicioDisp || slotTime >= horaFimDisp) {
        return {
          hora: String(slot.hora),
          minuto: slot.minuto,
          horaFormatada: slot.horaFormatada,
          status: 'bloqueado' as const,
          motivoBloqueio: 'Fora do horário de atendimento',
        };
      }
    }

    // Verificar se há bloqueio
    for (const bloqueio of bloqueios) {
      if (bloqueio.tipo_bloqueio === 'dia_inteiro' || bloqueio.tipo_bloqueio === 'feriado') {
        return {
          hora: String(slot.hora),
          minuto: slot.minuto,
          horaFormatada: slot.horaFormatada,
          status: 'bloqueado' as const,
          bloqueio,
        };
      }

      if (bloqueio.tipo_bloqueio === 'intervalo' && bloqueio.hora_inicio && bloqueio.hora_fim) {
        const slotTime = slot.horaFormatada;
        if (slotTime >= bloqueio.hora_inicio && slotTime < bloqueio.hora_fim) {
          return {
            hora: String(slot.hora),
            minuto: slot.minuto,
            horaFormatada: slot.horaFormatada,
            status: 'bloqueado' as const,
            bloqueio,
          };
        }
      }
    }

    // Verificar se há agendamento
    const agendamento = agendamentos.find(a => {
      const horaAgendamento = a.hora_agendamento.slice(0, 5);
      return horaAgendamento === slot.horaFormatada;
    });

    if (agendamento) {
      return {
        hora: String(slot.hora),
        minuto: slot.minuto,
        horaFormatada: slot.horaFormatada,
        status: 'ocupado' as const,
        agendamento,
      };
    }

    // Slot livre
    return {
      hora: String(slot.hora),
      minuto: slot.minuto,
      horaFormatada: slot.horaFormatada,
      status: 'livre' as const,
    };
  });
}
