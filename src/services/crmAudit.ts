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

export const ACAO_LABELS: Record<string, string> = {
  status_change: "Mudança de status",
  reprocess_welcome: "Reprocessou boas-vindas",
  manual_whatsapp: "WhatsApp manual",
  automation_trigger: "Disparou automação",
};

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

export async function listarAuditCrm(opts?: {
  limit?: number;
  agendamentoId?: string;
  acao?: string;
}): Promise<{ data: CrmAuditEntry[]; error: Error | null }> {
  try {
    let query = (supabase as any)
      .from("crm_audit_log")
      .select(
        `
        *,
        agendamento:agendamentos(nome_completo, telefone_whatsapp)
      `
      )
      .order("created_at", { ascending: false })
      .limit(opts?.limit ?? 100);

    if (opts?.agendamentoId) query = query.eq("agendamento_id", opts.agendamentoId);
    if (opts?.acao) query = query.eq("acao", opts.acao);

    const { data, error } = await query;
    if (error) return { data: [], error: new Error(error.message) };
    return { data: (data ?? []) as CrmAuditEntry[], error: null };
  } catch (err) {
    return { data: [], error: err as Error };
  }
}
