import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Agendamento } from "@/services/agendamentos";
import { enviarMensagemWhatsApp, gerarMensagemPadrao } from "@/services/integracoes";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle, Send, Loader2, Phone, Calendar, MapPin } from "lucide-react";

interface WhatsAppModalProps {
  agendamento: Agendamento | null;
  isOpen: boolean;
  onClose: () => void;
}

const WhatsAppModal = ({ agendamento, isOpen, onClose }: WhatsAppModalProps) => {
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);

  // Initialize message when agendamento changes
  useState(() => {
    if (agendamento) {
      setMensagem(gerarMensagemPadrao(agendamento));
    }
  });

  if (!agendamento) return null;

  const handleSend = async () => {
    if (!mensagem.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma mensagem para enviar.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    const { success, error } = await enviarMensagemWhatsApp(agendamento.telefone_whatsapp, mensagem);
    setSending(false);

    if (success) {
      toast({
        title: "Mensagem enviada!",
        description: "A mensagem foi enviada com sucesso via WhatsApp.",
      });
      onClose();
    } else {
      toast({
        title: "Erro ao enviar",
        description: error || "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setMensagem(gerarMensagemPadrao(agendamento));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Enviar WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient preview */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{agendamento.nome_completo}</span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {agendamento.telefone_whatsapp}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(agendamento.data_agendamento), "dd/MM/yyyy", { locale: ptBR })} às {agendamento.hora_agendamento.slice(0, 5)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {agendamento.local_atendimento}
              </span>
            </div>
          </div>

          {/* Message textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mensagem</Label>
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
                Restaurar mensagem padrão
              </Button>
            </div>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Digite sua mensagem..."
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {mensagem.length} caracteres
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={sending}
              className="bg-green-600 hover:bg-green-700"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppModal;
