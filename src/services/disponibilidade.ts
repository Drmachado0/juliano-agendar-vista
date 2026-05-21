import { supabase } from "@/integrations/supabase/client";
import { Clinica } from "./clinicas";

export type TipoBloqueio = 'dia_inteiro' | 'intervalo' | 'ausencia_profissional' | 'feriado';

export interface Bloqueio {
  id: string;
  clinica_id: string;
  profissional_id: string | null;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  tipo_bloqueio: TipoBloqueio;
  motivo: string | null;
  created_at: string;
  updated_at: string;
  clinicas?: Clinica;
}

export interface BloqueioInsert {
  clinica_id: string;
  profissional_id?: string | null;
  data: string;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  tipo_bloqueio: TipoBloqueio;
  motivo?: string | null;
}

export async function listarBloqueios(
  clinicaId?: string,
  dataInicio?: string,
  dataFim?: string
): Promise<{ data: Bloqueio[]; error: Error | null }> {
  try {
    let query = supabase
      .from('bloqueios_agenda')
      .select('*, clinicas(nome)')
      .order('data', { ascending: true });

    if (clinicaId) {
      query = query.eq('clinica_id', clinicaId);
    }

    if (dataInicio) {
      query = query.gte('data', dataInicio);
    }

    if (dataFim) {
      query = query.lte('data', dataFim);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data: data as Bloqueio[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar bloqueios:', err);
    return { data: [], error: err };
  }
}

export async function criarBloqueio(bloqueio: BloqueioInsert): Promise<{ data: Bloqueio | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('bloqueios_agenda')
      .insert(bloqueio)
      .select()
      .single();

    if (error) throw error;

    return { data: data as Bloqueio, error: null };
  } catch (err: any) {
    console.error('Erro ao criar bloqueio:', err);
    return { data: null, error: err };
  }
}

export async function atualizarBloqueio(
  id: string,
  dados: Partial<BloqueioInsert>
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('bloqueios_agenda')
      .update(dados)
      .eq('id', id);

    if (error) throw error;

    return { error: null };
  } catch (err: any) {
    console.error('Erro ao atualizar bloqueio:', err);
    return { error: err };
  }
}

export async function removerBloqueio(id: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('bloqueios_agenda')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { error: null };
  } catch (err: any) {
    console.error('Erro ao remover bloqueio:', err);
    return { error: err };
  }
}

export async function verificarDisponibilidade(
  clinicaId: string,
  data: string,
  horaInicio: string,
  horaFim: string,
  profissionalId?: string
): Promise<{ disponivel: boolean; motivo: string | null; error: Error | null }> {
  try {
    // Buscar bloqueios do dia
    const { data: bloqueios, error } = await supabase
      .from('bloqueios_agenda')
      .select('*')
      .eq('clinica_id', clinicaId)
      .eq('data', data);

    if (error) throw error;

    if (!bloqueios || bloqueios.length === 0) {
      return { disponivel: true, motivo: null, error: null };
    }

    for (const bloqueio of bloqueios) {
      // Bloqueio de dia inteiro ou feriado
      if (bloqueio.tipo_bloqueio === 'dia_inteiro' || bloqueio.tipo_bloqueio === 'feriado') {
        return { 
          disponivel: false, 
          motivo: bloqueio.motivo || `Dia bloqueado: ${bloqueio.tipo_bloqueio}`,
          error: null 
        };
      }

      // Bloqueio de ausência de profissional (só se o agendamento for com esse profissional)
      if (bloqueio.tipo_bloqueio === 'ausencia_profissional') {
        if (profissionalId && bloqueio.profissional_id === profissionalId) {
          return { 
            disponivel: false, 
            motivo: bloqueio.motivo || 'Profissional indisponível',
            error: null 
          };
        }
        continue; // Se não for o mesmo profissional, continua
      }

      // Bloqueio de intervalo
      if (bloqueio.tipo_bloqueio === 'intervalo' && bloqueio.hora_inicio && bloqueio.hora_fim) {
        const bloqueioInicio = bloqueio.hora_inicio;
        const bloqueioFim = bloqueio.hora_fim;

        // Verificar sobreposição de horários
        if (horaInicio < bloqueioFim && horaFim > bloqueioInicio) {
          return { 
            disponivel: false, 
            motivo: bloqueio.motivo || `Horário bloqueado: ${bloqueioInicio} - ${bloqueioFim}`,
            error: null 
          };
        }
      }
    }

    return { disponivel: true, motivo: null, error: null };
  } catch (err: any) {
    console.error('Erro ao verificar disponibilidade:', err);
    return { disponivel: false, motivo: 'Erro ao verificar disponibilidade', error: err };
  }
}

