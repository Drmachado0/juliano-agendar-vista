import { supabase } from "@/integrations/supabase/client";

export interface GoogleCalendarSettings {
  default_duration_min: number;
  reminder_popup_min: number[];
  event_color_id: string | null;
  include_patient_phone: boolean;
  include_convenio: boolean;
  auto_sync_enabled: boolean;
}

export interface GoogleCalendarStatus {
  connected: boolean;
  calendar_id?: string;
  google_email?: string;
  connected_at?: string;
  last_sync_at?: string;
  last_sync_error?: string | null;
  time_zone?: string;
  settings?: GoogleCalendarSettings;
}

export interface SyncStats {
  synced: number;
  pending: number;
}

export interface GoogleCalendarItem {
  id: string;
  summary: string;
  description?: string;
  primary: boolean;
  access_role: string;
  background_color?: string;
  time_zone?: string;
}

export async function checkGoogleCalendarConnection(userId: string): Promise<GoogleCalendarStatus> {
  // Retry com backoff para mitigar erros transitórios "Failed to fetch"
  let lastError: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'check', user_id: userId }
      });
      if (error) {
        lastError = error;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        console.error('Error checking Google Calendar connection:', error);
        // Erro de rede: não derruba o status — retorna marcador
        return { connected: false, last_sync_error: 'network' };
      }
      return data;
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
    }
  }
  console.error('Error checking Google Calendar connection:', lastError);
  return { connected: false, last_sync_error: 'network' };
}

export async function refreshGoogleEmail(userId: string): Promise<{ google_email: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'refresh-email', user_id: userId }
    });
    if (error) return { google_email: null };
    return { google_email: data?.google_email ?? null };
  } catch {
    return { google_email: null };
  }
}

export async function getGoogleCalendarSyncStats(userId: string): Promise<SyncStats> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'sync-stats', user_id: userId }
    });
    if (error) return { synced: 0, pending: 0 };
    return { synced: data?.synced ?? 0, pending: data?.pending ?? 0 };
  } catch {
    return { synced: 0, pending: 0 };
  }
}

export async function initiateGoogleCalendarAuth(redirectUri?: string): Promise<{ auth_url: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
      body: { redirect_uri: redirectUri }
    });
    if (error) return { auth_url: null, error: error.message };
    return { auth_url: data.auth_url, error: null };
  } catch (err: any) {
    return { auth_url: null, error: err.message || 'Unknown error' };
  }
}

export async function exchangeGoogleCalendarCode(
  code: string, userId: string, redirectUri?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.functions.invoke('google-calendar-callback', {
      body: { code, user_id: userId, redirect_uri: redirectUri }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function syncAppointmentToGoogleCalendar(
  agendamentoId: string,
  userId: string,
  action: 'create' | 'update' | 'delete' = 'create'
): Promise<{ success: boolean; event_id?: string; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
      body: { action, agendamento_id: agendamentoId, user_id: userId }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, event_id: data.event_id, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function disconnectGoogleCalendar(userId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'disconnect', user_id: userId }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function listGoogleCalendars(userId: string): Promise<{ calendars: GoogleCalendarItem[]; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-list', {
      body: { user_id: userId }
    });
    if (error) return { calendars: [], error: error.message };
    return { calendars: data.calendars || [], error: null };
  } catch (err: any) {
    return { calendars: [], error: err.message || 'Unknown error' };
  }
}

export async function updateCalendarSelection(userId: string, calendarId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'update-calendar', user_id: userId, calendar_id: calendarId }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function testGoogleCalendarConnection(userId: string): Promise<{ ok: boolean; summary?: string; time_zone?: string; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'test', user_id: userId }
    });
    if (error) return { ok: false, error: error.message };
    return { ok: !!data.ok, summary: data.summary, time_zone: data.time_zone, error: null };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Unknown error' };
  }
}

export async function resyncBatchGoogleCalendar(userId: string): Promise<{ success: boolean; total?: number; synced?: number; failed?: number; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'sync-batch', user_id: userId }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, total: data.total, synced: data.synced, failed: data.failed, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function updateGoogleCalendarSettings(userId: string, settings: GoogleCalendarSettings): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('google_calendar_settings')
      .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// Build OAuth URL with state parameter for server-side redirect
export function buildGoogleCalendarAuthUrl(
  baseAuthUrl: string,
  userId: string,
  redirectUri: string,
  appRedirect: string
): string {
  const state = btoa(JSON.stringify({
    user_id: userId,
    redirect_uri: redirectUri,
    app_redirect: appRedirect,
  }));
  const url = new URL(baseAuthUrl);
  url.searchParams.set('state', state);
  return url.toString();
}
