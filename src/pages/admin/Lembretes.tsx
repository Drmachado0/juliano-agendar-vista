import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { enviarMensagemWhatsApp } from "@/services/integracoes";
import { 
  buscarPacientesN8n, 
  listarLembretesPendentes, 
  salvarPacientesComoLembretes, 
  marcarLembreteEnviado,
  buscarTelefonesExistentes,
  type PacienteN8n,
  type LembreteAnual
} from "@/services/lembretesAnuais";
import { Bell, Send, RefreshCw, Loader2, CalendarIcon, Users, Pause, Play, XCircle, Phone, Shield, Settings2, Clock, AlertTriangle, Coffee, Save, Filter, CheckCircle, Calendar as CalendarIconLucide } from "lucide-react";
import { format, formatDistanceToNow, isPast, isWithinInterval, addDays, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface LogEnvio {
  timestamp: Date;
  telefone: string;
  nome: string;
  delayAplicado: number;
  mensagemGerada: string;
  status: 'sucesso' | 'falha' | 'bloqueado';
  motivo?: string;
}

type EstadoEnvio = 'idle' | 'enviando' | 'aguardando_intervalo' | 'pausa_seguranca' | 'interrompido_limite';
type FiltroLembrete = 'vencidos' | 'semana' | 'mes' | 'todos';

// Security limits
const LIMITE_SESSAO = 40;
const LIMITE_DIARIO = 100;
const HORARIO_INICIO = 9;
const HORARIO_FIM = 18;

// Message variations for annual reminder
const SAUDACOES_LEMBRETE = ["Olá", "Oi", "Olá 😊", "Oi 👋", "Olá!"];

const BLOCOS_ABERTURA_LEMBRETE = [
  "Já faz 1 ano desde sua última consulta oftalmológica conosco.",
  "Passou 1 ano desde seu último atendimento oftalmológico.",
  "Completou 1 ano da sua última visita ao oftalmologista.",
  "Faz 1 ano que você realizou sua última consulta conosco."
];

const BLOCOS_EXPLICATIVOS_LEMBRETE = [
  "Manter seus exames em dia é fundamental para a saúde dos seus olhos.",
  "Cuidar da visão regularmente previne problemas futuros.",
  "Exames periódicos são essenciais para manter a saúde ocular.",
  "A prevenção é o melhor caminho para cuidar da sua visão."
];

const CTAS_LEMBRETE = [
  "Gostaria de agendar seu retorno?",
  "Que tal marcar uma nova consulta?",
  "Podemos agendar seu retorno?",
  "Deseja marcar uma nova consulta?"
];

const TEMPLATE_LEMBRETE_PADRAO = `Olá, {{nome}}! 👋

Já faz 1 ano desde sua última consulta oftalmológica conosco.

Manter seus exames em dia é fundamental para a saúde dos seus olhos. 👀

Gostaria de agendar seu retorno? Podemos encontrar o melhor horário para você.

📱 Agende pelo WhatsApp ou pelo nosso site:
👉 https://drjulianomachado.com.br/agendar

Atenciosamente,
Dr. Juliano Machado
Oftalmologia`;

const gerarMensagemLembreteVariada = (nome: string, ultimaMensagem?: string): string => {
  let mensagem = '';
  let tentativas = 0;
  
  do {
    const saudacao = SAUDACOES_LEMBRETE[Math.floor(Math.random() * SAUDACOES_LEMBRETE.length)];
    const abertura = BLOCOS_ABERTURA_LEMBRETE[Math.floor(Math.random() * BLOCOS_ABERTURA_LEMBRETE.length)];
    const explicativo = BLOCOS_EXPLICATIVOS_LEMBRETE[Math.floor(Math.random() * BLOCOS_EXPLICATIVOS_LEMBRETE.length)];
    const cta = CTAS_LEMBRETE[Math.floor(Math.random() * CTAS_LEMBRETE.length)];
    
    mensagem = `${saudacao}, ${nome}!

${abertura}

${explicativo} 👀

${cta} Podemos encontrar o melhor horário para você.

📱 Agende pelo WhatsApp ou pelo nosso site:
👉 https://drjulianomachado.com.br/agendar

Atenciosamente,
Dr. Juliano Machado
Oftalmologia`;
    
    tentativas++;
  } while (mensagem === ultimaMensagem && tentativas < 10);
  
  return mensagem;
};

const Lembretes = () => {
  // Import patients state
  const [dataFiltro, setDataFiltro] = useState<Date | undefined>(undefined);
  const [pacientesN8n, setPacientesN8n] = useState<PacienteN8n[]>([]);
  const [loadingN8n, setLoadingN8n] = useState(false);
  const [selectedImport, setSelectedImport] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Pending reminders state
  const [lembretesPendentes, setLembretesPendentes] = useState<LembreteAnual[]>([]);
  const [loadingLembretes, setLoadingLembretes] = useState(true);
  const [filtroLembrete, setFiltroLembrete] = useState<FiltroLembrete>('vencidos');
  const [selectedLembretes, setSelectedLembretes] = useState<Set<string>>(new Set());

  // Batch sending state
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [pausado, setPausado] = useState(false);
  const pausadoRef = useRef(false);
  const canceladoRef = useRef(false);
  const [progressoLote, setProgressoLote] = useState({ enviados: 0, total: 0, sucesso: 0, falha: 0 });

  // Advanced config
  const [configAvancadaAberta, setConfigAvancadaAberta] = useState(false);
  const [intervaloMin, setIntervaloMin] = useState(45);
  const [intervaloMax, setIntervaloMax] = useState(120);
  const [pausarAposEnvios, setPausarAposEnvios] = useState(10);
  const [pausaMinMin, setPausaMinMin] = useState(5);
  const [pausaMaxMin, setPausaMaxMin] = useState(10);
  const [variacaoTextoAtiva, setVariacaoTextoAtiva] = useState(true);

  // Tracking
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvio>('idle');
  const [enviosSessao, setEnviosSessao] = useState(0);
  const [enviosDiarios, setEnviosDiarios] = useState(0);
  const [logsEnvio, setLogsEnvio] = useState<LogEnvio[]>([]);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [pausaRestante, setPausaRestante] = useState(0);

  // Load daily limits from localStorage
  useEffect(() => {
    const hoje = new Date().toISOString().split('T')[0];
    const dados = localStorage.getItem('lembretes_limites_diarios');
    if (dados) {
      const parsed = JSON.parse(dados);
      if (parsed.data === hoje) {
        setEnviosDiarios(parsed.enviados);
      } else {
        localStorage.setItem('lembretes_limites_diarios', JSON.stringify({ data: hoje, enviados: 0 }));
      }
    }
  }, []);

  // Persist daily limits
  useEffect(() => {
    const hoje = new Date().toISOString().split('T')[0];
    localStorage.setItem('lembretes_limites_diarios', JSON.stringify({
      data: hoje,
      enviados: enviosDiarios
    }));
  }, [enviosDiarios]);

  // Load pending reminders on mount and filter change
  useEffect(() => {
    carregarLembretesPendentes();
  }, [filtroLembrete]);

  const carregarLembretesPendentes = async () => {
    setLoadingLembretes(true);
    const { data, error } = await listarLembretesPendentes(filtroLembrete);
    if (error) {
      toast({ title: "Erro", description: error, variant: "destructive" });
    } else {
      setLembretesPendentes(data || []);
    }
    setLoadingLembretes(false);
  };

  const validarLimitesEnvio = (): { permitido: boolean; motivo?: string } => {
    const agora = new Date();
    const hora = agora.getHours();
    
    if (hora < HORARIO_INICIO || hora >= HORARIO_FIM) {
      return { permitido: false, motivo: `Envio permitido apenas entre ${HORARIO_INICIO}h e ${HORARIO_FIM}h` };
    }
    if (enviosSessao >= LIMITE_SESSAO) {
      return { permitido: false, motivo: `Limite de ${LIMITE_SESSAO} mensagens por sessão atingido` };
    }
    if (enviosDiarios >= LIMITE_DIARIO) {
      return { permitido: false, motivo: `Limite diário de ${LIMITE_DIARIO} mensagens atingido` };
    }
    return { permitido: true };
  };

  // === Import patients from n8n ===
  const buscarPacientes = async () => {
    if (!dataFiltro) {
      toast({ title: "Selecione uma data", description: "Escolha a data de atendimento.", variant: "destructive" });
      return;
    }

    setLoadingN8n(true);
    setPacientesN8n([]);
    setSelectedImport(new Set());

    const dataFormatada = format(dataFiltro, 'yyyy-MM-dd');
    const { data, error } = await buscarPacientesN8n(dataFormatada);

    if (error) {
      toast({ title: "Erro", description: error, variant: "destructive" });
      setLoadingN8n(false);
      return;
    }

    if (!data || data.length === 0) {
      toast({ title: "Nenhum paciente", description: `Não há pacientes em ${format(dataFiltro, 'dd/MM/yyyy')}.` });
      setLoadingN8n(false);
      return;
    }

    // Filter out already saved patients
    const { data: existentes } = await buscarTelefonesExistentes();
    const pacientesNovos = data.filter(p => {
      const key = `${p.telefone.replace(/\D/g, '').slice(-8)}_${p.data_atendimento}`;
      return !existentes?.has(key);
    });

    setPacientesN8n(pacientesNovos);
    
    const jaExistem = data.length - pacientesNovos.length;
    toast({
      title: "Pacientes carregados!",
      description: `${pacientesNovos.length} novo(s) de ${data.length} total (${jaExistem} já no banco).`,
    });

    setLoadingN8n(false);
  };

  const salvarPacientesSelecionados = async () => {
    const selecionados = pacientesN8n.filter(p => selectedImport.has(p.id));
    if (selecionados.length === 0) {
      toast({ title: "Selecione pacientes", description: "Marque ao menos um paciente para salvar.", variant: "destructive" });
      return;
    }

    setSalvando(true);
    const { success, inserted, error } = await salvarPacientesComoLembretes(selecionados);
    
    if (error) {
      toast({ title: "Erro ao salvar", description: error, variant: "destructive" });
    } else {
      toast({ title: "Salvo com sucesso!", description: `${inserted} paciente(s) adicionado(s) ao banco de lembretes.` });
      setPacientesN8n([]);
      setSelectedImport(new Set());
      carregarLembretesPendentes();
    }
    setSalvando(false);
  };

  // === Batch sending ===
  const enviarEmLote = async () => {
    const lembretesParaEnviar = lembretesPendentes.filter(l => selectedLembretes.has(l.id));
    
    if (lembretesParaEnviar.length === 0) {
      toast({ title: "Nenhum selecionado", description: "Selecione ao menos um paciente.", variant: "destructive" });
      return;
    }

    const validacao = validarLimitesEnvio();
    if (!validacao.permitido) {
      toast({ title: "Bloqueado", description: validacao.motivo, variant: "destructive" });
      setEstadoEnvio('interrompido_limite');
      return;
    }

    setEnviandoLote(true);
    setEstadoEnvio('enviando');
    setProgressoLote({ enviados: 0, total: lembretesParaEnviar.length, sucesso: 0, falha: 0 });
    canceladoRef.current = false;
    pausadoRef.current = false;

    let sucessos = 0;
    let falhas = 0;
    let ultimaMensagem = '';
    let contadorPausa = 0;

    for (let i = 0; i < lembretesParaEnviar.length; i++) {
      if (canceladoRef.current) break;

      while (pausadoRef.current && !canceladoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (canceladoRef.current) break;

      // Check limits before each send
      const validacaoAtual = validarLimitesEnvio();
      if (!validacaoAtual.permitido) {
        setEstadoEnvio('interrompido_limite');
        toast({ title: "Limite atingido", description: validacaoAtual.motivo, variant: "destructive" });
        break;
      }

      const lembrete = lembretesParaEnviar[i];
      const primeiroNome = lembrete.primeiro_nome || lembrete.nome.split(' ')[0];

      // Generate message
      const mensagem = variacaoTextoAtiva 
        ? gerarMensagemLembreteVariada(primeiroNome, ultimaMensagem)
        : TEMPLATE_LEMBRETE_PADRAO.replace('{{nome}}', primeiroNome);
      ultimaMensagem = mensagem;

      setEstadoEnvio('enviando');

      try {
        const resultado = await enviarMensagemWhatsApp(lembrete.telefone, mensagem);
        
        if (resultado.success) {
          sucessos++;
          await marcarLembreteEnviado(lembrete.id);
          setEnviosSessao(prev => prev + 1);
          setEnviosDiarios(prev => prev + 1);
          
          setLogsEnvio(prev => [{
            timestamp: new Date(),
            telefone: lembrete.telefone,
            nome: lembrete.nome,
            delayAplicado: 0,
            mensagemGerada: mensagem,
            status: 'sucesso'
          }, ...prev]);
        } else {
          falhas++;
          setLogsEnvio(prev => [{
            timestamp: new Date(),
            telefone: lembrete.telefone,
            nome: lembrete.nome,
            delayAplicado: 0,
            mensagemGerada: mensagem,
            status: 'falha',
            motivo: resultado.error || 'Erro desconhecido'
          }, ...prev]);
        }
      } catch (error: any) {
        falhas++;
        setLogsEnvio(prev => [{
          timestamp: new Date(),
          telefone: lembrete.telefone,
          nome: lembrete.nome,
          delayAplicado: 0,
          mensagemGerada: mensagem,
          status: 'falha',
          motivo: error.message
        }, ...prev]);
      }

      setProgressoLote({ enviados: i + 1, total: lembretesParaEnviar.length, sucesso: sucessos, falha: falhas });
      contadorPausa++;

      // Strategic pause
      if (contadorPausa >= pausarAposEnvios && i < lembretesParaEnviar.length - 1) {
        setEstadoEnvio('pausa_seguranca');
        const pausaDuracao = Math.floor(Math.random() * (pausaMaxMin - pausaMinMin + 1) + pausaMinMin) * 60 * 1000;
        
        let tempoRestantePausa = pausaDuracao;
        while (tempoRestantePausa > 0 && !canceladoRef.current) {
          setPausaRestante(Math.ceil(tempoRestantePausa / 1000));
          await new Promise(resolve => setTimeout(resolve, 1000));
          tempoRestantePausa -= 1000;
        }
        setPausaRestante(0);
        contadorPausa = 0;
      }

      // Random delay between messages
      if (i < lembretesParaEnviar.length - 1 && !canceladoRef.current) {
        setEstadoEnvio('aguardando_intervalo');
        const delay = Math.floor(Math.random() * (intervaloMax - intervaloMin + 1) + intervaloMin) * 1000;
        
        let tempoRestanteDelay = delay;
        while (tempoRestanteDelay > 0 && !canceladoRef.current && !pausadoRef.current) {
          setTempoRestante(Math.ceil(tempoRestanteDelay / 1000));
          await new Promise(resolve => setTimeout(resolve, 1000));
          tempoRestanteDelay -= 1000;
        }
        setTempoRestante(0);
      }
    }

    setEnviandoLote(false);
    setEstadoEnvio('idle');
    setSelectedLembretes(new Set());
    carregarLembretesPendentes();

    toast({
      title: canceladoRef.current ? "Envio cancelado" : "Envio concluído",
      description: `${sucessos} enviado(s), ${falhas} falha(s).`,
    });
  };

  const togglePausa = () => {
    pausadoRef.current = !pausadoRef.current;
    setPausado(pausadoRef.current);
  };

  const cancelarEnvio = () => {
    canceladoRef.current = true;
    pausadoRef.current = false;
    setPausado(false);
  };

  const toggleSelectAllImport = () => {
    if (selectedImport.size === pacientesN8n.length) {
      setSelectedImport(new Set());
    } else {
      setSelectedImport(new Set(pacientesN8n.map(p => p.id)));
    }
  };

  const toggleSelectAllLembretes = () => {
    if (selectedLembretes.size === lembretesPendentes.length) {
      setSelectedLembretes(new Set());
    } else {
      setSelectedLembretes(new Set(lembretesPendentes.map(l => l.id)));
    }
  };

  const getStatusBadge = (lembrete: LembreteAnual) => {
    const dataLembrete = new Date(lembrete.data_proximo_lembrete);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataLembrete < hoje) {
      return <Badge variant="destructive" className="text-xs">Vencido</Badge>;
    } else if (isWithinInterval(dataLembrete, { start: hoje, end: addDays(hoje, 7) })) {
      return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">Esta semana</Badge>;
    } else {
      return <Badge variant="outline" className="text-xs">Programado</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Lembretes Anuais
          </h1>
          <p className="text-muted-foreground mt-1">
            Envie lembretes para pacientes que completam 1 ano da última consulta
          </p>
        </div>

        {/* Security Info */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-4 flex-wrap">
            <span><strong>Sessão:</strong> {enviosSessao}/{LIMITE_SESSAO}</span>
            <span><strong>Diário:</strong> {enviosDiarios}/{LIMITE_DIARIO}</span>
            <span><strong>Horário:</strong> {HORARIO_INICIO}h-{HORARIO_FIM}h</span>
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="importar" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="importar" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Importar Pacientes
            </TabsTrigger>
            <TabsTrigger value="pendentes" className="flex items-center gap-2">
              <CalendarIconLucide className="h-4 w-4" />
              Lembretes Pendentes ({lembretesPendentes.length})
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="importar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Importar do Sistema SaudeViaNet
                </CardTitle>
                <CardDescription>
                  Busque pacientes atendidos em uma data específica e salve no banco de lembretes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !dataFiltro && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataFiltro ? format(dataFiltro, "dd/MM/yyyy") : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataFiltro}
                        onSelect={(date) => { setDataFiltro(date); setCalendarOpen(false); }}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>

                  <Button onClick={buscarPacientes} disabled={loadingN8n || !dataFiltro}>
                    {loadingN8n ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Buscar Pacientes
                  </Button>
                </div>

                {pacientesN8n.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedImport.size === pacientesN8n.length}
                          onCheckedChange={toggleSelectAllImport}
                        />
                        <span className="text-sm text-muted-foreground">
                          Selecionar todos ({pacientesN8n.length})
                        </span>
                      </div>
                      <Button onClick={salvarPacientesSelecionados} disabled={salvando || selectedImport.size === 0}>
                        {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar no Banco ({selectedImport.size})
                      </Button>
                    </div>

                    <ScrollArea className="h-[300px] border rounded-lg">
                      <div className="p-2 space-y-2">
                        {pacientesN8n.map((paciente) => (
                          <div
                            key={paciente.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                              selectedImport.has(paciente.id) ? "bg-primary/10 border-primary" : "hover:bg-muted"
                            )}
                            onClick={() => {
                              const newSet = new Set(selectedImport);
                              if (newSet.has(paciente.id)) {
                                newSet.delete(paciente.id);
                              } else {
                                newSet.add(paciente.id);
                              }
                              setSelectedImport(newSet);
                            }}
                          >
                            <Checkbox checked={selectedImport.has(paciente.id)} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{paciente.nome}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                {paciente.telefone_formatado}
                                <span className="text-xs">• {paciente.data_atendimento_formatada}</span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Reminders Tab */}
          <TabsContent value="pendentes" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" />
                      Lembretes Pendentes
                    </CardTitle>
                    <CardDescription>Pacientes que completam 1 ano da última consulta</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <select
                      value={filtroLembrete}
                      onChange={(e) => setFiltroLembrete(e.target.value as FiltroLembrete)}
                      className="text-sm border rounded-md px-2 py-1 bg-background"
                    >
                      <option value="vencidos">Vencidos</option>
                      <option value="semana">Esta semana</option>
                      <option value="mes">Este mês</option>
                      <option value="todos">Todos</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={carregarLembretesPendentes}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingLembretes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : lembretesPendentes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum lembrete pendente para o filtro selecionado
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedLembretes.size === lembretesPendentes.length && lembretesPendentes.length > 0}
                          onCheckedChange={toggleSelectAllLembretes}
                        />
                        <span className="text-sm text-muted-foreground">
                          Selecionar todos ({lembretesPendentes.length})
                        </span>
                      </div>
                    </div>

                    <ScrollArea className="h-[300px] border rounded-lg">
                      <div className="p-2 space-y-2">
                        {lembretesPendentes.map((lembrete) => (
                          <div
                            key={lembrete.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                              selectedLembretes.has(lembrete.id) ? "bg-primary/10 border-primary" : "hover:bg-muted"
                            )}
                            onClick={() => {
                              const newSet = new Set(selectedLembretes);
                              if (newSet.has(lembrete.id)) {
                                newSet.delete(lembrete.id);
                              } else {
                                newSet.add(lembrete.id);
                              }
                              setSelectedLembretes(newSet);
                            }}
                          >
                            <Checkbox checked={selectedLembretes.has(lembrete.id)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{lembrete.nome}</p>
                                {getStatusBadge(lembrete)}
                              </div>
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                {lembrete.telefone}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Última consulta: {format(new Date(lembrete.data_ultima_consulta), 'dd/MM/yyyy')} •
                                Lembrete: {format(new Date(lembrete.data_proximo_lembrete), 'dd/MM/yyyy')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Batch Sending Section */}
            {selectedLembretes.size > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" />
                    Enviar Lembretes em Lote
                  </CardTitle>
                  <CardDescription>
                    {selectedLembretes.size} paciente(s) selecionado(s)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Advanced Config */}
                  <Collapsible open={configAvancadaAberta} onOpenChange={setConfigAvancadaAberta}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4" />
                          Configurações Avançadas
                        </span>
                        {configAvancadaAberta ? "▲" : "▼"}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Intervalo mín. (seg)</label>
                          <input
                            type="number"
                            value={intervaloMin}
                            onChange={(e) => setIntervaloMin(Number(e.target.value))}
                            className="w-full border rounded-md px-3 py-2 mt-1"
                            min={30}
                            max={300}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Intervalo máx. (seg)</label>
                          <input
                            type="number"
                            value={intervaloMax}
                            onChange={(e) => setIntervaloMax(Number(e.target.value))}
                            className="w-full border rounded-md px-3 py-2 mt-1"
                            min={30}
                            max={300}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Pausar após X envios</label>
                          <input
                            type="number"
                            value={pausarAposEnvios}
                            onChange={(e) => setPausarAposEnvios(Number(e.target.value))}
                            className="w-full border rounded-md px-3 py-2 mt-1"
                            min={5}
                            max={20}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Pausa mín. (min)</label>
                          <input
                            type="number"
                            value={pausaMinMin}
                            onChange={(e) => setPausaMinMin(Number(e.target.value))}
                            className="w-full border rounded-md px-3 py-2 mt-1"
                            min={1}
                            max={30}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Variação automática de texto</label>
                        <Switch checked={variacaoTextoAtiva} onCheckedChange={setVariacaoTextoAtiva} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Progress */}
                  {enviandoLote && (
                    <div className="space-y-3">
                      <Progress value={(progressoLote.enviados / progressoLote.total) * 100} />
                      <div className="flex items-center justify-between text-sm">
                        <span>{progressoLote.enviados}/{progressoLote.total}</span>
                        <span className="text-emerald-600">✓ {progressoLote.sucesso}</span>
                        <span className="text-red-600">✗ {progressoLote.falha}</span>
                      </div>
                      {estadoEnvio === 'aguardando_intervalo' && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 animate-pulse" />
                          Aguardando intervalo: {tempoRestante}s
                        </div>
                      )}
                      {estadoEnvio === 'pausa_seguranca' && (
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                          <Coffee className="h-4 w-4" />
                          Pausa de segurança: {Math.floor(pausaRestante / 60)}m {pausaRestante % 60}s
                        </div>
                      )}
                    </div>
                  )}

                  {/* Send Controls */}
                  <div className="flex gap-2">
                    {!enviandoLote ? (
                      <Button onClick={enviarEmLote} className="flex-1">
                        <Send className="h-4 w-4 mr-2" />
                        Iniciar Envio ({selectedLembretes.size})
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" onClick={togglePausa} className="flex-1">
                          {pausado ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                          {pausado ? "Continuar" : "Pausar"}
                        </Button>
                        <Button variant="destructive" onClick={cancelarEnvio}>
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Logs */}
                  {logsEnvio.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Logs de Envio</h4>
                        <Button variant="ghost" size="sm" onClick={() => setLogsEnvio([])}>
                          Limpar
                        </Button>
                      </div>
                      <ScrollArea className="h-[200px] border rounded-lg">
                        <div className="p-2 space-y-2">
                          {logsEnvio.map((log, idx) => (
                            <div key={idx} className={cn(
                              "p-2 rounded text-sm",
                              log.status === 'sucesso' ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                            )}>
                              <div className="flex items-center gap-2">
                                {log.status === 'sucesso' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                <span className="font-medium">{log.nome}</span>
                                <Badge variant="outline" className="text-xs">{log.telefone}</Badge>
                                <span className="text-xs ml-auto">{format(log.timestamp, 'HH:mm:ss')}</span>
                              </div>
                              {log.motivo && <p className="text-xs mt-1 ml-6">{log.motivo}</p>}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Lembretes;
