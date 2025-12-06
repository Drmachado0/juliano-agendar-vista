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

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
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
  if (!response.ok) {
    throw new Error(data.error_description || 'Failed to refresh token');
  }

  return data;
}

async function getValidAccessToken(supabase: any, userId: string): Promise<string> {
  const { data: tokenData, error } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) {
    throw new Error('Google Calendar not connected');
  }

  const tokenExpiry = new Date(tokenData.token_expiry);
  const now = new Date();

  // Refresh token if it expires in less than 5 minutes
  if (tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Refreshing expired token...');
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

function createGoogleCalendarEvent(agendamento: Agendamento) {
  const [year, month, day] = agendamento.data_agendamento.split('-').map(Number);
  const [hour, minute] = agendamento.hora_agendamento.split(':').map(Number);
  
  const startDate = new Date(year, month - 1, day, hour, minute);
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30 min default

  return {
    summary: `${agendamento.tipo_atendimento} - ${agendamento.nome_completo}`,
    description: `
Paciente: ${agendamento.nome_completo}
Telefone: ${agendamento.telefone_whatsapp}
Tipo: ${agendamento.tipo_atendimento}
Local: ${agendamento.local_atendimento}
Convênio: ${agendamento.convenio}
    `.trim(),
    location: agendamento.local_atendimento,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 1440 }, // 24 hours
      ],
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, agendamento_id, user_id } = await req.json();

    if (!user_id) {
      throw new Error('User ID is required');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Handle check action first - before requiring valid token
    if (action === 'check') {
      const { data: tokenData, error } = await supabase
        .from('google_calendar_tokens')
        .select('id, calendar_id, updated_at')
        .eq('user_id', user_id)
        .single();

      return new Response(
        JSON.stringify({ 
          connected: !error && !!tokenData,
          calendar_id: tokenData?.calendar_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle disconnect action - doesn't need valid token
    if (action === 'disconnect') {
      await supabase
        .from('google_calendar_tokens')
        .delete()
        .eq('user_id', user_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For other actions, require Google credentials and valid token
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    const accessToken = await getValidAccessToken(supabase, user_id);

    // Get token data for calendar_id
    const { data: tokenData } = await supabase
      .from('google_calendar_tokens')
      .select('calendar_id')
      .eq('user_id', user_id)
      .single();

    const calendarId = tokenData?.calendar_id || 'primary';

    if (action === 'create' || action === 'update') {
      // Get appointment data
      const { data: agendamento, error: agendamentoError } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('id', agendamento_id)
        .single();

      if (agendamentoError || !agendamento) {
        throw new Error('Appointment not found');
      }

      const eventData = createGoogleCalendarEvent(agendamento);
      let eventId = agendamento.google_calendar_event_id;

      if (action === 'update' && eventId) {
        // Update existing event
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          console.error('Google Calendar update error:', error);
          // If event not found, create new one
          if (response.status === 404) {
            eventId = null;
          } else {
            throw new Error(error.error?.message || 'Failed to update event');
          }
        } else {
          console.log('Event updated successfully');
        }
      }

      if (action === 'create' || !eventId) {
        // Create new event
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          console.error('Google Calendar create error:', result);
          throw new Error(result.error?.message || 'Failed to create event');
        }

        eventId = result.id;
        console.log('Event created with ID:', eventId);

        // Store event ID in agendamento
        await supabase
          .from('agendamentos')
          .update({ google_calendar_event_id: eventId })
          .eq('id', agendamento_id);
      }

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
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${agendamento.google_calendar_event_id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok && response.status !== 404) {
          const error = await response.json();
          console.error('Google Calendar delete error:', error);
        } else {
          console.log('Event deleted successfully');
        }

        // Clear event ID from agendamento
        await supabase
          .from('agendamentos')
          .update({ google_calendar_event_id: null })
          .eq('id', agendamento_id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    throw new Error('Invalid action');
  } catch (error: unknown) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
