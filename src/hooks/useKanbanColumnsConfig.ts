import { useCallback, useEffect, useState } from "react";

export type KanbanColumnDef = {
  status: string;
  title: string;
  color: string;
};

export type KanbanColumnConfigItem = {
  status: string;
  visible: boolean;
};

const STORAGE_KEY = "crm:kanban-columns:v1";

export const DEFAULT_COLUMNS: KanbanColumnDef[] = [
  { status: "NOVO LEAD", title: "Novo Lead", color: "bg-emerald-500" },
  { status: "PRECISA_DE_HUMANO", title: "Precisa de humano", color: "bg-rose-500" },
  { status: "AGUARDANDO", title: "Aguardando", color: "bg-yellow-500" },
  { status: "CLINICOR", title: "Clinicor", color: "bg-blue-500" },
  { status: "HGP", title: "HGP", color: "bg-purple-500" },
  { status: "BELÉM", title: "Belém", color: "bg-amber-500" },
  { status: "ATENDIDO", title: "Atendido", color: "bg-gray-500" },
];

function loadConfig(): KanbanColumnConfigItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS.map((c) => ({ status: c.status, visible: true }));
    const parsed = JSON.parse(raw) as KanbanColumnConfigItem[];
    // merge: keep order from saved, append any new defaults at end
    const known = new Set(parsed.map((p) => p.status));
    const merged = parsed.filter((p) => DEFAULT_COLUMNS.some((d) => d.status === p.status));
    for (const d of DEFAULT_COLUMNS) {
      if (!known.has(d.status)) merged.push({ status: d.status, visible: true });
    }
    return merged;
  } catch {
    return DEFAULT_COLUMNS.map((c) => ({ status: c.status, visible: true }));
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
    setConfig(DEFAULT_COLUMNS.map((c) => ({ status: c.status, visible: true })));
  }, []);

  // Resolved ordered list of column defs (visible only) for rendering board
  const orderedVisibleColumns: KanbanColumnDef[] = config
    .filter((c) => c.visible)
    .map((c) => DEFAULT_COLUMNS.find((d) => d.status === c.status)!)
    .filter(Boolean);

  // Full ordered list for the manager UI
  const orderedAllColumns = config.map((c) => ({
    ...c,
    def: DEFAULT_COLUMNS.find((d) => d.status === c.status)!,
  }));

  return { config, orderedVisibleColumns, orderedAllColumns, toggleVisible, move, reset };
}
