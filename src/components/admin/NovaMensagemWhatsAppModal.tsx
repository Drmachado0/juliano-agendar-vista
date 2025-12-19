import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Send, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { enviarMensagemWhatsApp } from "@/services/integracoes";
import { inserirMensagem } from "@/services/mensagens";

interface NovaMensagemWhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessageSent?: () => void;
}

const formatarTelefone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const NovaMensagemWhatsAppModal = ({
  open,
  onOpenChange,
  onMessageSent,
}: NovaMensagemWhatsAppModalProps) => {
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatarTelefone(e.target.value));
  };

  const limparFormulario = () => {
    setTelefone("");
    setMensagem("");
  };

  const handleEnviar = async () => {
    const telefoneLimpo = telefone.replace(/\D/g, "");
    
    if (telefoneLimpo.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "Digite um número de telefone válido com DDD",
        variant: "destructive",
      });
      return;
    }

    if (!mensagem.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Digite uma mensagem para enviar",
        variant: "destructive",
      });
      return;
    }

    setEnviando(true);

    try {
      const { success, error } = await enviarMensagemWhatsApp(telefoneLimpo, mensagem);

      if (!success) {
        throw new Error(error || "Erro ao enviar mensagem");
      }

      // Salvar mensagem no banco (sem agendamento_id)
      await inserirMensagem({
        telefone: telefoneLimpo,
        direcao: "OUT",
        conteudo: mensagem,
        status_envio: "enviado",
      });

      toast({
        title: "Mensagem enviada!",
        description: `Mensagem enviada para ${telefone}`,
      });

      limparFormulario();
      onOpenChange(false);
      onMessageSent?.();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      toast({
        title: "Erro ao enviar mensagem",
        description: errorMessage,
        variant: "destructive",
        duration: 6000, // Show longer for error messages
      });
    } finally {
      setEnviando(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      limparFormulario();
    }
    onOpenChange(newOpen);
  };

  const telefoneLimpo = telefone.replace(/\D/g, "");
  const podeEnviar = telefoneLimpo.length >= 10 && mensagem.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Mensagem WhatsApp</DialogTitle>
          <DialogDescription>
            Envie uma mensagem para qualquer número de telefone
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="telefone"
                placeholder="(91) 99999-9999"
                value={telefone}
                onChange={handleTelefoneChange}
                className="pl-9"
                disabled={enviando}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensagem">Mensagem</Label>
            <Textarea
              id="mensagem"
              placeholder="Digite sua mensagem..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              disabled={enviando}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={enviando}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleEnviar}
            disabled={enviando || !podeEnviar}
            className="gap-2"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovaMensagemWhatsAppModal;
