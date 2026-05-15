import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight, RefreshCw, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { listarClinicas, Clinica } from "@/services/clinicas";
import { listarServicos, Servico, getDuracaoPadrao } from "@/services/servicos";
import { gerarSlots, listarAgendamentosDia, listarBloqueiosDia, montarGradeAgenda, SlotAgenda, verificarDiaAtivo } from "@/services/agenda";
import { Agendamento } from "@/services/agendamentos";
import { buscarDataAberta, fecharDia, listarModelosHorario, ModeloHorario, DataAberta } from "@/services/disponibilidade";
import { AgendaSlot } from "@/components/admin/AgendaSlot";
import AgendamentoDetailsModal from "@/components/admin/AgendamentoDetailsModal";
import { NovoAgendamentoAdminModal } from "@/components/admin/NovoAgendamentoAdminModal";
import { DiaFechadoCard } from "@/components/admin/DiaFechadoCard";
import { AbrirDiaModal } from "@/components/admin/AbrirDiaModal";
import { ResumoDiaAberto } from "@/components/admin/ResumoDiaAberto";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { pullGoogleCalendarEvents, PullRange } from "@/services/googleCalendar";
import { toast } from "@/hooks/use-toast";
import { toast as sonner } from "sonner";

export default function Agenda() {
  const { user } = useAuth();
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [selectedClinicaId, setSelectedClinicaId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<SlotAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingGoogle, setSyncingGoogle] = useState(false);

  // Dia aberto?
  const [dataAberta, setDataAberta] = useState<DataAberta | null>(null);
  const [modeloAplicado, setModeloAplicado] = useState<ModeloHorario | null>(null);
  const [abrirDiaOpen, setAbrirDiaOpen] = useState(false);

  // Modals
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [selectedSlotHora, setSelectedSlotHora] = useState<string>("");

  const selectedClinica = clinicas.find(c => c.id === selectedClinicaId);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if (selectedClinicaId && selectedDate) {
      carregarAgenda();
    }
  }, [selectedClinicaId, selectedDate]);

  async function carregarDados() {
    const [clinicasRes, servicosRes] = await Promise.all([
      listarClinicas(),
      listarServicos()
    ]);

    setClinicas(clinicasRes.data);
    setServicos(servicosRes.data);

    if (clinicasRes.data.length > 0) {
      setSelectedClinicaId(clinicasRes.data[0].id);
    }
    setLoading(false);
  }

  async function carregarAgenda() {
    const dataFormatada = format(selectedDate, 'yyyy-MM-dd');

    // 1. O dia está aberto para esta clínica?
    const aberta = await buscarDataAberta(selectedClinicaId, dataFormatada);
    setDataAberta(aberta);

    if (!aberta) {
      setSlots([]);
      setModeloAplicado(null);
      return;
    }

    // 2. Resolver horários (modelo OU campos próprios)
    let horaInicio = aberta.hora_inicio;
    let horaFim = aberta.hora_fim;
    let intervalo = aberta.intervalo_minutos;
    let modelo: ModeloHorario | null = null;

    if (aberta.modelo_id) {
      const modelos = await listarModelosHorario(selectedClinicaId);
      modelo = modelos.find((m) => m.id === aberta.modelo_id) ?? null;
      if (modelo) {
        horaInicio = horaInicio ?? modelo.hora_inicio;
        horaFim = horaFim ?? modelo.hora_fim;
        intervalo = intervalo ?? modelo.intervalo_minutos;
      }
    }
    setModeloAplicado(modelo);

    if (!horaInicio || !horaFim) {
      setSlots([]);
      return;
    }

    // 3. Carregar agendamentos + bloqueios e montar grade
    const [agendamentosRes, bloqueiosRes] = await Promise.all([
      listarAgendamentosDia(dataFormatada, selectedClinicaId),
      listarBloqueiosDia(dataFormatada, selectedClinicaId),
    ]);

    const [hi] = horaInicio.split(":").map(Number);
    const [hf] = horaFim.split(":").map(Number);
    const slotsBase = gerarSlots(intervalo ?? 30, hi, hf);
    const gradeAgenda = montarGradeAgenda(
      slotsBase,
      agendamentosRes.data,
      bloqueiosRes.data,
      selectedDate,
      true,
      horaInicio,
      horaFim
    );
    setSlots(gradeAgenda);
  }

  async function handleFecharDia() {
    if (!confirm("Fechar este dia removerá a disponibilidade aberta. Continuar?")) return;
    const { error } = await fecharDia(selectedClinicaId, format(selectedDate, "yyyy-MM-dd"));
    if (error) {
      sonner.error("Erro ao fechar o dia");
      return;
    }
    sonner.success("Dia fechado");
    carregarAgenda();
  }

  function handleSlotClick(slot: SlotAgenda) {
    if (slot.status === 'ocupado' && slot.agendamento) {
      setSelectedAgendamento(slot.agendamento);
      setDetailsModalOpen(true);
    } else if (slot.status === 'livre') {
      setSelectedSlotHora(slot.horaFormatada);
      setNovoModalOpen(true);
    }
  }

  function handleNovoAgendamentoCriado() {
    setNovoModalOpen(false);
    carregarAgenda();
  }

  function handleAgendamentoAtualizado() {
    setDetailsModalOpen(false);
    carregarAgenda();
  }

  async function handleSyncGoogle(range: PullRange = "default") {
    if (!user?.id) return;
    setSyncingGoogle(true);
    try {
      const r = await pullGoogleCalendarEvents(user.id, range);
      if (!r.ok) {
        toast({
          title: "Erro ao sincronizar",
          description: r.error || "Verifique se o Google Calendar está conectado em Configurações.",
          variant: "destructive",
        });
      } else {
        const t = r.totals;
        const rangeLabel =
          range === "hoje" ? " (hoje)" :
          range === "7dias" ? " (próximos 7 dias)" :
          range === "mes" ? " (mês atual)" : "";
        toast({
          title: `Sincronização concluída${rangeLabel}`,
          description: t
            ? `Importados: ${t.imported} · Atualizados: ${t.updated} · Cancelados: ${t.cancelled}${t.conflicts > 0 ? ` · ⚠️ ${t.conflicts} conflito(s)` : ""}`
            : "Sem novos eventos.",
        });
        await carregarAgenda();
      }
    } finally {
      setSyncingGoogle(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground">Visualize e gerencie agendamentos por clínica</p>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="w-full sm:w-64">
                <Select value={selectedClinicaId} onValueChange={setSelectedClinicaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a clínica" />
                  </SelectTrigger>
                  <SelectContent>
                    {clinicas.map(clinica => (
                      <SelectItem key={clinica.id} value={clinica.id}>
                        {clinica.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="min-w-[200px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button variant="outline" onClick={() => setSelectedDate(new Date())}>
                  Hoje
                </Button>

                <div className="flex">
                  <Button
                    variant="outline"
                    onClick={() => handleSyncGoogle("default")}
                    disabled={syncingGoogle}
                    title="Sincronização incremental (padrão)"
                    className="rounded-r-none border-r-0"
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-2", syncingGoogle && "animate-spin")} />
                    {syncingGoogle ? "Sincronizando..." : "Sincronizar Google"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={syncingGoogle}
                        className="rounded-l-none px-2"
                        title="Opções de sincronização"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Sincronizar período</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleSyncGoogle("default")}>
                        Padrão (incremental)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSyncGoogle("hoje")}>
                        Hoje
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSyncGoogle("7dias")}>
                        Próximos 7 dias
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSyncGoogle("mes")}>
                        Mês atual
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legenda */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
            <span className="text-sm text-muted-foreground">Livre</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300"></div>
            <span className="text-sm text-muted-foreground">Ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
            <span className="text-sm text-muted-foreground">Bloqueado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
            <span className="text-sm text-muted-foreground">Passado</span>
          </div>
        </div>

        {/* Grade de Horários */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {slots.map((slot, index) => (
                <AgendaSlot
                  key={`${slot.horaFormatada}-${index}`}
                  slot={slot}
                  onClick={() => handleSlotClick(slot)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalhes */}
      {selectedAgendamento && (
        <AgendamentoDetailsModal
          agendamento={selectedAgendamento}
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          onUpdate={handleAgendamentoAtualizado}
        />
      )}

      {/* Modal Novo Agendamento */}
      <NovoAgendamentoAdminModal
        open={novoModalOpen}
        onClose={() => setNovoModalOpen(false)}
        onSuccess={handleNovoAgendamentoCriado}
        clinicaId={selectedClinicaId}
        clinicaNome={selectedClinica?.nome || ''}
        data={format(selectedDate, 'yyyy-MM-dd')}
        hora={selectedSlotHora}
      />
    </AdminLayout>
  );
}
