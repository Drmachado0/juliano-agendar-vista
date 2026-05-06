import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Sparkles, ArrowLeft, Phone, MapPin, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatAppointmentDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  MensagemWhatsApp,
  LeadComMensagens,
  listarMensagensPorAgendamento,
  inserirMensagem,
  marcarMensagensComoLidas,
  buscarAgendamentoParaChat,
} from "@/services/mensagens";
import { enviarMensagemWhatsApp, gerarMensagemConfirmacaoIA } from "@/services/integracoes";
import {
  buscarUltimaIntencao,
  INTENCAO_LABEL,
  INTENCAO_VARIANT,
  ConversationIntent,
} from "@/services/conversationIntents";
import WhatsAppMessageBubble from "./WhatsAppMessageBubble";
import BotStatusBadge from "./BotStatusBadge";
import { getLocalBadgeClasses, LOCAL_SHORT_LABELS, getLocalGrupo } from "@/lib/localAtendimento";
import { cn } from "@/lib/utils";

interface WhatsAppChatProps {
  lead: LeadComMensagens | null;
  onBack?: () => void;
  showBackButton?: boolean;
}

const WhatsAppChat = ({ lead, onBack, showBackButton }: WhatsAppChatProps) => {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<MensagemWhatsApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [agendamentoCompleto, setAgendamentoCompleto] = useState<any>(null);
  const [ultimaIntencao, setUltimaIntencao] = useState<ConversationIntent | null>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load messages and appointment data
  useEffect(() => {
    if (!lead) {
      setMessages([]);
      setAgendamentoCompleto(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      
      // Load messages (also search by phone for unlinked messages)
      const { data: msgs } = await listarMensagensPorAgendamento(lead.agendamento_id, lead.telefone_whatsapp);
      setMessages(msgs);
      
      // Load full appointment data for AI generation
      const { data: agendamento } = await buscarAgendamentoParaChat(lead.agendamento_id);
      setAgendamentoCompleto(agendamento);

      // Load latest detected intent
      const intent = await buscarUltimaIntencao(lead.agendamento_id);
      setUltimaIntencao(intent);

      // Mark messages as read
      await marcarMensagensComoLidas(lead.agendamento_id);
      
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    };

    loadData();
  }, [lead?.agendamento_id]);

  // Scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to realtime messages for this chat
  useEffect(() => {
    if (!lead) return;

    // Get last 8 digits for phone matching
    const last8Digits = lead.telefone_whatsapp.replace(/\D/g, "").slice(-8);

    const channel = supabase
      .channel(`chat_${lead.agendamento_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens_whatsapp",
        },
        (payload) => {
          const newMessage = payload.new as MensagemWhatsApp;
          
          // Check if message belongs to this lead (by agendamento_id or phone)
          const messagePhoneLast8 = newMessage.telefone.replace(/\D/g, "").slice(-8);
          const isForThisLead = 
            newMessage.agendamento_id === lead.agendamento_id ||
            messagePhoneLast8 === last8Digits;
          
          if (!isForThisLead) return;
          
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
          
          if (newMessage.direcao === "IN") {
            marcarMensagensComoLidas(lead.agendamento_id);
            // Após ~3s, recarrega a última intenção (assistente roda em background no webhook)
            setTimeout(async () => {
              const intent = await buscarUltimaIntencao(lead.agendamento_id);
              if (intent) setUltimaIntencao(intent);
            }, 3500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lead?.agendamento_id, lead?.telefone_whatsapp]);

  // Add new message from realtime (kept for backwards compatibility)

  // Generate AI message
  const handleGenerateAI = async () => {
    if (!agendamentoCompleto) return;
    
    setGeneratingAI(true);
    const { mensagem, error } = await gerarMensagemConfirmacaoIA(agendamentoCompleto);
    
    if (error || !mensagem) {
      toast({
        title: "Erro ao gerar mensagem",
        description: "Não foi possível gerar a mensagem com IA. Tente novamente.",
        variant: "destructive",
      });
    } else {
      setNewMessage(mensagem);
    }
    
    setGeneratingAI(false);
  };

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !lead) return;
    
    setSending(true);
    const messageContent = newMessage.trim();
    
    // Send via Evolution API
    const { success, error } = await enviarMensagemWhatsApp(
      lead.telefone_whatsapp,
      messageContent
    );

    if (success) {
      // Save to database
      const { data: savedMessage, error: saveError } = await inserirMensagem({
        agendamento_id: lead.agendamento_id,
        telefone: lead.telefone_whatsapp,
        direcao: "OUT",
        conteudo: messageContent,
        status_envio: "enviado",
      });

      if (savedMessage) {
        setMessages((prev) => [...prev, savedMessage]);
      }



      setNewMessage("");
      
      toast({
        title: "Mensagem enviada",
        description: "A mensagem foi enviada com sucesso.",
      });
    } else {
      toast({
        title: "Erro ao enviar",
        description: error || "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    }
    
    setSending(false);
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Empty state
  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Send className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-foreground mb-2">Nenhuma conversa selecionada</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Escolha um lead na lista ao lado para visualizar o histórico e responder via WhatsApp,
          ou clique em <span className="font-medium text-foreground">"Nova conversa"</span> para iniciar um contato.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        {showBackButton && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
          <span className="text-sm font-semibold text-primary">
            {lead.nome_completo.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{lead.nome_completo}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{lead.telefone_whatsapp}</span>
          </div>
        </div>
        
        <div className="hidden sm:flex flex-col items-end gap-1">
          <Badge variant="outline">{lead.status_crm}</Badge>
          <BotStatusBadge agendamentoId={lead.agendamento_id} />
          <span className="text-[10px] text-muted-foreground italic">
            controle só desta conversa
          </span>
          {ultimaIntencao && (
            <Badge
              variant={INTENCAO_VARIANT[ultimaIntencao.intencao] || "secondary"}
              title={ultimaIntencao.resumo || ""}
              className="text-[10px]"
            >
              🤖 {INTENCAO_LABEL[ultimaIntencao.intencao] || ultimaIntencao.intencao}
              {ultimaIntencao.confianca != null && ` · ${Math.round(ultimaIntencao.confianca * 100)}%`}
            </Badge>
          )}
        </div>
      </div>

      {/* Appointment info */}
      {agendamentoCompleto && (
        <div className="px-4 py-2 bg-muted/30 border-b border-border flex flex-wrap gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              {formatAppointmentDate(agendamentoCompleto.data_agendamento, agendamentoCompleto.hora_agendamento, "Aguardando agendamento")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <Badge
              variant="outline"
              className={cn("text-[10px] font-medium px-1.5 py-0 border", getLocalBadgeClasses(agendamentoCompleto.local_atendimento))}
              title={agendamentoCompleto.local_atendimento}
            >
              {LOCAL_SHORT_LABELS[getLocalGrupo(agendamentoCompleto.local_atendimento)]}
            </Badge>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
              <Skeleton className="h-16 w-48 rounded-2xl" />
            </div>
          ))
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma mensagem ainda. Envie a primeira!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <WhatsAppMessageBubble
              key={msg.id}
              conteudo={msg.conteudo}
              direcao={msg.direcao}
              created_at={msg.created_at}
              status_envio={msg.status_envio}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex flex-wrap gap-2 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateAI}
            disabled={generatingAI || !agendamentoCompleto}
            className="gap-2"
          >
            <Sparkles className={`h-4 w-4 ${generatingAI ? "animate-pulse" : ""}`} />
            {generatingAI ? "Gerando..." : "Gerar com IA"}
          </Button>

        </div>
        
        <div className="flex gap-2">
          <Textarea
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[80px] resize-none"
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="self-end"
          >
            <Send className={`h-4 w-4 ${sending ? "animate-pulse" : ""}`} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppChat;
