import { supabase } from "@/integrations/supabase/client";

export type LogLevel = "info" | "warn" | "error" | "critical";

export interface SystemLogEntry {
  id: string;
  level: LogLevel;
  category: string;
  source: string;
  message: string;
  details: Record<string, any> | null;
  user_id: string | null;
  user_email: string | null;
  agendamento_id: string | null;
  request_id: string | null;
  created_at: string;
}

export interface ListarSystemLogsOptions {
  search?: string;
  level?: LogLevel;
  category?: string;
  source?: string;
  userId?: string;
  dataInicio?: string; // ISO
  dataFim?: string; // ISO
  limit?: number;
}

export const LOG_CATEGORIES: { value: string; label: string }[] = [
  { value: "edge_function", label: "Edge Function" },
  { value: "agendamento", label: "Agendamento" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "google_calendar", label: "Google Calendar" },
  { value: "cron", label: "Cron / Agendado" },
  { value: "admin_action", label: "Ação Admin" },
  { value: "auth", label: "Autenticação" },
  { value: "frontend", label: "Frontend" },
];

export const LOG_LEVEL_META: Record<LogLevel, { label: string; className: string }> = {
  info: { label: "Info", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  warn: { label: "Aviso", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  error: { label: "Erro", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  critical: { label: "Crítico", className: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-100 font-bold" },
};

export async function listarSystemLogs(
  opts: ListarSystemLogsOptions = {},
): Promise<{ data: SystemLogEntry[]; error: Error | null }> {
  try {
    const { data, error } = await (supabase as any).rpc("listar_system_logs", {
      p_search: opts.search?.trim() || null,
      p_level: opts.level || null,
      p_category: opts.category || null,
      p_source: opts.source || null,
      p_user_id: opts.userId || null,
      p_data_inicio: opts.dataInicio || null,
      p_data_fim: opts.dataFim || null,
      p_limit: opts.limit ?? 200,
    });
    if (error) return { data: [], error: new Error(error.message) };
    return { data: (data ?? []) as SystemLogEntry[], error: null };
  } catch (err) {
    return { data: [], error: err as Error };
  }
}

export async function registrarLogAdmin(params: {
  level: LogLevel;
  category: string;
  source: string;
  message: string;
  details?: Record<string, any> | null;
  agendamentoId?: string | null;
  requestId?: string | null;
}): Promise<void> {
  try {
    const { error } = await (supabase as any).rpc("registrar_system_log", {
      p_level: params.level,
      p_category: params.category,
      p_source: params.source,
      p_message: params.message,
      p_details: params.details ?? null,
      p_agendamento_id: params.agendamentoId ?? null,
      p_request_id: params.requestId ?? null,
    });
    if (error) console.error("[systemLogs] Falha ao registrar:", error);
  } catch (err) {
    console.error("[systemLogs] Exceção ao registrar:", err);
  }
}

export function exportarLogsCsv(entries: SystemLogEntry[]): string {
  const headers = ["created_at", "level", "category", "source", "message", "user_email", "agendamento_id", "request_id", "details"];
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const e of entries) {
    lines.push(
      [
        e.created_at, e.level, e.category, e.source, e.message,
        e.user_email, e.agendamento_id, e.request_id, e.details,
      ].map(escape).join(","),
    );
  }
  return lines.join("\n");
}
