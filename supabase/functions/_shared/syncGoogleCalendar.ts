// Helper compartilhado para sincronizar agendamentos com Google Calendar.
// Seleciona automaticamente um admin com Google Calendar conectado e
// invoca a edge function `google-calendar-sync` em modo fire-and-forget.

export type SyncAction = "create" | "update" | "delete";

export async function syncAgendamentoToCalendar(
  supabase: any,
  agendamentoId: string,
  action: SyncAction = "create",
): Promise<void> {
  try {
    // 1. Tentar achar um admin com token (preferencial)
    const { data: adminTokens } = await supabase
      .from("google_calendar_tokens")
      .select("user_id, user_roles!inner(role)")
      .eq("user_roles.role", "admin")
      .limit(1);

    let userId: string | undefined = adminTokens?.[0]?.user_id;

    // 2. Fallback: qualquer usuário com token configurado
    if (!userId) {
      const { data: anyToken } = await supabase
        .from("google_calendar_tokens")
        .select("user_id")
        .limit(1)
        .maybeSingle();
      userId = anyToken?.user_id;
    }

    if (!userId) {
      console.log(
        `[syncGoogleCalendar] Nenhum admin com Google Calendar conectado. Pulando sync do agendamento ${agendamentoId}.`,
      );
      return;
    }

    // Respeitar flag auto_sync_enabled das settings
    const { data: settings } = await supabase
      .from("google_calendar_settings")
      .select("auto_sync_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (settings && settings.auto_sync_enabled === false) {
      console.log(
        `[syncGoogleCalendar] Sincronização automática pausada para user ${userId}. Pulando ${agendamentoId}.`,
      );
      return;
    }

    console.log(
      `[syncGoogleCalendar] Sincronizando agendamento ${agendamentoId} (action=${action}) com calendário do user ${userId}`,
    );

    const { getN8nSharedSecret } = await import("./n8nSecret.ts");
    const sharedSecret = await getN8nSharedSecret();
    const { error } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action, agendamento_id: agendamentoId, user_id: userId },
      headers: sharedSecret ? { "x-n8n-secret": sharedSecret } : undefined,
    });

    if (error) {
      console.error(
        `[syncGoogleCalendar] Erro ao invocar google-calendar-sync:`,
        error,
      );
    } else {
      console.log(
        `[syncGoogleCalendar] Evento ${action} enviado com sucesso para o Calendar`,
      );
    }
  } catch (err) {
    console.error(`[syncGoogleCalendar] Falha inesperada:`, err);
  }
}
