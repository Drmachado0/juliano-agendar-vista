import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { listarClinicas, Clinica } from "@/services/clinicas";
import { listarServicos, Servico, getDuracaoPadrao } from "@/services/servicos";
import { gerarSlots, listarAgendamentosDia, listarBloqueiosDia, montarGradeAgenda, SlotAgenda, verificarDiaAtivo } from "@/services/agenda";
import { Agendamento } from "@/services/agendamentos";
import { Bloqueio } from "@/services/disponibilidade";
import { AgendaSlot } from "@/components/admin/AgendaSlot";
import AgendamentoDetailsModal from "@/components/admin/AgendamentoDetailsModal";
import { NovoAgendamentoAdminModal } from "@/components/admin/NovoAgendamentoAdminModal";
import { cn } from "@/lib/utils";

export default function Agenda() {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [selectedClinicaId, setSelectedClinicaId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<SlotAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  
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
    
    const [agendamentosRes, bloqueiosRes, diaDisp] = await Promise.all([
      listarAgendamentosDia(dataFormatada, selectedClinicaId),
      listarBloqueiosDia(dataFormatada, selectedClinicaId),
      verificarDiaAtivo(selectedDate, selectedClinicaId)
    ]);

    const duracaoPadrao = getDuracaoPadrao();
    const slotsBase = gerarSlots(duracaoPadrao, 8, 18);
    const gradeAgenda = montarGradeAgenda(
      slotsBase,
      agendamentosRes.data,
      bloqueiosRes.data,
      selectedDate,
      diaDisp.ativo,
      diaDisp.horaInicio,
      diaDisp.horaFim
    );

    setSlots(gradeAgenda);
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
