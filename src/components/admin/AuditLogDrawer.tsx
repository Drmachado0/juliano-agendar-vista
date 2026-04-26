import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACAO_LABELS, CrmAuditEntry, listarAuditCrm } from "@/services/crmAudit";
import { ArrowRight, Clock, ExternalLink, MessageCircle, RefreshCw, User } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLogDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAgendamento?: (agendamentoId: string) => void;
  onOpenWhatsApp?: (agendamentoId: string, telefone: string) => void;
}

const acaoColors: Record<string, string> = {
  status_change: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  reprocess_welcome: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  manual_whatsapp: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  automation_trigger: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
};

export default function AuditLogDrawer({ open, onOpenChange, onOpenAgendamento, onOpenWhatsApp }: AuditLogDrawerProps) {
  const [entries, setEntries] = useState<CrmAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroAcao, setFiltroAcao] = useState<string>("todas");

  const fetch = async () => {
    setLoading(true);
    const { data } = await listarAuditCrm({
      limit: 200,
      acao: filtroAcao === "todas" ? undefined : filtroAcao,
    });
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtroAcao]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Log de Auditoria do CRM
          </SheetTitle>
          <SheetDescription>
            Registro de todas as ações realizadas: mudanças de status, reprocessamentos e automações.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 py-3 border-b border-border">
          <Select value={filtroAcao} onValueChange={setFiltroAcao}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar por ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as ações</SelectItem>
              {Object.entries(ACAO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {entries.length} registro(s)
          </span>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading && entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum registro encontrado.
            </div>
          ) : (
            <ul className="space-y-3 py-3">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="border border-border rounded-lg p-3 bg-card space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className={acaoColors[e.acao] ?? ""}>
                      {ACAO_LABELS[e.acao] ?? e.acao}
                    </Badge>
                    <div className="text-xs text-muted-foreground text-right">
                      <div title={format(new Date(e.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}>
                        {format(new Date(e.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </div>
                      <div className="text-[10px] opacity-70">
                        {formatDistanceToNow(new Date(e.created_at), { locale: ptBR, addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{e.user_name ?? e.user_email ?? "—"}</span>
                    {e.user_email && e.user_name !== e.user_email && (
                      <span className="text-xs text-muted-foreground">({e.user_email})</span>
                    )}
                  </div>

                  {e.agendamento_id && (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="text-muted-foreground truncate">
                        Paciente:{" "}
                        {e.agendamento ? (
                          <span className="font-medium text-foreground">{e.agendamento.nome_completo}</span>
                        ) : (
                          <span className="italic">registro removido</span>
                        )}
                        {e.agendamento?.telefone_whatsapp && (
                          <> · {e.agendamento.telefone_whatsapp}</>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {onOpenAgendamento && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            disabled={!e.agendamento}
                            title={e.agendamento ? "Abrir agendamento" : "Registro removido"}
                            onClick={() => {
                              onOpenChange(false);
                              onOpenAgendamento(e.agendamento_id!);
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {onOpenWhatsApp && e.agendamento?.telefone_whatsapp && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            title="Abrir WhatsApp do paciente"
                            onClick={() => {
                              onOpenChange(false);
                              onOpenWhatsApp(e.agendamento_id!, e.agendamento!.telefone_whatsapp);
                            }}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {e.acao === "status_change" && (
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary">{e.status_anterior ?? "—"}</Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge>{e.status_novo ?? "—"}</Badge>
                    </div>
                  )}

                  {e.detalhes && Object.keys(e.detalhes).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Detalhes
                      </summary>
                      <pre className="mt-1 p-2 bg-muted rounded text-[11px] overflow-x-auto">
                        {JSON.stringify(e.detalhes, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
