import { useState } from "react";
import { Agendamento, reengajarLead } from "@/services/agendamentos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow, differenceInDays, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Calendar, Clock, MapPin, Phone, MessageCircle, Eye, Bell, Check, Zap, AlertTriangle, CheckCircle2, UserPlus, Timer, Send, XCircle, Loader2, FlaskConical, CheckCheck, Eye as EyeIcon, History, Globe, Bot, Megaphone, MessageSquare, HelpCircle, Snowflake, Flame, User as UserIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BoasVindasInfo } from "@/hooks/useBoasVindasStatus";
import HistoricoConversaModal from "./HistoricoConversaModal";
import { useDensity } from "@/hooks/useDensity";
import { getOrigemGrupo, ORIGEM_LABELS, ORIGEM_BADGE_CLASSES, type OrigemGrupo } from "@/lib/origemLead";
import { getLocalBadgeClasses, LOCAL_SHORT_LABELS, getLocalGrupo } from "@/lib/localAtendimento";

const ORIGEM_ICONS: Record<OrigemGrupo, typeof Globe> = {
  site: Globe,
  n8n: Bot,
  whatsapp: MessageSquare,
  meta: Megaphone,
  outro: HelpCircle,
};

interface KanbanCardProps {
  agendamento: Agendamento;
  onViewDetails: (agendamento: Agendamento) => void;
  onSendWhatsApp: (agendamento: Agendamento) => void;
  onTriggerAutomation: (agendamento: Agendamento) => void;
  onToggleSandbox?: (agendamento: Agendamento) => void;
  isDragging?: boolean;
  boasVindas?: BoasVindasInfo;
  ultimaMsgInAt?: string;
  onAfterReengajar?: () => void;
}

// Verifica se é um lead incompleto (sem data/hora de agendamento)
const isLeadIncompleto = (agendamento: Agendamento) => {
  return (agendamento as any).status_funil === 'lead' || !agendamento.data_agendamento || !agendamento.hora_agendamento;
};

// Verifica se está na coluna ATENDIDO
const isAtendido = (agendamento: Agendamento) => {
  return agendamento.status_crm === 'ATENDIDO';
};

// Local de atendimento — paleta unificada importada de @/lib/localAtendimento

