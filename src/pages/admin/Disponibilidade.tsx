import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Plus, Calendar, Trash2, Edit, Clock, Save, CalendarDays } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { listarClinicas, Clinica } from "@/services/clinicas";
import { useBloqueios, Bloqueio, getTipoBloqueioLabel, getTipoBloqueioColor } from "@/hooks/useBloqueios";
import { BloqueioModal } from "@/components/admin/BloqueioModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DisponibilidadeSemanal {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  intervalo_minutos: number;
  ativo: boolean;
  clinica_id: string | null;
}

interface DisponibilidadeEspecifica {
  id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  intervalo_minutos: number;
  disponivel: boolean;
  motivo: string | null;
  clinica_id: string | null;
}

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

export default function Disponibilidade() {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [selectedClinicaId, setSelectedClinicaId] = useState<string>("");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loadingClinicas, setLoadingClinicas] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBloqueio, setSelectedBloqueio] = useState<Bloqueio | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Disponibilidade semanal
  const [disponibilidadeSemanal, setDisponibilidadeSemanal] = useState<DisponibilidadeSemanal[]>([]);
  const [savingSemanal, setSavingSemanal] = useState(false);
  
  // Disponibilidade específica
  const [disponibilidadeEspecifica, setDisponibilidadeEspecifica] = useState<DisponibilidadeEspecifica[]>([]);
  const [novaEspecifica, setNovaEspecifica] = useState({
    data: "",
    hora_inicio: "08:00",
    hora_fim: "18:00",
    intervalo_minutos: 30,
    disponivel: true,
    motivo: ""
  });

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const daysOfWeek = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  // Hook de bloqueios com React Query - reativo por clínica
  const dataInicio = format(currentWeekStart, 'yyyy-MM-dd');
  const dataFim = format(weekEnd, 'yyyy-MM-dd');
  
  const {
    bloqueios,
    loading: loadingBloqueios,
    remove: removerBloqueioFn,
    refetch: refetchBloqueios,
  } = useBloqueios(selectedClinicaId || null, dataInicio, dataFim);

  useEffect(() => {
    carregarClinicas();
  }, []);

  useEffect(() => {
    if (selectedClinicaId) {
      carregarDisponibilidadeSemanal(selectedClinicaId);
      carregarDisponibilidadeEspecifica(selectedClinicaId);
    }
  }, [selectedClinicaId]);

  async function carregarClinicas() {
    setLoadingClinicas(true);
    const { data } = await listarClinicas();
    setClinicas(data);
    if (data.length > 0) {
      setSelectedClinicaId(data[0].id);
    }
    setLoadingClinicas(false);
  }

  async function carregarDisponibilidadeSemanal(clinicaId: string) {
    const { data, error } = await supabase
      .from('disponibilidade_semanal')
      .select('*')
      .eq('clinica_id', clinicaId)
      .order('dia_semana');
    
    if (error) {
      console.error('Erro ao carregar disponibilidade semanal:', error);
      return;
    }
    
    // Se não existem registros para esta clínica, criar automaticamente
    if (!data || data.length === 0) {
      await criarDisponibilidadePadraoClinica(clinicaId);
      return;
    }
    
    setDisponibilidadeSemanal(data || []);
  }

  async function criarDisponibilidadePadraoClinica(clinicaId: string) {
    const diasPadrao = [
      { dia_semana: 0, hora_inicio: '08:00', hora_fim: '12:00', ativo: false },
      { dia_semana: 1, hora_inicio: '08:00', hora_fim: '18:00', ativo: true },
      { dia_semana: 2, hora_inicio: '08:00', hora_fim: '18:00', ativo: true },
      { dia_semana: 3, hora_inicio: '08:00', hora_fim: '18:00', ativo: true },
      { dia_semana: 4, hora_inicio: '08:00', hora_fim: '18:00', ativo: true },
      { dia_semana: 5, hora_inicio: '08:00', hora_fim: '18:00', ativo: true },
      { dia_semana: 6, hora_inicio: '08:00', hora_fim: '12:00', ativo: true },
    ];

    const inserts = diasPadrao.map(d => ({
      ...d,
      clinica_id: clinicaId,
      intervalo_minutos: 30
    }));

    const { error } = await supabase
      .from('disponibilidade_semanal')
      .insert(inserts);

    if (error) {
      console.error('Erro ao criar disponibilidade padrão:', error);
      toast.error('Erro ao criar disponibilidade padrão para a clínica');
      return;
    }

    // Recarregar após criar
    await carregarDisponibilidadeSemanal(clinicaId);
  }

  async function carregarDisponibilidadeEspecifica(clinicaId: string) {
    const { data, error } = await supabase
      .from('disponibilidade_especifica')
      .select('*')
      .eq('clinica_id', clinicaId)
      .gte('data', format(new Date(), 'yyyy-MM-dd'))
      .order('data');
    
    if (error) {
      console.error('Erro ao carregar disponibilidade específica:', error);
      return;
    }
    
    setDisponibilidadeEspecifica(data || []);
  }

  // Bloqueios agora gerenciados pelo hook useBloqueios

  async function salvarDisponibilidadeSemanal() {
    setSavingSemanal(true);
    try {
      for (const disp of disponibilidadeSemanal) {
        const { error } = await supabase
          .from('disponibilidade_semanal')
          .update({
            hora_inicio: disp.hora_inicio,
            hora_fim: disp.hora_fim,
            intervalo_minutos: disp.intervalo_minutos,
            ativo: disp.ativo
          })
          .eq('id', disp.id);
        
        if (error) throw error;
      }
      toast.success('Disponibilidade semanal salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar disponibilidade');
    } finally {
      setSavingSemanal(false);
    }
  }

  async function adicionarDisponibilidadeEspecifica() {
    if (!novaEspecifica.data) {
      toast.error('Selecione uma data');
      return;
    }

    try {
      const { error } = await supabase
        .from('disponibilidade_especifica')
        .insert({
          clinica_id: selectedClinicaId,
          data: novaEspecifica.data,
          hora_inicio: novaEspecifica.disponivel ? novaEspecifica.hora_inicio : null,
          hora_fim: novaEspecifica.disponivel ? novaEspecifica.hora_fim : null,
          intervalo_minutos: novaEspecifica.intervalo_minutos,
          disponivel: novaEspecifica.disponivel,
          motivo: novaEspecifica.motivo || null
        });

      if (error) throw error;
      
      toast.success('Disponibilidade específica adicionada');
      setNovaEspecifica({
        data: "",
        hora_inicio: "08:00",
        hora_fim: "18:00",
        intervalo_minutos: 30,
        disponivel: true,
        motivo: ""
      });
      carregarDisponibilidadeEspecifica(selectedClinicaId);
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Já existe uma configuração para esta data nesta clínica');
      } else {
        toast.error('Erro ao adicionar disponibilidade');
      }
    }
  }

  async function removerDisponibilidadeEspecifica(id: string) {
    if (!confirm('Remover esta configuração específica?')) return;
    
    const { error } = await supabase
      .from('disponibilidade_especifica')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Erro ao remover');
    } else {
      toast.success('Removido com sucesso');
      carregarDisponibilidadeEspecifica(selectedClinicaId);
    }
  }

  function updateSemanalField(id: string, field: keyof DisponibilidadeSemanal, value: any) {
    setDisponibilidadeSemanal(prev => 
      prev.map(d => d.id === id ? { ...d, [field]: value } : d)
    );
  }

  function getBloqueiosDia(date: Date): Bloqueio[] {
    return bloqueios.filter(b => isSameDay(new Date(b.data + 'T00:00:00'), date));
  }

  async function handleRemoverBloqueio(id: string) {
    if (confirm('Tem certeza que deseja remover este bloqueio?')) {
      try {
        await removerBloqueioFn(id);
      } catch (error) {
        // Erro já tratado no hook
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
    refetchBloqueios();
  }

  if (loadingClinicas) {
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
          <h1 className="text-2xl font-bold text-foreground">Controle de Disponibilidade</h1>
          <p className="text-muted-foreground">Configure horários de atendimento e bloqueios</p>
        </div>

        <Tabs defaultValue="semanal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="semanal" className="gap-2">
              <Clock className="h-4 w-4" />
              Horários Semanais
            </TabsTrigger>
            <TabsTrigger value="especifica" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Datas Especiais
            </TabsTrigger>
            <TabsTrigger value="bloqueios" className="gap-2">
              <Calendar className="h-4 w-4" />
              Bloqueios por Clínica
            </TabsTrigger>
          </TabsList>

          {/* Tab: Disponibilidade Semanal */}
          <TabsContent value="semanal" className="space-y-6">
            {/* Seletor de Clínica */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Label className="font-medium">Clínica:</Label>
                  <Select value={selectedClinicaId} onValueChange={setSelectedClinicaId}>
                    <SelectTrigger className="w-72">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Horários Padrão da Semana</CardTitle>
                <CardDescription>
                  Configure os horários de atendimento para cada dia da semana nesta clínica.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {disponibilidadeSemanal.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Carregando disponibilidade...
                  </p>
                ) : (
                  disponibilidadeSemanal.map((disp) => {
                    const diaInfo = DIAS_SEMANA.find(d => d.value === disp.dia_semana);
                    return (
                      <div 
                        key={disp.id} 
                        className={`flex flex-wrap items-center gap-4 p-4 rounded-lg border ${disp.ativo ? 'bg-card' : 'bg-muted/50'}`}
                      >
                        <div className="flex items-center gap-3 w-40">
                          <Switch
                            checked={disp.ativo}
                            onCheckedChange={(checked) => updateSemanalField(disp.id, 'ativo', checked)}
                          />
                          <span className={`font-medium ${!disp.ativo && 'text-muted-foreground'}`}>
                            {diaInfo?.label}
                          </span>
                        </div>
                        
                        {disp.ativo && (
                          <>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm text-muted-foreground">Início:</Label>
                              <Input
                                type="time"
                                value={disp.hora_inicio}
                                onChange={(e) => updateSemanalField(disp.id, 'hora_inicio', e.target.value)}
                                className="w-28"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm text-muted-foreground">Fim:</Label>
                              <Input
                                type="time"
                                value={disp.hora_fim}
                                onChange={(e) => updateSemanalField(disp.id, 'hora_fim', e.target.value)}
                                className="w-28"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm text-muted-foreground">Intervalo:</Label>
                              <Select
                                value={disp.intervalo_minutos.toString()}
                                onValueChange={(v) => {
                                  const novoIntervalo = parseInt(v, 10);
                                  updateSemanalField(disp.id, 'intervalo_minutos', novoIntervalo);
                                }}
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue placeholder="Intervalo" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border border-border z-50">
                                  <SelectItem value="15">15 min</SelectItem>
                                  <SelectItem value="20">20 min</SelectItem>
                                  <SelectItem value="30">30 min</SelectItem>
                                  <SelectItem value="45">45 min</SelectItem>
                                  <SelectItem value="60">60 min</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
                
                <Button onClick={salvarDisponibilidadeSemanal} disabled={savingSemanal || disponibilidadeSemanal.length === 0} className="gap-2">
                  <Save className="h-4 w-4" />
                  {savingSemanal ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Disponibilidade Específica */}
          <TabsContent value="especifica" className="space-y-6">
            {/* Seletor de Clínica */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Label className="font-medium">Clínica:</Label>
                  <Select value={selectedClinicaId} onValueChange={setSelectedClinicaId}>
                    <SelectTrigger className="w-72">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Adicionar Data Especial</CardTitle>
                <CardDescription>
                  Configure horários diferentes para datas específicas (feriados, eventos, etc.)
                  Estas configurações substituem a disponibilidade semanal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={novaEspecifica.data}
                      onChange={(e) => setNovaEspecifica(prev => ({ ...prev, data: e.target.value }))}
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={novaEspecifica.disponivel ? "disponivel" : "bloqueado"}
                      onValueChange={(v) => setNovaEspecifica(prev => ({ ...prev, disponivel: v === "disponivel" }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disponivel">Disponível (horário especial)</SelectItem>
                        <SelectItem value="bloqueado">Bloqueado (sem atendimento)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {novaEspecifica.disponivel && (
                    <>
                      <div className="space-y-2">
                        <Label>Hora Início</Label>
                        <Input
                          type="time"
                          value={novaEspecifica.hora_inicio}
                          onChange={(e) => setNovaEspecifica(prev => ({ ...prev, hora_inicio: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Hora Fim</Label>
                        <Input
                          type="time"
                          value={novaEspecifica.hora_fim}
                          onChange={(e) => setNovaEspecifica(prev => ({ ...prev, hora_fim: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label>Motivo (opcional)</Label>
                    <Input
                      placeholder="Ex: Feriado, Evento, etc."
                      value={novaEspecifica.motivo}
                      onChange={(e) => setNovaEspecifica(prev => ({ ...prev, motivo: e.target.value }))}
                    />
                  </div>
                </div>
                
                <Button onClick={adicionarDisponibilidadeEspecifica} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Data Especial
                </Button>
              </CardContent>
            </Card>

            {/* Lista de datas especiais */}
            <Card>
              <CardHeader>
                <CardTitle>Datas Especiais Configuradas</CardTitle>
              </CardHeader>
              <CardContent>
                {disponibilidadeEspecifica.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma data especial configurada
                  </p>
                ) : (
                  <div className="space-y-2">
                    {disponibilidadeEspecifica.map((disp) => (
                      <div 
                        key={disp.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          disp.disponivel ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <Badge variant={disp.disponivel ? "default" : "destructive"}>
                            {disp.disponivel ? "Disponível" : "Bloqueado"}
                          </Badge>
                          <span className="font-medium">
                            {format(new Date(disp.data + 'T12:00:00'), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                          </span>
                          {disp.disponivel && disp.hora_inicio && disp.hora_fim && (
                            <span className="text-muted-foreground">
                              {disp.hora_inicio} - {disp.hora_fim}
                            </span>
                          )}
                          {disp.motivo && (
                            <span className="text-sm text-muted-foreground">
                              • {disp.motivo}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removerDisponibilidadeEspecifica(disp.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Bloqueios por Clínica */}
          <TabsContent value="bloqueios" className="space-y-6">
            {/* Header com botão */}
            <div className="flex justify-end">
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
              {loadingBloqueios ? (
                // Skeleton loading state
                daysOfWeek.slice(0, 6).map(day => (
                  <Card key={day.toISOString()} className="animate-pulse">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span>
                          {format(day, "EEE", { locale: ptBR })}
                          <span className="block text-lg font-bold">{format(day, "d")}</span>
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 min-h-[120px]">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-8 w-3/4" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                daysOfWeek.slice(0, 6).map(day => {
                  const bloqueiosDia = getBloqueiosDia(day);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <Card key={day.toISOString()} className={`transition-all duration-200 ${isToday ? 'ring-2 ring-primary' : ''}`}>
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
                              className={`p-2 rounded-md border text-xs transition-all duration-200 ${getTipoBloqueioColor(bloqueio.tipo_bloqueio)}`}
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
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
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
