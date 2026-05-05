import { useState, useEffect, useRef, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import KanbanColumn from "@/components/admin/KanbanColumn";
import AgendamentoDetailsModal from "@/components/admin/AgendamentoDetailsModal";
import WhatsAppModal from "@/components/admin/WhatsAppModal";
import { Button } from "@/components/ui/button";
import { Agendamento, listarAgendamentosPorStatus, atualizarStatusCrm, reprocessarBoasVindas, buscarAgendamento, marcarSandbox } from "@/services/agendamentos";
import { notificarN8n } from "@/services/integracoes";
import { toast } from "@/hooks/use-toast";
import { LayoutGrid, RefreshCw, Users, CalendarCheck, AlertTriangle, TrendingUp, CheckCircle2, ArrowRight, Send, Wifi, History, Copy, Contact } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import AuditLogDrawer from "@/components/admin/AuditLogDrawer";
import DuplicadosDrawer from "@/components/admin/DuplicadosDrawer";
import { useBoasVindasStatus } from "@/hooks/useBoasVindasStatus";
import CRMFilters, { CrmFilters, DEFAULT_CRM_FILTERS } from "@/components/admin/CRMFilters";
import { EvolutionStatusBadge } from "@/components/admin/EvolutionStatusBadge";
import WhatsAppContatos from "@/components/admin/WhatsAppContatos";
import { useNavigate } from "react-router-dom";

const TAB_STORAGE_KEY = "crm:tab:v1";

const FILTERS_STORAGE_KEY = "crm:filters:v1";

function loadFilters(): CrmFilters {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return DEFAULT_CRM_FILTERS;
    return { ...DEFAULT_CRM_FILTERS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CRM_FILTERS;
  }
}

function aplicarFiltrosEOrdenacao(
  porStatus: Record<string, Agendamento[]>,
  filters: CrmFilters
): Record<string, Agendamento[]> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim7 = new Date(hoje);
  fim7.setDate(fim7.getDate() + 7);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
  const buscaNorm = filters.busca.trim().toLowerCase();
  const buscaDigitos = buscaNorm.replace(/\D/g, "");

  const matches = (a: Agendamento) => {
    // Sandbox filter (default: somente reais)
    if (filters.sandbox === "reais" && a.is_sandbox) return false;
    if (filters.sandbox === "somente_testes" && !a.is_sandbox) return false;

    if (filters.local && a.local_atendimento !== filters.local) return false;
    if (filters.tipo && a.tipo_atendimento !== filters.tipo) return false;
    if (filters.convenio && a.convenio !== filters.convenio) return false;

    if (buscaNorm) {
      const nome = (a.nome_completo || "").toLowerCase();
      const tel = (a.telefone_whatsapp || "").replace(/\D/g, "");
      const matchNome = nome.includes(buscaNorm);
      const matchTel = buscaDigitos.length >= 3 && tel.includes(buscaDigitos);
      if (!matchNome && !matchTel) return false;
    }

    if (filters.periodo !== "todos") {
      const temData = !!a.data_agendamento;
      if (filters.periodo === "sem_data") {
        if (temData) return false;
      } else {
        if (!temData) return false;
        const d = new Date(a.data_agendamento + "T00:00:00");
        if (filters.periodo === "hoje") {
          if (d.getTime() !== hoje.getTime()) return false;
        } else if (filters.periodo === "7dias") {
          if (d < hoje || d > fim7) return false;
        } else if (filters.periodo === "mes") {
          if (d < inicioMes || d > fimMes) return false;
        } else if (filters.periodo === "atrasados") {
          if (d >= hoje) return false;
          if (a.status_crm === "ATENDIDO") return false;
        }
      }
    }
    return true;
  };

  const sorter = (a: Agendamento, b: Agendamento) => {
    const aTem = !!a.data_agendamento;
    const bTem = !!b.data_agendamento;
    switch (filters.ordenacao) {
      case "data_asc":
        if (aTem && !bTem) return -1;
        if (!aTem && bTem) return 1;
        if (aTem && bTem) {
          const dt = (a.data_agendamento as string).localeCompare(b.data_agendamento as string);
          if (dt !== 0) return dt;
          return (a.hora_agendamento || "").localeCompare(b.hora_agendamento || "");
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "data_desc":
        if (aTem && !bTem) return -1;
        if (!aTem && bTem) return 1;
        if (aTem && bTem) {
          const dt = (b.data_agendamento as string).localeCompare(a.data_agendamento as string);
          if (dt !== 0) return dt;
          return (b.hora_agendamento || "").localeCompare(a.hora_agendamento || "");
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "created_desc":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "created_asc":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
  };

  const result: Record<string, Agendamento[]> = {};
  for (const key of Object.keys(porStatus)) {
    result[key] = porStatus[key].filter(matches).sort(sorter);
  }
  return result;
}

const columns = [
  { status: "NOVO LEAD", title: "Novo Lead", color: "bg-emerald-500" },
  { status: "AGUARDANDO HUMANO", title: "Precisa de humano", color: "bg-rose-500" },
  { status: "AGUARDANDO", title: "Aguardando", color: "bg-yellow-500" },
  { status: "CLINICOR", title: "Clinicor", color: "bg-blue-500" },
  { status: "HGP", title: "HGP", color: "bg-purple-500" },
  { status: "BELÉM", title: "Belém", color: "bg-amber-500" },
  { status: "ATENDIDO", title: "Atendido", color: "bg-gray-500" },
];

const AdminCRM = () => {
  const [agendamentosPorStatus, setAgendamentosPorStatus] = useState<Record<string, Agendamento[]>>({
    "NOVO LEAD": [],
    "AGUARDANDO HUMANO": [],
    "AGUARDANDO": [],
    "CLINICOR": [],
    "HGP": [],
    "BELÉM": [],
    "ATENDIDO": [],
  });
  const [loading, setLoading] = useState(true);
  const [reprocessando, setReprocessando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date());
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingAgendamento, setDraggingAgendamento] = useState<Agendamento | null>(null);

  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [duplicadosOpen, setDuplicadosOpen] = useState(false);
  const isFetchingRef = useRef(false);

  const [filters, setFilters] = useState<CrmFilters>(() => loadFilters());
  const [tab, setTab] = useState<"kanban" | "contatos">(() => {
    try {
      const v = localStorage.getItem(TAB_STORAGE_KEY);
      return v === "contatos" ? "contatos" : "kanban";
    } catch {
      return "kanban";
    }
  });
  const navigate = useNavigate();
  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters]);

  const agendamentosFiltrados = useMemo(
    () => aplicarFiltrosEOrdenacao(agendamentosPorStatus, filters),
    [agendamentosPorStatus, filters]
  );

  const fetchAgendamentos = async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) setLoading(true);
    const { data, error } = await listarAgendamentosPorStatus();
    if (!silent) setLoading(false);
    isFetchingRef.current = false;

    if (error) {
      if (!silent) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar os agendamentos.",
          variant: "destructive",
        });
      }
    } else {
      setAgendamentosPorStatus(data);
      setUltimaAtualizacao(new Date());
    }
  };

  useEffect(() => {
    fetchAgendamentos();

    // Realtime: atualiza automaticamente quando agendamentos mudam (cron, drag de outro admin, etc.)
    const channel = supabase
      .channel('crm-agendamentos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos' },
        () => {
          fetchAgendamentos(true);
        }
      )
      .subscribe();

    // Polling de fallback a cada 60s
    const interval = setInterval(() => fetchAgendamentos(true), 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const handleReprocessarBoasVindas = async () => {
    setReprocessando(true);
    toast({ title: "Processando...", description: "Enviando boas-vindas para leads pendentes." });
    const { processed, failed, total_pending, error } = await reprocessarBoasVindas();
    setReprocessando(false);

    if (error) {
      toast({
        title: "Erro ao reprocessar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: `${processed} mensagem(ns) enviada(s)`,
        description: failed > 0
          ? `${failed} falha(s). ${total_pending} pendente(s) total.`
          : total_pending === 0
          ? "Nenhum lead pendente encontrado."
          : `${total_pending} pendente(s) total.`,
      });
      fetchAgendamentos(true);
    }
  };

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

    // Update in database (com auditoria)
    const { error } = await atualizarStatusCrm(draggingAgendamento.id, newStatus, oldStatus);

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

    // Registrar auditoria (fire-and-forget)
    const { registrarAuditCrm } = await import('@/services/crmAudit');
    registrarAuditCrm({
      agendamentoId: agendamento.id,
      acao: 'automation_trigger',
      detalhes: { success, error: error ?? null, status_crm: agendamento.status_crm },
    });

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

  const handleToggleSandbox = async (agendamento: Agendamento) => {
    const novoEstado = !agendamento.is_sandbox;
    let reason: string | null = null;
    if (novoEstado) {
      reason = window.prompt("Motivo (opcional) para marcar como teste:", "Contato de teste") || null;
    } else {
      if (!window.confirm(`Remover marcação de teste de "${agendamento.nome_completo}"?`)) return;
    }
    // Optimistic update
    setAgendamentosPorStatus((prev) => {
      const updated = { ...prev };
      const col = agendamento.status_crm;
      updated[col] = updated[col].map((a) =>
        a.id === agendamento.id ? { ...a, is_sandbox: novoEstado, sandbox_reason: reason } : a
      );
      return updated;
    });
    const { error } = await marcarSandbox(agendamento.id, novoEstado, reason);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      fetchAgendamentos(true);
    } else {
      toast({
        title: novoEstado ? "Marcado como teste" : "Marcação de teste removida",
        description: agendamento.nome_completo,
      });
    }
  };

  // Calcula estatísticas com base no resultado FILTRADO (header + taxas reagem aos filtros)
  const allItems = Object.values(agendamentosFiltrados).flat();
  const totalItems = allItems.length;
  const totalGeralCards = Object.values(agendamentosPorStatus).reduce((s, l) => s + l.length, 0);
  const leadsIncompletos = allItems.filter(
    (a) => (a as any).status_funil === 'lead' || !a.data_agendamento || !a.hora_agendamento
  ).length;
  const agendamentosConfirmados = totalItems - leadsIncompletos;

  // Status de boas-vindas para todos os cards visíveis (filtrados)
  const boasVindasMap = useBoasVindasStatus(allItems.map((a) => a.id));

  // Estatísticas de conversão
  const atendidos = agendamentosFiltrados['ATENDIDO']?.length || 0;
  const emAndamento = (agendamentosFiltrados['CLINICOR']?.length || 0) +
                      (agendamentosFiltrados['HGP']?.length || 0) +
                      (agendamentosFiltrados['BELÉM']?.length || 0);

  // Taxa de conversão: leads que viraram agendamentos confirmados
  const totalLeadsHistorico = agendamentosConfirmados + leadsIncompletos;
  const taxaConversao = totalLeadsHistorico > 0
    ? Math.round((agendamentosConfirmados / totalLeadsHistorico) * 100)
    : 0;

  // Taxa de conclusão: agendados que foram atendidos
  const totalAgendados = agendamentosConfirmados;
  const taxaConclusao = totalAgendados > 0
    ? Math.round((atendidos / totalAgendados) * 100)
    : 0;

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
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="font-medium">{leadsIncompletos}</span>
                <span className="text-amber-600/80 dark:text-amber-400/80">leads</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm">
                <CalendarCheck className="h-3.5 w-3.5" />
                <span className="font-medium">{agendamentosConfirmados}</span>
                <span className="text-emerald-600/80 dark:text-emerald-400/80">agendados</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 text-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="font-medium">{atendidos}</span>
                <span className="text-gray-600/80 dark:text-gray-400/80">atendidos</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-sm">
                <Users className="h-3.5 w-3.5" />
                <span className="font-medium">{totalItems}</span>
                <span>total</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <EvolutionStatusBadge />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded bg-muted/50">
              <Wifi className="h-3 w-3 text-emerald-500" />
              <span>Atualizado {ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocessarBoasVindas}
              disabled={reprocessando}
              title="Forçar envio de boas-vindas para leads pendentes"
            >
              <Send className={`h-4 w-4 mr-2 ${reprocessando ? 'animate-pulse' : ''}`} />
              {reprocessando ? "Enviando..." : "Reprocessar boas-vindas"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDuplicadosOpen(true)} title="Detectar e unificar leads duplicados por telefone">
              <Copy className="h-4 w-4 mr-2" />
              Duplicados
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAuditOpen(true)} title="Ver log de auditoria">
              <History className="h-4 w-4 mr-2" />
              Auditoria
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchAgendamentos()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "kanban" | "contatos")} className="space-y-6">
          <TabsList className="self-start">
            <TabsTrigger value="kanban" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="contatos" className="gap-2">
              <Contact className="h-4 w-4" />
              Contatos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="space-y-6 mt-0">
        {/* Estatísticas de Conversão */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Taxa de Conversão: Leads → Agendados */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span>Taxa de Conversão</span>
              </div>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {taxaConversao}%
              </span>
            </div>
            <Progress value={taxaConversao} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span>{leadsIncompletos} leads</span>
              </div>
              <ArrowRight className="h-3 w-3" />
              <div className="flex items-center gap-1">
                <CalendarCheck className="h-3 w-3 text-emerald-500" />
                <span>{agendamentosConfirmados} agendados</span>
              </div>
            </div>
          </div>

          {/* Taxa de Conclusão: Agendados → Atendidos */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <span>Taxa de Conclusão</span>
              </div>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {taxaConclusao}%
              </span>
            </div>
            <Progress value={taxaConclusao} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <CalendarCheck className="h-3 w-3 text-emerald-500" />
                <span>{agendamentosConfirmados} agendados</span>
              </div>
              <ArrowRight className="h-3 w-3" />
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-gray-500" />
                <span>{atendidos} atendidos</span>
              </div>
            </div>
            {emAndamento > 0 && (
              <div className="text-xs text-muted-foreground pt-1 border-t border-border">
                <span className="font-medium text-blue-500">{emAndamento}</span> em andamento (CLINICOR/HGP/Belém)
              </div>
            )}
          </div>
        </div>

        {/* Filtros */}
        <CRMFilters
          filters={filters}
          onChange={setFilters}
          totalFiltrado={totalItems}
          totalGeral={totalGeralCards}
        />

        {/* Kanban board */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4 kanban-scroll">
            {columns.map((column) => (
              <div
                key={column.status}
                onDragEnter={() => handleDragEnter(column.status)}
                onDragLeave={handleDragLeave}
              >
                <KanbanColumn
                  title={column.title}
                  status={column.status}
                  agendamentos={agendamentosFiltrados[column.status] || []}
                  color={column.color}
                  onViewDetails={handleViewDetails}
                  onSendWhatsApp={handleSendWhatsApp}
                  onTriggerAutomation={handleTriggerAutomation}
                  onToggleSandbox={handleToggleSandbox}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDragOver={dragOverColumn === column.status}
                  boasVindasMap={boasVindasMap}
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

      <AuditLogDrawer
        open={auditOpen}
        onOpenChange={setAuditOpen}
        onOpenAgendamento={async (id) => {
          // Procura primeiro nos agendamentos em memória
          const todos = Object.values(agendamentosPorStatus).flat();
          const found = todos.find((a) => a.id === id);
          if (found) {
            setSelectedAgendamento(found);
            setDetailsModalOpen(true);
            return;
          }
          // Fallback: busca no banco
          const { data, error } = await buscarAgendamento(id);
          if (data) {
            setSelectedAgendamento(data);
            setDetailsModalOpen(true);
          } else {
            toast({
              title: "Agendamento não encontrado",
              description: error?.message || "O registro pode ter sido excluído ou unificado.",
              variant: "destructive",
            });
          }
        }}
        onOpenWhatsApp={async (id) => {
          const todos = Object.values(agendamentosPorStatus).flat();
          const found = todos.find((a) => a.id === id);
          if (found) {
            setSelectedAgendamento(found);
            setWhatsappModalOpen(true);
            return;
          }
          const { data, error } = await buscarAgendamento(id);
          if (data) {
            setSelectedAgendamento(data);
            setWhatsappModalOpen(true);
          } else {
            toast({
              title: "Paciente não encontrado",
              description: error?.message || "O registro pode ter sido excluído ou unificado.",
              variant: "destructive",
            });
          }
        }}
      />
      <DuplicadosDrawer
        open={duplicadosOpen}
        onOpenChange={setDuplicadosOpen}
        onMerged={() => fetchAgendamentos(true)}
      />
    </AdminLayout>
  );
};

export default AdminCRM;
