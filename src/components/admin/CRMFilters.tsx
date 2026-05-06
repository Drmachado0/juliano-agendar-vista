import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Filter } from "lucide-react";

export type CrmPeriodo = "todos" | "hoje" | "7dias" | "mes" | "atrasados" | "sem_data";
export type CrmOrdenacao = "data_asc" | "data_desc" | "created_desc" | "created_asc";
export type CrmSandboxFiltro = "reais" | "todos" | "somente_testes";

export interface CrmFilters {
  busca: string;
  local?: string;
  tipo?: string;
  convenio?: string;
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

const CRMFilters = ({ filters, onChange, totalFiltrado, totalGeral }: CRMFiltersProps) => {
  // Debounce da busca
  const [buscaLocal, setBuscaLocal] = useState(filters.busca);
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
    filters.periodo !== "todos" ||
    filters.ordenacao !== "data_asc" ||
    filters.sandbox !== "reais";

  return (
    <div className="bg-card rounded-xl border border-border/70 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-foreground">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Filtros</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full tabular-nums">
            {totalFiltrado}/{totalGeral}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Sandbox segmented inline */}
          <div className="flex rounded-md border border-border/70 overflow-hidden text-xs">
            {sandboxOpcoes.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ ...filters, sandbox: o.value })}
                className={`px-2.5 py-1 transition-colors ${
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Busca */}
        <div className="lg:col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou telefone..."
              className="pl-10"
              value={buscaLocal}
              onChange={(e) => setBuscaLocal(e.target.value)}
            />
          </div>
        </div>

        {/* Local */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Local</Label>
          <Select
            value={filters.local || "all"}
            onValueChange={(v) => onChange({ ...filters, local: v === "all" ? undefined : v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {locais.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Tipo */}
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

        {/* Convênio */}
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

        {/* Período */}
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

        {/* Ordenação */}
        <div className="lg:col-span-2 space-y-1.5">
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
    </div>
  );
};

export default CRMFilters;
