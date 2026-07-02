import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user_id } = await req.json();
    if (!user_id) throw new Error('user_id é obrigatório');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const accessToken = await getValidAccessToken(supabase, user_id);

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Falha ao listar calendários');

    const calendars = (data.items || []).map((c: any) => ({
      id: c.id,
      summary: c.summary,
      description: c.description,
      primary: !!c.primary,
      access_role: c.accessRole,
      background_color: c.backgroundColor,
      time_zone: c.timeZone,
    }));

    return new Response(
      JSON.stringify({ calendars }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[google-calendar-list]', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
