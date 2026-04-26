// Edge function pública: retorna o status público de um agendamento.
// Usada pela página /status/:id para o paciente acompanhar seu agendamento.
// JWT desabilitado — acesso protegido por (1) UUID com 122 bits de entropia
// no path e (2) rate limit por IP. Retorna apenas campos não sensíveis.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rate limit em memória (por instância): 10 req/min/IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 min
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Extrai IP do request
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Aceita id via query string OU body
    let id: string | null = null;
    const url = new URL(req.url);
    id = url.searchParams.get("id");
    if (!id && (req.method === "POST" || req.method === "PUT")) {
      try {
        const body = await req.json();
        id = body?.id ?? null;
      } catch { /* ignore */ }
    }

    if (!id || !UUID_RE.test(id)) {
      return new Response(
        JSON.stringify({ error: "Agendamento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Projeção mínima: apenas campos não sensíveis
    const { data, error } = await supabase
      .from("agendamentos")
      .select(
        `id, nome_completo, data_agendamento, hora_agendamento,
         local_atendimento, tipo_atendimento, detalhe_exame_ou_cirurgia,
         convenio, status_crm, status_funil, confirmation_status,
         confirmation_response_at, created_at`,
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Agendamento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Apenas primeiro nome para reduzir exposição caso o link vaze
    const primeiroNome = (data.nome_completo || "").trim().split(/\s+/)[0] || "Paciente";

    // Determina o status exibido (mesma lógica do frontend)
    let statusExibido = "recebido";
    if (data.confirmation_status === "confirmado" || data.status_crm === "ATENDIDO") {
      statusExibido = "confirmado";
    } else if (data.confirmation_status === "cancelado") {
      statusExibido = "cancelado";
    } else if (data.status_funil === "lead") {
      statusExibido = "aguardando";
    }

    // Registra acesso (fire-and-forget, não bloqueia resposta)
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
    const referer = req.headers.get("referer")?.slice(0, 500) ?? null;
    supabase
      .from("status_acesso_log")
      .insert({
        agendamento_id: data.id,
        ip_address: ip,
        user_agent: userAgent,
        referer,
        status_exibido: statusExibido,
        confirmation_status: data.confirmation_status,
        status_funil: data.status_funil,
      })
      .then(({ error: logErr }) => {
        if (logErr) console.error("[status-agendamento] log falhou:", logErr.message);
      });

    return new Response(
      JSON.stringify({
        id: data.id,
        primeiro_nome: primeiroNome,
        data_agendamento: data.data_agendamento,
        hora_agendamento: data.hora_agendamento,
        local_atendimento: data.local_atendimento,
        tipo_atendimento: data.tipo_atendimento,
        detalhe_exame_ou_cirurgia: data.detalhe_exame_ou_cirurgia,
        convenio: data.convenio,
        status_crm: data.status_crm,
        status_funil: data.status_funil,
        confirmation_status: data.confirmation_status,
        confirmation_response_at: data.confirmation_response_at,
        created_at: data.created_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[status-agendamento] erro:", msg);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar agendamento" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
