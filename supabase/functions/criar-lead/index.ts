import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadData {
  nome_completo: string;
  telefone_whatsapp: string;
  data_nascimento?: string;
  email?: string;
  tipo_atendimento: string;
  detalhe_exame_ou_cirurgia?: string;
  local_atendimento: string;
  convenio: string;
  convenio_outro?: string;
  // Tracking
  origem?: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  landing_page?: string | null;
  referrer?: string | null;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function fireMetaCapiLead(
  lead: { id: string; email: string | null; telefone: string; nome: string },
  tracking: Partial<LeadData>,
  clientIp: string,
  userAgent: string,
) {
  try {
    const [first_name, ...rest] = (lead.nome || '').trim().split(/\s+/);
    const last_name = rest.join(' ');
    const url = `${SUPABASE_URL}/functions/v1/meta-capi`;
    const landing = tracking.landing_page || '/';
    const event_source_url = landing.startsWith('http')
      ? landing
      : `https://drjulianomachado.com${landing}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'x-forwarded-for': clientIp,
        'user-agent': userAgent,
      },
      body: JSON.stringify({
        event_name: 'Lead',
        event_id: lead.id,
        event_source_url,
        user_data: {
          em: lead.email || undefined,
          ph: lead.telefone || undefined,
          fn: first_name || undefined,
          ln: last_name || undefined,
          country: 'BR',
          external_id: lead.id,
          fbc: tracking.fbc || undefined,
          fbp: tracking.fbp || undefined,
          client_user_agent: userAgent || undefined,
        },
        custom_data: {
          content_name: 'Lead Site',
          content_category: 'Consulta Oftalmológica',
          value: 300,
          currency: 'BRL',
          utm_source: tracking.utm_source || undefined,
          utm_medium: tracking.utm_medium || undefined,
          utm_campaign: tracking.utm_campaign || undefined,
          utm_content: tracking.utm_content || undefined,
          utm_term: tracking.utm_term || undefined,
        },
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[criar-lead] Meta CAPI Lead failed (${res.status}): ${body}`);
    } else {
      console.log(`[criar-lead] Meta CAPI Lead sent event_id=${lead.id} resp=${body}`);
    }
  } catch (err) {
    console.error('[criar-lead] Meta CAPI Lead error:', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const data: LeadData = await req.json();

    console.log('[criar-lead] Dados recebidos:', JSON.stringify(data));

    if (!data.nome_completo || !data.telefone_whatsapp || !data.tipo_atendimento || !data.local_atendimento || !data.convenio) {
      console.error('[criar-lead] Campos obrigatórios faltando');
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const phoneClean = data.telefone_whatsapp.replace(/\D/g, '');

    const { data: lead, error } = await supabase
      .from('agendamentos')
      .insert({
        nome_completo: data.nome_completo.trim(),
        telefone_whatsapp: phoneClean,
        data_nascimento: data.data_nascimento || null,
        email: data.email?.trim() || null,
        tipo_atendimento: data.tipo_atendimento,
        detalhe_exame_ou_cirurgia: data.detalhe_exame_ou_cirurgia || null,
        local_atendimento: data.local_atendimento,
        convenio: data.convenio,
        convenio_outro: data.convenio_outro || null,
        status_crm: 'NOVO LEAD',
        status_funil: 'lead',
        origem: data.origem || 'site',
        data_agendamento: null,
        hora_agendamento: null,
        // Tracking persistido
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
        utm_campaign: data.utm_campaign || null,
        utm_term: data.utm_term || null,
        utm_content: data.utm_content || null,
        gclid: data.gclid || null,
        fbclid: data.fbclid || null,
        gbraid: data.gbraid || null,
        wbraid: data.wbraid || null,
        fbp: data.fbp || null,
        fbc: data.fbc || null,
        landing_page: data.landing_page || null,
        referrer: data.referrer || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao criar lead:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar lead', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead criado com sucesso:', lead.id);

    // Fire-and-forget Meta CAPI Lead (server-side dedup com browser via event_id = lead.id)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? req.headers.get('x-real-ip')
      ?? '';
    const userAgent = req.headers.get('user-agent') ?? '';
    fireMetaCapiLead(
      { id: lead.id, email: data.email?.trim() || null, telefone: phoneClean, nome: data.nome_completo },
      data,
      clientIp,
      userAgent,
    ).catch((e) => console.error('[criar-lead] Meta CAPI fire-and-forget error:', e));

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
