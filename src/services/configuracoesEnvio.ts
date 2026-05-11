import { supabase } from "@/integrations/supabase/client";

export type StatusGlobalEnvio = "ativo" | "pausado" | "bloqueado";

export interface ConfiguracoesEnvio {
  limite_sessao: number;
  limite_diario: number;
  janela_inicio: string; // "HH:MM:SS" ou "HH:MM"
  janela_fim: string;
  status_global: StatusGlobalEnvio;
  motivo_bloqueio: string | null;
  blackout_dates: string[]; // YYYY-MM-DD
  intervalo_min_segundos: number;
  intervalo_max_segundos: number;
  updated_at: string;
  updated_by: string | null;
}

export const CONFIG_FALLBACK: ConfiguracoesEnvio = {
  limite_sessao: 40,
  limite_diario: 100,
  janela_inicio: "09:00:00",
  janela_fim: "18:00:00",
  status_global: "pausado", // fail-safe: nunca libera envio se algo der errado
  motivo_bloqueio: "Configuração indisponível (fallback de segurança)",
  blackout_dates: [],
  intervalo_min_segundos: 75,
  intervalo_max_segundos: 210,
  updated_at: new Date().toISOString(),
  updated_by: null,
};

export async function buscarConfiguracoesEnvio(): Promise<{
  data: ConfiguracoesEnvio | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("configuracoes_envio")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { data: null, error: "Singleton não encontrado" };
    return { data: data as unknown as ConfiguracoesEnvio, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar configurações";
    console.error("[configuracoesEnvio] erro ao buscar:", e);
    return { data: null, error: msg };
  }
}

export async function atualizarConfiguracoesEnvio(
  payload: Partial<
    Pick<
      ConfiguracoesEnvio,
      | "limite_sessao"
      | "limite_diario"
      | "janela_inicio"
      | "janela_fim"
      | "status_global"
      | "motivo_bloqueio"
      | "blackout_dates"
    >
  >
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("configuracoes_envio")
      .update({ ...payload, updated_by: user?.id ?? null })
      .eq("id", true);
    if (error) throw error;
    return { success: true, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar configurações";
    console.error("[configuracoesEnvio] erro ao atualizar:", e);
    return { success: false, error: msg };
  }
}

export async function pausarEnvioGlobal(motivo?: string) {
  return atualizarConfiguracoesEnvio({
    status_global: "pausado",
    motivo_bloqueio: motivo || null,
  });
}

export async function retomarEnvioGlobal() {
  return atualizarConfiguracoesEnvio({
    status_global: "ativo",
    motivo_bloqueio: null,
  });
}

/** Retorna apenas a hora (0-23) a partir de "HH:MM:SS" */
export function horaDeString(hms: string): number {
  const [h] = hms.split(":");
  return parseInt(h, 10) || 0;
}

/** Verifica se a hora atual local está dentro da janela [janela_inicio, janela_fim) */
export function dentroDaJanela(cfg: ConfiguracoesEnvio, agora: Date = new Date()): boolean {
  const horaAtual = agora.getHours() + agora.getMinutes() / 60;
  const ini = horaDeString(cfg.janela_inicio);
  const fim = horaDeString(cfg.janela_fim);
  return horaAtual >= ini && horaAtual < fim;
}

export function ehBlackoutHoje(cfg: ConfiguracoesEnvio, hoje: Date = new Date()): boolean {
  const iso = hoje.toISOString().slice(0, 10);
  return (cfg.blackout_dates || []).includes(iso);
}
