import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// Zod schema for appointment validation
const agendamentoInsertSchema = z.object({
  nome_completo: z
    .string()
    .min(3, "Nome deve ter no mínimo 3 caracteres")
    .max(200, "Nome deve ter no máximo 200 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Nome contém caracteres inválidos"),
  telefone_whatsapp: z
    .string()
    .min(10, "Telefone deve ter no mínimo 10 dígitos")
    .max(20, "Telefone deve ter no máximo 20 caracteres")
    .regex(/^[\d\s\-\(\)\+]+$/, "Telefone contém caracteres inválidos"),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida")
    .nullable()
    .optional(),
  email: z
    .string()
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres")
    .nullable()
    .optional()
    .or(z.literal("")),
  tipo_atendimento: z.enum(["Consulta", "Retorno", "Exame", "Cirurgia"], {
    errorMap: () => ({ message: "Tipo de atendimento inválido" }),
  }),
  detalhe_exame_ou_cirurgia: z
    .string()
    .max(500, "Detalhe deve ter no máximo 500 caracteres")
    .nullable()
    .optional(),
  local_atendimento: z
    .string()
    .min(1, "Local de atendimento é obrigatório")
    .max(200, "Local deve ter no máximo 200 caracteres"),
  convenio: z
    .string()
    .min(1, "Convênio é obrigatório")
    .max(100, "Convênio deve ter no máximo 100 caracteres"),
  convenio_outro: z
    .string()
    .max(100, "Convênio outro deve ter no máximo 100 caracteres")
    .nullable()
    .optional(),
  data_agendamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de agendamento inválida"),
  hora_agendamento: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora de agendamento inválida"),
  aceita_primeiro_horario: z.boolean().optional(),
  aceita_contato_whatsapp_email: z.boolean().optional(),
  status_crm: z
    .enum(["NOVO LEAD", "AGUARDANDO", "CLINICOR", "HGP", "BELÉM", "ATENDIDO"])
    .optional()
    .default("NOVO LEAD"),
  origem: z
    .string()
    .max(100, "Origem deve ter no máximo 100 caracteres")
    .optional()
    .default("site"),
  observacoes_internas: z
    .string()
    .max(2000, "Observações devem ter no máximo 2000 caracteres")
    .nullable()
    .optional(),
});

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
  data_agendamento: string | null;
  hora_agendamento: string | null;
  aceita_primeiro_horario: boolean;
  aceita_contato_whatsapp_email: boolean;
  status_crm: string;
  status_funil: string;
  origem: string;
  observacoes_internas: string | null;
  created_at: string;
  updated_at: string;
  // Campos para agenda multiclínicas
  clinica_id: string | null;
  profissional_id: string | null;
  servico_id: string | null;
  confirmacao_enviada: boolean;
  // Campos para confirmação WhatsApp automática
  confirmation_status: string | null;
  confirmation_sent_at: string | null;
  confirmation_response_at: string | null;
  confirmation_channel: string | null;
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
  // Novos campos opcionais
  clinica_id?: string | null;
  profissional_id?: string | null;
  servico_id?: string | null;
}

export interface AgendamentoFilters {
  dataInicio?: string;
  dataFim?: string;
  localAtendimento?: string;
  statusCrm?: string;
  busca?: string;
}

// Determine CRM status based on location
function determineStatusCrmByLocation(localAtendimento: string): string {
  const locationLower = localAtendimento.toLowerCase();
  
  if (locationLower.includes("clinicor")) {
    return "CLINICOR";
  }
  if (locationLower.includes("hgp") || locationLower.includes("hospital geral de paragominas")) {
    return "HGP";
  }
  if (locationLower.includes("belém") || locationLower.includes("belem") || locationLower.includes("iob") || locationLower.includes("vitria")) {
    return "BELÉM";
  }
  // Contacts without specific location stay as NOVO LEAD
  return "NOVO LEAD";
}

