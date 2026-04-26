import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validarDisponibilidade } from "../_shared/validarDisponibilidade.ts";
import { syncAgendamentoToCalendar } from "../_shared/syncGoogleCalendar.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // Max 5 appointments per minute per IP

// In-memory rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries periodically
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Check if request is rate limited
function isRateLimited(ip: string): { limited: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return { limited: true, remaining: 0, resetTime: entry.resetTime };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(ip, entry);
  return { limited: false, remaining: MAX_REQUESTS_PER_WINDOW - entry.count, resetTime: entry.resetTime };
}

// Get client IP from request
function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') ||
         'unknown';
}

// Simple validation (Zod-like but lightweight)
function validateAgendamento(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!data.nome_completo || typeof data.nome_completo !== 'string' || data.nome_completo.length < 3) {
    errors.push('Nome completo é obrigatório (mínimo 3 caracteres)');
  } else if (data.nome_completo.length > 200) {
    errors.push('Nome completo muito longo (máximo 200 caracteres)');
  } else if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(data.nome_completo)) {
    errors.push('Nome contém caracteres inválidos');
  }

  if (!data.telefone_whatsapp || typeof data.telefone_whatsapp !== 'string' || data.telefone_whatsapp.length < 10) {
    errors.push('Telefone WhatsApp é obrigatório (mínimo 10 dígitos)');
  } else if (!/^[\d\s\-\(\)\+]+$/.test(data.telefone_whatsapp)) {
    errors.push('Telefone contém caracteres inválidos');
  }

  if (data.email && typeof data.email === 'string' && data.email.length > 0) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Email inválido');
    }
  }

  const tiposValidos = ['Consulta', 'Retorno', 'Exame', 'Cirurgia'];
  if (!data.tipo_atendimento || !tiposValidos.includes(data.tipo_atendimento as string)) {
    errors.push('Tipo de atendimento inválido');
  }

  if (!data.local_atendimento || typeof data.local_atendimento !== 'string') {
    errors.push('Local de atendimento é obrigatório');
  }

  if (!data.convenio || typeof data.convenio !== 'string') {
    errors.push('Convênio é obrigatório');
  }

  if (!data.data_agendamento || !/^\d{4}-\d{2}-\d{2}$/.test(data.data_agendamento as string)) {
    errors.push('Data de agendamento inválida');
  }

  if (!data.hora_agendamento || !/^\d{2}:\d{2}(:\d{2})?$/.test(data.hora_agendamento as string)) {
    errors.push('Hora de agendamento inválida');
  }

  return { valid: errors.length === 0, errors };
}

