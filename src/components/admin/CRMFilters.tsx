import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { useDensity } from "@/hooks/useDensity";
import { cn } from "@/lib/utils";
import { ORIGEM_FILTER_OPTIONS, ORIGEM_LABELS, ORIGEM_BADGE_SOFT_CLASSES, getOrigemGrupo, type OrigemGrupo } from "@/lib/origemLead";
import { LOCAL_DOT_CLASSES, LOCAL_SHORT_LABELS, getLocalGrupo, LOCAL_BADGE_SOFT_CLASSES } from "@/lib/localAtendimento";
import { Badge } from "@/components/ui/badge";

export type CrmPeriodo = "todos" | "hoje" | "7dias" | "mes" | "atrasados" | "sem_data";
export type CrmOrdenacao = "data_asc" | "data_desc" | "created_desc" | "created_asc";
export type CrmSandboxFiltro = "reais" | "todos" | "somente_testes";

export interface CrmFilters {
  busca: string;
  local?: string;
  tipo?: string;
  convenio?: string;
  origem?: OrigemGrupo;
  periodo: CrmPeriodo;
  ordenacao: CrmOrdenacao;
  sandbox: CrmSandboxFiltro;
}

export const DEFAULT_CRM_FILTERS: CrmFilters = {
  busca: "",
  periodo: "todos",
  ordenacao: "data_asc",
  sandbox: "reais",
};

interface CRMFiltersProps {
  filters: CrmFilters;
  onChange: (filters: CrmFilters) => void;
  totalFiltrado: number;
  totalGeral: number;
}

const locais = [
  { value: "all", label: "Todos os locais" },
  { value: "Clinicor – Paragominas", label: "Clinicor – Paragominas" },
  { value: "Hospital Geral de Paragominas", label: "Hospital Geral de Paragominas" },
  { value: "Belém (IOB / Vitria)", label: "Belém (IOB / Vitria)" },
];

const tipos = [
  { value: "all", label: "Todos os tipos" },
  { value: "Consulta", label: "Consulta" },
  { value: "Retorno", label: "Retorno" },
  { value: "Exame", label: "Exame" },
  { value: "Cirurgia", label: "Cirurgia" },
];

const convenios = [
  { value: "all", label: "Todos os convênios" },
  { value: "Particular", label: "Particular" },
  { value: "Bradesco", label: "Bradesco" },
  { value: "Unimed", label: "Unimed" },
  { value: "Cassi", label: "Cassi" },
  { value: "Sul América", label: "Sul América" },
  { value: "Outro", label: "Outro" },
];

const periodos: { value: CrmPeriodo; label: string }[] = [
  { value: "todos", label: "Todas as datas" },
  { value: "hoje", label: "Hoje" },
  { value: "7dias", label: "Próximos 7 dias" },
  { value: "mes", label: "Este mês" },
  { value: "atrasados", label: "Atrasados" },
  { value: "sem_data", label: "Sem data" },
];

const ordenacoes: { value: CrmOrdenacao; label: string }[] = [
  { value: "data_asc", label: "Data (mais próxima)" },
  { value: "data_desc", label: "Data (mais distante)" },
  { value: "created_desc", label: "Cadastro mais recente" },
  { value: "created_asc", label: "Cadastro mais antigo" },
];

const sandboxOpcoes: { value: CrmSandboxFiltro; label: string }[] = [
  { value: "reais", label: "Somente reais" },
  { value: "todos", label: "Incluir testes" },
  { value: "somente_testes", label: "Somente testes" },
];

const COLLAPSE_KEY_BASE = "crm:filters:collapsed:v1";
const collapseKeyFor = (density: "compact" | "comfortable") =>
  `${COLLAPSE_KEY_BASE}:${density}`;