const KanbanCard = ({
  agendamento,
  onViewDetails,
  onSendWhatsApp,
  onTriggerAutomation,
  onToggleSandbox,
  isDragging,
  boasVindas,
  ultimaMsgInAt,
  onAfterReengajar,
}: KanbanCardProps) => {
  const isLead = isLeadIncompleto(agendamento);
  const atendido = isAtendido(agendamento);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [reengajando, setReengajando] = useState(false);
  const { isComfortable } = useDensity();

  // Calcula tempo desde criação e tempo na fase atual
  const createdDate = new Date(agendamento.created_at);
  const updatedDate = agendamento.updated_at ? new Date(agendamento.updated_at) : createdDate;
  const diasDesdeCriacao = differenceInDays(new Date(), createdDate);
  const diasNaFase = differenceInDays(new Date(), updatedDate);

  // SLA: tempo desde a última mensagem do PACIENTE (IN)
  const horasDesdeUltimaIn = ultimaMsgInAt
    ? differenceInHours(new Date(), new Date(ultimaMsgInAt))
    : null;
  const slaLevel: "normal" | "warm" | "cold" | null =
    horasDesdeUltimaIn == null
      ? null
      : horasDesdeUltimaIn < 2
      ? "normal"
      : horasDesdeUltimaIn < 24
      ? "warm"
      : "cold";

  // Cor da borda esquerda: SLA tem prioridade sobre dias na fase
  const slaBorder =
    slaLevel === "cold"
      ? "border-l-red-500"
      : slaLevel === "warm"
      ? "border-l-yellow-500"
      : null;
  const urgenciaColor =
    slaBorder ??
    (atendido
      ? "border-l-muted-foreground/40"
      : diasNaFase > 7
      ? "border-l-red-500"
      : diasNaFase > 2
      ? "border-l-yellow-500"
      : "border-l-emerald-500");

  // Bot vs Humano
  const pausaAteMs = (agendamento as any).bot_pausado_ate
    ? new Date((agendamento as any).bot_pausado_ate).getTime()
    : 0;
  const pausaVigente = pausaAteMs > Date.now();
  const humanoAssumiu = (agendamento as any).bot_ativo === false || pausaVigente;

  // Lead "não qualificado" (ghost): sem nome real
  const naoQualificado =
    !agendamento.nome_completo ||
    agendamento.nome_completo.trim() === "" ||
    agendamento.nome_completo.trim().toLowerCase() === "lead whatsapp";

  // Reengajar
  const ultimoFollowup = (agendamento as any).ultimo_followup_em as string | undefined;
  const followupRecente =
    !!ultimoFollowup &&
    Date.now() - new Date(ultimoFollowup).getTime() < 24 * 60 * 60 * 1000;
  const podeReengajar = slaLevel === "cold" && !humanoAssumiu && !followupRecente;
  const motivoBloqueio = humanoAssumiu
    ? "humano assumiu"
    : followupRecente
    ? "reengajado recentemente"
    : null;

  const telDigits = (agendamento.telefone_whatsapp || "").replace(/\D/g, "");
  const waUrl = telDigits ? `https://wa.me/${telDigits}` : null;

  const handleReengajar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!podeReengajar || reengajando) return;
    setReengajando(true);
    const { success, error } = await reengajarLead(agendamento.id);
    setReengajando(false);
    if (success) {
      toast.success("Mensagem de reengajamento enviada");
      onAfterReengajar?.();
    } else {
      toast.error(error || "Não foi possível reengajar");
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div
      className={cn(
        "relative bg-card border border-border/70 rounded-xl shadow-sm hover:shadow-md hover:border-border transition-all cursor-grab active:cursor-grabbing border-l-4",
        isComfortable ? "p-4 space-y-2.5" : "p-3 space-y-2",
        urgenciaColor,
        isDragging && "shadow-lg ring-2 ring-primary/50 opacity-90",
        atendido && "opacity-75",
        agendamento.is_sandbox && "ring-1 ring-orange-400/50"
      )}
    >
      {/* Selo TESTE / Sandbox - canto superior direito */}
      {agendamento.is_sandbox && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide bg-orange-500 text-white px-1.5 py-0.5 rounded-md shadow">
              <FlaskConical className="h-2.5 w-2.5" />
              <span>Teste</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs max-w-xs">
              {agendamento.sandbox_reason || "Contato marcado como teste — não entra nas métricas reais."}
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Selo de Origem (canto superior direito) — só aparece quando NÃO é "site" */}
      {(() => {
        const grupo = getOrigemGrupo(agendamento.origem);
        if (grupo === "site") return null;
        const Icon = ORIGEM_ICONS[grupo];
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "absolute -top-1.5 z-10 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md shadow",
                  ORIGEM_BADGE_CLASSES[grupo],
                  agendamento.is_sandbox ? "right-14" : "-right-1.5"
                )}
              >
                <Icon className="h-2.5 w-2.5" />
                <span>{ORIGEM_LABELS[grupo]}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                Origem: {agendamento.origem || "—"} ({ORIGEM_LABELS[grupo]})
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })()}

      {/* Header - Name + telefone */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="space-y-0.5 cursor-help">
            <div className={cn(
              "font-semibold text-foreground truncate tracking-tight",
              isComfortable ? "text-lg leading-snug" : "text-base leading-tight"
            )}>
              {agendamento.nome_completo}
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground/80">
              <Phone className="h-3 w-3 flex-shrink-0" />
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate hover:text-emerald-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                  title="Abrir conversa no WhatsApp"
                >
                  {agendamento.telefone_whatsapp}
                </a>
              ) : (
                <span className="truncate">{agendamento.telefone_whatsapp}</span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="text-xs space-y-1">
            <div><strong>Nome:</strong> {agendamento.nome_completo}</div>
            <div><strong>Telefone:</strong> {agendamento.telefone_whatsapp}</div>
            {agendamento.email && <div><strong>E-mail:</strong> {agendamento.email}</div>}
            {agendamento.data_nascimento && (
              <div>
                <strong>Nascimento:</strong>{" "}
                {format(new Date(agendamento.data_nascimento + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
              </div>
            )}
            <div><strong>Local:</strong> {agendamento.local_atendimento}</div>
            <div><strong>Tipo:</strong> {agendamento.tipo_atendimento}</div>
            <div>
              <strong>Convênio:</strong>{" "}
              {agendamento.convenio === "Outro" ? agendamento.convenio_outro : agendamento.convenio}
            </div>
            {agendamento.detalhe_exame_ou_cirurgia && (
              <div><strong>Detalhe:</strong> {agendamento.detalhe_exame_ou_cirurgia}</div>
            )}
            {agendamento.observacoes_internas && (
              <div className="pt-1 mt-1 border-t border-border/50">
                <strong>Obs:</strong> {agendamento.observacoes_internas}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Linha de status: SLA + Bot/Humano + Não qualificado */}
      {(slaLevel === "warm" || slaLevel === "cold" || humanoAssumiu || !humanoAssumiu || naoQualificado) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {slaLevel === "warm" && horasDesdeUltimaIn != null && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30">
              <Snowflake className="h-2.5 w-2.5" />
              esfriando — há {horasDesdeUltimaIn}h sem resposta
            </span>
          )}
          {slaLevel === "cold" && horasDesdeUltimaIn != null && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30">
              <Flame className="h-2.5 w-2.5" />
              frio — há {Math.floor(horasDesdeUltimaIn / 24)}d sem resposta
            </span>
          )}
          {humanoAssumiu ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30">
                  <UserIcon className="h-2.5 w-2.5" />
                  Humano assumiu
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {pausaVigente
                  ? `Bot pausado até ${format(new Date(pausaAteMs), "dd/MM HH:mm", { locale: ptBR })}`
                  : "Bot desativado para este lead"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30">
              <Bot className="h-2.5 w-2.5" />
              Bot atendendo
            </span>
          )}
          {naoQualificado && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                  <Sparkles className="h-2.5 w-2.5" />
                  não qualificado
                </span>
              </TooltipTrigger>
              <TooltipContent>Lead ainda sem nome real — aguardando 1ª resposta</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}



      {/* Bloco data/hora consulta - destacado quando existir */}
      {!isLead && agendamento.data_agendamento && agendamento.hora_agendamento ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-md cursor-help",
              isComfortable ? "text-sm px-3 py-2" : "text-xs px-2 py-1.5"
            )}>
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Calendar className="h-3 w-3 text-primary" />
                {format(new Date(agendamento.data_agendamento + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Clock className="h-3 w-3 text-primary" />
                {agendamento.hora_agendamento.slice(0, 5)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-0.5">
              <div className="font-medium">
                {format(new Date(agendamento.data_agendamento + "T00:00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>
              <div className="text-muted-foreground">
                Horário: {agendamento.hora_agendamento.slice(0, 5)}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      ) : isLead ? (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
          <AlertTriangle className="h-3 w-3" />
          <span>Aguardando agendamento</span>
        </div>
      ) : null}

      {atendido && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
          <CheckCircle2 className="h-3 w-3" />
          <span>Atendido</span>
        </div>
      )}

      {/* Linha: Local (badge colorido) + Tipo · Convênio (texto neutro inline) */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge
          variant="outline"
          className={cn(
            "font-medium border shrink-0",
            isComfortable ? "text-[11px] px-2 py-0.5" : "text-[10px] px-1.5 py-0.5",
            getLocalBadgeClasses(agendamento.local_atendimento)
          )}
        >
          <MapPin className="h-2.5 w-2.5 mr-1" />
          {LOCAL_SHORT_LABELS[getLocalGrupo(agendamento.local_atendimento)]}
        </Badge>
        <span
          className={cn(
            "text-muted-foreground truncate",
            isComfortable ? "text-[12px]" : "text-[11px]"
          )}
          title={`${agendamento.tipo_atendimento} · ${
            agendamento.convenio === "Outro" ? agendamento.convenio_outro : agendamento.convenio
          }`}
        >
          {agendamento.tipo_atendimento}
          <span className="mx-1.5 opacity-50">·</span>
          {agendamento.convenio === "Outro" ? agendamento.convenio_outro : agendamento.convenio}
        </span>
      </div>

      {/* Meta info: contato + indicadores em uma linha */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-1">
            <span className="flex items-center gap-1">
              <UserPlus className="h-2.5 w-2.5" />
              {format(createdDate, "dd/MM/yy", { locale: ptBR })}
            </span>
            <span className={cn(
              "flex items-center gap-0.5 font-medium tabular-nums",
              diasDesdeCriacao > 7 ? "text-red-500" :
              diasDesdeCriacao > 2 ? "text-yellow-500" :
              "text-emerald-500"
            )}>
              <Timer className="h-2.5 w-2.5" />
              {diasDesdeCriacao === 0 ? "hoje" : `${diasDesdeCriacao}d`}
            </span>
            <div className="flex items-center gap-1">
              {agendamento.aceita_primeiro_horario && (
                <Check className="h-2.5 w-2.5 text-emerald-500" />
              )}
              {agendamento.aceita_contato_whatsapp_email && (
                <Bell className="h-2.5 w-2.5 text-blue-500" />
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div>Criado em: {format(createdDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
            <div>Última atualização: {formatDistanceToNow(updatedDate, { locale: ptBR, addSuffix: true })}</div>
            {!atendido && diasNaFase > 2 && (
              <div className="font-medium text-yellow-500">⚠ Parado nesta fase há {diasNaFase} dia(s)</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Boas-vindas status (compacto) */}
      {boasVindas && (() => {
        const s = boasVindas.status;
        const labels: Record<string, string> = {
          enviado: "Enviada",
          entregue: "Entregue",
          lido: "Lida",
          pendente: "Pendente",
          erro: "Erro",
        };
        const colorClass =
          s === "lido"
            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
            : s === "entregue"
            ? "text-teal-600 dark:text-teal-400 bg-teal-500/10"
            : s === "enviado"
            ? "text-blue-600 dark:text-blue-400 bg-blue-500/10"
            : s === "pendente"
            ? "text-yellow-600 dark:text-yellow-400 bg-yellow-500/10"
            : "text-red-600 dark:text-red-400 bg-red-500/10";
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("flex items-center gap-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded w-fit", colorClass)}>
                {s === "lido" && <EyeIcon className="h-2.5 w-2.5" />}
                {s === "entregue" && <CheckCheck className="h-2.5 w-2.5" />}
                {s === "enviado" && <Send className="h-2.5 w-2.5" />}
                {s === "pendente" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                {s === "erro" && <XCircle className="h-2.5 w-2.5" />}
                <span>BV · {labels[s]}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-xs space-y-1">
                <div><strong>Status:</strong> {s}{boasVindas.statusRaw && boasVindas.statusRaw.toLowerCase() !== s ? ` (${boasVindas.statusRaw})` : ""}</div>
                <div>
                  <strong>Quando:</strong>{" "}
                  {format(new Date(boasVindas.data), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                </div>
                <div className="opacity-80">
                  {formatDistanceToNow(new Date(boasVindas.data), { locale: ptBR, addSuffix: true })}
                </div>
                {s === "erro" && boasVindas.motivoErro && (
                  <div className="pt-1 mt-1 border-t border-border/50">
                    <strong>Motivo:</strong> {boasVindas.motivoErro}
                  </div>
                )}
                {s === "pendente" && (
                  <div className="pt-1 mt-1 border-t border-border/50 opacity-80">
                    Aguardando confirmação de entrega da Evolution API.
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })()}

      {/* Actions */}
      {(() => {
        const btnSize = isComfortable ? "h-8 w-8" : "h-7 w-7";
        const iconSize = isComfortable ? "h-4 w-4" : "h-3.5 w-3.5";
        return (
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn("p-0 hover:bg-accent text-muted-foreground hover:text-foreground", btnSize)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSendWhatsApp(agendamento);
                }}
              >
                <MessageCircle className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>WhatsApp</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn("p-0 hover:bg-accent text-muted-foreground hover:text-foreground", btnSize)}
                onClick={(e) => {
                  e.stopPropagation();
                  setHistoricoOpen(true);
                }}
              >
                <History className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Histórico de conversas</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn("p-0 hover:bg-accent text-muted-foreground hover:text-foreground", btnSize)}
                onClick={(e) => {
                  e.stopPropagation();
                  onTriggerAutomation(agendamento);
                }}
              >
                <Zap className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Disparar automação n8n</TooltipContent>
          </Tooltip>
          {slaLevel === "cold" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!podeReengajar || reengajando}
                    className={cn(
                      "p-0 hover:bg-accent",
                      btnSize,
                      podeReengajar
                        ? "text-red-500 hover:text-red-600"
                        : "text-muted-foreground/60"
                    )}
                    onClick={handleReengajar}
                  >
                    {reengajando ? (
                      <Loader2 className={cn(iconSize, "animate-spin")} />
                    ) : (
                      <Flame className={iconSize} />
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {motivoBloqueio ? `Reengajar (${motivoBloqueio})` : "Reengajar lead frio"}
              </TooltipContent>
            </Tooltip>
          )}
          {onToggleSandbox && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "p-0 hover:bg-accent",
                    btnSize,
                    agendamento.is_sandbox
                      ? "text-orange-500 hover:text-orange-600"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSandbox(agendamento);
                  }}
                >
                  <FlaskConical className={iconSize} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {agendamento.is_sandbox ? "Remover marcação de teste" : "Marcar como teste"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn("hover:bg-accent", isComfortable ? "h-8 px-2.5 text-sm" : "h-7 px-2 text-xs")}
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(agendamento);
          }}
        >
          <Eye className={cn("mr-1", iconSize)} />
          Detalhes
        </Button>
      </div>
        );
      })()}
    </div>
    <HistoricoConversaModal
      agendamento={agendamento}
      isOpen={historicoOpen}
      onClose={() => setHistoricoOpen(false)}
    />
    </TooltipProvider>
  );
};

export default KanbanCard;
