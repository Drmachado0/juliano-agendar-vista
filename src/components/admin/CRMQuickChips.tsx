import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CalendarDays, CalendarRange, AlertCircle, CalendarOff, X, MapPin, Shield } from "lucide-react";
import type { Agendamento } from "@/services/agendamentos";
import type { CrmFilters, CrmPeriodo } from "./CRMFilters";
import { LOCAL_BADGE_SOFT_CLASSES, LOCAL_SHORT_LABELS, getLocalGrupo } from "@/lib/localAtendimento";

interface CRMQuickChipsProps {
  filters: CrmFilters;
  onChange: (filters: CrmFilters) => void;
  /** Lista plana de todos os agendamentos (após filtro de sandbox) — usada só para contar */
  agendamentos: Agendamento[];
}

type ChipDef = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  count: number;
  colorClass?: string;
  onToggle: () => void;
};

const periodoChipsBase: { value: CrmPeriodo; label: string; icon: React.ReactNode }[] = [
  { value: "hoje", label: "Hoje", icon: <CalendarDays className="h-3 w-3" /> },
  { value: "7dias", label: "7 dias", icon: <CalendarRange className="h-3 w-3" /> },
  { value: "atrasados", label: "Atrasados", icon: <AlertCircle className="h-3 w-3" /> },
  { value: "sem_data", label: "Sem data", icon: <CalendarOff className="h-3 w-3" /> },
];

function countByPeriodo(items: Agendamento[], periodo: CrmPeriodo): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim7 = new Date(hoje);
  fim7.setDate(fim7.getDate() + 7);

  return items.filter((a) => {
    const temData = !!a.data_agendamento;
    if (periodo === "sem_data") return !temData;
    if (!temData) return false;
    const d = new Date(a.data_agendamento + "T00:00:00");
    if (periodo === "hoje") return d.getTime() === hoje.getTime();
    if (periodo === "7dias") return d >= hoje && d <= fim7;
    if (periodo === "atrasados") return d < hoje && a.status_crm !== "ATENDIDO";
    return true;
  }).length;
}

const CRMQuickChips = ({ filters, onChange, agendamentos }: CRMQuickChipsProps) => {
  // Unidades e convênios derivados dos dados existentes
  const { unidadesDisponiveis, conveniosDisponiveis } = useMemo(() => {
    const uniMap = new Map<string, number>();
    const convMap = new Map<string, number>();
    for (const a of agendamentos) {
      if (a.local_atendimento) uniMap.set(a.local_atendimento, (uniMap.get(a.local_atendimento) || 0) + 1);
      const conv = a.convenio === "Outro" ? a.convenio_outro || "Outro" : a.convenio;
      if (conv) convMap.set(conv, (convMap.get(conv) || 0) + 1);
    }
    const sortByCount = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]);
    return {
      unidadesDisponiveis: sortByCount(uniMap),
      conveniosDisponiveis: sortByCount(convMap).slice(0, 6),
    };
  }, [agendamentos]);

  const periodoChips: ChipDef[] = periodoChipsBase.map((p) => ({
    key: `periodo:${p.value}`,
    label: p.label,
    icon: p.icon,
    active: filters.periodo === p.value,
    count: countByPeriodo(agendamentos, p.value),
    onToggle: () =>
      onChange({
        ...filters,
        periodo: filters.periodo === p.value ? "todos" : p.value,
      }),
  }));

  const unidadeChips: ChipDef[] = unidadesDisponiveis.map(([u, count]) => {
    const grupo = getLocalGrupo(u);
    return {
      key: `local:${u}`,
      label: LOCAL_SHORT_LABELS[grupo] || u,
      icon: <MapPin className="h-3 w-3" />,
      active: filters.local === u,
      count,
      colorClass: LOCAL_BADGE_SOFT_CLASSES[grupo],
      onToggle: () =>
        onChange({ ...filters, local: filters.local === u ? undefined : u }),
    };
  });

  const convenioChips: ChipDef[] = conveniosDisponiveis.map(([c, count]) => ({
    key: `convenio:${c}`,
    label: c,
    icon: <Shield className="h-3 w-3" />,
    active: filters.convenio === c,
    count,
    onToggle: () =>
      onChange({ ...filters, convenio: filters.convenio === c ? undefined : c }),
  }));

  const hasActive =
    filters.periodo !== "todos" || !!filters.local || !!filters.convenio;

  const Chip = ({ chip }: { chip: ChipDef }) => (
    <button
      type="button"
      onClick={chip.onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all whitespace-nowrap",
        chip.active
          ? cn(
              "border-primary/50 bg-primary/15 text-foreground shadow-sm",
              chip.colorClass
            )
          : "border-border/60 bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground"
      )}
    >
      {chip.icon}
      <span>{chip.label}</span>
      <span
        className={cn(
          "tabular-nums text-[10px] px-1 rounded",
          chip.active ? "bg-primary/20" : "bg-muted/60"
        )}
      >
        {chip.count}
      </span>
    </button>
  );

  const Group = ({ label, chips }: { label: string; chips: ChipDef[] }) => {
    if (chips.length === 0) return null;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mr-1">
          {label}
        </span>
        {chips.map((c) => <Chip key={c.key} chip={c} />)}
      </div>
    );
  };

  return (
    <div className="bg-card/50 rounded-xl border border-border/50 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Filtros rápidos</span>
        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({ ...filters, periodo: "todos", local: undefined, convenio: undefined })
            }
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Group label="Período" chips={periodoChips} />
        <Group label="Unidade" chips={unidadeChips} />
        <Group label="Convênio" chips={convenioChips} />
      </div>
    </div>
  );
};

export default CRMQuickChips;
