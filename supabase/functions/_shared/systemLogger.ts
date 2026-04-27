// Helper compartilhado para Edge Functions registrarem eventos em system_logs.
// Fire-and-forget: nunca bloqueia ou propaga erros.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type LogLevel = "info" | "warn" | "error" | "critical";
export type LogCategory =
  | "edge_function"
  | "agendamento"
  | "whatsapp"
  | "google_calendar"
  | "cron"
  | "admin_action"
  | "auth"
  | "frontend";

export interface LogSystemParams {
  level: LogLevel;
  category: LogCategory;
  source: string;
  message: string;
  details?: Record<string, unknown> | null;
  userId?: string | null;
  userEmail?: string | null;
  agendamentoId?: string | null;
  requestId?: string | null;
}

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (_client) return _client;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

/**
 * Registra um evento no system_logs. Fire-and-forget — nunca lança.
 */
export function logSystem(params: LogSystemParams): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn("[systemLogger] SUPABASE_URL/SERVICE_ROLE_KEY ausentes; pulando log.");
    return Promise.resolve();
  }

  return client
    .from("system_logs")
    .insert({
      level: params.level,
      category: params.category,
      source: params.source,
      message: params.message,
      details: params.details ?? null,
      user_id: params.userId ?? null,
      user_email: params.userEmail ?? null,
      agendamento_id: params.agendamentoId ?? null,
      request_id: params.requestId ?? null,
    })
    .then(({ error }) => {
      if (error) console.error("[systemLogger] Falha ao gravar log:", error.message);
    })
    .catch((err) => {
      console.error("[systemLogger] Exceção ao gravar log:", err);
    }) as unknown as Promise<void>;
}
