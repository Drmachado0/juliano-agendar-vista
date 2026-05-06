import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageCircle, Phone } from "lucide-react";
import { Agendamento } from "@/services/agendamentos";
import { MensagemWhatsApp, listarMensagensPorAgendamento } from "@/services/mensagens";
import WhatsAppMessageBubble from "./WhatsAppMessageBubble";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  agendamento: Agendamento | null;
  isOpen: boolean;
  onClose: () => void;
}

const HistoricoConversaModal = ({ agendamento, isOpen, onClose }: Props) => {
  const [mensagens, setMensagens] = useState<MensagemWhatsApp[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agendamento || !isOpen) return;
    let active = true;
    const carregar = async () => {
      setLoading(true);
      const { data } = await listarMensagensPorAgendamento(
        agendamento.id,
        agendamento.telefone_whatsapp
      );
      if (active) {
        setMensagens(data);
        setLoading(false);
      }
    };
    carregar();

    const channel = supabase
      .channel(`historico-${agendamento.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagens_whatsapp" },
        () => carregar()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [agendamento, isOpen]);

  if (!agendamento) return null;

  const grupos: { data: string; itens: MensagemWhatsApp[] }[] = [];
  for (const m of mensagens) {
    const ultimo = grupos[grupos.length - 1];
    const d = new Date(m.created_at);
    if (ultimo && isSameDay(new Date(ultimo.itens[0].created_at), d)) {
      ultimo.itens.push(m);
    } else {
      grupos.push({ data: m.created_at, itens: [m] });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Histórico de conversa
          </DialogTitle>
          <DialogDescription className="flex items-center gap-3 text-xs flex-wrap">
            <span className="font-medium text-foreground">{agendamento.nome_completo}</span>
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {agendamento.telefone_whatsapp}
            </span>
            <span className="ml-auto text-muted-foreground">
              {mensagens.length} mensagem(ns)
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 [&>div>div]:!block [&>div>div]:w-full">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando mensagens...
            </div>
          ) : mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageCircle className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma mensagem trocada ainda.</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {grupos.map((g, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-center">
                    <span className="text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      {format(new Date(g.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  {g.itens.map((m) => (
                    <WhatsAppMessageBubble
                      key={m.id}
                      conteudo={m.conteudo}
                      direcao={m.direcao}
                      created_at={m.created_at}
                      status_envio={m.status_envio}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default HistoricoConversaModal;
