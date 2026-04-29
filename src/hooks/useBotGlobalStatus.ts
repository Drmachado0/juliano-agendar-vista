import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lê (e mantém em realtime) o flag global `bot_global_ativo` da tabela bot_config.
 * Quando false, todos os controles individuais ficam efetivamente em "pausado globalmente".
 */
export function useBotGlobalStatus() {
  const [globalAtivo, setGlobalAtivo] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase
        .from("bot_config" as any)
        .select("bot_global_ativo")
        .eq("id", true)
        .maybeSingle();
      if (mounted) {
        setGlobalAtivo((data as any)?.bot_global_ativo ?? true);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel("bot_config_global")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bot_config" },
        (payload) => {
          const r = payload.new as any;
          if (typeof r?.bot_global_ativo === "boolean") {
            setGlobalAtivo(r.bot_global_ativo);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { globalAtivo, loading };
}