const CRMFilters = ({ filters, onChange, totalFiltrado, totalGeral }: CRMFiltersProps) => {
  const { isComfortable } = useDensity();
  const density: "compact" | "comfortable" = isComfortable ? "comfortable" : "compact";
  const [buscaLocal, setBuscaLocal] = useState(filters.busca);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(collapseKeyFor(density));
      if (v !== null) return v === "1";
      const legacy = localStorage.getItem(COLLAPSE_KEY_BASE);
      return legacy === null ? true : legacy === "1";
    } catch {
      return true;
    }
  });

  // Ao alternar densidade, restaura a preferência salva para aquela densidade
  useEffect(() => {
    try {
      const v = localStorage.getItem(collapseKeyFor(density));
      if (v !== null) setCollapsed(v === "1");
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density]);

  useEffect(() => {
    try {
      localStorage.setItem(collapseKeyFor(density), collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, density]);

  useEffect(() => {
    setBuscaLocal(filters.busca);
  }, [filters.busca]);

  useEffect(() => {
    if (buscaLocal === filters.busca) return;
    const t = setTimeout(() => onChange({ ...filters, busca: buscaLocal }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaLocal]);

  const hasActive =
    !!filters.busca ||
    !!filters.local ||
    !!filters.tipo ||
    !!filters.convenio ||
    !!filters.origem ||
    filters.periodo !== "todos" ||
    filters.ordenacao !== "data_asc" ||
    filters.sandbox !== "reais";

  const activeChips: { label: string; colorClass?: string; clear: () => void }[] = [];
  if (filters.local) {
    const grupo = getLocalGrupo(filters.local);
    activeChips.push({
      label: `Local: ${LOCAL_SHORT_LABELS[grupo]}`,
      colorClass: LOCAL_BADGE_SOFT_CLASSES[grupo],
      clear: () => onChange({ ...filters, local: undefined }),
    });
  }
  if (filters.tipo)
    activeChips.push({ label: `Tipo: ${filters.tipo}`, clear: () => onChange({ ...filters, tipo: undefined }) });
  if (filters.convenio)
    activeChips.push({ label: `Convênio: ${filters.convenio}`, clear: () => onChange({ ...filters, convenio: undefined }) });
  if (filters.origem)
    activeChips.push({
      label: `Origem: ${ORIGEM_LABELS[filters.origem]}`,
      colorClass: ORIGEM_BADGE_SOFT_CLASSES[filters.origem],
      clear: () => onChange({ ...filters, origem: undefined }),
    });
  if (filters.periodo !== "todos") {
    const p = periodos.find((x) => x.value === filters.periodo)?.label ?? filters.periodo;
    activeChips.push({ label: `Período: ${p}`, clear: () => onChange({ ...filters, periodo: "todos" }) });
  }
  if (filters.ordenacao !== "data_asc") {
    const o = ordenacoes.find((x) => x.value === filters.ordenacao)?.label ?? filters.ordenacao;
    activeChips.push({ label: `Ordem: ${o}`, clear: () => onChange({ ...filters, ordenacao: "data_asc" }) });
  }

  return (
    <div className={cn("bg-card rounded-xl border border-border/70", isComfortable ? "p-3" : "p-2.5")}>
      {/* Cabeçalho: grid responsivo para evitar quebra excessiva */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr,auto] items-center gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-foreground hover:text-primary transition-colors justify-self-start"
          aria-expanded={!collapsed}
        >
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Filtros</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full tabular-nums">
            {totalFiltrado}/{totalGeral}
          </span>
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Busca sempre visível */}
        <div className="relative w-full sm:max-w-[320px] sm:justify-self-stretch">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Nome ou telefone..."
            className={cn("pl-8 w-full", isComfortable ? "h-9" : "h-8")}
            value={buscaLocal}
            onChange={(e) => setBuscaLocal(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
          {/* Sandbox segmented */}
          <div className="flex rounded-md border border-border/70 overflow-hidden text-xs">
            {sandboxOpcoes.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ ...filters, sandbox: o.value })}
                className={`px-2.5 py-1 transition-colors whitespace-nowrap ${
                  filters.sandbox === o.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-card hover:bg-muted text-muted-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {hasActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBuscaLocal("");
                onChange(DEFAULT_CRM_FILTERS);
              }}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Chips dos filtros ativos quando recolhido — scroll horizontal no mobile */}
      {collapsed && activeChips.length > 0 && (
        <div
          className="flex sm:flex-wrap gap-1.5 mt-2 overflow-x-auto sm:overflow-visible -mx-1 px-1 pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label="Filtros ativos"
        >
          {activeChips.map((chip, i) => (
            <button
              key={i}
              type="button"
              onClick={chip.clear}
              role="listitem"
              title={chip.label}
              className={cn(
                "group inline-flex shrink-0 items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors max-w-[200px]",
                chip.colorClass || "bg-muted text-muted-foreground border-transparent"
              )}
            >
              <span className="truncate">{chip.label}</span>
              <X className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      {/* Grid expandido */}
      {!collapsed && (
        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 mt-3",
            isComfortable
              ? "gap-3 [&_button[role=combobox]]:h-10 [&_input]:h-10"
              : "gap-2.5 [&_button[role=combobox]]:h-9 [&_input]:h-9"
          )}
        >
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Local</Label>
            <Select
              value={filters.local || "all"}
              onValueChange={(v) => onChange({ ...filters, local: v === "all" ? undefined : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {locais.map((o) => {
                  const grupo = o.value === "all" ? null : getLocalGrupo(o.value);
                  return (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">
                        {grupo && (
                          <span className={cn("inline-block h-2 w-2 rounded-full", LOCAL_DOT_CLASSES[grupo])} />
                        )}
                        {o.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select
              value={filters.tipo || "all"}
              onValueChange={(v) => onChange({ ...filters, tipo: v === "all" ? undefined : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {tipos.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Convênio</Label>
            <Select
              value={filters.convenio || "all"}
              onValueChange={(v) => onChange({ ...filters, convenio: v === "all" ? undefined : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {convenios.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Origem</Label>
            <Select
              value={filters.origem || "all"}
              onValueChange={(v) =>
                onChange({ ...filters, origem: v === "all" ? undefined : (v as OrigemGrupo) })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {ORIGEM_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0 border",
                          ORIGEM_BADGE_SOFT_CLASSES[o.value]
                        )}
                      >
                        {o.label}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select
              value={filters.periodo}
              onValueChange={(v) => onChange({ ...filters, periodo: v as CrmPeriodo })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {periodos.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ordenar por</Label>
            <Select
              value={filters.ordenacao}
              onValueChange={(v) => onChange({ ...filters, ordenacao: v as CrmOrdenacao })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ordenacoes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMFilters;
