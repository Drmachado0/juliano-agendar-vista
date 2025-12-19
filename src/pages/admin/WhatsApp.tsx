import { useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import WhatsAppLeadsList from "@/components/admin/WhatsAppLeadsList";
import WhatsAppChat from "@/components/admin/WhatsAppChat";
import { EvolutionStatusBadge } from "@/components/admin/EvolutionStatusBadge";
import { LeadComMensagens, MensagemWhatsApp } from "@/services/mensagens";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const AdminWhatsApp = () => {
  const [selectedLead, setSelectedLead] = useState<LeadComMensagens | null>(null);
  const [leads, setLeads] = useState<LeadComMensagens[]>([]);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  // Handle realtime messages - match by agendamento_id OR phone number
  const handleNewMessage = useCallback(
    (message: MensagemWhatsApp) => {
      // Normalize phone for comparison (last 8 digits)
      const normalizePhone = (phone: string) => phone.replace(/\D/g, "").slice(-8);
      const messagePhoneLast8 = normalizePhone(message.telefone);
      
      // Update leads list with new message
      setLeads((prev) => {
        const updated = prev.map((lead) => {
          // Match by agendamento_id OR by phone number
          const leadPhoneLast8 = normalizePhone(lead.telefone_whatsapp);
          const isMatch = 
            lead.agendamento_id === message.agendamento_id ||
            (message.agendamento_id === null && leadPhoneLast8 === messagePhoneLast8);
          
          if (isMatch) {
            return {
              ...lead,
              ultima_mensagem: message.conteudo,
              ultima_mensagem_data: message.created_at,
              mensagens_nao_lidas:
                message.direcao === "IN" && lead.agendamento_id !== selectedLead?.agendamento_id
                  ? lead.mensagens_nao_lidas + 1
                  : lead.mensagens_nao_lidas,
            };
          }
          return lead;
        });

        // Sort by last message
        return updated.sort((a, b) => {
          if (!a.ultima_mensagem_data && !b.ultima_mensagem_data) return 0;
          if (!a.ultima_mensagem_data) return 1;
          if (!b.ultima_mensagem_data) return -1;
          return (
            new Date(b.ultima_mensagem_data).getTime() -
            new Date(a.ultima_mensagem_data).getTime()
          );
        });
      });
    },
    [selectedLead?.agendamento_id]
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

  return (
    <TooltipProvider>
      <AdminLayout>
        <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] flex flex-col">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe e gerencie conversas com leads em tempo real
              </p>
            </div>
            <EvolutionStatusBadge />
          </div>

        {/* Main content */}
        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex h-full">
            {/* Leads list - hidden on mobile when chat is open */}
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
              />
            </div>

            {/* Chat area - hidden on mobile when list is shown */}
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
      </div>
    </AdminLayout>
    </TooltipProvider>
  );
};

export default AdminWhatsApp;
