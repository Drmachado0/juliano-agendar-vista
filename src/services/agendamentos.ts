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
    .regex(/^[\d\s\-()+]+$/, "Telefone contém caracteres inválidos"),
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
    .enum(["NOVO LEAD", "AGUARDANDO", "PRECISA_DE_HUMANO", "EXAMES_HGP", "CLINICOR", "HGP", "BELÉM", "ATENDIDO", "YAG_LASER"])
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
  // Sandbox / contatos de teste
  is_sandbox: boolean;
  sandbox_reason: string | null;
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
  sandbox?: "reais" | "todos" | "somente_testes"; // default reais
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

// Captura sinais de tracking (cookies fbc/fbp/UTMs/click IDs/landing/referrer)
// para CAPI dedup E persistência na tabela agendamentos (colunas adicionadas
// em migration 20260502005818).
function captureMetaSignals() {
  if (typeof window === 'undefined') return {};

  const getCookie = (name: string): string | undefined => {
    const m = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]+)`));
    return m ? m[2] : undefined;
  };

  const params = new URLSearchParams(window.location.search);
  const persisted = (key: string) =>
    params.get(key) ?? sessionStorage.getItem(key) ?? undefined;

  // Persiste em sessionStorage para sobreviver à navegação interna até o submit
  for (const k of [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'gclid', 'fbclid', 'gbraid', 'wbraid',
  ]) {
    const v = params.get(k);
    if (v) sessionStorage.setItem(k, v);
  }
  if (!sessionStorage.getItem('landing_page')) {
    sessionStorage.setItem('landing_page', window.location.href);
  }
  if (!sessionStorage.getItem('referrer') && document.referrer) {
    sessionStorage.setItem('referrer', document.referrer);
  }

  // event_id estável por sessão para dedup Pixel/CAPI/CRM.
  let eventId = sessionStorage.getItem('lead_event_id') || undefined;
  if (!eventId) {
    try {
      eventId =
        (window.crypto && typeof window.crypto.randomUUID === 'function')
          ? window.crypto.randomUUID()
          : `lead_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('lead_event_id', eventId);
    } catch {
      /* ignore */
    }
  }

  return {
    // Persistido na tabela (Edge Function vai escrever nas colunas)
    utm_source: persisted('utm_source'),
    utm_medium: persisted('utm_medium'),
    utm_campaign: persisted('utm_campaign'),
    utm_content: persisted('utm_content'),
    utm_term: persisted('utm_term'),
    gclid: persisted('gclid'),
    fbclid: persisted('fbclid'),
    gbraid: persisted('gbraid'),
    wbraid: persisted('wbraid'),
    fbc: getCookie('_fbc'),
    fbp: getCookie('_fbp'),
    landing_page: sessionStorage.getItem('landing_page') || window.location.href,
    referrer: sessionStorage.getItem('referrer') || document.referrer || undefined,
    event_id: eventId,
    // Sinais usados só pelo CAPI (não persistidos)
    meta_event_source_url: window.location.href,
    meta_user_agent: navigator.userAgent,
  };
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
  // Inclui sinais Meta CAPI no body (fbc/fbp/UTMs/source URL/user agent) para dedup
  const { data: responseData, error } = await supabase.functions.invoke('criar-agendamento', {
    body: { ...sanitizedData, ...captureMetaSignals() },
  });

  // Detecta erro de slot tomado (HTTP 409). O supabase-js coloca o body no responseData
  // mesmo quando há error de rede; preferimos olhar o code primeiro.
  const slotTaken =
    (responseData as any)?.code === 'SLOT_TAKEN' ||
    error?.message?.includes('SLOT_TAKEN') ||
    error?.message?.toLowerCase().includes('reservado por outra pessoa');

  if (slotTaken) {
    const err = new Error(
      (responseData as any)?.error ||
      'Este horário acabou de ser reservado por outra pessoa. Por favor, escolha outro horário.'
    );
    (err as any).code = 'SLOT_TAKEN';
    return { data: null, error: err };
  }

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
  // Sandbox filter (default: somente reais)
  const sandboxMode = filters.sandbox ?? "reais";
  if (sandboxMode === "reais") query = query.eq('is_sandbox', false);
  else if (sandboxMode === "somente_testes") query = query.eq('is_sandbox', true);

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
// Agrupa agendamentos pelo status_funil (fonte ÚNICA das colunas do kanban).
// Valores legados são normalizados via normalizeStatusFunil em useKanbanColumnsConfig.
export async function listarAgendamentosPorStatus(): Promise<{
  data: Record<string, Agendamento[]>;
  error: Error | null;
}> {
  const { normalizeStatusFunil, DEFAULT_COLUMNS } = await import("@/hooks/useKanbanColumnsConfig");
  const emptyBuckets = () =>
    DEFAULT_COLUMNS.reduce<Record<string, Agendamento[]>>((acc, c) => {
      acc[c.status] = [];
      return acc;
    }, {});

  const { data, error } = await supabase
    .from("agendamentos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar agendamentos por status_funil:", error);
    if (error.message?.includes("JWT expired") || error.code === "PGRST303") {
      await supabase.auth.signOut();
      window.location.href = "/auth";
    }
    return { data: emptyBuckets(), error: new Error(error.message) };
  }

  const grouped = emptyBuckets();

  (data || []).forEach((ag) => {
    const col = normalizeStatusFunil((ag as any).status_funil);
    if (col === "__hidden__") return; // bloqueios não entram no funil
    if (grouped[col]) {
      grouped[col].push(ag as Agendamento);
    } else {
      // status_funil desconhecido cai em "novo" para não sumir
      grouped["novo"].push(ag as Agendamento);
    }
  });

  // Ordena: cards com data → mais próxima primeiro; sem data → mais recente primeiro
  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) => {
      const aTem = !!a.data_agendamento;
      const bTem = !!b.data_agendamento;
      if (aTem && !bTem) return -1;
      if (!aTem && bTem) return 1;
      if (aTem && bTem) {
        const dt = (a.data_agendamento as string).localeCompare(b.data_agendamento as string);
        if (dt !== 0) return dt;
        return (a.hora_agendamento || "").localeCompare(b.hora_agendamento || "");
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  });

  return { data: grouped, error: null };
}

