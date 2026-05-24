// Helper para verificar status_global de envios antes de despachar mensagens automáticas.
// Retorna true se envio está liberado, false caso contrário.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function envioAutomaticoLiberado(
  supabase: SupabaseClient,
): Promise<{ liberado: boolean; status: string; motivo?: string }> {
  try {
    const { data, error } = await supabase
      .from("configuracoes_envio")
      .select("status_global, motivo_bloqueio")
      .eq("id", true)
      .maybeSingle();
    if (error || !data) {
      // fail-safe: se não conseguimos ler, NÃO bloqueamos envios transacionais
      // (boas-vindas/confirmação/lembrete são esperados pelo paciente).
      // Apenas avisamos no log.
      console.warn("[envioAutomaticoLiberado] erro lendo config, liberando:", error?.message);
      return { liberado: true, status: "desconhecido" };
    }
    const status = data.status_global as string;
    if (status === "bloqueado" || status === "pausado") {
      return {
        liberado: false,
        status,
        motivo: data.motivo_bloqueio ?? `Status global = ${status}`,
      };
    }
    return { liberado: true, status };
  } catch (e) {
    console.warn("[envioAutomaticoLiberado] exceção, liberando:", e);
    return { liberado: true, status: "erro" };
  }
}
