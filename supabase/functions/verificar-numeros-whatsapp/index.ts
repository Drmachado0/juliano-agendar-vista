import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verificarNumeroWhatsapp, normalizePhoneBR } from "../_shared/whatsappSender.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NumberCheckResult {
  telefone: string;
  telefoneFormatado: string;
  existeWhatsApp?: boolean;
  jid?: string;
  fromCache?: boolean;
  erro?: string;
}

interface CachedVerification {
  telefone: string;
  existe_whatsapp: boolean;
  jid: string | null;
  verificado_em: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefones, forceRefresh = false } = await req.json();

    if (!telefones || !Array.isArray(telefones) || telefones.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lista de telefones é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (telefones.length > 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'Máximo de 50 números por verificação' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const numerosFormatados = telefones.map((tel: string) => ({
      original: tel,
      formatted: normalizePhoneBR(tel),
    }));

    const results: NumberCheckResult[] = [];
    const numerosParaVerificar: { original: string; formatted: string }[] = [];

    // Cache (30 dias)
    if (!forceRefresh) {
      const telefonesParaBuscar = numerosFormatados.map(n => n.formatted);
      const { data: cached } = await supabase
        .from('verificacoes_whatsapp')
        .select('telefone, existe_whatsapp, jid, verificado_em')
        .in('telefone', telefonesParaBuscar);

      const cacheMap = new Map<string, CachedVerification>();
      if (cached) for (const item of cached) cacheMap.set(item.telefone, item);

      for (const num of numerosFormatados) {
        const c = cacheMap.get(num.formatted);
        if (c) {
          const dias = (Date.now() - new Date(c.verificado_em).getTime()) / 86400000;
          if (dias < 30) {
            results.push({
              telefone: num.original,
              telefoneFormatado: num.formatted,
              existeWhatsApp: c.existe_whatsapp,
              jid: c.jid || undefined,
              fromCache: true,
            });
            continue;
          }
        }
        numerosParaVerificar.push(num);
      }
    } else {
      numerosParaVerificar.push(...numerosFormatados);
    }

    // Verificação via n8n: 1 chamada por número (deduplicado)
    if (numerosParaVerificar.length > 0) {
      const uniques = [...new Set(numerosParaVerificar.map(n => n.formatted))];
      console.log(`[verificar] Verificando ${uniques.length} números únicos`);

      const existsMap = new Map<string, { resolved: boolean; exists?: boolean; jid?: string; erro?: string }>();

      // Uma falha de resolução no ManyChat não pode cancelar o lote inteiro.
      // Processamos com concorrência limitada e mantemos o número como
      // "não verificado", sem classificá-lo incorretamente como sem WhatsApp.
      const CONCURRENCY = 5;
      for (let i = 0; i < uniques.length; i += CONCURRENCY) {
        const chunk = uniques.slice(i, i + CONCURRENCY);
        const checked = await Promise.all(chunk.map(async (phone) => ({
          phone,
          result: await verificarNumeroWhatsapp(phone),
        })));

        for (const { phone, result } of checked) {
          if (!result.ok || typeof result.exists !== 'boolean') {
            const erro = result.erro || 'resultado_inconclusivo';
            console.error(`[verificar] Falha na verificação para ${phone}: ${erro}`);
            existsMap.set(phone, { resolved: false, erro });
            continue;
          }
          existsMap.set(phone, {
            resolved: true,
            exists: result.exists,
            jid: result.exists ? `${phone}@s.whatsapp.net` : undefined,
          });
        }
      }

      const newVerifications: { telefone: string; existe_whatsapp: boolean; jid: string | null }[] = [];
      for (const num of numerosParaVerificar) {
        const info = existsMap.get(num.formatted);
        if (!info?.resolved) {
          results.push({
            telefone: num.original,
            telefoneFormatado: num.formatted,
            fromCache: false,
            erro: info?.erro || 'resultado_inconclusivo',
          });
          continue;
        }
        results.push({
          telefone: num.original,
          telefoneFormatado: num.formatted,
          existeWhatsApp: info.exists === true,
          jid: info.jid,
          fromCache: false,
        });
        newVerifications.push({
          telefone: num.formatted,
          existe_whatsapp: info.exists === true,
          jid: info.jid || null,
        });
      }

      if (newVerifications.length > 0) {
        await supabase
          .from('verificacoes_whatsapp')
          .upsert(
            newVerifications.map(v => ({ ...v, verificado_em: new Date().toISOString() })),
            { onConflict: 'telefone' }
          );
      }
    }

    const validos = results.filter(r => r.existeWhatsApp === true).length;
    const invalidos = results.filter(r => r.existeWhatsApp === false).length;
    const naoVerificados = results.filter(r => typeof r.existeWhatsApp !== 'boolean').length;
    const fromCache = results.filter(r => r.fromCache).length;

    return new Response(
      JSON.stringify({
        success: true,
        resultados: results,
        resumo: {
          total: results.length,
          validos,
          invalidos,
          naoVerificados,
          doCache: fromCache,
          verificadosAgora: results.length - fromCache,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Erro ao verificar números:', error);
    const msg = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
