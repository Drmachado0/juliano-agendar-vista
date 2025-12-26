import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ValidacaoResult {
  disponivel: boolean;
  motivo?: string;
  codigo?: 'BLOQUEIO_DIA_INTEIRO' | 'BLOQUEIO_INTERVALO' | 'SEM_DISPONIBILIDADE' | 'HORARIO_OCUPADO' | 'DATA_PASSADA' | 'FORA_EXPEDIENTE';
}

// Map location to clinic slugs
function getClinicaSlugsFromLocal(localAtendimento: string): string[] {
  const localLower = localAtendimento.toLowerCase();
  
  if (localLower.includes("clinicor")) {
    return ["clinicor"];
  }
  if (localLower.includes("hgp") || localLower.includes("hospital geral")) {
    return ["hgp"];
  }
  if (localLower.includes("belém") || localLower.includes("belem") || localLower.includes("iob") || localLower.includes("vitria")) {
    return ["belem", "iob", "vitria"];
  }
  return [];
}

// Generate time slots from start to end
function gerarSlots(horaInicio: string, horaFim: string, intervaloMinutos: number): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = horaInicio.split(':').map(Number);
  const [endHour, endMin] = horaFim.split(':').map(Number);
  
  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  while (currentMinutes < endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    currentMinutes += intervaloMinutos;
  }
  
  return slots;
}

// Check if time is within a block
function horarioDentroBloqueio(horario: string, horaInicio: string | null, horaFim: string | null): boolean {
  if (!horaInicio || !horaFim) return false;
  
  const [h, m] = horario.split(':').map(Number);
  const [startH, startM] = horaInicio.split(':').map(Number);
  const [endH, endM] = horaFim.split(':').map(Number);
  
  const timeMinutes = h * 60 + m;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  return timeMinutes >= startMinutes && timeMinutes < endMinutes;
}

