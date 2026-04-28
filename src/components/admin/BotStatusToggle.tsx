import { useEffect, useState, MouseEvent } from "react";
import { Bot, BotOff, Pause, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { pausarBot, reativarBot } from "@/services/botPausa";
import { cn } from "@/lib/utils";

interface Props {
  agendamentoId: string;
  botAtivo: boolean;
  botPausadoAte: string | null;
  pausaMinutosPadrao?: number;
}

function formatRestante(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

const BotStatusToggle = ({
  agendamentoId,
  botAtivo,
  botPausadoAte,
  pausaMinutosPadrao = 30,
}: Props) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const ateMs = botPausadoAte ? new Date(botPausadoAte).getTime() : null;
  const pausaAtiva = ateMs !== null && ateMs > now;
  const desligado = !botAtivo && !pausaAtiva;
  const ativo = !pausaAtiva && !desligado;

  useEffect(() => {
    if (!pausaAtiva) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [pausaAtiva]);

  const handleClick = async (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    if (ativo) {
      const { error } = await pausarBot(agendamentoId, pausaMinutosPadrao, "manual_lista");
      if (error) toast({ title: "Erro ao pausar bot", description: error, variant: "destructive" });
      else toast({ title: `Bot pausado por ${pausaMinutosPadrao} min nesta conversa` });
    } else {
      const { error } = await reativarBot(agendamentoId);
      if (error) toast({ title: "Erro ao reativar bot", description: error, variant: "destructive" });
      else toast({ title: "Bot reativado nesta conversa" });
    }
    setBusy(false);
  };

  let icon = <Bot className="h-3.5 w-3.5" />;
  let label = "Bot ativo · clique para pausar";
  let className = "text-emerald-600 hover:bg-emerald-500/10";

  if (pausaAtiva) {
    icon = <Pause className="h-3.5 w-3.5" />;
    label = `Bot pausado · volta em ${formatRestante(ateMs! - now)} · clique para reativar`;
    className = "text-amber-600 hover:bg-amber-500/10";
  } else if (desligado) {
    icon = <BotOff className="h-3.5 w-3.5" />;
    label = "Bot desligado · clique para reativar";
    className = "text-destructive hover:bg-destructive/10";
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            disabled={busy}
            aria-label={label}
            className={cn(
              "flex items-center justify-center h-6 w-6 rounded-md transition-colors",
              "border border-transparent hover:border-current/20",
              className,
              busy && "opacity-60 cursor-wait"
            )}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default BotStatusToggle;
