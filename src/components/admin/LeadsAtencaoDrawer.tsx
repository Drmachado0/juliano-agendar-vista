import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCrmLeadsAtencao, type LeadAtencao } from "@/hooks/useCrmLeadsAtencao";
import {
  AlertTriangle,
  RefreshCw,
  Phone,
  Clock,
  MessageCircle,
  FileText,
  Inbox,
  Bot,
} from "lucide-react";

interface LeadsAtencaoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAgendamento: (id: string) => void;
  onOpenWhatsApp: (id: string) => void;
}

function humanizarHoras(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} d`;
}

const CATEGORIA_META: Record<
  LeadAtencao["categoria"],
  { label: string; badge: string; usaUltimaIn: boolean }
> = {
  inbound_sem_resposta: {
    label: "Paciente sem resposta",
    badge:
      "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    usaUltimaIn: true,
  },
  lead_sem_welcome: {
    label: "Sem boas-vindas",
    badge:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    usaUltimaIn: false,
  },
};

export default function LeadsAtencaoDrawer({
  open,
  onOpenChange,
  onOpenAgendamento,
  onOpenWhatsApp,
}: LeadsAtencaoDrawerProps) {
  const { data: leads = [], isLoading, isFetching, refetch } = useCrmLeadsAtencao();

  const semResposta = leads.filter((l) => l.categoria === "inbound_sem_resposta");
  const semWelcome = leads.filter((l) => l.categoria === "lead_sem_welcome");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Leads precisando de atenção
          </SheetTitle>
          <SheetDescription>
            Leads que nunca receberam boas-vindas ou cuja última mensagem foi do
            paciente sem resposta. Use os botões para abrir a ficha ou responder
            no WhatsApp — nenhum envio é automático.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 py-3 border-b border-border flex-wrap">
          <Badge
            variant="outline"
            className="gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
          >
            <MessageCircle className="h-3 w-3" />
            {semResposta.length} sem resposta
          </Badge>
          <Badge
            variant="outline"
            className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
          >
            <Inbox className="h-3 w-3" />
            {semWelcome.length} sem boas-vindas
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Carregando leads...
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              🎉 Nenhum lead pendente de atenção.
            </div>
          ) : (
            <ul className="space-y-2.5 py-3">
              {leads.map((lead) => {
                const meta = CATEGORIA_META[lead.categoria];
                const horas = meta.usaUltimaIn
                  ? lead.horas_desde_ultima_in
                  : lead.horas_desde_criacao;
                return (
                  <li
                    key={lead.agendamento_id}
                    className="border border-border rounded-lg p-3 bg-card space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">
                            {lead.nome || "(sem nome)"}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px]", meta.badge)}
                          >
                            {meta.label}
                          </Badge>
                          {lead.bot_ativo === false && (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 text-muted-foreground"
                            >
                              <Bot className="h-2.5 w-2.5" />
                              bot off
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3" />
                            {lead.telefone || "—"}
                          </span>
                          <span>·</span>
                          <span
                            className={cn(
                              "flex items-center gap-1",
                              (horas ?? 0) >= 24 && "text-amber-600 dark:text-amber-400 font-medium"
                            )}
                            title="Tempo esperando"
                          >
                            <Clock className="h-3 w-3" />
                            {humanizarHoras(horas)}
                          </span>
                          {lead.origem && (
                            <>
                              <span>·</span>
                              <span className="truncate">{lead.origem}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          onOpenChange(false);
                          onOpenWhatsApp(lead.agendamento_id);
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                        Responder WhatsApp
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          onOpenChange(false);
                          onOpenAgendamento(lead.agendamento_id);
                        }}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Ficha
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
