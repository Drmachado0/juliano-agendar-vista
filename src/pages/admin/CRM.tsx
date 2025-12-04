import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import KanbanColumn from "@/components/admin/KanbanColumn";
import AgendamentoDetailsModal from "@/components/admin/AgendamentoDetailsModal";
import WhatsAppModal from "@/components/admin/WhatsAppModal";
import { Button } from "@/components/ui/button";
import { Agendamento, listarAgendamentosPorStatus, atualizarStatusCrm } from "@/services/agendamentos";
import { notificarN8n } from "@/services/integracoes";
import { toast } from "@/hooks/use-toast";
import { LayoutGrid, RefreshCw } from "lucide-react";

const columns = [
  { status: "NOVO LEAD", title: "Novo Lead", color: "bg-emerald-500" },
  { status: "CLINICOR", title: "Clinicor", color: "bg-blue-500" },
  { status: "HGP", title: "HGP", color: "bg-purple-500" },
];

const AdminCRM = () => {
  const [agendamentosPorStatus, setAgendamentosPorStatus] = useState<Record<string, Agendamento[]>>({
    "NOVO LEAD": [],
    "CLINICOR": [],
    "HGP": [],
  });
  const [loading, setLoading] = useState(true);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingAgendamento, setDraggingAgendamento] = useState<Agendamento | null>(null);

  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

  const fetchAgendamentos = async () => {
    setLoading(true);
    const { data, error } = await listarAgendamentosPorStatus();
    setLoading(false);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os agendamentos.",
        variant: "destructive",
      });
    } else {
      setAgendamentosPorStatus(data);
    }
  };

  useEffect(() => {
    fetchAgendamentos();
  }, []);

  const handleDragStart = (e: React.DragEvent, agendamento: Agendamento) => {
    setDraggingAgendamento(agendamento);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (status: string) => {
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggingAgendamento || draggingAgendamento.status_crm === newStatus) {
      setDraggingAgendamento(null);
      return;
    }

    const oldStatus = draggingAgendamento.status_crm;

    // Optimistic update
    setAgendamentosPorStatus((prev) => {
      const updated = { ...prev };
      updated[oldStatus] = updated[oldStatus].filter((a) => a.id !== draggingAgendamento.id);
      updated[newStatus] = [{ ...draggingAgendamento, status_crm: newStatus }, ...updated[newStatus]];
      return updated;
    });

    // Update in database
    const { error } = await atualizarStatusCrm(draggingAgendamento.id, newStatus);

    if (error) {
      // Revert on error
      setAgendamentosPorStatus((prev) => {
        const updated = { ...prev };
        updated[newStatus] = updated[newStatus].filter((a) => a.id !== draggingAgendamento.id);
        updated[oldStatus] = [draggingAgendamento, ...updated[oldStatus]];
        return updated;
      });

      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Status atualizado!",
        description: `Movido para ${newStatus}`,
      });

      // Notify n8n about status change
      await notificarN8n('status_crm_atualizado', {
        ...draggingAgendamento,
        status_crm: newStatus,
      });
    }

    setDraggingAgendamento(null);
  };

  const handleViewDetails = (agendamento: Agendamento) => {
    setSelectedAgendamento(agendamento);
    setDetailsModalOpen(true);
  };

  const handleSendWhatsApp = (agendamento: Agendamento) => {
    setSelectedAgendamento(agendamento);
    setWhatsappModalOpen(true);
  };

  const handleTriggerAutomation = async (agendamento: Agendamento) => {
    toast({
      title: "Enviando para automação...",
      description: "Disparando evento no n8n",
    });

    const { success, error } = await notificarN8n('status_crm_atualizado', agendamento);

    if (success) {
      toast({
        title: "Automação disparada!",
        description: "O evento foi enviado para o n8n.",
      });
    } else {
      toast({
        title: "Erro",
        description: error || "Não foi possível disparar a automação.",
        variant: "destructive",
      });
    }
  };

  const totalAgendamentos = Object.values(agendamentosPorStatus).flat().length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <LayoutGrid className="h-6 w-6" />
              CRM Kanban
            </h1>
            <p className="text-muted-foreground mt-1">
              {totalAgendamentos} agendamento{totalAgendamentos !== 1 ? 's' : ''} no pipeline
            </p>
          </div>
          <Button variant="outline" onClick={fetchAgendamentos} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Kanban board */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => (
              <div
                key={column.status}
                onDragEnter={() => handleDragEnter(column.status)}
                onDragLeave={handleDragLeave}
              >
                <KanbanColumn
                  title={column.title}
                  status={column.status}
                  agendamentos={agendamentosPorStatus[column.status] || []}
                  color={column.color}
                  onViewDetails={handleViewDetails}
                  onSendWhatsApp={handleSendWhatsApp}
                  onTriggerAutomation={handleTriggerAutomation}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDragOver={dragOverColumn === column.status}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AgendamentoDetailsModal
        agendamento={selectedAgendamento}
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        onUpdate={fetchAgendamentos}
      />

      <WhatsAppModal
        agendamento={selectedAgendamento}
        isOpen={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
      />
    </AdminLayout>
  );
};

export default AdminCRM;
