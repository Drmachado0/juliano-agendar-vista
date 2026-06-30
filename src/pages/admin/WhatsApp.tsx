import { useState, useCallback, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import WhatsAppLeadsList from "@/components/admin/WhatsAppLeadsList";
import WhatsAppChat from "@/components/admin/WhatsAppChat";
import WhatsAppContatos from "@/components/admin/WhatsAppContatos";
import { LeadComMensagens, MensagemWhatsApp, buscarAgendamentoPorTelefone } from "@/services/mensagens";
import { mesmoTelefone } from "@/lib/whatsappNumber";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useBotGlobalStatus } from "@/hooks/useBotGlobalStatus";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bot, PowerOff } from "lucide-react";
import { toast } from "sonner";

// Ordena os leads pela última mensagem (mais recente primeiro; sem data vai pro fim)
function ordenarPorUltimaMensagem(a: LeadComMensagens, b: LeadComMensagens) {
  if (!a.ultima_mensagem_data && !b.ultima_mensagem_data) return 0;
  if (!a.ultima_mensagem_data) return 1;
  if (!b.ultima_mensagem_data) return -1;
  return (
    new Date(b.ultima_mensagem_data).getTime() -
    new Date(a.ultima_mensagem_data).getTime()
  );
}

const AdminWhatsApp = () => {
  const [selectedLead, setSelectedLead] = useState<LeadComMensagens | null>(null);
  const [leads, setLeads] = useState<LeadComMensagens[]>([]);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [tab, setTab] = useState<"conversas" | "contatos">("conversas");
  const { globalAtivo: botGlobalAtivo } = useBotGlobalStatus();

  // Quando o lead selecionado some da lista (filtro/busca mudou), limpa seleção
  // para evitar enviar mensagem para o paciente errado.
  useEffect(() => {
    if (!selectedLead) return;
    const ainda = leads.some((l) => l.agendamento_id === selectedLead.agendamento_id);
    if (!ainda) {
      setSelectedLead(null);
      setMobileView("list");
    }
  }, [leads, selectedLead]);

  // Contato novo que chegou em tempo real mas ainda não está na lista (primeira
  // mensagem de um número sem card): busca o lead e o adiciona no topo.
  const adicionarLeadNovo = useCallback(async (message: MensagemWhatsApp) => {
    const { data } = await buscarAgendamentoPorTelefone(message.telefone);
    if (!data) return; // número sem agendamento/lead → nada a exibir ainda
    setLeads((prev) => {
      // guarda anti-duplicado (corrida / StrictMode)
      if (prev.some((l) => l.agendamento_id === data.id)) return prev;
      const novo: LeadComMensagens = {
        agendamento_id: data.id,
        nome_completo: data.nome_completo,
        telefone_whatsapp: data.telefone_whatsapp,
        status_crm: data.status_crm,
        local_atendimento: data.local_atendimento || "",
        is_sandbox: data.is_sandbox,
        ultima_mensagem: message.conteudo,
        ultima_mensagem_data: message.created_at,
        mensagens_nao_lidas: message.direcao === "IN" ? 1 : 0,
      };
      return [novo, ...prev].sort(ordenarPorUltimaMensagem);
    });
  }, []);

  // Handle realtime messages - match by agendamento_id OR phone number
  const handleNewMessage = useCallback(
    (message: MensagemWhatsApp) => {
      setLeads((prev) => {
        const idx = prev.findIndex(
          (lead) =>
            lead.agendamento_id === message.agendamento_id ||
            (message.agendamento_id === null &&
              mesmoTelefone(lead.telefone_whatsapp, message.telefone))
        );

        // Contato novo (sem card): dispara a busca assíncrona e mantém a lista.
        if (idx === -1) {
          adicionarLeadNovo(message);
          return prev;
        }

        const updated = [...prev];
        const lead = updated[idx];
        updated[idx] = {
          ...lead,
          ultima_mensagem: message.conteudo,
          ultima_mensagem_data: message.created_at,
          mensagens_nao_lidas:
            message.direcao === "IN" && lead.agendamento_id !== selectedLead?.agendamento_id
              ? lead.mensagens_nao_lidas + 1
              : lead.mensagens_nao_lidas,
        };
        return updated.sort(ordenarPorUltimaMensagem);
      });
    },
    [selectedLead?.agendamento_id, adicionarLeadNovo]
  );

  // Subscribe to realtime
  useRealtimeMessages({ onNewMessage: handleNewMessage });

  const handleSelectLead = (lead: LeadComMensagens) => {
    setSelectedLead(lead);
    setMobileView("chat");
    
    // Reset unread count for selected lead
    setLeads((prev) =>
      prev.map((l) =>
        l.agendamento_id === lead.agendamento_id
          ? { ...l, mensagens_nao_lidas: 0 }
          : l
      )
    );
  };

  const handleBack = () => {
    setMobileView("list");
  };

  const abrirChatPorTelefone = async (telefone: string) => {
    const { data } = await buscarAgendamentoPorTelefone(telefone);
    if (!data) {
      toast.error("Nenhuma conversa encontrada para este número");
      return;
    }
    setTab("conversas");
    const lead: LeadComMensagens = {
      agendamento_id: data.id,
      nome_completo: data.nome_completo,
      telefone_whatsapp: data.telefone_whatsapp,
      status_crm: data.status_crm,
      local_atendimento: data.local_atendimento || "",
      is_sandbox: data.is_sandbox,
      ultima_mensagem: null,
      ultima_mensagem_data: null,
      mensagens_nao_lidas: 0,
    };
    handleSelectLead(lead);
  };

  return (
    <TooltipProvider>
      <AdminLayout>
        <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] flex flex-col">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe conversas em tempo real e gerencie seus contatos
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {botGlobalAtivo ? (
                <Badge className="gap-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40">
                  <Bot className="h-3 w-3" />
                  Automação ativa
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <PowerOff className="h-3 w-3" />
                  Automação desligada
                </Badge>
              )}
            </div>
          </div>

          {!botGlobalAtivo && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Automação global desligada</AlertTitle>
              <AlertDescription>
                Nenhum paciente está recebendo respostas automáticas. Os controles individuais por
                conversa só voltam a ter efeito quando a automação global for reativada em
                Configurações.
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
            <TabsList className="self-start mb-3">
              <TabsTrigger value="conversas">Conversas</TabsTrigger>
              <TabsTrigger value="contatos">Contatos</TabsTrigger>
            </TabsList>

            <TabsContent value="conversas" className="flex-1 mt-0 min-h-0">
              <div className="h-full bg-card rounded-xl border border-border overflow-hidden">
                <div className="flex h-full">
                  <div
                    className={cn(
                      "w-full lg:w-80 xl:w-96 border-r border-border flex-shrink-0",
                      mobileView === "chat" ? "hidden lg:flex lg:flex-col" : "flex flex-col"
                    )}
                  >
                    <WhatsAppLeadsList
                      selectedLeadId={selectedLead?.agendamento_id || null}
                      onSelectLead={handleSelectLead}
                      onLeadsUpdate={setLeads}
                      onLeadCreated={(agendamentoId) => {
                        setLeads((prev) => {
                          const novo = prev.find((l) => l.agendamento_id === agendamentoId);
                          if (novo) handleSelectLead(novo);
                          return prev;
                        });
                      }}
                    />
                  </div>
                  <div
                    className={cn(
                      "flex-1 flex flex-col",
                      mobileView === "list" ? "hidden lg:flex" : "flex"
                    )}
                  >
                    <WhatsAppChat
                      lead={selectedLead}
                      onBack={handleBack}
                      showBackButton={mobileView === "chat"}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contatos" className="flex-1 mt-0 min-h-0">
              <div className="h-full bg-card rounded-xl border border-border overflow-hidden">
                <WhatsAppContatos onAbrirChat={abrirChatPorTelefone} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </AdminLayout>
    </TooltipProvider>
  );
};

export default AdminWhatsApp;