export async function validarDisponibilidade(
  localAtendimento: string,
  dataAgendamento: string,
  horaAgendamento: string
): Promise<ValidacaoResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Normalize time to HH:MM format
  const horaNormalizada = horaAgendamento.substring(0, 5);
  
  console.log(`[validarDisponibilidade] Validando: ${dataAgendamento} ${horaNormalizada} - ${localAtendimento}`);

  // 1. Check if date is in the past
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataCheck = new Date(dataAgendamento + 'T00:00:00');
  
  if (dataCheck < hoje) {
    console.log(`[validarDisponibilidade] Data no passado: ${dataAgendamento}`);
    return {
      disponivel: false,
      motivo: 'Não é possível agendar em datas passadas',
      codigo: 'DATA_PASSADA'
    };
  }

  // 2. Get clinic IDs for the location
  const slugs = getClinicaSlugsFromLocal(localAtendimento);
  let clinicaIds: string[] = [];
  
  if (slugs.length > 0) {
    const { data: clinicas } = await supabase
      .from('clinicas')
      .select('id')
      .in('slug', slugs)
      .eq('ativo', true);
    
    clinicaIds = clinicas?.map(c => c.id) || [];
  }

  console.log(`[validarDisponibilidade] Clínicas encontradas: ${clinicaIds.length}`);

  // 3. Check for full-day blocks (feriado, dia_inteiro)
  const { data: bloqueiosDiaInteiro } = await supabase
    .from('bloqueios_agenda')
    .select('*')
    .eq('data', dataAgendamento)
    .in('tipo_bloqueio', ['dia_inteiro', 'feriado']);
  
  // Filter by clinic if we have clinic IDs
  const bloqueiosDiaFiltrados = bloqueiosDiaInteiro?.filter(b => 
    clinicaIds.length === 0 || clinicaIds.includes(b.clinica_id)
  ) || [];

  if (bloqueiosDiaFiltrados.length > 0) {
    const bloqueio = bloqueiosDiaFiltrados[0];
    console.log(`[validarDisponibilidade] Bloqueio dia inteiro encontrado: ${bloqueio.tipo_bloqueio}`);
    return {
      disponivel: false,
      motivo: bloqueio.motivo || 'Esta data está bloqueada para agendamentos',
      codigo: 'BLOQUEIO_DIA_INTEIRO'
    };
  }

  // 4. Check for interval blocks
  const { data: bloqueiosIntervalo } = await supabase
    .from('bloqueios_agenda')
    .select('*')
    .eq('data', dataAgendamento)
    .in('tipo_bloqueio', ['intervalo', 'ausencia_profissional']);
  
  const bloqueiosIntervaloFiltrados = bloqueiosIntervalo?.filter(b => 
    clinicaIds.length === 0 || clinicaIds.includes(b.clinica_id)
  ) || [];

  for (const bloqueio of bloqueiosIntervaloFiltrados) {
    if (horarioDentroBloqueio(horaNormalizada, bloqueio.hora_inicio, bloqueio.hora_fim)) {
      console.log(`[validarDisponibilidade] Horário dentro de bloqueio: ${bloqueio.hora_inicio} - ${bloqueio.hora_fim}`);
      return {
        disponivel: false,
        motivo: bloqueio.motivo || 'Este horário está bloqueado',
        codigo: 'BLOQUEIO_INTERVALO'
      };
    }
  }

  // 5. Check specific availability (override rules)
  const { data: disponibilidadeEspecifica } = await supabase
    .from('disponibilidade_especifica')
    .select('*')
    .eq('data', dataAgendamento);
  
  const dispEspecificaFiltrada = disponibilidadeEspecifica?.filter(d => 
    d.clinica_id === null || clinicaIds.length === 0 || clinicaIds.includes(d.clinica_id)
  ) || [];

  // If there's specific availability for this date
  if (dispEspecificaFiltrada.length > 0) {
    let encontrouHorario = false;
    
    for (const disp of dispEspecificaFiltrada) {
      if (!disp.disponivel) continue;
      if (!disp.hora_inicio || !disp.hora_fim) continue;
      
      const slots = gerarSlots(disp.hora_inicio, disp.hora_fim, disp.intervalo_minutos || 30);
      if (slots.includes(horaNormalizada)) {
        encontrouHorario = true;
        break;
      }
    }
    
    if (!encontrouHorario) {
      // Check if the date is marked as unavailable
      const indisponivel = dispEspecificaFiltrada.find(d => !d.disponivel);
      if (indisponivel) {
        console.log(`[validarDisponibilidade] Data marcada como indisponível`);
        return {
          disponivel: false,
          motivo: indisponivel.motivo || 'Esta data não está disponível',
          codigo: 'SEM_DISPONIBILIDADE'
        };
      }
      
      console.log(`[validarDisponibilidade] Horário fora da disponibilidade específica`);
      return {
        disponivel: false,
        motivo: 'Este horário não está disponível nesta data',
        codigo: 'FORA_EXPEDIENTE'
      };
    }
  } else {
    // 6. Check weekly availability
    const diaSemana = new Date(dataAgendamento + 'T12:00:00').getDay();
    
    const { data: disponibilidadeSemanal } = await supabase
      .from('disponibilidade_semanal')
      .select('*')
      .eq('dia_semana', diaSemana)
      .eq('ativo', true);
    
    const dispSemanalFiltrada = disponibilidadeSemanal?.filter(d => 
      d.clinica_id === null || clinicaIds.length === 0 || clinicaIds.includes(d.clinica_id)
    ) || [];

    if (dispSemanalFiltrada.length === 0) {
      console.log(`[validarDisponibilidade] Sem disponibilidade semanal para dia ${diaSemana}`);
      return {
        disponivel: false,
        motivo: 'Não há expediente neste dia da semana',
        codigo: 'SEM_DISPONIBILIDADE'
      };
    }

    // Check if time is within any weekly availability
    let encontrouHorario = false;
    for (const disp of dispSemanalFiltrada) {
      const slots = gerarSlots(disp.hora_inicio, disp.hora_fim, disp.intervalo_minutos);
      if (slots.includes(horaNormalizada)) {
        encontrouHorario = true;
        break;
      }
    }

    if (!encontrouHorario) {
      console.log(`[validarDisponibilidade] Horário fora do expediente semanal`);
      return {
        disponivel: false,
        motivo: 'Este horário está fora do expediente',
        codigo: 'FORA_EXPEDIENTE'
      };
    }
  }

  // 7. Check for existing appointments at the same time
  const { data: agendamentosExistentes } = await supabase
    .from('agendamentos')
    .select('id, nome_completo')
    .eq('data_agendamento', dataAgendamento)
    .eq('hora_agendamento', horaNormalizada)
    .neq('status_funil', 'cancelado');
  
  // Filter by location/clinic if needed
  // For now, we consider any appointment at the same time as a conflict
  if (agendamentosExistentes && agendamentosExistentes.length > 0) {
    console.log(`[validarDisponibilidade] Já existe agendamento neste horário: ${agendamentosExistentes.length}`);
    return {
      disponivel: false,
      motivo: 'Este horário já está ocupado',
      codigo: 'HORARIO_OCUPADO'
    };
  }

  console.log(`[validarDisponibilidade] Horário disponível!`);
  return {
    disponivel: true
  };
}
