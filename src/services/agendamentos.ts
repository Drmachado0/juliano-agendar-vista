import { supabase } from "@/integrations/supabase/client";

export interface Agendamento {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string;
  data_nascimento: string | null;
  email: string | null;
  tipo_atendimento: string;
  detalhe_exame_ou_cirurgia: string | null;
  local_atendimento: string;
  convenio: string;
  convenio_outro: string | null;
  data_agendamento: string;
  hora_agendamento: string;
  aceita_primeiro_horario: boolean;
  aceita_contato_whatsapp_email: boolean;
  status_crm: string;
  origem: string;
  observacoes_internas: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendamentoInsert {
  nome_completo: string;
  telefone_whatsapp: string;
  data_nascimento?: string | null;
  email?: string | null;
  tipo_atendimento: string;
  detalhe_exame_ou_cirurgia?: string | null;
  local_atendimento: string;
  convenio: string;
  convenio_outro?: string | null;
  data_agendamento: string;
  hora_agendamento: string;
  aceita_primeiro_horario?: boolean;
  aceita_contato_whatsapp_email?: boolean;
  status_crm?: string;
  origem?: string;
  observacoes_internas?: string | null;
}

export interface AgendamentoFilters {
  dataInicio?: string;
  dataFim?: string;
  localAtendimento?: string;
  statusCrm?: string;
  busca?: string;
}

// Create new agendamento (public - from website form)
export async function criarAgendamento(data: AgendamentoInsert): Promise<{ data: Agendamento | null; error: Error | null }> {
  const { data: agendamento, error } = await supabase
    .from('agendamentos')
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar agendamento:', error);
    return { data: null, error: new Error(error.message) };
  }

  // TODO: Integração futura com Google Calendar/Calendly
  // Aqui seria chamada a função para criar evento no calendário
  // await criarEventoCalendario(agendamento);

  return { data: agendamento as Agendamento, error: null };
}

// List agendamentos with filters (admin only)
export async function listarAgendamentos(
  filters: AgendamentoFilters = {},
  page: number = 1,
  pageSize: number = 20
): Promise<{ data: Agendamento[]; count: number; error: Error | null }> {
  let query = supabase
    .from('agendamentos')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filters.dataInicio) {
    query = query.gte('data_agendamento', filters.dataInicio);
  }
  if (filters.dataFim) {
    query = query.lte('data_agendamento', filters.dataFim);
  }
  if (filters.localAtendimento) {
    query = query.eq('local_atendimento', filters.localAtendimento);
  }
  if (filters.statusCrm) {
    query = query.eq('status_crm', filters.statusCrm);
  }
  if (filters.busca) {
    query = query.or(`nome_completo.ilike.%${filters.busca}%,telefone_whatsapp.ilike.%${filters.busca}%`);
  }

  // Order and paginate
  query = query
    .order('data_agendamento', { ascending: false })
    .order('hora_agendamento', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('Erro ao listar agendamentos:', error);
    return { data: [], count: 0, error: new Error(error.message) };
  }

  return { data: (data || []) as Agendamento[], count: count || 0, error: null };
}

// Get agendamentos by CRM status (for Kanban)
export async function listarAgendamentosPorStatus(): Promise<{ 
  data: Record<string, Agendamento[]>; 
  error: Error | null 
}> {
  const { data, error } = await supabase
    .from('agendamentos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao listar agendamentos por status:', error);
    return { data: { 'NOVO LEAD': [], 'CLINICOR': [], 'HGP': [] }, error: new Error(error.message) };
  }

  const grouped: Record<string, Agendamento[]> = {
    'NOVO LEAD': [],
    'CLINICOR': [],
    'HGP': []
  };

  (data || []).forEach((agendamento) => {
    const status = agendamento.status_crm || 'NOVO LEAD';
    if (grouped[status]) {
      grouped[status].push(agendamento as Agendamento);
    }
  });

  return { data: grouped, error: null };
}

// Update agendamento status (for Kanban drag-and-drop)
export async function atualizarStatusCrm(
  id: string, 
  novoStatus: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('agendamentos')
    .update({ status_crm: novoStatus, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar status CRM:', error);
    return { error: new Error(error.message) };
  }

  return { error: null };
}

// Update observações internas
export async function atualizarObservacoes(
  id: string, 
  observacoes: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('agendamentos')
    .update({ observacoes_internas: observacoes, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar observações:', error);
    return { error: new Error(error.message) };
  }

  return { error: null };
}

// Get single agendamento by ID
export async function buscarAgendamento(id: string): Promise<{ data: Agendamento | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('agendamentos')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Erro ao buscar agendamento:', error);
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as Agendamento, error: null };
}
