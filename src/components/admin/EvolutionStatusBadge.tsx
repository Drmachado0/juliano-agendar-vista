import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Wifi, WifiOff, Loader2, Settings } from "lucide-react";
import { useEvolutionStatus } from "@/hooks/useEvolutionStatus";
import { cn } from "@/lib/utils";

interface EvolutionStatusBadgeProps {
  className?: string;
  showRefresh?: boolean;
}

export function EvolutionStatusBadge({ className, showRefresh = true }: EvolutionStatusBadgeProps) {
  const { status, loading, lastChecked, refresh } = useEvolutionStatus(true, 60000);

  const getStatusInfo = () => {
    if (loading && !status) {
      return {
        label: "Verificando...",
        variant: "secondary" as const,
        icon: Loader2,
        iconClass: "animate-spin",
      };
    }

    if (!status) {
      return {
        label: "Desconhecido",
        variant: "secondary" as const,
        icon: WifiOff,
        iconClass: "",
      };
    }

    if (status.connected) {
      return {
        label: "Conectado",
        variant: "default" as const,
        icon: Wifi,
        iconClass: "text-green-500",
      };
    }

    // Map different states to user-friendly labels
    const stateLabels: Record<string, string> = {
      close: "Desconectado",
      connecting: "Conectando...",
      timeout: "Sem resposta",
      error: "Erro",
      not_configured: "Não configurado",
    };

    return {
      label: stateLabels[status.state] || "Desconectado",
      variant: "destructive" as const,
      icon: WifiOff,
      iconClass: "",
    };
  };

  const info = getStatusInfo();
  const Icon = info.icon;

  const tooltipContent = () => {
    if (!status) return "Status desconhecido";
    
    let content = `Instância: ${status.instanceName || "N/A"}`;
    if (status.error) {
      content += `\nErro: ${status.error}`;
    }
    if (lastChecked) {
      content += `\nÚltima verificação: ${lastChecked.toLocaleTimeString("pt-BR")}`;
    }
    return content;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link to="/admin/configuracoes/evolution">
            <Badge variant={info.variant} className="gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
              <Icon className={cn("h-3 w-3", info.iconClass)} />
              {info.label}
            </Badge>
          </Link>
        </TooltipTrigger>
        <TooltipContent className="whitespace-pre-line">
          {tooltipContent()}
          {"\n"}Clique para ver instruções
        </TooltipContent>
      </Tooltip>

      {showRefresh && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      )}
    </div>
  );
}
