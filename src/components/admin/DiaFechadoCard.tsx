import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarOff, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  data: Date;
  clinicaNome: string;
  onAbrir: () => void;
}

export function DiaFechadoCard({ data, clinicaNome, onAbrir }: Props) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="rounded-full bg-muted p-4">
          <CalendarOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Dia fechado para atendimento</h3>
          <p className="text-sm text-muted-foreground">
            Não há disponibilidade aberta em <strong>{clinicaNome}</strong> para{" "}
            {format(data, "EEEE, d 'de' MMMM", { locale: ptBR })}.
          </p>
          <p className="text-xs text-muted-foreground">
            Por padrão, dias sem disponibilidade específica ficam fechados — mesmo que existam modelos semanais.
          </p>
        </div>
        <Button onClick={onAbrir} className="gap-2">
          <Plus className="h-4 w-4" />
          Abrir este dia
        </Button>
      </CardContent>
    </Card>
  );
}