// Determine CRM status based on location
function determineStatusCrmByLocation(localAtendimento: string): string {
  const locationLower = localAtendimento.toLowerCase();
  
  if (locationLower.includes("clinicor")) return "CLINICOR";
  if (locationLower.includes("hgp") || locationLower.includes("hospital geral de paragominas")) return "HGP";
  if (locationLower.includes("belém") || locationLower.includes("belem") || locationLower.includes("iob") || locationLower.includes("vitria")) return "BELÉM";
  return "NOVO LEAD";
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Clean up expired rate limit entries
  cleanupRateLimitStore();

  // Get client IP and check rate limit
  const clientIp = getClientIp(req);
  const rateLimit = isRateLimited(clientIp);

  console.log(`[criar-agendamento] Request from IP: ${clientIp}, remaining: ${rateLimit.remaining}`);

  if (rateLimit.limited) {
    const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
    console.log(`[criar-agendamento] Rate limited IP: ${clientIp}, retry after: ${retryAfter}s`);
    
    return new Response(
      JSON.stringify({ 
        error: 'Muitas solicitações. Por favor, aguarde alguns minutos antes de tentar novamente.',
        retryAfter 
      }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetTime.toString()
        } 
      }
    );
  }

  try {
    const body = await req.json();
    console.log(`[criar-agendamento] Received data for: ${body.nome_completo}`);

    // Validate input
    const validation = validateAgendamento(body);
    if (!validation.valid) {
      console.log(`[criar-agendamento] Validation failed:`, validation.errors);
      return new Response(
        JSON.stringify({ error: `Dados inválidos: ${validation.errors.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for inserting
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // *** VALIDATE AVAILABILITY BEFORE INSERTING ***
    console.log(`[criar-agendamento] Validando disponibilidade...`);
    const validacaoDisponibilidade = await validarDisponibilidade(
      supabase,
      body.data_agendamento,
      body.hora_agendamento,
      body.local_atendimento
    );

    if (!validacaoDisponibilidade.disponivel) {
      console.log(`[criar-agendamento] Horário indisponível: ${validacaoDisponibilidade.motivo}`);
      return new Response(
        JSON.stringify({ 
          error: validacaoDisponibilidade.motivo || 'Horário não disponível',
          code: (validacaoDisponibilidade as any).codigo || 'HORARIO_INDISPONIVEL'
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[criar-agendamento] Disponibilidade confirmada, prosseguindo com criação...`);

    // Prepare sanitized data
    const autoStatusCrm = determineStatusCrmByLocation(body.local_atendimento);
    const sanitizedData = {
      nome_completo: body.nome_completo.trim(),
      telefone_whatsapp: body.telefone_whatsapp.trim(),
      data_nascimento: body.data_nascimento || null,
      email: body.email?.trim() || null,
      tipo_atendimento: body.tipo_atendimento,
      detalhe_exame_ou_cirurgia: body.detalhe_exame_ou_cirurgia || null,
      local_atendimento: body.local_atendimento,
      convenio: body.convenio,
      convenio_outro: body.convenio_outro || null,
      data_agendamento: body.data_agendamento,
      hora_agendamento: body.hora_agendamento,
      aceita_primeiro_horario: body.aceita_primeiro_horario ?? false,
      aceita_contato_whatsapp_email: body.aceita_contato_whatsapp_email ?? false,
      status_crm: autoStatusCrm,
      origem: body.origem || 'site',
    };

    // Insert into database
    const { data, error } = await supabase
      .from('agendamentos')
      .insert([sanitizedData])
      .select()
      .single();

    if (error) {
      console.error(`[criar-agendamento] Database error:`, error);
      // Race condition: outro agendamento foi criado no mesmo slot entre validar e inserir
      if ((error as any).code === '23505') {
        return new Response(
          JSON.stringify({
            error: 'Este horário acabou de ser reservado por outra pessoa. Por favor, escolha outro horário.',
            code: 'SLOT_TAKEN',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar agendamento. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[criar-agendamento] Created appointment: ${data.id}`);

    // Fire-and-forget: dispara notificações sem bloquear a resposta
    const notifyWhatsApp = supabase.functions.invoke('confirmar-agendamento-whatsapp', {
      body: {
        agendamento_data: {
          nome_completo: sanitizedData.nome_completo,
          telefone_whatsapp: sanitizedData.telefone_whatsapp,
          tipo_atendimento: sanitizedData.tipo_atendimento,
          local_atendimento: sanitizedData.local_atendimento,
          data_agendamento: sanitizedData.data_agendamento,
          hora_agendamento: sanitizedData.hora_agendamento,
          convenio: sanitizedData.convenio,
        }
      },
    }).then(() => console.log('[criar-agendamento] WhatsApp notification sent'))
      .catch((err: unknown) => console.error('[criar-agendamento] WhatsApp notification failed:', err));

    const notifyEmail = supabase.functions.invoke('notificar-agendamento-email', {
      body: {
        nome_completo: sanitizedData.nome_completo,
        telefone_whatsapp: sanitizedData.telefone_whatsapp,
        email_paciente: sanitizedData.email,
        data_nascimento: sanitizedData.data_nascimento,
        tipo_atendimento: sanitizedData.tipo_atendimento,
        detalhe_exame_ou_cirurgia: sanitizedData.detalhe_exame_ou_cirurgia,
        local_atendimento: sanitizedData.local_atendimento,
        convenio: sanitizedData.convenio,
        convenio_outro: sanitizedData.convenio_outro,
        data_agendamento: sanitizedData.data_agendamento,
        hora_agendamento: sanitizedData.hora_agendamento,
      },
    }).then(() => console.log('[criar-agendamento] Email notification sent'))
      .catch((err: unknown) => console.error('[criar-agendamento] Email notification failed:', err));

    // Sync com Google Calendar (fire-and-forget)
    const notifyCalendar = syncAgendamentoToCalendar(supabase, data.id, "create")
      .then(() => console.log("[criar-agendamento] Google Calendar sync triggered"))
      .catch((err: unknown) => console.error("[criar-agendamento] Google Calendar sync failed:", err));

    // Aguarda todas sem bloquear o retorno (best-effort)
    Promise.allSettled([notifyWhatsApp, notifyEmail, notifyCalendar]);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Agendamento criado com sucesso',
        data: { id: data.id }
      }),
      { 
        status: 201, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString()
        } 
      }
    );

  } catch (err) {
    console.error(`[criar-agendamento] Unexpected error:`, err);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
