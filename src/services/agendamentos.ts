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
    .enum(["NOVO LEAD", "CLINICOR", "HGP", "BELÉM"])
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
  data_agendamento: string;
  hora_agendamento: string;
  aceita_primeiro_horario: boolean;
  aceita_contato_whatsapp_email: boolean;
  status_crm: string;
  origem: string;
  observacoes_internas: string | null;
  created_at: string;
  updated_at: string;
  // Novos campos para agenda multiclínicas
  clinica_id: string | null;
  profissional_id: string | null;
  servico_id: string | null;
  confirmacao_enviada: boolean;
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

// Create new agendamento (public - from website form)
export async function criarAgendamento(data: AgendamentoInsert): Promise<{ data: Agendamento | null; error: Error | null }> {
  // Validate input with zod schema
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
    status_crm: autoStatusCrm, // Automatically set based on location
    origem: validatedData.origem ?? "site",
    observacoes_internas: validatedData.observacoes_internas ?? null,
  };

  const { data: agendamento, error } = await supabase
    .from('agendamentos')
    .insert([sanitizedData])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar agendamento:', error);
    return { data: null, error: new Error(error.message) };
  }

  // Enviar notificações em paralelo (não bloqueiam a criação)
  const notificacoes = [];

  // 1. Enviar WhatsApp para o paciente
  notificacoes.push(
    supabase.functions.invoke('confirmar-agendamento-whatsapp', {
      body: { agendamento_id: agendamento.id },
    }).then(() => console.log('WhatsApp enviado para o paciente'))
      .catch((err) => console.error('Erro ao enviar WhatsApp (não crítico):', err))
  );

  // 2. Enviar email para o Dr. Juliano
  notificacoes.push(
    supabase.functions.invoke('notificar-agendamento-email', {
      body: {
        nome_completo: sanitizedData.nome_completo,
        telefone_whatsapp: sanitizedData.telefone_whatsapp,
        email_paciente: sanitizedData.email,
        data_nascimento: sanitizedData.data_nascimento,
        tipo_atendimento: sanitizedData.tipo_atendimento,
        detalhe_exame_ou_cirurgia: sanitizedData.detalhe_exame_ou_cirurgia,
        local_atendimento: sanitizedData.local_atendimento,
        convenio: sanitizedData.convenio,
        convenio_outro: sanitizedData.convenio_outro,
        data_agendamento: sanitizedData.data_agendamento,
        hora_agendamento: sanitizedData.hora_agendamento,
      },
    }).then(() => console.log('Email de notificação enviado'))
      .catch((err) => console.error('Erro ao enviar email (não crítico):', err))
  );

  // Executar notificações em paralelo sem bloquear
  Promise.all(notificacoes).catch(() => {});

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
    return { data: { 'NOVO LEAD': [], 'CLINICOR': [], 'HGP': [], 'BELÉM': [] }, error: new Error(error.message) };
  }

  const grouped: Record<string, Agendamento[]> = {
    'NOVO LEAD': [],
    'CLINICOR': [],
    'HGP': [],
    'BELÉM': []
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
