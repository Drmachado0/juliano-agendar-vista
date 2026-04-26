import { supabase } from "@/integrations/supabase/client";

export interface DuplicadoAgendamento {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string;
  email: string | null;
  status_crm: string;
  status_funil: string | null;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  local_atendimento: string;
  tipo_atendimento: string;
  created_at: string;
  updated_at: string;
}

export interface GrupoDuplicado {
  telefone_normalizado: string;
  total_duplicados: number;
  agendamentos: DuplicadoAgendamento[];
}

export async function detectarDuplicadosTelefone(): Promise<{
  data: GrupoDuplicado[];
  error: Error | null;
}> {
  try {
    const { data, error } = await (supabase as any).rpc("detectar_duplicados_telefone");
    if (error) return { data: [], error: new Error(error.message) };
    return { data: (data ?? []) as GrupoDuplicado[], error: null };
  } catch (err) {
    return { data: [], error: err as Error };
  }
}

export async function unificarDuplicados(
  telefoneNormalizado: string,
  principalId?: string
): Promise<{
  principalId: string | null;
  removidos: string[];
  mensagensMovidas: number;
  auditMovidas: number;
  error: Error | null;
}> {
  try {
    const { data, error } = await (supabase as any).rpc("unificar_duplicados", {
      p_telefone_normalizado: telefoneNormalizado,
      p_principal_id: principalId ?? null,
    });
    if (error) {
      return {
        principalId: null,
        removidos: [],
        mensagensMovidas: 0,
        auditMovidas: 0,
        error: new Error(error.message),
      };
    }
    return {
      principalId: data?.principal_id ?? null,
      removidos: data?.removidos ?? [],
      mensagensMovidas: data?.mensagens_movidas ?? 0,
      auditMovidas: data?.audit_movidas ?? 0,
      error: null,
    };
  } catch (err) {
    return {
      principalId: null,
      removidos: [],
      mensagensMovidas: 0,
      auditMovidas: 0,
      error: err as Error,
    };
  }
}
