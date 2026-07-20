import { useCallback, useEffect, useState } from "react";

export type KanbanColumnDef = {
  status: string;
  title: string;
  color: string;
  defaultVisible?: boolean; // undefined/true = visível; false = oculta por padrão (colunas terminais)
};

export type KanbanColumnConfigItem = {
  status: string;
  visible: boolean;
};

// v5: esconde por padrão as colunas terminais (Compareceu/Cancelado/Faltou) para um board
// mais limpo. Compareceu é arquivado após 7d; as três seguem acessíveis no gerenciador de colunas.
const STORAGE_KEY = "crm:kanban-columns:v5";

export const DEFAULT_COLUMNS: KanbanColumnDef[] = [
  { status: "novo", title: "🆕 Novo Lead", color: "bg-blue-500" },
  { status: "em_conversa", title: "💬 Em conversa", color: "bg-cyan-500" },
  { status: "exames_hgp", title: "🧪 EXAMES — HGP", color: "bg-teal-500" },
  { status: "aguardando_confirmacao", title: "⏳ Aguardando confirmação", color: "bg-amber-500" },
  { status: "yag_laser", title: "🔆 YAG Laser — Belém", color: "bg-violet-500" },
  { status: "agendado", title: "✅ Agendado", color: "bg-emerald-500" },
  { status: "compareceu", title: "🟢 Compareceu", color: "bg-green-600", defaultVisible: false },
  { status: "cancelado", title: "❌ Cancelado", color: "bg-gray-500", defaultVisible: false },
  { status: "faltou", title: "🔴 Faltou", color: "bg-rose-500", defaultVisible: false },
];

// Visibilidade padrão de cada coluna (terminais começam ocultas via defaultVisible: false).
function defaultConfig(): KanbanColumnConfigItem[] {
  return DEFAULT_COLUMNS.map((c) => ({ status: c.status, visible: c.defaultVisible !== false }));
}

function loadConfig(): KanbanColumnConfigItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as KanbanColumnConfigItem[];
    const known = new Set(parsed.map((p) => p.status));
    const merged = parsed.filter((p) => DEFAULT_COLUMNS.some((d) => d.status === p.status));
    for (const d of DEFAULT_COLUMNS) {
      if (!known.has(d.status)) merged.push({ status: d.status, visible: d.defaultVisible !== false });
    }
    return merged;
  } catch {
    return defaultConfig();
  }
}

export function useKanbanColumnsConfig() {
  const [config, setConfig] = useState<KanbanColumnConfigItem[]>(() => loadConfig());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* ignore */
    }
  }, [config]);

  const toggleVisible = useCallback((status: string) => {
    setConfig((prev) => prev.map((c) => (c.status === status ? { ...c, visible: !c.visible } : c)));
  }, []);

  const move = useCallback((from: number, to: number) => {
    setConfig((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }, []);

  const reset = useCallback(() => {
    setConfig(defaultConfig());
  }, []);

  const orderedVisibleColumns: KanbanColumnDef[] = config
    .filter((c) => c.visible)
    .map((c) => DEFAULT_COLUMNS.find((d) => d.status === c.status)!)
    .filter(Boolean);

  const orderedAllColumns = config.map((c) => ({
    ...c,
    def: DEFAULT_COLUMNS.find((d) => d.status === c.status)!,
  }));

  return { config, orderedVisibleColumns, orderedAllColumns, toggleVisible, move, reset };
}

// Normaliza valores legados/sinônimos de status_funil para a coluna correta.
export function normalizeStatusFunil(raw: string | null | undefined): string {
  const v = (raw || "").toLowerCase().trim();
  if (!v) return "novo";
  if (v === "lead") return "novo";
  if (v === "confirmado") return "agendado";
  if (v === "finalizado" || v === "atendido") return "compareceu";
  if (v === "bloqueio") return "__hidden__";
  if (v === "exames_hgp" || v === "exames-hgp") return "exames_hgp";
  return v;
}
