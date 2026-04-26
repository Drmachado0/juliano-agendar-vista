import { supabase } from "@/integrations/supabase/client";

export interface CrmAuditEntry {
  id: string;
  agendamento_id: string | null;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  acao: string;
  status_anterior: string | null;
  status_novo: string | null;
  detalhes: Record<string, any> | null;
  created_at: string;
  agendamento?: {
    nome_completo: string;
    telefone_whatsapp: string;
  } | null;
}

export interface AuditUserOption {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
}

export const ACAO_LABELS: Record<string, string> = {
  status_change: "Mudança de status",
  reprocess_welcome: "Reprocessou boas-vindas",
  manual_whatsapp: "WhatsApp manual",
  automation_trigger: "Disparou automação",
};

export const STATUS_CRM_OPCOES = [
  "NOVO LEAD",
  "AGUARDANDO",
  "CLINICOR",
  "HGP",
  "BELÉM",
  "ATENDIDO",
] as const;

/**
 * Registra uma entrada no log de auditoria do CRM.
 * Usa RPC com SECURITY DEFINER que captura o usuário autenticado automaticamente.
 */
export async function registrarAuditCrm(params: {
  agendamentoId?: string | null;
  acao: keyof typeof ACAO_LABELS;
  statusAnterior?: string | null;
  statusNovo?: string | null;
  detalhes?: Record<string, any> | null;
}): Promise<void> {
  try {
    const { error } = await (supabase as any).rpc("registrar_crm_audit", {
      p_agendamento_id: params.agendamentoId ?? null,
      p_acao: params.acao,
      p_status_anterior: params.statusAnterior ?? null,
      p_status_novo: params.statusNovo ?? null,
      p_detalhes: params.detalhes ?? null,
    });
    if (error) console.error("[crmAudit] Falha ao registrar:", error);
  } catch (err) {
    console.error("[crmAudit] Exceção ao registrar:", err);
  }
}

export interface ListarAuditCrmOptions {
  limit?: number;
  agendamentoId?: string;
  acao?: string;
  search?: string;
  userId?: string;
  statusAnterior?: string;
  statusNovo?: string;
  dataInicio?: string; // ISO timestamp
  dataFim?: string; // ISO timestamp
}

export async function listarAuditCrm(
  opts?: ListarAuditCrmOptions,
): Promise<{ data: CrmAuditEntry[]; error: Error | null }> {
  try {
    // Para filtro por agendamento específico, mantém query direta (caminho mais simples)
    if (opts?.agendamentoId) {
      let query = (supabase as any)
        .from("crm_audit_log")
        .select(
          `
          *,
          agendamento:agendamentos(nome_completo, telefone_whatsapp)
        `,
        )
        .eq("agendamento_id", opts.agendamentoId)
        .order("created_at", { ascending: false })
        .limit(opts?.limit ?? 100);
      if (opts?.acao) query = query.eq("acao", opts.acao);
      const { data, error } = await query;
      if (error) return { data: [], error: new Error(error.message) };
      return { data: (data ?? []) as CrmAuditEntry[], error: null };
    }

    // Caso geral: usa RPC com filtros server-side
    const { data, error } = await (supabase as any).rpc("listar_crm_audit", {
      p_search: opts?.search?.trim() || null,
      p_acao: opts?.acao || null,
      p_user_id: opts?.userId || null,
      p_status_anterior: opts?.statusAnterior || null,
      p_status_novo: opts?.statusNovo || null,
      p_data_inicio: opts?.dataInicio || null,
      p_data_fim: opts?.dataFim || null,
      p_limit: opts?.limit ?? 200,
    });
    if (error) return { data: [], error: new Error(error.message) };

    // Converte saída flat (paciente_nome / paciente_telefone) no formato CrmAuditEntry
    const mapped: CrmAuditEntry[] = ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      agendamento_id: r.agendamento_id,
      user_id: r.user_id,
      user_email: r.user_email,
      user_name: r.user_name,
      acao: r.acao,
      status_anterior: r.status_anterior,
      status_novo: r.status_novo,
      detalhes: r.detalhes,
      created_at: r.created_at,
      agendamento: r.paciente_nome || r.paciente_telefone
        ? {
            nome_completo: r.paciente_nome ?? "",
            telefone_whatsapp: r.paciente_telefone ?? "",
          }
        : null,
    }));
    return { data: mapped, error: null };
  } catch (err) {
    return { data: [], error: err as Error };
  }
}

export async function listarUsuariosAudit(): Promise<{
  data: AuditUserOption[];
  error: Error | null;
}> {
  try {
    const { data, error } = await (supabase as any).rpc("listar_crm_audit_users");
    if (error) return { data: [], error: new Error(error.message) };
    return { data: (data ?? []) as AuditUserOption[], error: null };
  } catch (err) {
    return { data: [], error: err as Error };
  }
}
