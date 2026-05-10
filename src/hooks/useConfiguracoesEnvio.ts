import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buscarConfiguracoesEnvio,
  CONFIG_FALLBACK,
  ConfiguracoesEnvio,
  dentroDaJanela,
  ehBlackoutHoje,
} from "@/services/configuracoesEnvio";

export const QK_CONFIG_ENVIO = ["configuracoes_envio"] as const;

export function useConfiguracoesEnvio() {
  const query = useQuery({
    queryKey: QK_CONFIG_ENVIO,
    queryFn: async (): Promise<ConfiguracoesEnvio> => {
      const { data, error } = await buscarConfiguracoesEnvio();
      if (error || !data) throw new Error(error || "Sem dados");
      return data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Fail-safe: se erro/loading, usa fallback (status pausado)
  const cfg: ConfiguracoesEnvio = query.data ?? CONFIG_FALLBACK;

  const podeEnviarAgora = (): { ok: boolean; motivo?: string } => {
    if (cfg.status_global !== "ativo") {
      return {
        ok: false,
        motivo:
          cfg.status_global === "bloqueado"
            ? `Bloqueado: ${cfg.motivo_bloqueio || "sem motivo"}`
            : "Envios pausados pelo administrador",
      };
    }
    if (!dentroDaJanela(cfg)) {
      return {
        ok: false,
        motivo: `Fora da janela permitida (${cfg.janela_inicio}–${cfg.janela_fim})`,
      };
    }
    if (ehBlackoutHoje(cfg)) {
      return { ok: false, motivo: "Hoje está marcado como blackout date" };
    }
    return { ok: true };
  };

  return {
    cfg,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    podeEnviarAgora,
  };
}

export function useInvalidateConfiguracoesEnvio() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: QK_CONFIG_ENVIO });
}