export function getTipoBloqueioLabel(tipo: TipoBloqueio): string {
  const labels: Record<TipoBloqueio, string> = {
    'dia_inteiro': 'Dia Inteiro',
    'intervalo': 'Intervalo',
    'ausencia_profissional': 'Ausência de Profissional',
    'feriado': 'Feriado',
  };
  return labels[tipo] || tipo;
}

// ─────────────────────────────────────────────
// "Datas abertas" e "Modelos de horário"
// ─────────────────────────────────────────────

export interface ModeloHorario {
  id: string;
  clinica_id: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  intervalo_minutos: number;
  ativo: boolean;
  nome: string | null;
}

export interface DataAberta {
  id: string;
  clinica_id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  intervalo_minutos: number | null;
  modelo_id: string | null;
  disponivel: boolean;
  motivo: string | null;
}

export async function listarModelosHorario(clinicaId: string): Promise<ModeloHorario[]> {
  const { data, error } = await supabase
    .from("disponibilidade_semanal")
    .select("*")
    .eq("clinica_id", clinicaId)
    .eq("ativo", true)
    .order("dia_semana");
  if (error) {
    console.error("listarModelosHorario:", error);
    return [];
  }
  return (data as ModeloHorario[]) || [];
}

export async function buscarDataAberta(
  clinicaId: string,
  data: string
): Promise<DataAberta | null> {
  const { data: rows, error } = await supabase
    .from("disponibilidade_especifica")
    .select("*")
    .eq("clinica_id", clinicaId)
    .eq("data", data)
    .eq("disponivel", true)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error("buscarDataAberta:", error);
    return null;
  }
  return ((rows?.[0] as unknown) as DataAberta) || null;
}

async function limparBloqueiosDiaInteiro(clinicaId: string, data: string) {
  // Ao abrir um dia, removemos bloqueios "dia_inteiro"/"feriado" que estariam
  // sobrescrevendo todos os slots. Bloqueios granulares (intervalo,
  // ausencia_profissional) são mantidos.
  await supabase
    .from("bloqueios_agenda")
    .delete()
    .eq("clinica_id", clinicaId)
    .eq("data", data)
    .in("tipo_bloqueio", ["dia_inteiro", "feriado"]);
}

export async function abrirDiaManual(input: {
  clinicaId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  intervaloMinutos: number;
  motivo?: string | null;
}): Promise<{ error: Error | null }> {
  await limparBloqueiosDiaInteiro(input.clinicaId, input.data);
  const { error } = await supabase.from("disponibilidade_especifica").insert({
    clinica_id: input.clinicaId,
    data: input.data,
    hora_inicio: input.horaInicio,
    hora_fim: input.horaFim,
    intervalo_minutos: input.intervaloMinutos,
    disponivel: true,
    motivo: input.motivo || null,
  });
  return { error: error as any };
}

export async function abrirDiaComModelo(input: {
  clinicaId: string;
  data: string;
  modeloId: string;
}): Promise<{ error: Error | null }> {
  await limparBloqueiosDiaInteiro(input.clinicaId, input.data);
  const { error } = await supabase.from("disponibilidade_especifica").insert({
    clinica_id: input.clinicaId,
    data: input.data,
    modelo_id: input.modeloId,
    disponivel: true,
  } as any);
  return { error: error as any };
}

export async function fecharDia(
  clinicaId: string,
  data: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("disponibilidade_especifica")
    .delete()
    .eq("clinica_id", clinicaId)
    .eq("data", data);
  return { error: error as any };
}

export function getTipoBloqueioColor(tipo: TipoBloqueio): string {
  const colors: Record<TipoBloqueio, string> = {
    'dia_inteiro': 'bg-red-100 text-red-800 border-red-200',
    'intervalo': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'ausencia_profissional': 'bg-gray-100 text-gray-800 border-gray-200',
    'feriado': 'bg-orange-100 text-orange-800 border-orange-200',
  };
  return colors[tipo] || 'bg-gray-100 text-gray-800';
}
