import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LOG_LEVEL_META, SystemLogEntry } from "@/services/systemLogs";

interface Props {
  log: SystemLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LogDetailsDrawer = ({ log, open, onOpenChange }: Props) => {
  if (!log) return null;
  const meta = LOG_LEVEL_META[log.level] ?? LOG_LEVEL_META.info;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={meta.className}>{meta.label}</Badge>
            <Badge variant="outline">{log.category}</Badge>
            <Badge variant="outline">{log.source}</Badge>
          </div>
          <SheetTitle className="text-left">{log.message}</SheetTitle>
          <SheetDescription className="text-left">
            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            {log.user_email && <> · {log.user_email}</>}
            {log.request_id && <> · req {log.request_id.slice(0, 8)}</>}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4">
          <div className="space-y-4 pr-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="ID">{log.id}</Field>
              <Field label="Criado em">{log.created_at}</Field>
              <Field label="Usuário">{log.user_email || "—"}</Field>
              <Field label="Agendamento">{log.agendamento_id || "—"}</Field>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Detalhes (JSON)</div>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {log.details ? JSON.stringify(log.details, null, 2) : "Sem detalhes"}
              </pre>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="font-mono text-xs break-all">{children}</div>
  </div>
);

export default LogDetailsDrawer;
