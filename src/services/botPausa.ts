import { supabase } from "@/integrations/supabase/client";

export interface BotConfig {
  pausa_automatica_ativa: boolean;
  pausa_automatica_minutos: number;
}

export interface BotStatusAgendamento {
  bot_ativo: boolean;
  bot_pausado_ate: string | null;
  bot_pausa_motivo: string | null;
}

export async function obterBotConfig(): Promise<BotConfig> {
  const { data } = await supabase
    .from("bot_config" as any)
    .select("pausa_automatica_ativa, pausa_automatica_minutos")
    .eq("id", true)
    .maybeSingle();
  return {
    pausa_automatica_ativa: (data as any)?.pausa_automatica_ativa ?? true,
    pausa_automatica_minutos: (data as any)?.pausa_automatica_minutos ?? 30,
  };
}

export async function atualizarBotConfig(cfg: BotConfig): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("bot_config" as any)
    .update({
      pausa_automatica_ativa: cfg.pausa_automatica_ativa,
      pausa_automatica_minutos: cfg.pausa_automatica_minutos,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  return { error: error?.message ?? null };
}

export async function obterStatusBot(agendamentoId: string): Promise<BotStatusAgendamento | null> {
  const { data } = await supabase
    .from("agendamentos")
    .select("bot_ativo, bot_pausado_ate, bot_pausa_motivo")
    .eq("id", agendamentoId)
    .maybeSingle();
  if (!data) return null;
  return data as any;
}

export async function pausarBot(agendamentoId: string, minutos?: number, motivo: string = "manual"): Promise<{ error: string | null; ate: string | null }> {
  const { data, error } = await (supabase as any).rpc("pausar_bot_agendamento", {
    p_agendamento_id: agendamentoId,
    p_minutos: minutos ?? null,
    p_motivo: motivo,
  });
  return { error: error?.message ?? null, ate: (data as string) ?? null };
}

export async function reativarBot(agendamentoId: string): Promise<{ error: string | null }> {
  const { error } = await (supabase as any).rpc("reativar_bot_agendamento", {
    p_agendamento_id: agendamentoId,
  });
  return { error: error?.message ?? null };
}
