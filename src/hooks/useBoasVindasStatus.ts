import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BoasVindasStatus = "enviada" | "falhou" | "tentativa";

export interface BoasVindasInfo {
  status: BoasVindasStatus;
  data: string; // ISO
  motivoErro?: string | null;
}

/**
 * Busca o status de boas-vindas para uma lista de agendamentos.
 * Retorna o registro mais recente de mensagens_whatsapp do tipo 'boas_vindas' por agendamento.
 */
export function useBoasVindasStatus(agendamentoIds: string[]) {
  const [statusMap, setStatusMap] = useState<Record<string, BoasVindasInfo>>({});
  const idsKey = agendamentoIds.slice().sort().join(",");

  useEffect(() => {
    if (agendamentoIds.length === 0) {
      setStatusMap({});
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("mensagens_whatsapp")
        .select("agendamento_id, status_envio, error_message, created_at, tipo_mensagem")
        .in("agendamento_id", agendamentoIds)
        .eq("tipo_mensagem", "boas_vindas")
        .order("created_at", { ascending: false });

      if (cancelled || error || !data) return;

      const map: Record<string, BoasVindasInfo> = {};
      for (const row of data as any[]) {
        if (!row.agendamento_id || map[row.agendamento_id]) continue; // mais recente primeiro
        const raw = (row.status_envio ?? "").toLowerCase();
        let status: BoasVindasStatus = "tentativa";
        if (["enviado", "entregue", "lido", "sucesso", "ok"].includes(raw)) status = "enviada";
        else if (["erro", "falhou", "failed", "error"].includes(raw)) status = "falhou";
        map[row.agendamento_id] = {
          status,
          data: row.created_at,
          motivoErro: row.error_message ?? null,
        };
      }
      setStatusMap(map);
    })();

    // Realtime: atualiza quando novas mensagens chegam
    const channel = supabase
      .channel("kanban-boas-vindas-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagens_whatsapp" },
        (payload) => {
          const row: any = payload.new ?? payload.old;
          if (!row?.agendamento_id) return;
          if (row.tipo_mensagem !== "boas_vindas") return;
          if (!agendamentoIds.includes(row.agendamento_id)) return;
          // Re-fetch leve para esse id
          supabase
            .from("mensagens_whatsapp")
            .select("agendamento_id, status_envio, error_message, created_at")
            .eq("agendamento_id", row.agendamento_id)
            .eq("tipo_mensagem", "boas_vindas")
            .order("created_at", { ascending: false })
            .limit(1)
            .then(({ data }) => {
              const r: any = data?.[0];
              if (!r) return;
              const raw = (r.status_envio ?? "").toLowerCase();
              let status: BoasVindasStatus = "tentativa";
              if (["enviado", "entregue", "lido", "sucesso", "ok"].includes(raw)) status = "enviada";
              else if (["erro", "falhou", "failed", "error"].includes(raw)) status = "falhou";
              setStatusMap((prev) => ({
                ...prev,
                [r.agendamento_id]: { status, data: r.created_at, motivoErro: r.error_message ?? null },
              }));
            });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return statusMap;
}
