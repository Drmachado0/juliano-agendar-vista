import { supabase } from "@/integrations/supabase/client";
import type { SystemLogEntry, LogLevel } from "./systemLogs";

export type Canal = "meta_capi" | "n8n" | "whatsapp";

export const CANAL_META: Record<Canal, { label: string; sources: string[] }> = {
  meta_capi: {
    label: "Meta CAPI",
    sources: ["meta-capi"],
  },
  n8n: {
    label: "n8n",
    sources: [
      "whatsapp-n8n",
      "registrar-mensagem-in-n8n",
      "registrar-envio-out-n8n",
      "notificar-n8n",
      "n8n-registrar-envio",
      "n8n-resposta-confirmacao",
    ],
  },
  whatsapp: {
    label: "WhatsApp",
    sources: [
      "enviar-whatsapp",
      "enviar-whatsapp-queue",
      "enviar-whatsapp-imagem",
      "enviar-boas-vindas-lead",
      "retentar-boas-vindas-pendentes",
      "confirmar-agendamento-whatsapp",
      "lembrete-consulta-whatsapp",
      "lembretes-runner",
    ],
  },
};

export function classificarCanal(source: string | null): Canal | null {
  if (!source) return null;
  for (const [canal, meta] of Object.entries(CANAL_META) as [Canal, typeof CANAL_META[Canal]][]) {
    if (meta.sources.includes(source)) return canal;
    if (canal === "n8n" && source.includes("n8n")) return canal;
  }
  return null;
}

export interface CanalStats {
  canal: Canal;
  label: string;
  ok: number;
  warn: number;
  error: number;
  critical: number;
  ultimo_erro_at: string | null;
  ultimo_erro_msg: string | null;
}

export interface MonitorSnapshot {
  janela_horas: number;
  gerado_em: string;
  por_canal: CanalStats[];
  ultimos_erros: SystemLogEntry[];
}

/**
 * Busca logs relevantes (últimas N horas) e agrega por canal.
 * Usa a RPC listar_system_logs já disponível.
 */
export async function carregarMonitor(janelaHoras = 24): Promise<MonitorSnapshot> {
  const dataInicio = new Date(Date.now() - janelaHoras * 3600_000).toISOString();

  const { data, error } = await (supabase as any).rpc("listar_system_logs", {
    p_search: null,
    p_level: null,
    p_category: null,
    p_source: null,
    p_user_id: null,
    p_data_inicio: dataInicio,
    p_data_fim: null,
    p_limit: 1000,
  });
  if (error) throw new Error(error.message);

  const entries = (data ?? []) as SystemLogEntry[];

  const base: Record<Canal, CanalStats> = {
    meta_capi: { canal: "meta_capi", label: CANAL_META.meta_capi.label, ok: 0, warn: 0, error: 0, critical: 0, ultimo_erro_at: null, ultimo_erro_msg: null },
    n8n: { canal: "n8n", label: CANAL_META.n8n.label, ok: 0, warn: 0, error: 0, critical: 0, ultimo_erro_at: null, ultimo_erro_msg: null },
    whatsapp: { canal: "whatsapp", label: CANAL_META.whatsapp.label, ok: 0, warn: 0, error: 0, critical: 0, ultimo_erro_at: null, ultimo_erro_msg: null },
  };

  const errosFlat: SystemLogEntry[] = [];

  for (const e of entries) {
    const canal = classificarCanal(e.source);
    if (!canal) continue;
    const stats = base[canal];
    const lvl = (e.level ?? "info") as LogLevel;
    if (lvl === "info") stats.ok++;
    else if (lvl === "warn") stats.warn++;
    else if (lvl === "error") stats.error++;
    else if (lvl === "critical") stats.critical++;

    if (lvl === "error" || lvl === "critical" || lvl === "warn") {
      errosFlat.push(e);
      if (lvl !== "warn" && (!stats.ultimo_erro_at || e.created_at > stats.ultimo_erro_at)) {
        stats.ultimo_erro_at = e.created_at;
        stats.ultimo_erro_msg = e.message;
      }
    }
  }

  errosFlat.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return {
    janela_horas: janelaHoras,
    gerado_em: new Date().toISOString(),
    por_canal: [base.meta_capi, base.n8n, base.whatsapp],
    ultimos_erros: errosFlat.slice(0, 50),
  };
}

export interface AgendamentoStatusIntegracoes {
  agendamento_id: string;
  canais: Record<Canal, { level: LogLevel | "sem_registro"; ultimo: string | null; mensagem: string | null }>;
}

/**
 * Retorna status por canal para um agendamento específico
 * (nível pior encontrado + último timestamp).
 */
export async function statusPorAgendamento(agendamentoId: string): Promise<AgendamentoStatusIntegracoes> {
  const { data, error } = await supabase
    .from("system_logs")
    .select("level, source, message, created_at")
    .eq("agendamento_id", agendamentoId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const canais: AgendamentoStatusIntegracoes["canais"] = {
    meta_capi: { level: "sem_registro", ultimo: null, mensagem: null },
    n8n: { level: "sem_registro", ultimo: null, mensagem: null },
    whatsapp: { level: "sem_registro", ultimo: null, mensagem: null },
  };

  const pesos: Record<LogLevel | "sem_registro", number> = {
    sem_registro: 0, info: 1, warn: 2, error: 3, critical: 4,
  };

  for (const row of (data ?? []) as any[]) {
    const canal = classificarCanal(row.source);
    if (!canal) continue;
    const cur = canais[canal];
    const lvl = (row.level ?? "info") as LogLevel;
    if (pesos[lvl] >= pesos[cur.level]) {
      canais[canal] = { level: lvl, ultimo: row.created_at, mensagem: row.message };
    }
  }

  return { agendamento_id: agendamentoId, canais };
}
