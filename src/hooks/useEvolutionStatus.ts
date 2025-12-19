import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EvolutionStatus {
  connected: boolean;
  state: string;
  instanceName: string;
  error?: string;
}

interface ConnectionActionResult {
  success: boolean;
  action: string;
  state?: string;
  connected?: boolean;
  error?: string;
  details?: { qrcode?: string };
}

export function useEvolutionStatus(autoCheck = true, intervalMs = 30000) {
  const [status, setStatus] = useState<EvolutionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
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

  // Execute a connection management action
  const executeAction = useCallback(async (action: "check" | "restart" | "connect" | "reconnect"): Promise<ConnectionActionResult> => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerenciar-conexao-evolution", {
        body: { action },
      });

      if (error) {
        console.error(`[useEvolutionStatus] Erro na ação ${action}:`, error);
        return {
          success: false,
          action,
          error: error.message,
        };
      }

      const result = data as ConnectionActionResult;
      
      // Update local status if we got connection info
      if (result.state !== undefined && result.connected !== undefined) {
        setStatus(prev => ({
          ...prev,
          connected: result.connected!,
          state: result.state!,
          instanceName: prev?.instanceName || "",
          error: result.error,
        }));
      }

      setLastChecked(new Date());
      return result;
    } catch (err: any) {
      console.error(`[useEvolutionStatus] Exceção na ação ${action}:`, err);
      return {
        success: false,
        action,
        error: err.message,
      };
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Convenience methods for specific actions
  const reiniciar = useCallback(() => executeAction("restart"), [executeAction]);
  const conectar = useCallback(() => executeAction("connect"), [executeAction]);
  const reconectar = useCallback(() => executeAction("reconnect"), [executeAction]);

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
    actionLoading,
    lastChecked,
    refresh: checkStatus,
    reiniciar,
    conectar,
    reconectar,
    executeAction,
  };
}
