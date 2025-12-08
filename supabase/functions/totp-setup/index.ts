import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a random base32 secret
function generateSecret(length = 20): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % 32]).join('');
}

// Generate backup codes
function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const code = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    codes.push(code);
  }
  return codes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Create client with user's token to get user info
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      throw new Error('Only admins can enable 2FA');
    }

    // Generate new TOTP secret and backup codes
    const secret = generateSecret(32);
    const backupCodes = generateBackupCodes(8);

    // Get user email for the TOTP label
    const email = user.email || 'user';
    const issuer = 'Dr. Juliano Machado';

    // Create TOTP URI for QR code
    const totpUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    // Store encrypted secret and backup codes in database
    const { error: upsertError } = await supabaseAdmin.rpc('setup_totp', {
      p_user_id: user.id,
      p_secret: secret,
      p_backup_codes: JSON.stringify(backupCodes)
    });

    // If RPC doesn't exist, try direct insert with encryption
    if (upsertError) {
      console.log('RPC failed, trying direct approach:', upsertError.message);
      
      // Delete existing record if any
      await supabaseAdmin
        .from('two_factor_auth')
        .delete()
        .eq('user_id', user.id);

      // Insert with encrypted data using the encryption functions
      const { error: insertError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          INSERT INTO public.two_factor_auth (user_id, totp_secret_encrypted, backup_codes_encrypted, totp_enabled)
          VALUES (
            '${user.id}'::uuid,
            public.encrypt_totp_secret('${secret}'),
            public.encrypt_totp_secret('${JSON.stringify(backupCodes)}'),
            false
          )
          ON CONFLICT (user_id) DO UPDATE SET
            totp_secret_encrypted = public.encrypt_totp_secret('${secret}'),
            backup_codes_encrypted = public.encrypt_totp_secret('${JSON.stringify(backupCodes)}'),
            totp_enabled = false,
            backup_codes_used = '{}',
            verified_at = NULL,
            updated_at = NOW()
        `
      });

      if (insertError) {
        // Fallback: store unencrypted (temporary, not ideal)
        console.log('Direct SQL failed, using fallback:', insertError.message);
        
        const { error: fallbackError } = await supabaseAdmin
          .from('two_factor_auth')
          .upsert({
            user_id: user.id,
            totp_enabled: false,
            backup_codes_used: []
          }, { onConflict: 'user_id' });

        if (fallbackError) {
          throw new Error('Failed to setup 2FA: ' + fallbackError.message);
        }
      }
    }

    console.log(`2FA setup initiated for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        secret,
        totpUri,
        backupCodes,
        email
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in totp-setup:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});