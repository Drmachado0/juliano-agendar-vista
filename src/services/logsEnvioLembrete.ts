import { supabase } from "@/integrations/supabase/client";

export type LogStatus = "sucesso" | "falha" | "bloqueado" | "ignorado";
export type LogAgente = "manual" | "lembretes-runner" | "cron";

export interface LogEnvioLembrete {
  id: string;
  created_at: string;
  agente: LogAgente;
  status: LogStatus;
  motivo: string | null;
  telefone: string | null;
  nome: string | null;
  mensagem_renderizada: string | null;
  lembrete_id: string | null;
  campanha_id: string | null;
  remessa_id: string | null;
  paciente_campanha_id: string | null;
  latencia_ms: number | null;
  request_id: string | null;
  payload: Record<string, unknown> | null;
}

export interface RegistrarLogPayload {
  agente: LogAgente;
  status: LogStatus;
  motivo?: string | null;
  telefone?: string | null;
  nome?: string | null;
  mensagem_renderizada?: string | null;
  lembrete_id?: string | null;
  campanha_id?: string | null;
  remessa_id?: string | null;
  paciente_campanha_id?: string | null;
  latencia_ms?: number | null;
  request_id?: string | null;
  payload?: Record<string, unknown> | null;
}

export async function registrarLogEnvioLembrete(
  payload: RegistrarLogPayload
): Promise<{ id: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("logs_envio_lembrete")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { id: data?.id ?? null, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao registrar log";
    console.error("[logsEnvioLembrete] erro ao registrar:", e);
    return { id: null, error: msg };
  }
}

export interface ListarLogsFiltros {
  limit?: number;
  status?: LogStatus;
  agente?: LogAgente;
  desde?: string;
}

export async function listarLogsEnvioLembrete(
  filtros: ListarLogsFiltros = {}
): Promise<{ data: LogEnvioLembrete[] | null; error: string | null }> {
  try {
    let q = supabase
      .from("logs_envio_lembrete")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(filtros.limit ?? 50, 1), 500));

    if (filtros.status) q = q.eq("status", filtros.status);
    if (filtros.agente) q = q.eq("agente", filtros.agente);
    if (filtros.desde) q = q.gte("created_at", filtros.desde);

    const { data, error } = await q;
    if (error) throw error;
    return { data: (data as unknown as LogEnvioLembrete[]) || [], error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar logs";
    console.error("[logsEnvioLembrete] erro ao listar:", e);
    return { data: null, error: msg };
  }
}
