// Trava anti-loop / anti-spam para envios outbound de WhatsApp.
// Uso: antes de chamar Evolution, verifique se o telefone está dentro do
// limite de envios da janela. Se não, registre e pule.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface OutboundLimit {
  tipo: string | null;       // null = considera qualquer tipo
  janelaMinutos: number;
  maxMsgs: number;
}

// Limites padrão por tipo de mensagem (defesa em profundidade)
export const LIMITES_PADRAO: Record<string, OutboundLimit> = {
  boas_vindas:   { tipo: "boas_vindas",   janelaMinutos: 60 * 24,       maxMsgs: 1  },
  confirmacao:   { tipo: "confirmacao",   janelaMinutos: 60 * 6,        maxMsgs: 1  },
  lembrete_24h:  { tipo: "lembrete_24h",  janelaMinutos: 60 * 24,       maxMsgs: 1  },
  lembrete_2h:   { tipo: "lembrete_2h",   janelaMinutos: 60 * 6,        maxMsgs: 1  },
  lembrete_anual:{ tipo: null,            janelaMinutos: 60 * 24 * 7,   maxMsgs: 1  },
  agradecimento: { tipo: "agradecimento", janelaMinutos: 60 * 24 * 30,  maxMsgs: 1  },
  manual:        { tipo: null,            janelaMinutos: 60,            maxMsgs: 10 },
  // Trava global anti-flood (qualquer tipo, mesmo telefone, curtíssimo prazo)
  global_burst:  { tipo: null,            janelaMinutos: 5,             maxMsgs: 3  },
};

export interface RateLimitResult {
  ok: boolean;
  motivo?: string;
  limiteAtingido?: OutboundLimit;
}

/**
 * Verifica se pode enviar mensagem outbound. Sempre aplica o limite
 * `global_burst` + um limite específico opcional.
 * Em qualquer erro de RPC, falha aberto (retorna ok=true) para não bloquear envios legítimos.
 */
export async function podeEnviarOutbound(
  supabase: SupabaseClient,
  telefone: string,
  limites: OutboundLimit[],
): Promise<RateLimitResult> {
  // Sempre inclui o burst global
  const todos = [LIMITES_PADRAO.global_burst, ...limites];

  for (const lim of todos) {
    const { data, error } = await supabase.rpc("pode_enviar_outbound", {
      p_telefone: telefone,
      p_tipo: lim.tipo,
      p_janela_minutos: lim.janelaMinutos,
      p_max_msgs: lim.maxMsgs,
    });
    if (error) {
      console.warn("[rateLimitOutbound] RPC erro — fail open:", error.message);
      continue;
    }
    if (data === false) {
      return {
        ok: false,
        limiteAtingido: lim,
        motivo: `Rate limit atingido: tipo=${lim.tipo ?? "qualquer"} max=${lim.maxMsgs} janela=${lim.janelaMinutos}min`,
      };
    }
  }
  return { ok: true };
}

/**
 * Helper para registrar bloqueio em system_logs (não trava em caso de erro).
 */
export async function logarBloqueioRateLimit(
  supabase: SupabaseClient,
  source: string,
  telefone: string,
  agendamentoId: string | null,
  resultado: RateLimitResult,
): Promise<void> {
  try {
    const last4 = telefone.replace(/\D/g, "").slice(-4);
    await supabase.from("system_logs").insert({
      level: "warn",
      category: "whatsapp",
      source,
      message: "Envio bloqueado por rate limit anti-loop",
      details: {
        event: "rate_limit_block",
        telefone_mascarado: "***" + last4,
        agendamento_id: agendamentoId,
        limite: resultado.limiteAtingido,
        motivo: resultado.motivo,
      },
      agendamento_id: agendamentoId,
    });
  } catch (_) { /* silencioso */ }
}
