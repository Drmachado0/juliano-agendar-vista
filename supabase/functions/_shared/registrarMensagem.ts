// Helper compartilhado para garantir registro universal de mensagens WhatsApp
// Usa a RPC registrar_mensagem_whatsapp que faz:
// - Vinculação automática ao agendamento (busca por últimos 8 dígitos do telefone)
// - Categorização por tipo_mensagem
// - Persiste mesmo com erro de envio (status_envio='erro' + error_message)

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type TipoMensagem =
  | "manual"
  | "confirmacao"
  | "lembrete_24h"
  | "boas_vindas"
  | "bot_pre_agendamento"
  | "avaliacao"
  | "lembrete_anual"
  | "sistema"
  | "recebida"
  | "imagem"
  | "audio"
  | "video"
  | "documento"
  | "sticker"
  | "reacao";

export interface RegistrarMensagemParams {
  telefone: string;
  direcao: "IN" | "OUT";
  conteudo: string;
  tipo_mensagem?: TipoMensagem;
  agendamento_id?: string | null;
  status_envio?: "enviado" | "erro" | "entregue" | "lido";
  mensagem_externa_id?: string | null;
  error_message?: string | null;
  payload?: Record<string, unknown> | null;
}

/**
 * Registra uma mensagem WhatsApp na tabela `mensagens_whatsapp` via RPC,
 * vinculando automaticamente ao agendamento quando possível.
 * Não lança — apenas loga em caso de erro para não quebrar o fluxo principal.
 */
export async function registrarMensagemWhatsapp(
  supabase: SupabaseClient,
  params: RegistrarMensagemParams,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("registrar_mensagem_whatsapp", {
      p_telefone: params.telefone,
      p_direcao: params.direcao,
      p_conteudo: params.conteudo,
      p_tipo_mensagem: params.tipo_mensagem ?? "manual",
      p_agendamento_id: params.agendamento_id ?? null,
      p_status_envio: params.status_envio ?? "enviado",
      p_mensagem_externa_id: params.mensagem_externa_id ?? null,
      p_error_message: params.error_message ?? null,
      p_payload: (params.payload ?? null) as never,
    });
    if (error) {
      console.error("[registrarMensagemWhatsapp] erro RPC:", error.message);
      return null;
    }
    return (data as string) ?? null;
  } catch (e) {
    console.error("[registrarMensagemWhatsapp] exceção:", e instanceof Error ? e.message : e);
    return null;
  }
}
