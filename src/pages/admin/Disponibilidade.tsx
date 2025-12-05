import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Calendar, Trash2, Edit } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { listarClinicas, Clinica } from "@/services/clinicas";
import { listarBloqueios, removerBloqueio, Bloqueio, getTipoBloqueioLabel, getTipoBloqueioColor } from "@/services/disponibilidade";
import { BloqueioModal } from "@/components/admin/BloqueioModal";
import { toast } from "sonner";

export default function Disponibilidade() {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [selectedClinicaId, setSelectedClinicaId] = useState<string>("");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBloqueio, setSelectedBloqueio] = useState<Bloqueio | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const daysOfWeek = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  useEffect(() => {
    carregarClinicas();
  }, []);

  useEffect(() => {
    if (selectedClinicaId) {
      carregarBloqueios();
    }
  }, [selectedClinicaId, currentWeekStart]);

  async function carregarClinicas() {
    const { data } = await listarClinicas();
    setClinicas(data);
    if (data.length > 0) {
      setSelectedClinicaId(data[0].id);
    }
    setLoading(false);
  }

  async function carregarBloqueios() {
    const dataInicio = format(currentWeekStart, 'yyyy-MM-dd');
    const dataFim = format(weekEnd, 'yyyy-MM-dd');
    const { data } = await listarBloqueios(selectedClinicaId, dataInicio, dataFim);
    setBloqueios(data);
  }

  function getBloqueiosDia(date: Date): Bloqueio[] {
    return bloqueios.filter(b => isSameDay(new Date(b.data + 'T00:00:00'), date));
  }

  async function handleRemoverBloqueio(id: string) {
    if (confirm('Tem certeza que deseja remover este bloqueio?')) {
      const { error } = await removerBloqueio(id);
      if (error) {
        toast.error('Erro ao remover bloqueio');
      } else {
        toast.success('Bloqueio removido');
        carregarBloqueios();
      }
    }
  }

  function handleEditarBloqueio(bloqueio: Bloqueio) {
    setSelectedBloqueio(bloqueio);
    setSelectedDate(new Date(bloqueio.data + 'T00:00:00'));
    setModalOpen(true);
  }

  function handleNovoBloqueio(date?: Date) {
    setSelectedBloqueio(null);
    setSelectedDate(date || null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setSelectedBloqueio(null);
    setSelectedDate(null);
    carregarBloqueios();
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Controle de Disponibilidade</h1>
            <p className="text-muted-foreground">Gerencie bloqueios de horários por clínica</p>
          </div>
          <Button onClick={() => handleNovoBloqueio()} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Bloqueio
          </Button>
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
                <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[200px] text-center">
                  {format(currentWeekStart, "d 'de' MMM", { locale: ptBR })} - {format(weekEnd, "d 'de' MMM, yyyy", { locale: ptBR })}
                </span>
                <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legenda */}
        <div className="flex flex-wrap gap-3">
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">Dia Inteiro</Badge>
          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">Feriado</Badge>
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Intervalo</Badge>
          <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">Ausência Prof.</Badge>
        </div>

        {/* Grade Semanal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {daysOfWeek.slice(0, 6).map(day => {
            const bloqueiosDia = getBloqueiosDia(day);
            const isToday = isSameDay(day, new Date());

            return (
              <Card key={day.toISOString()} className={isToday ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>
                      {format(day, "EEE", { locale: ptBR })}
                      <span className="block text-lg font-bold">{format(day, "d")}</span>
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleNovoBloqueio(day)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 min-h-[120px]">
                  {bloqueiosDia.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Sem bloqueios
                    </p>
                  ) : (
                    bloqueiosDia.map(bloqueio => (
                      <div
                        key={bloqueio.id}
                        className={`p-2 rounded-md border text-xs ${getTipoBloqueioColor(bloqueio.tipo_bloqueio)}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium truncate">
                            {getTipoBloqueioLabel(bloqueio.tipo_bloqueio)}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditarBloqueio(bloqueio)}
                              className="p-1 hover:bg-black/10 rounded"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleRemoverBloqueio(bloqueio.id)}
                              className="p-1 hover:bg-black/10 rounded"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {bloqueio.hora_inicio && bloqueio.hora_fim && (
                          <p className="text-[10px] opacity-80">
                            {bloqueio.hora_inicio.slice(0, 5)} - {bloqueio.hora_fim.slice(0, 5)}
                          </p>
                        )}
                        {bloqueio.motivo && (
                          <p className="text-[10px] opacity-80 truncate">{bloqueio.motivo}</p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      <BloqueioModal
        open={modalOpen}
        onClose={handleModalClose}
        clinicaId={selectedClinicaId}
        bloqueio={selectedBloqueio}
        initialDate={selectedDate}
      />
    </AdminLayout>
  );
}
