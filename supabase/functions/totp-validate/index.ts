import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// TOTP verification using HMAC-SHA1
async function verifyTOTP(secret: string, token: string, window = 1): Promise<boolean> {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  
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
    const { user_id, token } = await req.json();

    if (!user_id) {
      throw new Error('User ID is required');
    }

    if (!token || (token.length !== 6 && token.length !== 8)) {
      throw new Error('Invalid token format');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's 2FA settings with decrypted secret
    const { data: twoFactorData, error: fetchError } = await supabaseAdmin
      .from('two_factor_auth')
      .select('*')
      .eq('user_id', user_id)
      .eq('totp_enabled', true)
      .single();

    if (fetchError || !twoFactorData) {
      // 2FA not enabled, allow login
      return new Response(
        JSON.stringify({ success: true, verified: true, twoFactorRequired: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get decrypted secret
    const { data: secretData, error: secretError } = await supabaseAdmin.rpc(
      'decrypt_totp_secret',
      { encrypted_secret: twoFactorData.totp_secret_encrypted }
    );

    if (secretError || !secretData) {
      throw new Error('Failed to retrieve 2FA secret');
    }

    // Check if it's a backup code
    if (token.length === 8) {
      // Decrypt backup codes
      const { data: backupCodesData } = await supabaseAdmin.rpc(
        'decrypt_totp_secret',
        { encrypted_secret: twoFactorData.backup_codes_encrypted }
      );

      if (backupCodesData) {
        const backupCodes: string[] = JSON.parse(backupCodesData);
        const usedCodes = twoFactorData.backup_codes_used || [];

        if (backupCodes.includes(token.toUpperCase()) && !usedCodes.includes(token.toUpperCase())) {
          // Mark backup code as used
          await supabaseAdmin
            .from('two_factor_auth')
            .update({
              backup_codes_used: [...usedCodes, token.toUpperCase()]
            })
            .eq('user_id', user_id);

          console.log(`Backup code used for user ${user_id}`);

          return new Response(
            JSON.stringify({ success: true, verified: true, usedBackupCode: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }
    }

    // Verify TOTP
    const isValid = await verifyTOTP(secretData, token);

    if (!isValid) {
      console.log(`Invalid 2FA code for user ${user_id}`);
      return new Response(
        JSON.stringify({ success: false, verified: false, error: 'Invalid verification code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log(`2FA verified for user ${user_id}`);

    return new Response(
      JSON.stringify({ success: true, verified: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in totp-validate:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});