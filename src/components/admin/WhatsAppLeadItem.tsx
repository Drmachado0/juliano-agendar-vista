import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadComMensagens } from "@/services/mensagens";

interface WhatsAppLeadItemProps {
  lead: LeadComMensagens;
  isSelected: boolean;
  onClick: () => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "NOVO LEAD":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "CLINICOR":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "HGP":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "BELÉM":
      return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const formatMessageTime = (dateString: string | null) => {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return format(date, "HH:mm", { locale: ptBR });
  }
  
  if (isYesterday(date)) {
    return "Ontem";
  }
  
  return format(date, "dd/MM", { locale: ptBR });
};

const truncateMessage = (message: string | null, maxLength: number = 40) => {
  if (!message) return "Nenhuma mensagem";
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + "...";
};

const WhatsAppLeadItem = ({ lead, isSelected, onClick }: WhatsAppLeadItemProps) => {
  const initials = lead.nome_completo
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left",
        isSelected
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted/50 border border-transparent"
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
          <span className="text-sm font-semibold text-primary">{initials}</span>
        </div>
        {lead.mensagens_nao_lidas > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
            <span className="text-[10px] font-bold text-destructive-foreground">
              {lead.mensagens_nao_lidas > 9 ? "9+" : lead.mensagens_nao_lidas}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm text-foreground truncate">
            {lead.nome_completo}
          </span>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {formatMessageTime(lead.ultima_mensagem_data)}
          </span>
        </div>
        
        <div className="flex items-center gap-2 mt-0.5">
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0", getStatusColor(lead.status_crm))}
          >
            {lead.status_crm}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground mt-1 truncate">
          {truncateMessage(lead.ultima_mensagem)}
        </p>
      </div>
    </button>
  );
};

export default WhatsAppLeadItem;