// Create new agendamento (public - from website form) via rate-limited edge function
export async function criarAgendamento(data: AgendamentoInsert): Promise<{ data: Agendamento | null; error: Error | null }> {
  // Validate input with zod schema on client side first
  const validationResult = agendamentoInsertSchema.safeParse(data);
  
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => e.message).join(", ");
    console.error('Validation error:', validationResult.error.errors);
    return { data: null, error: new Error(`Dados inválidos: ${errorMessages}`) };
  }

  // Sanitize and determine CRM status based on location
  const validatedData = validationResult.data;
  const autoStatusCrm = determineStatusCrmByLocation(validatedData.local_atendimento);
  
  const sanitizedData: AgendamentoInsert = {
    nome_completo: validatedData.nome_completo,
    telefone_whatsapp: validatedData.telefone_whatsapp,
    data_nascimento: validatedData.data_nascimento ?? null,
    email: validatedData.email === "" ? null : (validatedData.email ?? null),
    tipo_atendimento: validatedData.tipo_atendimento,
    detalhe_exame_ou_cirurgia: validatedData.detalhe_exame_ou_cirurgia ?? null,
    local_atendimento: validatedData.local_atendimento,
    convenio: validatedData.convenio,
    convenio_outro: validatedData.convenio_outro ?? null,
    data_agendamento: validatedData.data_agendamento,
    hora_agendamento: validatedData.hora_agendamento,
    aceita_primeiro_horario: validatedData.aceita_primeiro_horario ?? false,
    aceita_contato_whatsapp_email: validatedData.aceita_contato_whatsapp_email ?? false,
    status_crm: autoStatusCrm,
    origem: validatedData.origem ?? "site",
    observacoes_internas: validatedData.observacoes_internas ?? null,
  };

  // Call rate-limited edge function instead of direct insert
  const { data: responseData, error } = await supabase.functions.invoke('criar-agendamento', {
    body: sanitizedData,
  });

  if (error) {
    console.error('Erro ao criar agendamento:', error);
    return { data: null, error: new Error(error.message || 'Erro ao criar agendamento') };
  }

  // Check for rate limit or validation errors in response
  if (responseData?.error) {
    console.error('Erro retornado pela edge function:', responseData.error);
    return { data: null, error: new Error(responseData.error) };
  }

  // Return success with the created appointment ID
  return { 
    data: { ...sanitizedData, id: responseData?.data?.id || 'created' } as unknown as Agendamento, 
    error: null 
  };
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
    // Sanitize search input: limit length and escape ILIKE special characters to prevent pattern attacks
    const sanitizedSearch = filters.busca
      .slice(0, 100) // Limit to 100 characters to prevent DoS
      .replace(/[%_\\]/g, '\\$&'); // Escape ILIKE wildcards: %, _, \
    query = query.or(`nome_completo.ilike.%${sanitizedSearch}%,telefone_whatsapp.ilike.%${sanitizedSearch}%`);
  }

  // Order and paginate
  query = query
    .order('data_agendamento', { ascending: false })
    .order('hora_agendamento', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('Erro ao listar agendamentos:', error);
    
    // Detect JWT expired and force logout
    if (error.message?.includes('JWT expired') || error.code === 'PGRST303') {
      await supabase.auth.signOut();
      window.location.href = '/auth';
      return { data: [], count: 0, error: new Error('Sessão expirada. Redirecionando para login...') };
    }
    
    return { data: [], count: 0, error: new Error(error.message) };
  }

  return { data: (data || []) as Agendamento[], count: count || 0, error: null };
}

// Get agendamentos by CRM status (for Kanban) - Separando leads de agendamentos
// Ordenado por data de agendamento (ou created_at) dentro de cada coluna
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
    
    // Detect JWT expired and force logout
    if (error.message?.includes('JWT expired') || error.code === 'PGRST303') {
      await supabase.auth.signOut();
      window.location.href = '/auth';
    return { data: { 'NOVO LEAD': [], 'AGUARDANDO': [], 'CLINICOR': [], 'HGP': [], 'BELÉM': [], 'ATENDIDO': [] }, error: new Error('Sessão expirada. Redirecionando para login...') };
    }
    
    return { data: { 'NOVO LEAD': [], 'AGUARDANDO': [], 'CLINICOR': [], 'HGP': [], 'BELÉM': [], 'ATENDIDO': [] }, error: new Error(error.message) };
  }

  const grouped: Record<string, Agendamento[]> = {
    'NOVO LEAD': [],
    'AGUARDANDO': [],
    'CLINICOR': [],
    'HGP': [],
    'BELÉM': [],
    'ATENDIDO': []
  };

  (data || []).forEach((agendamento) => {
    const statusFunil = (agendamento as any).status_funil || 'agendado';
    const status = agendamento.status_crm || 'NOVO LEAD';
    
    // Leads incompletos: respeitar status_crm quando já atualizado
    if (statusFunil === 'lead' && status === 'NOVO LEAD') {
      grouped['NOVO LEAD'].push(agendamento as Agendamento);
    } else if (statusFunil === 'lead' && status === 'AGUARDANDO') {
      grouped['AGUARDANDO'].push(agendamento as Agendamento);
    } else if (grouped[status]) {
      grouped[status].push(agendamento as Agendamento);
    }
  });

  // Ordenar cada coluna por data (data_agendamento ou created_at)
  Object.keys(grouped).forEach(key => {
    grouped[key].sort((a, b) => {
      const dateA = a.data_agendamento || a.created_at;
      const dateB = b.data_agendamento || b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
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

// Get decrypted observations for an agendamento (admin only)
export async function buscarObservacoesDecrypted(id: string): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('get_observacoes_decrypted', { agendamento_id: id });

  if (error) {
    console.error('Erro ao buscar observações descriptografadas:', error);
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as string, error: null };
}

// Delete agendamento
export async function excluirAgendamento(id: string): Promise<{ error: Error | null }> {
  // First delete related messages
  await supabase
    .from('mensagens_whatsapp')
    .delete()
    .eq('agendamento_id', id);

  // Then delete the agendamento
  const { error } = await supabase
    .from('agendamentos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir agendamento:', error);
    return { error: new Error(error.message) };
  }

  return { error: null };
}

// Update agendamento (for editing)
export async function atualizarAgendamento(
  id: string,
  data: Partial<AgendamentoInsert>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('agendamentos')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar agendamento:', error);
    return { error: new Error(error.message) };
  }

  return { error: null };
}
