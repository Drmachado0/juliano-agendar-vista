import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EvolutionStatus {
  connected: boolean;
  state: string;
  instanceName: string;
  error?: string;
}

export function useEvolutionStatus(autoCheck = true, intervalMs = 30000) {
  const [status, setStatus] = useState<EvolutionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verificar-status-evolution");

      if (error) {
        console.error("[useEvolutionStatus] Erro ao verificar:", error);
        setStatus({
          connected: false,
          state: "error",
          instanceName: "",
          error: error.message,
        });
      } else {
        setStatus(data as EvolutionStatus);
      }
      setLastChecked(new Date());
    } catch (err: any) {
      console.error("[useEvolutionStatus] Exceção:", err);
      setStatus({
        connected: false,
        state: "error",
        instanceName: "",
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial check
  useEffect(() => {
    if (autoCheck) {
      checkStatus();
    }
  }, [autoCheck, checkStatus]);

  // Periodic check
  useEffect(() => {
    if (!autoCheck || intervalMs <= 0) return;

    const interval = setInterval(checkStatus, intervalMs);
    return () => clearInterval(interval);
  }, [autoCheck, intervalMs, checkStatus]);

  return {
    status,
    loading,
    lastChecked,
    refresh: checkStatus,
  };
}
