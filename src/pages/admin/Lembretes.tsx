import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { enviarMensagemWhatsApp, enviarImagemWhatsApp } from "@/services/integracoes";
import { 
  buscarPacientesN8n, 
  listarLembretesPendentes, 
  salvarPacientesComoLembretes, 
  marcarLembreteEnviado,
  buscarTelefonesExistentes,
  buscarEstatisticasGerais,
  buscarEstatisticasPorMes,
  type PacienteN8n,
  type LembreteAnual,
  type EstatisticasGerais,
  type EstatisticaMensal
} from "@/services/lembretesAnuais";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Send, RefreshCw, Loader2, CalendarIcon, Users, Pause, Play, XCircle, Phone, Shield, Settings2, Clock, AlertTriangle, Coffee, Save, Filter, CheckCircle, Calendar as CalendarIconLucide, CalendarRange, ArrowRight, BarChart3, TrendingUp, History, MessageCircle, ImagePlus, X, Shuffle, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { format, formatDistanceToNow, isPast, isWithinInterval, addDays, addMonths, eachDayOfInterval, differenceInDays } from "date-fns";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { useEnvioLoteConfig, LIMITE_SESSAO, LIMITE_DIARIO } from "@/hooks/useEnvioLoteConfig";

interface LogEnvio {
  timestamp: Date;
  telefone: string;
  nome: string;
  delayAplicado: number;
  mensagemGerada: string;
  status: 'sucesso' | 'falha' | 'bloqueado';
  motivo?: string;
}

interface HistoricoLembrete {
  id: string;
  telefone: string;
  conteudo: string;
  created_at: string;
}

