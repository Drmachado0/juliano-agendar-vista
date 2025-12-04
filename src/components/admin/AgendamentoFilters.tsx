import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { AgendamentoFilters as Filters } from "@/services/agendamentos";

interface AgendamentoFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onClearFilters: () => void;
}

const locais = [
  { value: "all", label: "Todos os locais" },
  { value: "Clinicor – Paragominas", label: "Clinicor – Paragominas" },
  { value: "Hospital Geral de Paragominas", label: "Hospital Geral de Paragominas" },
  { value: "Belém (IOB / Vitria)", label: "Belém (IOB / Vitria)" },
];

const statusCrm = [
  { value: "all", label: "Todos os status" },
  { value: "NOVO LEAD", label: "Novo Lead" },
  { value: "CLINICOR", label: "Clinicor" },
  { value: "HGP", label: "HGP" },
];

const AgendamentoFilters = ({ filters, onFiltersChange, onClearFilters }: AgendamentoFiltersProps) => {
  const hasActiveFilters = filters.busca || filters.dataInicio || filters.dataFim || 
    filters.localAtendimento || filters.statusCrm;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Filtros</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="lg:col-span-2 space-y-2">
          <Label className="text-sm text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou telefone..."
              className="pl-10"
              value={filters.busca || ""}
              onChange={(e) => onFiltersChange({ ...filters, busca: e.target.value })}
            />
          </div>
        </div>

        {/* Date range */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Data início</Label>
          <Input
            type="date"
            value={filters.dataInicio || ""}
            onChange={(e) => onFiltersChange({ ...filters, dataInicio: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Data fim</Label>
          <Input
            type="date"
            value={filters.dataFim || ""}
            onChange={(e) => onFiltersChange({ ...filters, dataFim: e.target.value })}
          />
        </div>

        {/* Location filter */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Local</Label>
          <Select
            value={filters.localAtendimento || "all"}
            onValueChange={(value) => 
              onFiltersChange({ ...filters, localAtendimento: value === "all" ? undefined : value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locais.map((local) => (
                <SelectItem key={local.value} value={local.value}>
                  {local.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status CRM filter */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Status CRM</Label>
          <Select
            value={filters.statusCrm || "all"}
            onValueChange={(value) => 
              onFiltersChange({ ...filters, statusCrm: value === "all" ? undefined : value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusCrm.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default AgendamentoFilters;
