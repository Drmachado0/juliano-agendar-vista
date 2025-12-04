import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck } from "lucide-react";

interface WhatsAppMessageBubbleProps {
  conteudo: string;
  direcao: "IN" | "OUT";
  created_at: string;
  status_envio?: string | null;
}

const WhatsAppMessageBubble = ({
  conteudo,
  direcao,
  created_at,
  status_envio,
}: WhatsAppMessageBubbleProps) => {
  const isOut = direcao === "OUT";
  const time = format(new Date(created_at), "HH:mm", { locale: ptBR });

  const getStatusIcon = () => {
    if (!isOut) return null;
    
    switch (status_envio) {
      case "lido":
        return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
      case "entregue":
        return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
      case "enviado":
        return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
      case "erro":
        return <span className="text-xs text-destructive">!</span>;
      default:
        return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div
      className={cn(
        "flex w-full",
        isOut ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2 shadow-sm",
          isOut
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{conteudo}</p>
        <div
          className={cn(
            "flex items-center gap-1 mt-1",
            isOut ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              isOut ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {time}
          </span>
          {getStatusIcon()}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppMessageBubble;