// Atualiza status_funil (drag-and-drop no kanban novo). Mantém status_crm como metadado.
export async function atualizarStatusFunil(
  id: string,
  novoStatus: string,
  statusAnterior?: string,
  motivo?: string | null
): Promise<{ error: Error | null }> {
  const updates: Record<string, unknown> = {
    status_funil: novoStatus,
    updated_at: new Date().toISOString(),
  };
  if (motivo !== undefined) updates.motivo_status = motivo;

  const { error } = await supabase.from("agendamentos").update(updates).eq("id", id);
  if (error) {
    console.error("Erro ao atualizar status_funil:", error);
    return { error: new Error(error.message) };
  }

  const { registrarAuditCrm } = await import("./crmAudit");
  registrarAuditCrm({
    agendamentoId: id,
    acao: "status_funil_change",
    statusAnterior: statusAnterior ?? null,
    statusNovo: novoStatus,
    detalhes: motivo ? { motivo } : undefined,
  });

  import("./integracoes").then(({ notificarN8n }) => {
    notificarN8n("status_funil_atualizado", { id, status_funil: novoStatus, motivo: motivo ?? null }).catch(
      (err) => console.error("[atualizarStatusFunil] notificar-n8n falhou:", err)
    );
  });

  return { error: null };
}

// Compatibilidade: mantém o nome antigo apontando para o novo (status_crm vira metadado).
export async function atualizarStatusCrm(
  id: string,
  novoStatus: string,
  statusAnterior?: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("agendamentos")
    .update({ status_crm: novoStatus, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: new Error(error.message) };
  const { registrarAuditCrm } = await import("./crmAudit");
  registrarAuditCrm({
    agendamentoId: id,
    acao: "status_change",
    statusAnterior: statusAnterior ?? null,
    statusNovo: novoStatus,
  });
  return { error: null };
}

// Busca a última mensagem IN (do paciente) por agendamento_id — usado para SLA visual no card.
export async function listarUltimasMensagensIn(
  agendamentoIds: string[]
): Promise<Record<string, string>> {
  if (agendamentoIds.length === 0) return {};
  const { data, error } = await supabase
    .from("mensagens_whatsapp")
    .select("agendamento_id, created_at")
    .eq("direcao", "IN")
    .in("agendamento_id", agendamentoIds)
    .order("created_at", { ascending: false })
    .limit(3000);
  if (error) {
    console.warn("listarUltimasMensagensIn:", error.message);
    return {};
  }
  const map: Record<string, string> = {};
  for (const m of data || []) {
    const id = (m as any).agendamento_id as string;
    if (id && !map[id]) map[id] = (m as any).created_at as string;
  }
  return map;
}

// Dispara reengajamento de lead frio via edge function dedicada.
export async function reengajarLead(
  agendamentoId: string,
  mensagem?: string
): Promise<{ success: boolean; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("reengajar-lead", {
    body: { agendamento_id: agendamentoId, mensagem },
  });
  if (error) return { success: false, error: error.message };
  if (data && (data as any).success === false) {
    return { success: false, error: (data as any).error || "Falha desconhecida" };
  }
  return { success: true, error: null };
}



// Reprocessar boas-vindas pendentes manualmente (admin)
export async function reprocessarBoasVindas(): Promise<{
  processed: number;
  failed: number;
  total_pending: number;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('enviar-boas-vindas-lead', {
      body: {},
    });
    if (error) {
      return { processed: 0, failed: 0, total_pending: 0, error: new Error(error.message) };
    }
    const result = {
      processed: data?.processed ?? 0,
      failed: data?.failed ?? 0,
      total_pending: data?.total_pending ?? 0,
      error: null,
    };
    // Registrar auditoria (fire-and-forget)
    const { registrarAuditCrm } = await import('./crmAudit');
    registrarAuditCrm({
      acao: 'reprocess_welcome',
      detalhes: { processed: result.processed, failed: result.failed, total_pending: result.total_pending },
    });
    return result;
  } catch (err) {
    return { processed: 0, failed: 0, total_pending: 0, error: err as Error };
  }
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

// Bulk delete agendamentos
export async function excluirAgendamentosEmLote(
  ids: string[]
): Promise<{ deleted: number; error: Error | null }> {
  if (!ids.length) return { deleted: 0, error: null };

  // First delete related messages
  await supabase.from('mensagens_whatsapp').delete().in('agendamento_id', ids);

  const { error, count } = await supabase
    .from('agendamentos')
    .delete({ count: 'exact' })
    .in('id', ids);

  if (error) {
    console.error('Erro ao excluir agendamentos em lote:', error);
    return { deleted: 0, error: new Error(error.message) };
  }

  return { deleted: count ?? ids.length, error: null };
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
    if ((error as any).code === '23505') {
      const err = new Error(
        'Este horário já está ocupado por outro paciente nesta clínica. Escolha outro horário.'
      );
      (err as any).code = 'SLOT_TAKEN';
      return { error: err };
    }
    return { error: new Error(error.message) };
  }

  return { error: null };
}

// Marca/desmarca um agendamento como sandbox (teste). Auditoria é registrada no servidor.
export async function marcarSandbox(
  id: string,
  isSandbox: boolean,
  reason?: string | null
): Promise<{ error: Error | null }> {
  const { error } = await (supabase as any).rpc('set_agendamento_sandbox', {
    p_agendamento_id: id,
    p_is_sandbox: isSandbox,
    p_reason: reason ?? null,
  });
  if (error) {
    console.error('Erro ao alterar sandbox:', error);
    return { error: new Error(error.message) };
  }
  return { error: null };
}
