// Guards compartilhados para envio outbound via WhatsApp.
// - hasWhatsappViaCache: usa a tabela verificacoes_whatsapp para evitar HTTP 400
//   ao tentar enviar mensagem para número que não tem WhatsApp.
// - isBotPaused: verifica se o agendamento está com bot pausado (bot_pausado_ate > now()).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Retorna true se o cache indica explicitamente que o número NÃO tem WhatsApp.
 * Retorna false em qualquer outro caso (cache positivo, ausente, expirado ou erro)
 * — ou seja, "false = pode tentar enviar".
 *
 * Usa as últimas 8 dígitos do telefone para casar variações de DDI/DDD.
 * Considera o cache válido por 30 dias.
 */
export async function isKnownInvalidWhatsapp(
  supabase: SupabaseClient,
  telefone: string,
  maxAgeDays = 30,
): Promise<boolean> {
  const digits = (telefone || "").replace(/\D/g, "");
  if (digits.length < 8) return false;
  const last8 = digits.slice(-8);

  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("verificacoes_whatsapp")
    .select("existe_whatsapp, verificado_em, telefone")
    .ilike("telefone", `%${last8}`)
    .gte("verificado_em", cutoff)
    .order("verificado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  return data.existe_whatsapp === false;
}

/**
 * Retorna true se o bot deve ser considerado pausado para um agendamento
 * (bot_ativo=false ou bot_pausado_ate no futuro).
 */
export function isBotPaused(agendamento: {
  bot_ativo?: boolean | null;
  bot_pausado_ate?: string | null;
}): boolean {
  if (agendamento?.bot_ativo === false) return true;
  if (agendamento?.bot_pausado_ate) {
    const ate = new Date(agendamento.bot_pausado_ate).getTime();
    if (!Number.isNaN(ate) && ate > Date.now()) return true;
  }
  return false;
}
