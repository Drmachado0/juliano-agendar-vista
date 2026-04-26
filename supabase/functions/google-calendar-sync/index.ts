import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface Agendamento {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string;
  tipo_atendimento: string;
  local_atendimento: string;
  data_agendamento: string;
  hora_agendamento: string;
  convenio: string;
  google_calendar_event_id?: string;
}

interface GcalSettings {
  default_duration_min: number;
  reminder_popup_min: number[];
  event_color_id: string | null;
  include_patient_phone: boolean;
  include_convenio: boolean;
  auto_sync_enabled: boolean;
}

const DEFAULT_SETTINGS: GcalSettings = {
  default_duration_min: 30,
  reminder_popup_min: [60, 1440],
  event_color_id: null,
  include_patient_phone: true,
  include_convenio: true,
  auto_sync_enabled: true,
};

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || 'Failed to refresh token');
  return data;
}

async function fetchUserEmail(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.email ?? null;
  } catch {
    return null;
  }
}

async function getValidAccessToken(supabase: any, userId: string): Promise<string> {
  const { data: tokenData, error } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error || !tokenData) throw new Error('Google Calendar não conectado');

  const tokenExpiry = new Date(tokenData.token_expiry);
  if (tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
    const newTokens = await refreshAccessToken(tokenData.refresh_token);
    const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
    await supabase
      .from('google_calendar_tokens')
      .update({
        access_token: newTokens.access_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    return newTokens.access_token;
  }
  return tokenData.access_token;
}

async function getSettings(supabase: any, userId: string): Promise<GcalSettings> {
  const { data } = await supabase
    .from('google_calendar_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    default_duration_min: data.default_duration_min ?? DEFAULT_SETTINGS.default_duration_min,
    reminder_popup_min: data.reminder_popup_min ?? DEFAULT_SETTINGS.reminder_popup_min,
    event_color_id: data.event_color_id ?? null,
    include_patient_phone: data.include_patient_phone ?? true,
    include_convenio: data.include_convenio ?? true,
    auto_sync_enabled: data.auto_sync_enabled ?? true,
  };
}

function buildEvent(agendamento: Agendamento, settings: GcalSettings) {
  const [year, month, day] = agendamento.data_agendamento.split('-').map(Number);
  const [hour, minute] = agendamento.hora_agendamento.split(':').map(Number);
  const startDate = new Date(year, month - 1, day, hour, minute);
  const endDate = new Date(startDate.getTime() + settings.default_duration_min * 60 * 1000);

  const descLines = [`Paciente: ${agendamento.nome_completo}`];
  if (settings.include_patient_phone) descLines.push(`Telefone: ${agendamento.telefone_whatsapp}`);
  descLines.push(`Tipo: ${agendamento.tipo_atendimento}`);
  descLines.push(`Local: ${agendamento.local_atendimento}`);
  if (settings.include_convenio) descLines.push(`Convênio: ${agendamento.convenio}`);

  const event: Record<string, unknown> = {
    summary: `${agendamento.tipo_atendimento} - ${agendamento.nome_completo}`,
    description: descLines.join('\n'),
    location: agendamento.local_atendimento,
    start: { dateTime: startDate.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: endDate.toISOString(), timeZone: 'America/Sao_Paulo' },
    reminders: {
      useDefault: false,
      overrides: settings.reminder_popup_min.map((m) => ({ method: 'popup', minutes: m })),
    },
  };
  if (settings.event_color_id) event.colorId = settings.event_color_id;
  return event;
}

async function recordSyncStatus(supabase: any, userId: string, error: string | null) {
  await supabase
    .from('google_calendar_tokens')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: error,
    })
    .eq('user_id', userId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action, agendamento_id, user_id, calendar_id: bodyCalendarId } = await req.json();
    if (!user_id) throw new Error('User ID is required');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // ---- check ----
    if (action === 'check') {
      const { data: tokenData, error } = await supabase
        .from('google_calendar_tokens')
        .select('id, calendar_id, google_email, connected_at, last_sync_at, last_sync_error, updated_at')
        .eq('user_id', user_id)
        .maybeSingle();

      const settings = await getSettings(supabase, user_id);

      return new Response(
        JSON.stringify({
          connected: !error && !!tokenData,
          calendar_id: tokenData?.calendar_id,
          google_email: tokenData?.google_email,
          connected_at: tokenData?.connected_at,
          last_sync_at: tokenData?.last_sync_at,
          last_sync_error: tokenData?.last_sync_error,
          settings,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- disconnect ----
    if (action === 'disconnect') {
      await supabase.from('google_calendar_tokens').delete().eq('user_id', user_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- update-calendar ----
    if (action === 'update-calendar') {
      if (!bodyCalendarId) throw new Error('calendar_id é obrigatório');
      const { error } = await supabase
        .from('google_calendar_tokens')
        .update({ calendar_id: bodyCalendarId, updated_at: new Date().toISOString() })
        .eq('user_id', user_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For remaining actions we need a valid Google token + Google credentials
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    const accessToken = await getValidAccessToken(supabase, user_id);
    const { data: tokenData } = await supabase
      .from('google_calendar_tokens')
      .select('calendar_id')
      .eq('user_id', user_id)
      .single();
    const calendarId = tokenData?.calendar_id || 'primary';

    // ---- test ----
    if (action === 'test') {
      const resp = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await resp.json();
      if (!resp.ok) {
        await recordSyncStatus(supabase, user_id, data.error?.message || 'Falha no teste');
        throw new Error(data.error?.message || 'Falha no teste de conexão');
      }
      await recordSyncStatus(supabase, user_id, null);
      return new Response(
        JSON.stringify({ ok: true, summary: data.summary, time_zone: data.timeZone }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- sync-batch ----
    if (action === 'sync-batch') {
      const today = new Date().toISOString().slice(0, 10);
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + 30);
      const limitStr = limitDate.toISOString().slice(0, 10);

      const { data: pendentes, error: pendErr } = await supabase
        .from('agendamentos')
        .select('*')
        .gte('data_agendamento', today)
        .lte('data_agendamento', limitStr)
        .is('google_calendar_event_id', null)
        .not('hora_agendamento', 'is', null);

      if (pendErr) throw pendErr;

      const settings = await getSettings(supabase, user_id);
      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const ag of pendentes ?? []) {
        try {
          const eventData = buildEvent(ag, settings);
          const resp = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(eventData),
            }
          );
          const result = await resp.json();
          if (!resp.ok) throw new Error(result.error?.message || 'Falha ao criar evento');
          await supabase
            .from('agendamentos')
            .update({ google_calendar_event_id: result.id })
            .eq('id', ag.id);
          success++;
          await new Promise((r) => setTimeout(r, 200)); // gentle on quota
        } catch (e: any) {
          failed++;
          errors.push(`${ag.nome_completo}: ${e.message}`);
        }
      }

      await recordSyncStatus(supabase, user_id, failed > 0 ? errors.slice(0, 3).join('; ') : null);

      return new Response(
        JSON.stringify({ success: true, total: pendentes?.length ?? 0, synced: success, failed, errors: errors.slice(0, 5) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- create / update / delete (single agendamento) ----
    const settings = await getSettings(supabase, user_id);

    if (action === 'create' || action === 'update') {
      const { data: agendamento, error: agendamentoError } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('id', agendamento_id)
        .single();
      if (agendamentoError || !agendamento) throw new Error('Agendamento não encontrado');

      const eventData = buildEvent(agendamento, settings);
      let eventId = agendamento.google_calendar_event_id;

      if (action === 'update' && eventId) {
        const resp = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData),
          }
        );
        if (!resp.ok) {
          const err = await resp.json();
          if (resp.status === 404) eventId = null;
          else {
            await recordSyncStatus(supabase, user_id, err.error?.message || 'Falha update');
            throw new Error(err.error?.message || 'Failed to update event');
          }
        }
      }

      if (action === 'create' || !eventId) {
        const resp = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData),
          }
        );
        const result = await resp.json();
        if (!resp.ok) {
          await recordSyncStatus(supabase, user_id, result.error?.message || 'Falha create');
          throw new Error(result.error?.message || 'Failed to create event');
        }
        eventId = result.id;
        await supabase
          .from('agendamentos')
          .update({ google_calendar_event_id: eventId })
          .eq('id', agendamento_id);
      }

      await recordSyncStatus(supabase, user_id, null);
      return new Response(
        JSON.stringify({ success: true, event_id: eventId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      const { data: agendamento } = await supabase
        .from('agendamentos')
        .select('google_calendar_event_id')
        .eq('id', agendamento_id)
        .single();
      if (agendamento?.google_calendar_event_id) {
        const resp = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${agendamento.google_calendar_event_id}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!resp.ok && resp.status !== 404) {
          const err = await resp.json();
          await recordSyncStatus(supabase, user_id, err.error?.message || 'Falha delete');
        } else {
          await recordSyncStatus(supabase, user_id, null);
        }
        await supabase
          .from('agendamentos')
          .update({ google_calendar_event_id: null })
          .eq('id', agendamento_id);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[google-calendar-sync]', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
