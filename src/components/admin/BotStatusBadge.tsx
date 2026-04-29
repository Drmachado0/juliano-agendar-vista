import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Bot, BotOff, Pause, Play, ChevronDown, PowerOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  BotStatusAgendamento,
  obterStatusBot,
  pausarBot,
  reativarBot,
} from "@/services/botPausa";
import { useBotGlobalStatus } from "@/hooks/useBotGlobalStatus";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  agendamentoId: string;
}

function formatRestante(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec > 0 && min < 5 ? `${min}m ${sec}s` : `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

const BotStatusBadge = ({ agendamentoId }: Props) => {
  const { toast } = useToast();
  const { globalAtivo } = useBotGlobalStatus();
  const [status, setStatus] = useState<BotStatusAgendamento | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  // Load + realtime subscription on the agendamento row
  useEffect(() => {
    let mounted = true;
    obterStatusBot(agendamentoId).then((s) => {
      if (mounted) setStatus(s);
    });

    const channel = supabase
      .channel(`bot_status_${agendamentoId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agendamentos",
          filter: `id=eq.${agendamentoId}`,
        },
        (payload) => {
          const r = payload.new as any;
          setStatus({
            bot_ativo: r.bot_ativo !== false,
            bot_pausado_ate: r.bot_pausado_ate ?? null,
            bot_pausa_motivo: r.bot_pausa_motivo ?? null,
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [agendamentoId]);

  // Tick every 15s for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const ateMs = status.bot_pausado_ate ? new Date(status.bot_pausado_ate).getTime() : null;
  const pausaAtiva = ateMs !== null && ateMs > now;
  const desligado = !status.bot_ativo && !pausaAtiva;

  const handlePause = async (minutos: number) => {
    setBusy(true);
    const { error } = await pausarBot(agendamentoId, minutos);
    setBusy(false);
    if (error) toast({ title: "Erro ao pausar bot", description: error, variant: "destructive" });
    else toast({ title: `Bot pausado por ${minutos} min` });
  };

  const handleResume = async () => {
    setBusy(true);
    const { error } = await reativarBot(agendamentoId);
    setBusy(false);
    if (error) toast({ title: "Erro ao reativar bot", description: error, variant: "destructive" });
    else toast({ title: "Bot reativado" });
  };

  let badge: JSX.Element;
  if (!globalAtivo) {
    badge = (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="gap-1 cursor-help">
            <PowerOff className="h-3 w-3" />
            Bot pausado globalmente
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-xs">
            A automação global está desligada nas configurações do bot. Os controles individuais
            só voltam a ter efeito quando ela for reativada.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  } else if (pausaAtiva) {
    const restante = formatRestante(ateMs! - now);
    badge = (
      <Badge className="gap-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30">
        <Pause className="h-3 w-3" />
        Bot pausado · {restante}
      </Badge>
    );
  } else if (desligado) {
    badge = (
      <Badge variant="destructive" className="gap-1">
        <BotOff className="h-3 w-3" />
        Bot desligado
      </Badge>
    );
  } else {
    badge = (
      <Badge className="gap-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30">
        <Bot className="h-3 w-3" />
        Bot ativo
      </Badge>
    );
  }

  // Se global desligado, exibir badge sem dropdown (controles individuais sem efeito)
  if (!globalAtivo) {
    return badge;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" disabled={busy}>
          {badge}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Controle do bot</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(pausaAtiva || desligado) && (
          <DropdownMenuItem onClick={handleResume}>
            <Play className="h-4 w-4 mr-2" /> Reativar agora
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => handlePause(15)}>
          <Pause className="h-4 w-4 mr-2" /> Pausar por 15 min
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePause(30)}>
          <Pause className="h-4 w-4 mr-2" /> Pausar por 30 min
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePause(60)}>
          <Pause className="h-4 w-4 mr-2" /> Pausar por 1 hora
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePause(240)}>
          <Pause className="h-4 w-4 mr-2" /> Pausar por 4 horas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default BotStatusBadge;
