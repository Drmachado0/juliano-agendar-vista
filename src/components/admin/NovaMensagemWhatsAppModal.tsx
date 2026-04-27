import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Phone, Send, Loader2, UserCheck, UserPlus, FlaskConical } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { enviarMensagemWhatsApp } from "@/services/integracoes";
import {
  inserirMensagem,
  buscarAgendamentoPorTelefone,
  criarLeadManualWhatsApp,
  AgendamentoMatch,
} from "@/services/mensagens";

interface NovaMensagemWhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessageSent?: (agendamentoId?: string) => void;
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
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [isSandbox, setIsSandbox] = useState(false);
  const [criarLead, setCriarLead] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Busca de agendamento existente
  const [match, setMatch] = useState<AgendamentoMatch | null>(null);
  const [buscandoMatch, setBuscandoMatch] = useState(false);

  const telefoneLimpo = telefone.replace(/\D/g, "");

  // Debounce: ao digitar telefone válido, procura agendamento existente
  useEffect(() => {
    if (telefoneLimpo.length < 10) {
      setMatch(null);
      return;
    }
    setBuscandoMatch(true);
    const t = setTimeout(async () => {
      const { data } = await buscarAgendamentoPorTelefone(telefoneLimpo);
      setMatch(data);
      setBuscandoMatch(false);
    }, 400);
    return () => {
      clearTimeout(t);
      setBuscandoMatch(false);
    };
  }, [telefoneLimpo]);

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatarTelefone(e.target.value));
  };

  const limparFormulario = () => {
    setTelefone("");
    setNome("");
    setMensagem("");
    setIsSandbox(false);
    setCriarLead(true);
    setMatch(null);
  };

  const handleEnviar = async () => {
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

    // Sem match e sem nome → exige nome para criar lead (a menos que usuário desmarque)
    if (!match && criarLead && nome.trim().length < 2) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome do contato para criar o lead no CRM.",
        variant: "destructive",
      });
      return;
    }

    setEnviando(true);

    try {
      let agendamentoId: string | undefined = match?.id;

      // Cria lead se for um número novo e o usuário marcou "criar lead"
      if (!agendamentoId && criarLead) {
        const { id, error: leadError } = await criarLeadManualWhatsApp({
          nome: nome.trim(),
          telefone: telefoneLimpo,
          isSandbox,
        });
        if (leadError || !id) {
          throw new Error(leadError?.message || "Não foi possível criar o lead");
        }
        agendamentoId = id;
      }

      // Envia a mensagem via Evolution
      const { success, error } = await enviarMensagemWhatsApp(telefoneLimpo, mensagem);
      if (!success) {
        throw new Error(error || "Erro ao enviar mensagem");
      }

      // Persiste mensagem (vinculada ao agendamento se houver)
      await inserirMensagem({
        telefone: telefoneLimpo,
        direcao: "OUT",
        conteudo: mensagem,
        status_envio: "enviado",
        agendamento_id: agendamentoId ?? null,
        tipo_mensagem: "manual",
      });

      toast({
        title: "Mensagem enviada!",
        description: match
          ? `Vinculada ao lead ${match.nome_completo}`
          : agendamentoId
          ? `Lead "${nome.trim()}" criado e mensagem enviada`
          : `Mensagem enviada para ${telefone}`,
      });

      limparFormulario();
      onOpenChange(false);
      onMessageSent?.(agendamentoId);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao enviar mensagem",
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setEnviando(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) limparFormulario();
    onOpenChange(newOpen);
  };

  const podeEnviar =
    telefoneLimpo.length >= 10 &&
    mensagem.trim().length > 0 &&
    (match || !criarLead || nome.trim().length >= 2);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Mensagem WhatsApp</DialogTitle>
          <DialogDescription>
            Abra uma conversa nova com qualquer número. Vinculamos automaticamente a um lead
            existente quando o telefone bater.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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

            {/* Resultado da busca por telefone */}
            {telefoneLimpo.length >= 10 && (
              <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
                {buscandoMatch ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Procurando lead existente…
                  </span>
                ) : match ? (
                  <div className="flex items-start gap-2">
                    <UserCheck className="h-4 w-4 text-emerald-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {match.nome_completo}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {match.status_crm}
                        </Badge>
                        {match.is_sandbox && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-600 border-orange-500/30"
                          >
                            TESTE
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1">
                        A conversa será vinculada a este lead.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <UserPlus className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        Nenhum lead encontrado para este número
                      </div>
                      <p className="text-muted-foreground">
                        {criarLead
                          ? "Será criado um novo lead no CRM como NOVO LEAD."
                          : "A mensagem será enviada sem criar lead."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nome (apenas se não houver match) */}
          {!match && telefoneLimpo.length >= 10 && (
            <div className="space-y-2">
              <Label htmlFor="nome">
                Nome do contato {criarLead && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="nome"
                placeholder="Ex.: Maria Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={enviando || !criarLead}
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={criarLead}
                    onCheckedChange={(v) => setCriarLead(!!v)}
                    disabled={enviando}
                  />
                  Criar lead no CRM
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={isSandbox}
                    onCheckedChange={(v) => setIsSandbox(!!v)}
                    disabled={enviando || !criarLead}
                  />
                  <FlaskConical className="h-3 w-3" />
                  Marcar como teste/sandbox
                </label>
              </div>
            </div>
          )}

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
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={enviando || !podeEnviar} className="gap-2">
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