type EstadoEnvio = 'idle' | 'enviando' | 'aguardando_intervalo' | 'pausa_seguranca' | 'interrompido_limite';
type FiltroLembrete = string; // 'vencidos' | 'semana' | 'mes' | 'todos' | 'mes_YYYY-MM'

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
  // Import patients state - now with date range
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [pacientesN8n, setPacientesN8n] = useState<PacienteN8n[]>([]);
  const [loadingN8n, setLoadingN8n] = useState(false);
  const [selectedImport, setSelectedImport] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [calendarInicioOpen, setCalendarInicioOpen] = useState(false);
  const [calendarFimOpen, setCalendarFimOpen] = useState(false);
  const [progressoBusca, setProgressoBusca] = useState({ atual: 0, total: 0 });

  // Pending reminders state
  const [lembretesPendentes, setLembretesPendentes] = useState<LembreteAnual[]>([]);
  const [loadingLembretes, setLoadingLembretes] = useState(true);
  const [filtroLembrete, setFiltroLembrete] = useState<FiltroLembrete>('vencidos');
  const [selectedLembretes, setSelectedLembretes] = useState<Set<string>>(new Set());

  // Dashboard statistics state
  const [estatisticasGerais, setEstatisticasGerais] = useState<EstatisticasGerais | null>(null);
  const [estatisticasMensais, setEstatisticasMensais] = useState<EstatisticaMensal[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Batch sending state
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [pausado, setPausado] = useState(false);
  const pausadoRef = useRef(false);
  const canceladoRef = useRef(false);
  const [progressoLote, setProgressoLote] = useState({ enviados: 0, total: 0, sucesso: 0, falha: 0 });

  // ===== CONFIGURAÇÕES DE ENVIO EM LOTE (via hook compartilhado) =====
  const {
    intervaloMin,
    setIntervaloMin,
    intervaloMax,
    setIntervaloMax,
    pausarAposEnvios,
    setPausarAposEnvios,
    pausaMinMin,
    setPausaMinMin,
    pausaMaxMin,
    setPausaMaxMin,
    variacaoTextoAtiva,
    setVariacaoTextoAtiva,
    modoEnvioSemRestricao,
    setModoEnvioSemRestricao,
    horarioInicio,
    setHorarioInicio,
    horarioFim,
    setHorarioFim,
    isHorarioPermitido,
    validarLimitesEnvio: validarLimitesEnvioHook,
    gerarDelayAleatorio,
    gerarPausaAleatoria,
    resetarConfiguracoes,
  } = useEnvioLoteConfig();

  const [configAvancadaAberta, setConfigAvancadaAberta] = useState(false);

  // Template and image state
  const [template, setTemplate] = useState(TEMPLATE_LEMBRETE_PADRAO);
  const [imagemBase64, setImagemBase64] = useState<string | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemNome, setImagemNome] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mensagemPreviewVariada, setMensagemPreviewVariada] = useState(() => 
    gerarMensagemLembreteVariada("Maria")
  );

  // History from database
  const [historico, setHistorico] = useState<HistoricoLembrete[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Tracking
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvio>('idle');
  const [enviosSessao, setEnviosSessao] = useState(0);
  const [enviosDiarios, setEnviosDiarios] = useState(0);
  const [logsEnvio, setLogsEnvio] = useState<LogEnvio[]>([]);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [pausaRestante, setPausaRestante] = useState(0);
  const [logExpandido, setLogExpandido] = useState<number | null>(null);

  // Wrapper para validar limites usando contadores locais
  const validarLimitesEnvio = () => validarLimitesEnvioHook(enviosSessao, enviosDiarios);

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

  // Load dashboard on mount
  useEffect(() => {
    carregarDashboard();
    carregarHistorico();
  }, []);

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

  const carregarDashboard = async () => {
    setLoadingDashboard(true);
    const [geraisResult, mensaisResult] = await Promise.all([
      buscarEstatisticasGerais(),
      buscarEstatisticasPorMes()
    ]);
    
    if (geraisResult.data) {
      setEstatisticasGerais(geraisResult.data);
    }
    if (mensaisResult.data) {
      setEstatisticasMensais(mensaisResult.data);
    }
    setLoadingDashboard(false);
  };

  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    const { data, error } = await supabase
      .from("mensagens_whatsapp")
      .select("id, telefone, conteudo, created_at")
      .eq("tipo_mensagem", "lembrete")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setHistorico(data as HistoricoLembrete[]);
    }
    setLoadingHistorico(false);
  };

  // Image handling
  const handleImagemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Erro", description: "Selecione apenas arquivos de imagem.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Erro", description: "A imagem deve ter no máximo 5MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImagemBase64(base64);
      setImagemPreview(base64);
      setImagemNome(file.name);
    };
    reader.readAsDataURL(file);
  };

  const removerImagem = () => {
    setImagemBase64(null);
    setImagemPreview(null);
    setImagemNome("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const gerarNovaMensagemPreview = () => {
    setMensagemPreviewVariada(gerarMensagemLembreteVariada("Maria", mensagemPreviewVariada));
  };

  const renderizarTemplate = (nome: string) => {
    return template.replace(/\{\{nome\}\}/g, nome);
  };

  // === Import patients from n8n - now with date range ===
  const buscarPacientes = async () => {
    if (!dataInicio) {
      toast({ title: "Selecione uma data", description: "Escolha pelo menos a data inicial.", variant: "destructive" });
      return;
    }

    const inicio = dataInicio;
    const fim = dataFim || dataInicio;
    
    const diasDiferenca = differenceInDays(fim, inicio);
    if (diasDiferenca < 0) {
      toast({ title: "Intervalo inválido", description: "A data final deve ser após a data inicial.", variant: "destructive" });
      return;
    }
    if (diasDiferenca > 90) {
      toast({ title: "Intervalo muito grande", description: "Selecione um período de no máximo 90 dias.", variant: "destructive" });
      return;
    }

    setLoadingN8n(true);
    setPacientesN8n([]);
    setSelectedImport(new Set());

    const datasNoIntervalo = eachDayOfInterval({ start: inicio, end: fim });
    setProgressoBusca({ atual: 0, total: datasNoIntervalo.length });

    const { data: existentes } = await buscarTelefonesExistentes();
    
    let todosPacientes: PacienteN8n[] = [];
    let totalBuscados = 0;
    let totalJaExistem = 0;
    const telefonesVistos = new Set<string>();

    for (let i = 0; i < datasNoIntervalo.length; i++) {
      const data = datasNoIntervalo[i];
      setProgressoBusca({ atual: i + 1, total: datasNoIntervalo.length });

      const dataFormatada = format(data, 'yyyy-MM-dd');
      const { data: pacientes, error } = await buscarPacientesN8n(dataFormatada);

      if (error) {
        console.error(`Erro ao buscar ${dataFormatada}:`, error);
        continue;
      }

      if (pacientes && pacientes.length > 0) {
        totalBuscados += pacientes.length;
        
        const pacientesNovos = pacientes.filter(p => {
          const telefoneNorm = p.telefone.replace(/\D/g, '').slice(-8);
          const key = `${telefoneNorm}_${p.data_atendimento}`;
          
          if (existentes?.has(key)) {
            totalJaExistem++;
            return false;
          }
          
          if (telefonesVistos.has(telefoneNorm)) {
            return false;
          }
          
          telefonesVistos.add(telefoneNorm);
          return true;
        });

        todosPacientes = [...todosPacientes, ...pacientesNovos];
      }

      if (i < datasNoIntervalo.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    setPacientesN8n(todosPacientes);
    setProgressoBusca({ atual: 0, total: 0 });

    if (todosPacientes.length === 0 && totalBuscados === 0) {
      toast({ 
        title: "Nenhum paciente", 
        description: `Não há pacientes no período selecionado.`
      });
    } else if (todosPacientes.length === 0) {
      toast({ 
        title: "Todos já cadastrados", 
        description: `${totalJaExistem} paciente(s) já estão no banco de lembretes.`
      });
    } else {
      toast({
        title: "Pacientes carregados!",
        description: `${todosPacientes.length} novo(s) de ${totalBuscados} total (${totalJaExistem} já no banco).`,
      });
    }

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
        : renderizarTemplate(primeiroNome);
      ultimaMensagem = mensagem;

      // Calculate delay
      const delay = Math.floor(Math.random() * (intervaloMax - intervaloMin + 1) + intervaloMin);

      setEstadoEnvio('enviando');

      try {
        let resultado;
        
        // Send image first if present (with message as caption)
        if (imagemBase64) {
          resultado = await enviarImagemWhatsApp(lembrete.telefone, imagemBase64, mensagem);
        } else {
          resultado = await enviarMensagemWhatsApp(lembrete.telefone, mensagem);
        }
        
        if (resultado.success) {
          sucessos++;
          await marcarLembreteEnviado(lembrete.id);
          setEnviosSessao(prev => prev + 1);
          setEnviosDiarios(prev => prev + 1);
          
          // Save to database
          await supabase.from("mensagens_whatsapp").insert({
            telefone: lembrete.telefone,
            conteudo: mensagem,
            direcao: "OUT",
            tipo_mensagem: "lembrete",
            status_envio: "enviado",
          });
          
          setLogsEnvio(prev => [{
            timestamp: new Date(),
            telefone: lembrete.telefone,
            nome: lembrete.nome,
            delayAplicado: delay,
            mensagemGerada: mensagem,
            status: 'sucesso'
          }, ...prev]);
        } else {
          falhas++;
          setLogsEnvio(prev => [{
            timestamp: new Date(),
            telefone: lembrete.telefone,
            nome: lembrete.nome,
            delayAplicado: delay,
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
          delayAplicado: delay,
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
        const delayMs = delay * 1000;
        
        let tempoRestanteDelay = delayMs;
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
    carregarHistorico();

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

  const countLogsByStatus = () => {
    const sucesso = logsEnvio.filter(l => l.status === 'sucesso').length;
    const falha = logsEnvio.filter(l => l.status === 'falha').length;
    const bloqueado = logsEnvio.filter(l => l.status === 'bloqueado').length;
    return { sucesso, falha, bloqueado };
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

        {/* Visual Security Bar with Tooltips */}
        <TooltipProvider>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center cursor-help">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs text-muted-foreground">Sessão</span>
                  </div>
                  <span className={cn(
                    "text-lg font-bold",
                    enviosSessao >= LIMITE_SESSAO ? "text-red-600" : "text-emerald-600"
                  )}>
                    {enviosSessao}/{LIMITE_SESSAO}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Máximo de {LIMITE_SESSAO} mensagens por sessão</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center cursor-help">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CalendarIconLucide className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">Diário</span>
                  </div>
                  <span className={cn(
                    "text-lg font-bold",
                    enviosDiarios >= LIMITE_DIARIO ? "text-red-600" : "text-blue-600"
                  )}>
                    {enviosDiarios}/{LIMITE_DIARIO}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Máximo de {LIMITE_DIARIO} mensagens por dia</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center cursor-help">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-xs text-muted-foreground">Horário</span>
                  </div>
                  <span className={cn(
                    "text-lg font-bold",
                    isHorarioPermitido() ? "text-amber-600" : "text-red-600"
                  )}>
                    {modoEnvioSemRestricao ? "Livre" : `${horarioInicio}h-${horarioFim}h`}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {modoEnvioSemRestricao 
                    ? "Envios permitidos a qualquer horário" 
                    : `Envio permitido apenas entre ${horarioInicio}h e ${horarioFim}h`
                  }
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center cursor-help">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs text-muted-foreground">Status</span>
                  </div>
                  <Badge className={cn(
                    "text-xs",
                    isHorarioPermitido() && enviosSessao < LIMITE_SESSAO && enviosDiarios < LIMITE_DIARIO
                      ? "bg-emerald-500 hover:bg-emerald-600"
                      : "bg-red-500 hover:bg-red-600"
                  )}>
                    {isHorarioPermitido() && enviosSessao < LIMITE_SESSAO && enviosDiarios < LIMITE_DIARIO
                      ? "Ativo"
                      : "Bloqueado"
                    }
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sistema de envio {isHorarioPermitido() && enviosSessao < LIMITE_SESSAO && enviosDiarios < LIMITE_DIARIO ? "liberado" : "bloqueado"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="importar" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Importar Pacientes
            </TabsTrigger>
            <TabsTrigger value="pendentes" className="flex items-center gap-2">
              <CalendarIconLucide className="h-4 w-4" />
              Lembretes Pendentes ({lembretesPendentes.length})
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      {loadingDashboard ? (
                        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                      ) : (
                        <p className="text-2xl font-bold">{estatisticasGerais?.total || 0}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                      <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Enviados</p>
                      {loadingDashboard ? (
                        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                      ) : (
                        <>
                          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{estatisticasGerais?.enviados || 0}</p>
                          {estatisticasGerais && estatisticasGerais.total > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {((estatisticasGerais.enviados / estatisticasGerais.total) * 100).toFixed(1)}%
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pendentes</p>
                      {loadingDashboard ? (
                        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                      ) : (
                        <>
                          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{estatisticasGerais?.pendentes || 0}</p>
                          {estatisticasGerais && estatisticasGerais.total > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {((estatisticasGerais.pendentes / estatisticasGerais.total) * 100).toFixed(1)}%
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Vencidos</p>
                      {loadingDashboard ? (
                        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                      ) : (
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{estatisticasGerais?.vencidos || 0}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Chart */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Distribuição Mensal
                  </CardTitle>
                  <CardDescription>Lembretes por mês de vencimento</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={carregarDashboard} disabled={loadingDashboard}>
                  <RefreshCw className={cn("h-4 w-4", loadingDashboard && "animate-spin")} />
                </Button>
              </CardHeader>
              <CardContent>
                {loadingDashboard ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : estatisticasMensais.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={estatisticasMensais} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="mesFormatado" className="text-xs" />
                      <YAxis className="text-xs" />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend />
                      <Bar dataKey="pendentes" name="Pendentes" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="enviados" name="Enviados" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Monthly Detail Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalhamento por Mês</CardTitle>
                <CardDescription>Taxa de envio mensal de lembretes</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDashboard ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : estatisticasMensais.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mês</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Pendentes</TableHead>
                          <TableHead className="text-right">Enviados</TableHead>
                          <TableHead className="w-[200px]">Taxa de Envio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {estatisticasMensais.map((mes) => {
                          const taxaEnvio = mes.total > 0 ? (mes.enviados / mes.total) * 100 : 0;
                          return (
                            <TableRow key={mes.mes}>
                              <TableCell className="font-medium">{mes.mesFormatado}</TableCell>
                              <TableCell className="text-right">{mes.total}</TableCell>
                              <TableCell className="text-right">
                                <span className="text-amber-600 dark:text-amber-400">{mes.pendentes}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-emerald-600 dark:text-emerald-400">{mes.enviados}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={taxaEnvio} className="h-2 flex-1" />
                                  <span className="text-sm text-muted-foreground w-12 text-right">
                                    {taxaEnvio.toFixed(0)}%
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="importar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-primary" />
                  Importar do Sistema SaudeViaNet
                </CardTitle>
                <CardDescription>
                  Selecione um período para buscar pacientes em lote e salvar no banco de lembretes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <Popover open={calendarInicioOpen} onOpenChange={setCalendarInicioOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Data início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={(date) => { setDataInicio(date); setCalendarInicioOpen(false); }}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  <ArrowRight className="h-4 w-4 text-muted-foreground" />

                  <Popover open={calendarFimOpen} onOpenChange={setCalendarFimOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dataFim && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataFim ? format(dataFim, "dd/MM/yyyy") : "Data fim (opcional)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataFim}
                        onSelect={(date) => { setDataFim(date); setCalendarFimOpen(false); }}
                        disabled={(date) => date > new Date() || (dataInicio && date < dataInicio)}
                        initialFocus
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  <Button onClick={buscarPacientes} disabled={loadingN8n || !dataInicio}>
                    {loadingN8n ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    {loadingN8n ? `Buscando... ${progressoBusca.atual}/${progressoBusca.total}` : "Buscar Pacientes"}
                  </Button>
                </div>

                {loadingN8n && progressoBusca.total > 0 && (
                  <div className="space-y-2">
                    <Progress value={(progressoBusca.atual / progressoBusca.total) * 100} />
                    <p className="text-sm text-muted-foreground text-center">
                      Buscando dia {progressoBusca.atual} de {progressoBusca.total}...
                    </p>
                  </div>
                )}

                {dataInicio && (
                  <Alert>
                    <CalendarRange className="h-4 w-4" />
                    <AlertDescription>
                      {dataFim && dataFim !== dataInicio 
                        ? `Período: ${format(dataInicio, 'dd/MM/yyyy')} até ${format(dataFim, 'dd/MM/yyyy')} (${differenceInDays(dataFim, dataInicio) + 1} dias)`
                        : `Data única: ${format(dataInicio, 'dd/MM/yyyy')}`
                      }
                    </AlertDescription>
                  </Alert>
                )}

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
                      onChange={(e) => setFiltroLembrete(e.target.value)}
                      className="text-sm border rounded-md px-2 py-1 bg-background min-w-[180px]"
                    >
                      <optgroup label="Por Status">
                        <option value="vencidos">Vencidos {estatisticasGerais?.vencidos ? `(${estatisticasGerais.vencidos})` : ''}</option>
                        <option value="semana">Esta semana</option>
                        <option value="mes">Próximo mês</option>
                        <option value="todos">Todos pendentes {estatisticasGerais?.pendentes ? `(${estatisticasGerais.pendentes})` : ''}</option>
                      </optgroup>
                      <optgroup label="Por Mês Específico">
                        {(() => {
                          const hoje = new Date();
                          const meses = [];
                          for (let i = -2; i <= 12; i++) {
                            const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
                            const mesKey = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                            const valor = `mes_${mesKey}`;
                            const label = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                            const estatMes = estatisticasMensais.find(e => e.mes === mesKey);
                            const countLabel = estatMes?.pendentes ? ` (${estatMes.pendentes})` : '';
                            meses.push(
                              <option key={valor} value={valor}>
                                {label.charAt(0).toUpperCase() + label.slice(1)}{countLabel}
                              </option>
                            );
                          }
                          return meses;
                        })()}
                      </optgroup>
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

            {/* Template Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  Modelo da Mensagem
                </CardTitle>
                <CardDescription>Personalize a mensagem de lembrete anual</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Template (use {"{{nome}}"} para o nome do paciente)</Label>
                    <Textarea
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap h-[280px] overflow-auto">
                      {renderizarTemplate("Maria")}
                    </div>
                  </div>
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <Label>Imagem (opcional)</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImagemChange}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Selecionar Imagem
                    </Button>
                    {imagemPreview && (
                      <div className="flex items-center gap-2">
                        <img src={imagemPreview} alt="Preview" className="h-12 w-12 object-cover rounded" />
                        <span className="text-sm text-muted-foreground">{imagemNome}</span>
                        <Button variant="ghost" size="sm" onClick={removerImagem}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">A imagem será enviada antes da mensagem de texto (máx. 5MB)</p>
                </div>
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
                          Configurações Avançadas de Envio
                        </span>
                        {configAvancadaAberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-6">
                      {/* Intervalos */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Intervalos Aleatórios
                        </h4>
                        <p className="text-xs text-muted-foreground">Define o tempo aleatório entre cada mensagem</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Mínimo (segundos)</Label>
                            <Input
                              type="number"
                              value={intervaloMin}
                              onChange={(e) => setIntervaloMin(Number(e.target.value))}
                              min={30}
                              max={300}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Máximo (segundos)</Label>
                            <Input
                              type="number"
                              value={intervaloMax}
                              onChange={(e) => setIntervaloMax(Number(e.target.value))}
                              min={30}
                              max={300}
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Pausas */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Coffee className="h-4 w-4 text-muted-foreground" />
                          Pausas Estratégicas
                        </h4>
                        <p className="text-xs text-muted-foreground">Pausa após X mensagens para simular comportamento humano</p>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Pausar após</Label>
                            <Input
                              type="number"
                              value={pausarAposEnvios}
                              onChange={(e) => setPausarAposEnvios(Number(e.target.value))}
                              min={5}
                              max={20}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Pausa mín. (min)</Label>
                            <Input
                              type="number"
                              value={pausaMinMin}
                              onChange={(e) => setPausaMinMin(Number(e.target.value))}
                              min={1}
                              max={30}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Pausa máx. (min)</Label>
                            <Input
                              type="number"
                              value={pausaMaxMin}
                              onChange={(e) => setPausaMaxMin(Number(e.target.value))}
                              min={1}
                              max={30}
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Variação de Texto */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <Shuffle className="h-4 w-4 text-muted-foreground" />
                              Variação Automática de Texto
                            </h4>
                            <p className="text-xs text-muted-foreground">Gera mensagens únicas para evitar detecção de spam</p>
                          </div>
                          <Switch checked={variacaoTextoAtiva} onCheckedChange={setVariacaoTextoAtiva} />
                        </div>
                        
                        {variacaoTextoAtiva && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Preview de mensagem variada</Label>
                              <Button variant="ghost" size="sm" onClick={gerarNovaMensagemPreview} className="gap-1">
                                <Shuffle className="h-3 w-3" />
                                Gerar novo exemplo
                              </Button>
                            </div>
                            <div className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-wrap border">
                              {mensagemPreviewVariada}
                            </div>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Configuração de Horário de Envio */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              Restrição de Horário de Envio
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {modoEnvioSemRestricao 
                                ? "⚡ Modo livre: Envios permitidos a qualquer horário (use com cautela)"
                                : `Envios apenas entre ${horarioInicio}h e ${horarioFim}h`
                              }
                            </p>
                          </div>
                          <Switch 
                            checked={!modoEnvioSemRestricao} 
                            onCheckedChange={(checked) => setModoEnvioSemRestricao(!checked)} 
                          />
                        </div>
                        
                        {!modoEnvioSemRestricao && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Início (hora)</Label>
                              <Input
                                type="number"
                                value={horarioInicio}
                                onChange={(e) => setHorarioInicio(Math.max(0, Math.min(horarioFim - 1, Number(e.target.value))))}
                                min={0}
                                max={horarioFim - 1}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Fim (hora)</Label>
                              <Input
                                type="number"
                                value={horarioFim}
                                onChange={(e) => setHorarioFim(Math.max(horarioInicio + 1, Math.min(24, Number(e.target.value))))}
                                min={horarioInicio + 1}
                                max={24}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Progress */}
                  {enviandoLote && (
                    <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm font-medium">
                          {estadoEnvio === 'enviando' && 'Enviando mensagem...'}
                          {estadoEnvio === 'aguardando_intervalo' && 'Aguardando intervalo...'}
                          {estadoEnvio === 'pausa_seguranca' && 'Pausa de segurança...'}
                          {estadoEnvio === 'interrompido_limite' && 'Limite atingido'}
                        </span>
                      </div>
                      <Progress value={(progressoLote.enviados / progressoLote.total) * 100} />
                      <div className="flex items-center justify-between text-sm">
                        <span>{progressoLote.enviados}/{progressoLote.total}</span>
                        <span className="text-emerald-600">✓ {progressoLote.sucesso}</span>
                        <span className="text-red-600">✗ {progressoLote.falha}</span>
                      </div>
                      {estadoEnvio === 'aguardando_intervalo' && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 animate-pulse" />
                          Próximo envio em: {tempoRestante}s
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
                </CardContent>
              </Card>
            )}

            {/* Session Logs Card */}
            {logsEnvio.length > 0 && (
              <Card className="border-blue-500/30">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="h-5 w-5 text-blue-600" />
                      Logs de Envio da Sessão
                    </CardTitle>
                    <CardDescription>{logsEnvio.length} mensagem(s) nesta sessão</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setLogsEnvio([])}>
                    Limpar logs
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {logsEnvio.map((log, idx) => (
                        <Collapsible key={idx} open={logExpandido === idx} onOpenChange={() => setLogExpandido(logExpandido === idx ? null : idx)}>
                          <div className={cn(
                            "p-3 rounded-lg",
                            log.status === 'sucesso' ? "bg-emerald-500/5 border border-emerald-500/20" : 
                            log.status === 'falha' ? "bg-red-500/5 border border-red-500/20" :
                            "bg-amber-500/5 border border-amber-500/20"
                          )}>
                            <div className="flex items-center gap-2">
                              {log.status === 'sucesso' ? (
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                              ) : log.status === 'falha' ? (
                                <XCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                              )}
                              <span className="font-medium text-sm">{log.nome}</span>
                              <Badge variant="outline" className="text-xs">{log.telefone}</Badge>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {log.delayAplicado}s
                              </div>
                              <span className="text-xs text-muted-foreground ml-auto">{format(log.timestamp, 'HH:mm:ss')}</span>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            {log.motivo && <p className="text-xs text-red-600 mt-1 ml-6">{log.motivo}</p>}
                            <CollapsibleContent>
                              <div className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap">
                                {log.mensagemGerada}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Summary */}
                  <div className="pt-4 border-t flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle className="h-4 w-4" />
                      {countLogsByStatus().sucesso} sucesso
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-4 w-4" />
                      {countLogsByStatus().falha} falha
                    </span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      {countLogsByStatus().bloqueado} bloqueado
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* History from Database Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Histórico de Lembretes Enviados
                  </CardTitle>
                  <CardDescription>Últimas 50 mensagens de lembrete enviadas</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={carregarHistorico} disabled={loadingHistorico}>
                  <RefreshCw className={cn("h-4 w-4", loadingHistorico && "animate-spin")} />
                </Button>
              </CardHeader>
              <CardContent>
                {loadingHistorico ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : historico.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum lembrete enviado ainda
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {historico.map((item) => (
                        <div key={item.id} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {item.telefone}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </div>
                          <div className="text-sm bg-muted p-2 rounded whitespace-pre-wrap line-clamp-3">
                            {item.conteudo}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Lembretes;
