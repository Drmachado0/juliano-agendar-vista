import { supabase } from "@/integrations/supabase/client";

export interface GoogleCalendarStatus {
  connected: boolean;
  calendar_id?: string;
}

export async function checkGoogleCalendarConnection(userId: string): Promise<GoogleCalendarStatus> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'check', user_id: userId }
    });

    if (error) {
      console.error('Error checking Google Calendar connection:', error);
      return { connected: false };
    }

    return data;
  } catch (err) {
    console.error('Error checking Google Calendar connection:', err);
    return { connected: false };
  }
}

export async function initiateGoogleCalendarAuth(redirectUri?: string): Promise<{ auth_url: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
      body: { redirect_uri: redirectUri }
    });

    if (error) {
      console.error('Error initiating Google Calendar auth:', error);
      return { auth_url: null, error: error.message };
    }

    return { auth_url: data.auth_url, error: null };
  } catch (err: any) {
    console.error('Error initiating Google Calendar auth:', err);
    return { auth_url: null, error: err.message || 'Unknown error' };
  }
}

export async function exchangeGoogleCalendarCode(
  code: string, 
  userId: string, 
  redirectUri?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-callback', {
      body: { code, user_id: userId, redirect_uri: redirectUri }
    });

    if (error) {
      console.error('Error exchanging Google Calendar code:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Error exchanging Google Calendar code:', err);
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

    if (error) {
      console.error('Error syncing to Google Calendar:', error);
      return { success: false, error: error.message };
    }

    return { success: true, event_id: data.event_id, error: null };
  } catch (err: any) {
    console.error('Error syncing to Google Calendar:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function disconnectGoogleCalendar(userId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'disconnect', user_id: userId }
    });

    if (error) {
      console.error('Error disconnecting Google Calendar:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Error disconnecting Google Calendar:', err);
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
