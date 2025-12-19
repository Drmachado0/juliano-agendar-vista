import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, RefreshCw, MessageSquarePlus } from "lucide-react";
import { LeadComMensagens, listarLeadsComMensagens } from "@/services/mensagens";
import WhatsAppLeadItem from "./WhatsAppLeadItem";
import { Skeleton } from "@/components/ui/skeleton";
import NovaMensagemWhatsAppModal from "./NovaMensagemWhatsAppModal";

interface WhatsAppLeadsListProps {
  selectedLeadId: string | null;
  onSelectLead: (lead: LeadComMensagens) => void;
  onLeadsUpdate?: (leads: LeadComMensagens[]) => void;
}

const WhatsAppLeadsList = ({
  selectedLeadId,
  onSelectLead,
  onLeadsUpdate,
}: WhatsAppLeadsListProps) => {
  const [leads, setLeads] = useState<LeadComMensagens[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [novaMensagemModalOpen, setNovaMensagemModalOpen] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await listarLeadsComMensagens(
      statusFilter,
      searchTerm || undefined
    );
    
    if (!error && data) {
      setLeads(data);
      onLeadsUpdate?.(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchLeads();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  // Função para atualizar leads externamente (para realtime)
  const updateLeadWithNewMessage = (agendamentoId: string, mensagem: string, data: string) => {
    setLeads((prev) => {
      const updated = prev.map((lead) => {
        if (lead.agendamento_id === agendamentoId) {
          return {
            ...lead,
            ultima_mensagem: mensagem,
            ultima_mensagem_data: data,
            mensagens_nao_lidas:
              lead.agendamento_id !== selectedLeadId
                ? lead.mensagens_nao_lidas + 1
                : lead.mensagens_nao_lidas,
          };
        }
        return lead;
      });
      
      // Reordenar por última mensagem
      return updated.sort((a, b) => {
        if (!a.ultima_mensagem_data && !b.ultima_mensagem_data) return 0;
        if (!a.ultima_mensagem_data) return 1;
        if (!b.ultima_mensagem_data) return -1;
        return new Date(b.ultima_mensagem_data).getTime() - new Date(a.ultima_mensagem_data).getTime();
      });
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Conversas</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setNovaMensagemModalOpen(true)}
              className="gap-1.5"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Nova
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchLeads} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os status</SelectItem>
            <SelectItem value="NOVO LEAD">Novo Lead</SelectItem>
            <SelectItem value="CLINICOR">Clinicor</SelectItem>
            <SelectItem value="HGP">HGP</SelectItem>
            <SelectItem value="BELÉM">Belém</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lead list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {searchTerm || statusFilter !== "TODOS"
                ? "Nenhum lead encontrado com esses filtros"
                : "Nenhum lead com telefone cadastrado"}
            </p>
          </div>
        ) : (
          leads.map((lead) => (
            <WhatsAppLeadItem
              key={lead.agendamento_id}
              lead={lead}
              isSelected={selectedLeadId === lead.agendamento_id}
              onClick={() => onSelectLead(lead)}
            />
          ))
        )}
      </div>

      <NovaMensagemWhatsAppModal
        open={novaMensagemModalOpen}
        onOpenChange={setNovaMensagemModalOpen}
        onMessageSent={fetchLeads}
      />
    </div>
  );
};

export default WhatsAppLeadsList;
