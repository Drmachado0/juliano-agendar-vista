// Edge function que centraliza o login com 2FA obrigatório server-side.
// Fluxo:
//  1. Recebe { email, password, token? }
//  2. Valida credenciais via anon client (signInWithPassword)
//  3. Se o usuário tiver 2FA habilitado e não veio token → retorna
//     { requires_2fa: true } SEM devolver os tokens (session fica órfã).
//  4. Se veio token, valida TOTP/backup-code. Só devolve a sessão se o token
//     estiver correto. Caso contrário, revoga a sessão via admin API.
//
// Isso fecha o bypass em que o JWT era emitido antes do TOTP ser verificado.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Base32 + HMAC-SHA1 TOTP verifier (copiado do totp-validate para não depender dele)
async function verifyTOTP(secret: string, token: string, windowSize = 1): Promise<boolean> {
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const bits: number[] = [];
  for (const c of cleaned) {
    const v = base32Chars.indexOf(c);
    for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1);
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
    bytes[i] = byte;
  }
  const now = Math.floor(Date.now() / 1000);
  for (let i = -windowSize; i <= windowSize; i++) {
    const counter = Math.floor((now + i * 30) / 30);
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigUint64(0, BigInt(counter), false);
    const key = await crypto.subtle.importKey(
      "raw",
      bytes.buffer as ArrayBuffer,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"],
    );
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
    const offset = sig[sig.length - 1] & 0x0f;
    const bin =
      ((sig[offset] & 0x7f) << 24) |
      ((sig[offset + 1] & 0xff) << 16) |
      ((sig[offset + 2] & 0xff) << 8) |
      (sig[offset + 3] & 0xff);
    const otp = (bin % 1_000_000).toString().padStart(6, "0");
    if (otp === token) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, password, token } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Credenciais obrigatórias" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Verifica senha via anon client
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr || !signInData?.session || !signInData?.user) {
      return new Response(
        JSON.stringify({ error: "Email ou senha incorretos" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = signInData.user.id;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Verifica se tem 2FA habilitado
    const { data: twoFactor } = await admin
      .from("two_factor_auth")
      .select("*")
      .eq("user_id", userId)
      .eq("totp_enabled", true)
      .maybeSingle();

    // Sem 2FA → devolve sessão direto
    if (!twoFactor) {
      return new Response(
        JSON.stringify({
          success: true,
          requires_2fa: false,
          session: signInData.session,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Tem 2FA e não veio token → NÃO devolve sessão, revoga o refresh e pede 2FA.
    if (!token) {
      try {
        await admin.auth.admin.signOut(signInData.session.access_token as any);
      } catch { /* best-effort revoke */ }
      return new Response(
        JSON.stringify({ success: false, requires_2fa: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Valida TOTP ou backup code
    let valid = false;
    let usedBackupCode = false;

    if (token.length === 6 || token.length === 8) {
      const { data: secretPlain } = await admin.rpc("decrypt_totp_secret", {
        encrypted_secret: twoFactor.totp_secret_encrypted,
      });
      if (typeof secretPlain === "string" && secretPlain) {
        if (token.length === 6) {
          valid = await verifyTOTP(secretPlain, token);
        } else {
          const { data: backupPlain } = await admin.rpc("decrypt_totp_secret", {
            encrypted_secret: twoFactor.backup_codes_encrypted,
          });
          if (typeof backupPlain === "string" && backupPlain) {
            try {
              const codes: string[] = JSON.parse(backupPlain);
              const used: string[] = twoFactor.backup_codes_used || [];
              const upper = token.toUpperCase();
              if (codes.includes(upper) && !used.includes(upper)) {
                valid = true;
                usedBackupCode = true;
                await admin
                  .from("two_factor_auth")
                  .update({ backup_codes_used: [...used, upper] })
                  .eq("user_id", userId);
              }
            } catch { /* invalid backup json */ }
          }
        }
      }
    }

    if (!valid) {
      // Revoga a sessão que acabamos de criar para não deixar refresh token válido
      try {
        await admin.auth.admin.signOut(signInData.session.access_token as any);
      } catch { /* ignore */ }
      return new Response(
        JSON.stringify({ success: false, error: "Código de verificação inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        requires_2fa: false,
        used_backup_code: usedBackupCode,
        session: signInData.session,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[login-secure] Erro:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
