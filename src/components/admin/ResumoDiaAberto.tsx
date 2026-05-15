import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { SlotAgenda } from "@/services/agenda";

interface Props {
  clinicaNome: string;
  modeloNome?: string | null;
  slots: SlotAgenda[];
  onFechar: () => void;
}

export function ResumoDiaAberto({ clinicaNome, modeloNome, slots, onFechar }: Props) {
  const total = slots.length;
  const livres = slots.filter((s) => s.status === "livre").length;
  const ocupados = slots.filter((s) => s.status === "ocupado").length;
  const bloqueados = slots.filter((s) => s.status === "bloqueado").length;
  const passados = slots.filter((s) => s.status === "passado").length;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="default">Aberto</Badge>
            <span className="text-sm text-muted-foreground">{clinicaNome}</span>
            {modeloNome && (
              <Badge variant="outline" className="text-xs">
                Modelo: {modeloNome}
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onFechar} className="gap-2">
            <Lock className="h-4 w-4" />
            Fechar dia
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          <Stat label="Total" value={total} />
          <Stat label="Livres" value={livres} accent="text-green-600 dark:text-green-400" />
          <Stat label="Ocupados" value={ocupados} accent="text-blue-600 dark:text-blue-400" />
          <Stat label="Bloqueados" value={bloqueados} accent="text-red-600 dark:text-red-400" />
          <Stat label="Passados" value={passados} accent="text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
