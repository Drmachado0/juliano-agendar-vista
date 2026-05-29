import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { registrarMensagemWhatsapp } from "../_shared/registrarMensagem.ts";
import { sendWhatsappImageMessage } from "../_shared/evolutionApiClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone, imageBase64: rawImageBase64, imageUrl, caption, agendamento_id, tipo_mensagem } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!telefone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!imageUrl && !rawImageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'imageUrl ou imageBase64 é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Z-API aceita URL pública OU data URI base64. Priorizamos URL.
    let imagePayload: string;
    let usedMethod: string;
    if (imageUrl) {
      imagePayload = imageUrl;
      usedMethod = 'URL';
    } else {
      let b64 = rawImageBase64 as string;
      if (b64.includes(';base64,')) b64 = b64.split(';base64,')[1];
      imagePayload = `data:image/jpeg;base64,${b64}`;
      usedMethod = 'base64';
    }

    console.log('[enviar-whatsapp-imagem] Enviando via Z-API (', usedMethod, ')');

    const result = await sendWhatsappImageMessage(telefone, imagePayload, caption);
    const conteudoLog = caption ? `[imagem] ${caption}` : "[imagem]";

    if (!result.success) {
      console.error('[enviar-whatsapp-imagem] ✗ Falha:', result.errorMessage);
      await registrarMensagemWhatsapp(supabase, {
        telefone,
        direcao: "OUT",
        conteudo: conteudoLog,
        tipo_mensagem: (tipo_mensagem as any) ?? "imagem",
        agendamento_id: agendamento_id ?? null,
        status_envio: "erro",
        error_message: `[Z-API] ${result.errorMessage ?? 'Erro desconhecido'}`,
      });
      return new Response(
        JSON.stringify({ success: false, error: result.errorMessage, details: result.sanitizedResponse }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[enviar-whatsapp-imagem] ✓ Imagem enviada (', usedMethod, ') messageId=', result.messageId);

    await registrarMensagemWhatsapp(supabase, {
      telefone,
      direcao: "OUT",
      conteudo: conteudoLog,
      tipo_mensagem: (tipo_mensagem as any) ?? "imagem",
      agendamento_id: agendamento_id ?? null,
      status_envio: "enviado",
      mensagem_externa_id: result.messageId ?? null,
      payload: { method: usedMethod, imageUrl: imageUrl ?? null, response: result.sanitizedResponse ?? null },
    });

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId, data: result.sanitizedResponse, method: usedMethod }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[enviar-whatsapp-imagem] Erro fatal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
