import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BoasVindasStatus =
  | "enviado"
  | "entregue"
  | "lido"
  | "pendente"
  | "erro";

export interface BoasVindasInfo {
  status: BoasVindasStatus;
  statusRaw: string | null;
  data: string; // ISO timestamp
  motivoErro?: string | null;
}

function normalizeStatus(raw: string | null | undefined): BoasVindasStatus {
  const s = (raw ?? "").toLowerCase().trim();
  if (["lido", "read"].includes(s)) return "lido";
  if (["entregue", "delivered", "delivery_ack"].includes(s)) return "entregue";
  if (["enviado", "enviada", "sent", "server_ack", "ok", "sucesso"].includes(s))
    return "enviado";
  if (["erro", "error", "falhou", "failed", "failure"].includes(s)) return "erro";
  // pendente, pending, queued, processing, vazio etc.
  return "pendente";
}

/**
 * Busca o status real de boas-vindas para uma lista de agendamentos.
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
        map[row.agendamento_id] = {
          status: normalizeStatus(row.status_envio),
          statusRaw: row.status_envio ?? null,
          data: row.created_at,
          motivoErro: row.error_message ?? null,
        };
      }
      setStatusMap(map);
    })();

    // Realtime: atualiza quando novas mensagens chegam ou status muda
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
              setStatusMap((prev) => ({
                ...prev,
                [r.agendamento_id]: {
                  status: normalizeStatus(r.status_envio),
                  statusRaw: r.status_envio ?? null,
                  data: r.created_at,
                  motivoErro: r.error_message ?? null,
                },
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
