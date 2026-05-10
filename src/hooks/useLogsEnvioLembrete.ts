import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listarLogsEnvioLembrete,
  ListarLogsFiltros,
  LogEnvioLembrete,
} from "@/services/logsEnvioLembrete";

export const QK_LOGS_ENVIO = (filtros: ListarLogsFiltros) =>
  ["logs_envio_lembrete", filtros] as const;

export function useLogsEnvioLembrete(filtros: ListarLogsFiltros = {}) {
  const query = useQuery({
    queryKey: QK_LOGS_ENVIO(filtros),
    queryFn: async (): Promise<LogEnvioLembrete[]> => {
      const { data, error } = await listarLogsEnvioLembrete(filtros);
      if (error) throw new Error(error);
      return data ?? [];
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  return {
    logs: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useInvalidateLogsEnvio() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["logs_envio_lembrete"] });
}
