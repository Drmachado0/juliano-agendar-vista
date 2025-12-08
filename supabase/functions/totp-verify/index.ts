import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// TOTP verification using HMAC-SHA1
async function verifyTOTP(secret: string, token: string, window = 1): Promise<boolean> {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  
  // Decode base32 secret
  function base32Decode(encoded: string): Uint8Array {
    const cleaned = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
    const bits: number[] = [];
    for (const char of cleaned) {
      const val = base32Chars.indexOf(char);
      for (let i = 4; i >= 0; i--) {
        bits.push((val >> i) & 1);
      }
    }
    const bytes = new Uint8Array(Math.floor(bits.length / 8));
    for (let i = 0; i < bytes.length; i++) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | bits[i * 8 + j];
      }
      bytes[i] = byte;
    }
    return bytes;
  }

  // Generate TOTP for a given time
  async function generateTOTP(secretBytes: Uint8Array, time: number): Promise<string> {
    const counter = Math.floor(time / 30);
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setBigUint64(0, BigInt(counter), false);

    const keyBuffer = new Uint8Array(secretBytes).buffer as ArrayBuffer;
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, counterBuffer);
    const signatureArray = new Uint8Array(signature);
    
    const offset = signatureArray[signatureArray.length - 1] & 0x0f;
    const binary =
      ((signatureArray[offset] & 0x7f) << 24) |
      ((signatureArray[offset + 1] & 0xff) << 16) |
      ((signatureArray[offset + 2] & 0xff) << 8) |
      (signatureArray[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  const secretBytes = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000);

  // Check current and adjacent time windows
  for (let i = -window; i <= window; i++) {
    const time = now + (i * 30);
    const expectedToken = await generateTOTP(secretBytes, time);
    if (expectedToken === token) {
      return true;
    }
  }

  return false;
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

    const { token, secret, action } = await req.json();

    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      throw new Error('Invalid token format. Must be 6 digits.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get user from auth header
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify TOTP
    const isValid = await verifyTOTP(secret, token);

    if (!isValid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid verification code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // If this is the enable action, update the database
    if (action === 'enable') {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      const { error: updateError } = await supabaseAdmin
        .from('two_factor_auth')
        .update({
          totp_enabled: true,
          verified_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        throw new Error('Failed to enable 2FA: ' + updateError.message);
      }

      console.log(`2FA enabled for user ${user.id}`);
    }

    return new Response(
      JSON.stringify({ success: true, verified: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in totp-verify:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});