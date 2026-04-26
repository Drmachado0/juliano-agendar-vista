import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiter configuration (stricter for OAuth endpoint)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 requests per minute per IP

const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(identifier, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const resetIn = RATE_LIMIT_WINDOW_MS - (now - record.windowStart);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  record.count++;
  const resetIn = RATE_LIMIT_WINDOW_MS - (now - record.windowStart);
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count, resetIn };
}

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                   req.headers.get("x-real-ip") || 
                   "unknown";
  
  const rateLimit = checkRateLimit(clientIP);
  
  if (!rateLimit.allowed) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000))
        } 
      }
    );
  }

  try {
    const url = new URL(req.url);
    let code: string | null = null;
    let user_id: string | null = null;
    let redirect_uri: string | null = null;
    let app_redirect: string | null = null;

    // Handle both GET (redirect from Google) and POST (from frontend)
    if (req.method === 'GET') {
      code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (state) {
        try {
          const stateData = JSON.parse(atob(state));
          user_id = stateData.user_id;
          redirect_uri = stateData.redirect_uri;
          app_redirect = stateData.app_redirect;
        } catch (e) {
          console.error('Error parsing state:', e);
        }
      }
    } else {
      const body = await req.json();
      code = body.code;
      user_id = body.user_id;
      redirect_uri = body.redirect_uri;
    }

    if (!code) {
      throw new Error('Authorization code is required');
    }

    if (!user_id) {
      throw new Error('User ID is required');
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    const callbackUri = redirect_uri || `${SUPABASE_URL}/functions/v1/google-calendar-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token exchange response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokenData);
      throw new Error(tokenData.error_description || 'Failed to exchange code for tokens');
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token) {
      throw new Error('Missing tokens in response');
    }

    // Try to fetch the connected Google account email (best-effort)
    let google_email: string | null = null;
    try {
      const userinfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (userinfoResp.ok) {
        const userinfo = await userinfoResp.json();
        google_email = userinfo.email ?? null;
      }
    } catch (e) {
      console.warn('Could not fetch userinfo:', e);
    }

    // Calculate token expiry
    const token_expiry = new Date(Date.now() + expires_in * 1000).toISOString();

    // Store tokens in database
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { error: upsertError } = await supabase
      .from('google_calendar_tokens')
      .upsert({
        user_id,
        access_token,
        refresh_token,
        token_expiry,
        calendar_id: 'primary',
        google_email,
        connected_at: new Date().toISOString(),
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Error storing tokens:', upsertError);
      throw new Error('Failed to store tokens');
    }

    console.log('Successfully stored Google Calendar tokens for user:', user_id);

    // If it's a GET request (redirect from Google), redirect to app
    if (req.method === 'GET' && app_redirect) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${app_redirect}?success=true` },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Google Calendar connected successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // If it's a redirect-style request, redirect with error
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const state = url.searchParams.get('state');
      let app_redirect = '/admin/configuracoes';
      if (state) {
        try {
          const stateData = JSON.parse(atob(state));
          app_redirect = stateData.app_redirect || app_redirect;
        } catch (e) {}
      }
      return new Response(null, {
        status: 302,
        headers: { Location: `${app_redirect}?error=${encodeURIComponent(errorMessage)}` },
      });
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});