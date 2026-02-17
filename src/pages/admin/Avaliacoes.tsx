import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { supabase } from "@/integrations/supabase/client";
import { enviarMensagemWhatsApp, enviarImagemWhatsApp } from "@/services/integracoes";
import { Star, Send, RefreshCw, Search, Loader2, MessageCircle, CheckCircle, ImagePlus, X, Zap, CalendarIcon, Users, Pause, Play, XCircle, Phone, Shield, Settings2, Clock, AlertTriangle, Coffee, Shuffle, Pencil, Trash2, Check, Wifi, WifiOff } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EvolutionStatusBadge } from "@/components/admin/EvolutionStatusBadge";
import { useEvolutionStatus } from "@/hooks/useEvolutionStatus";
import { useEnvioLoteConfig, LIMITE_SESSAO, LIMITE_DIARIO } from "@/hooks/useEnvioLoteConfig";

interface PacienteAtendido {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string;
  data_agendamento: string;
  hora_agendamento: string;
  local_atendimento: string;
  avaliacaoEnviada?: boolean;
}

interface HistoricoAvaliacao {
  id: string;
  telefone: string;
  conteudo: string;
  created_at: string;
  agendamentos: { nome_completo: string } | null;
}

interface PacienteN8n {
  id: string;
  nome: string;
  primeiro_nome: string;
  telefone: string;
  telefone_formatado: string;
  data_atendimento: string;
  data_atendimento_formatada: string;
  whatsappVerificado?: 'pendente' | 'valido' | 'invalido';
}

interface LogEnvio {
  timestamp: Date;
  telefone: string;
  nome: string;
  delayAplicado: number;
  mensagemGerada: string;
  status: 'sucesso' | 'falha' | 'bloqueado' | 'conexao_perdida';
  motivo?: string;
}

type EstadoEnvio = 'idle' | 'enviando' | 'aguardando_intervalo' | 'pausa_seguranca' | 'interrompido_limite' | 'conexao_perdida';

// ===== SISTEMA DE VARIAÇÃO DE MENSAGENS =====
const SAUDACOES = [
  "Olá", "Oi", "Olá 😊", "Oi 👋", "Olá!", "Oi!", "E aí"
];

const BLOCOS_ABERTURA = [
  "Foi um prazer atendê-lo(a).",
  "Agradeço por ter nos escolhido.",
  "Espero que esteja tudo bem com você.",
  "Foi muito bom ter você conosco.",
  "Obrigado pela confiança no nosso trabalho.",
  "Esperamos que tenha gostado do atendimento."
];

const BLOCOS_EXPLICATIVOS = [
  "Sua opinião é muito importante para continuarmos oferecendo um atendimento de qualidade.",
  "Sua avaliação nos ajuda a melhorar cada vez mais.",
  "Gostaria de saber como foi sua experiência conosco.",
  "Seu feedback é essencial para nossa melhoria contínua.",
  "Sua avaliação faz toda diferença para nós.",
  "Queremos saber se você ficou satisfeito(a) com nosso serviço."
];

const CTAS = [
  "Se puder, deixe sua avaliação clicando no link abaixo:",
  "Ficaria muito grato se pudesse nos avaliar:",
  "Pode nos deixar sua avaliação aqui:",
  "Compartilhe sua experiência conosco:",
  "Deixe sua opinião no link:",
  "Avalie nosso atendimento:"
];

const EMOJIS_OPCIONAIS = ["💙", "🙏", "✨", "❤️", "👨‍⚕️", "⭐", ""];

const TEMPLATE_PADRAO = `Olá, {{nome}}! 👋

Foi um prazer atendê-lo(a). Sua opinião é muito importante para continuarmos oferecendo um atendimento de qualidade e em constante melhoria.

Se puder, deixe sua avaliação clicando no link abaixo:
👉 https://g.page/r/CTkTpXB1m13mEBM/review

Agradeço desde já pela confiança. 💙
Dr. Juliano Machado
Oftalmologia`;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// ===== VALIDAÇÃO DE TELEFONE BRASILEIRO =====
const dddsValidos = [
  11, 12, 13, 14, 15, 16, 17, 18, 19, // SP
  21, 22, 24, // RJ
  27, 28, // ES
  31, 32, 33, 34, 35, 37, 38, // MG
  41, 42, 43, 44, 45, 46, // PR
  47, 48, 49, // SC
  51, 53, 54, 55, // RS
  61, // DF
  62, 64, // GO
  63, // TO
  65, 66, // MT
  67, // MS
  68, // AC
  69, // RO
  71, 73, 74, 75, 77, // BA
  79, // SE
  81, 82, 83, 84, 85, 86, 87, 88, 89, // NE
  91, 92, 93, 94, 95, 96, 97, 98, 99 // Norte
];

// Função para autocorrigir telefone (adiciona 9 se faltando)
const autocorrigirTelefone = (telefone: string): { corrigido: string; foiCorrigido: boolean; formatado: string } => {
  let numeros = telefone.replace(/\D/g, '');
  let foiCorrigido = false;
  
  // Remove 55 do início se presente (código do Brasil)
  if (numeros.startsWith('55') && numeros.length >= 12) {
    numeros = numeros.slice(2);
  }
  
  // Se tem 10 dígitos (DDD + 8 dígitos), adiciona o 9
  if (numeros.length === 10) {
    const ddd = numeros.slice(0, 2);
    const numero = numeros.slice(2);
    // Adiciona 9 após o DDD (padrão para celulares)
    numeros = ddd + '9' + numero;
    foiCorrigido = true;
  }
  
  // Formata o número para exibição
  let formatado = numeros;
  if (numeros.length === 11) {
    formatado = `+55 (${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  } else if (numeros.length === 10) {
    formatado = `+55 (${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }
  
  return { corrigido: numeros, foiCorrigido, formatado };
};

const validarTelefoneBrasileiro = (telefone: string): { valido: boolean; erro?: string; podeCorrigir?: boolean } => {
  let numeros = telefone.replace(/\D/g, '');
  
  // Remove 55 do início se presente
  if (numeros.startsWith('55') && numeros.length >= 12) {
    numeros = numeros.slice(2);
  }
  
  // Se tem 10 dígitos, pode ser corrigido adicionando o 9
  if (numeros.length === 10) {
    const ddd = parseInt(numeros.slice(0, 2));
    if (dddsValidos.includes(ddd)) {
      return { 
        valido: false, 
        erro: 'Falta o dígito 9 após o DDD. Clique para corrigir.',
        podeCorrigir: true
      };
    }
  }
  
  // Deve ter 10 ou 11 dígitos
  if (numeros.length < 10 || numeros.length > 11) {
    return { 
      valido: false, 
      erro: `Telefone deve ter 10 ou 11 dígitos. Atual: ${numeros.length} dígitos.` 
    };
  }
  
  // Extrair DDD (2 primeiros dígitos)
  const ddd = parseInt(numeros.slice(0, 2));
  
  if (!dddsValidos.includes(ddd)) {
    return { 
      valido: false, 
      erro: `DDD ${ddd} não é válido.` 
    };
  }
  
  // Se tem 11 dígitos, deve começar com 9 (celular)
  if (numeros.length === 11) {
    const primeiroDigitoNumero = numeros[2];
    if (primeiroDigitoNumero !== '9') {
      return { 
        valido: false, 
        erro: 'Celular deve começar com 9 após o DDD.' 
      };
    }
  }
  
  return { valido: true };
};

// Função para gerar mensagem variada
const gerarMensagemVariada = (nome: string, ultimaMensagem?: string): string => {
  let mensagem = '';
  let tentativas = 0;
  
  do {
    const saudacao = SAUDACOES[Math.floor(Math.random() * SAUDACOES.length)];
    const abertura = BLOCOS_ABERTURA[Math.floor(Math.random() * BLOCOS_ABERTURA.length)];
    const explicativo = BLOCOS_EXPLICATIVOS[Math.floor(Math.random() * BLOCOS_EXPLICATIVOS.length)];
    const cta = CTAS[Math.floor(Math.random() * CTAS.length)];
    
    // 0-2 emojis opcionais
    const qtdEmojis = Math.floor(Math.random() * 3);
    const emojisSet = new Set<string>();
    while (emojisSet.size < qtdEmojis) {
      const emoji = EMOJIS_OPCIONAIS[Math.floor(Math.random() * EMOJIS_OPCIONAIS.length)];
      if (emoji) emojisSet.add(emoji);
    }
    const emojis = Array.from(emojisSet).join(' ');
    
    mensagem = `${saudacao}, ${nome}!

${abertura} ${explicativo}

${cta}
👉 https://g.page/r/CTkTpXB1m13mEBM/review

Agradeço desde já pela confiança.${emojis ? ` ${emojis}` : ''}
Dr. Juliano Machado
Oftalmologia`;
    
    tentativas++;
  } while (mensagem === ultimaMensagem && tentativas < 10);
  
  return mensagem;
};

const Avaliacoes = () => {
  // Hook para status da conexão Evolution API
  const { status: evolutionStatus, loading: evolutionLoading, reconectar, refresh: refreshEvolution } = useEvolutionStatus(true, 30000);
  const isWhatsAppConnected = evolutionStatus?.connected ?? false;
  
  const [template, setTemplate] = useState(TEMPLATE_PADRAO);
  const [nomeAvulso, setNomeAvulso] = useState("");
  const [telefoneAvulso, setTelefoneAvulso] = useState("");
  const [enviandoAvulso, setEnviandoAvulso] = useState(false);
  const [pacientes, setPacientes] = useState<PacienteAtendido[]>([]);
  const [loadingPacientes, setLoadingPacientes] = useState(true);
  const [busca, setBusca] = useState("");
  const [enviandoIds, setEnviandoIds] = useState<Set<string>>(new Set());
  const [avaliacoesEnviadas, setAvaliacoesEnviadas] = useState<Set<string>>(new Set());
  const [historico, setHistorico] = useState<HistoricoAvaliacao[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  
  // Image state
  const [imagemBase64, setImagemBase64] = useState<string | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemNome, setImagemNome] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para Disparo em Lote (n8n)
  const [dataFiltro, setDataFiltro] = useState<Date | undefined>(undefined);
  const [pacientesLote, setPacientesLote] = useState<PacienteN8n[]>([]);
  const [loadingLote, setLoadingLote] = useState(false);
  const [erroLote, setErroLote] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [pausado, setPausado] = useState(false);
  const pausadoRef = useRef(false);
  const canceladoRef = useRef(false);
  const [progressoLote, setProgressoLote] = useState({ enviados: 0, total: 0, sucesso: 0, falha: 0 });
  const [telefonesDiarioJaEnviados, setTelefonesDiarioJaEnviados] = useState<Set<string>>(new Set());
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Estados para edição de telefone na lista
  const [editandoTelefone, setEditandoTelefone] = useState<string | null>(null);
  const [telefoneEditado, setTelefoneEditado] = useState("");
  
  // Estado para confirmação de exclusão
  const [pacienteParaExcluir, setPacienteParaExcluir] = useState<PacienteN8n | null>(null);

  // Estados para verificação WhatsApp
  const [verificandoWhatsApp, setVerificandoWhatsApp] = useState(false);
  const [verificacaoConcluida, setVerificacaoConcluida] = useState(false);

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
  const [mensagemPreviewVariada, setMensagemPreviewVariada] = useState(() => gerarMensagemVariada("Maria"));
  
  // Tracking de limites
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvio>('idle');
  const [enviosSessao, setEnviosSessao] = useState(0);
  const [enviosDiarios, setEnviosDiarios] = useState(0);
  const [logsEnvio, setLogsEnvio] = useState<LogEnvio[]>([]);
  
  // Contagem regressiva visual
  const [tempoRestante, setTempoRestante] = useState(0);
  const [pausaRestante, setPausaRestante] = useState(0);

  // Wrapper para validar limites usando contadores locais
  const validarLimitesEnvio = () => validarLimitesEnvioHook(enviosSessao, enviosDiarios);

  // Função para tocar som de notificação
  const tocarNotificacao = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQQAPlrT6NtqFgA0o+bWcQwAbMzV3YccADWi5ONvGQA0o+bWcQwAbMzV3YccAA==');
    audio.play().catch(() => {});
  };

  // Carregar limites diários do localStorage
  useEffect(() => {
    const hoje = new Date().toISOString().split('T')[0];
    const dados = localStorage.getItem('avaliacoes_limites_diarios');
    if (dados) {
      const parsed = JSON.parse(dados);
      if (parsed.data === hoje) {
        setEnviosDiarios(parsed.enviados);
      } else {
        // Reset para novo dia
        localStorage.setItem('avaliacoes_limites_diarios', JSON.stringify({ data: hoje, enviados: 0 }));
      }
    }
  }, []);

  // Persistir limites diários
  useEffect(() => {
    const hoje = new Date().toISOString().split('T')[0];
    localStorage.setItem('avaliacoes_limites_diarios', JSON.stringify({
      data: hoje,
      enviados: enviosDiarios
    }));
  }, [enviosDiarios]);

  useEffect(() => {
    carregarPacientesAtendidos();
    carregarAvaliacoesEnviadas();
    carregarHistoricoAvaliacoes();
  }, []);

  // Atualizar preview de mensagem variada
  const gerarNovoPreview = () => {
    setMensagemPreviewVariada(gerarMensagemVariada("Maria", mensagemPreviewVariada));
  };

  // Funções para gerenciar lista de pacientes do lote
  const confirmarRemocaoPaciente = () => {
    if (pacienteParaExcluir) {
      setPacientesLote(prev => prev.filter(p => p.id !== pacienteParaExcluir.id));
      setSelectedIds(prev => {
        const updated = new Set(prev);
        updated.delete(pacienteParaExcluir.id);
        return updated;
      });
      if (editandoTelefone === pacienteParaExcluir.id) {
        setEditandoTelefone(null);
        setTelefoneEditado("");
      }
      setPacienteParaExcluir(null);
    }
  };

  const abrirDialogExclusao = (paciente: PacienteN8n) => {
    setPacienteParaExcluir(paciente);
  };

  const iniciarEdicaoTelefone = (paciente: PacienteN8n) => {
    setEditandoTelefone(paciente.id);
    setTelefoneEditado(paciente.telefone_formatado);
  };

  const salvarTelefoneEditado = (id: string) => {
    const telefoneNumeros = telefoneEditado.replace(/\D/g, '');
    setPacientesLote(prev => prev.map(p => 
      p.id === id 
        ? { ...p, telefone: telefoneNumeros, telefone_formatado: telefoneEditado }
        : p
    ));
    setEditandoTelefone(null);
    setTelefoneEditado("");
  };

  const cancelarEdicaoTelefone = () => {
    setEditandoTelefone(null);
    setTelefoneEditado("");
  };

  // Autocorrigir telefone de um paciente específico
  const autocorrigirTelefonePaciente = (id: string) => {
    setPacientesLote(prev => prev.map(p => {
      if (p.id === id) {
        const { corrigido, formatado } = autocorrigirTelefone(p.telefone);
        return { ...p, telefone: corrigido, telefone_formatado: formatado };
      }
      return p;
    }));
  };

  // Autocorrigir todos os telefones inválidos da lista
  const autocorrigirTodosTelefones = () => {
    let corrigidos = 0;
    setPacientesLote(prev => prev.map(p => {
      const validacao = validarTelefoneBrasileiro(p.telefone);
      if (!validacao.valido && validacao.podeCorrigir) {
        const { corrigido, formatado } = autocorrigirTelefone(p.telefone);
        corrigidos++;
        return { ...p, telefone: corrigido, telefone_formatado: formatado };
      }
      return p;
    }));
    
    if (corrigidos > 0) {
      toast({
        title: "Telefones corrigidos!",
        description: `${corrigidos} telefone(s) tiveram o dígito 9 adicionado automaticamente.`,
      });
    } else {
      toast({
        title: "Nenhuma correção necessária",
        description: "Todos os telefones já estão no formato correto.",
      });
    }
  };

  // Verificar números via Evolution API
  const verificarNumerosWhatsApp = async () => {
    if (pacientesLote.length === 0) return;
    
    setVerificandoWhatsApp(true);
    setVerificacaoConcluida(false);
    
    // Marcar todos como pendentes
    setPacientesLote(prev => prev.map(p => ({ ...p, whatsappVerificado: 'pendente' as const })));
    
    try {
      // Pegar telefones únicos formatados (deduplicar antes de enviar)
      const telefonesSet = new Set<string>();
      pacientesLote.forEach(p => {
        let numeros = p.telefone.replace(/\D/g, '');
        if (!numeros.startsWith('55')) numeros = '55' + numeros;
        telefonesSet.add(numeros);
      });
      const telefones = Array.from(telefonesSet);
      
      console.log(`Verificando ${telefones.length} telefones únicos (de ${pacientesLote.length} pacientes)`);
      
      // Dividir em lotes de 50
      const BATCH_SIZE = 50;
      const batches = [];
      for (let i = 0; i < telefones.length; i += BATCH_SIZE) {
        batches.push(telefones.slice(i, i + BATCH_SIZE));
      }
      
      const allResults: { telefone: string; telefoneFormatado: string; existeWhatsApp: boolean; fromCache?: boolean }[] = [];
      
      for (const batch of batches) {
        const { data, error } = await supabase.functions.invoke('verificar-numeros-whatsapp', {
          body: { telefones: batch }
        });
        
        // Check for connection error in data OR error response
        const isConnectionErr = data?.isConnectionError || 
          (error && typeof error === 'object' && 'context' in error);
        
        // For 503 responses, Supabase may put the body in error.context or data
        let errorData = data;
        if (error && typeof error === 'object') {
          try {
            // Try to get the response body from error context
            const errorObj = error as { context?: { body?: string }; message?: string };
            if (errorObj.context?.body) {
              errorData = JSON.parse(errorObj.context.body);
            } else if (errorObj.message) {
              // Sometimes the error message contains the JSON
              const match = errorObj.message.match(/\{.*\}/);
              if (match) {
                errorData = JSON.parse(match[0]);
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
        
        // Check for connection error
        if (errorData?.isConnectionError) {
          toast({
            title: "WhatsApp Desconectado",
            description: "Reconecte o WhatsApp nas configurações antes de verificar números.",
            variant: "destructive",
          });
          // Reset status - DO NOT mark as invalid
          setPacientesLote(prev => prev.map(p => ({ ...p, whatsappVerificado: undefined })));
          setVerificandoWhatsApp(false);
          return;
        }
        
        if (error && !errorData?.resultados) {
          throw error;
        }
        
        if (errorData?.resultados || data?.resultados) {
          allResults.push(...(errorData?.resultados || data?.resultados));
        }
      }
      
      // Atualizar status dos pacientes
      setPacientesLote(prev => prev.map(p => {
        let telefoneNormalizado = p.telefone.replace(/\D/g, '');
        if (!telefoneNormalizado.startsWith('55')) telefoneNormalizado = '55' + telefoneNormalizado;
        
        const resultado = allResults.find(r => r.telefoneFormatado === telefoneNormalizado);
        
        return {
          ...p,
          whatsappVerificado: resultado?.existeWhatsApp ? 'valido' as const : 'invalido' as const
        };
      }));
      
      setVerificacaoConcluida(true);
      
      const validos = allResults.filter(r => r.existeWhatsApp).length;
      const invalidos = allResults.filter(r => !r.existeWhatsApp).length;
      const doCache = allResults.filter(r => r.fromCache).length;
      
      toast({
        title: "Verificação concluída!",
        description: doCache > 0 
          ? `${validos} válido(s), ${invalidos} inválido(s). ${doCache} do cache.`
          : `${validos} número(s) válido(s), ${invalidos} não encontrado(s) no WhatsApp.`,
      });
      
    } catch (error) {
      console.error("Erro ao verificar números:", error);
      toast({
        title: "Erro na verificação",
        description: "Não foi possível verificar os números. Tente novamente.",
        variant: "destructive",
      });
      // Reset status
      setPacientesLote(prev => prev.map(p => ({ ...p, whatsappVerificado: undefined })));
    } finally {
      setVerificandoWhatsApp(false);
    }
  };

  // Filtrar números inválidos (remover da lista)
  const removerNumerosInvalidos = () => {
    const invalidos = pacientesLote.filter(p => p.whatsappVerificado === 'invalido');
    if (invalidos.length === 0) {
      toast({
        title: "Nenhum número inválido",
        description: "Todos os números verificados são válidos.",
      });
      return;
    }
    
    setPacientesLote(prev => prev.filter(p => p.whatsappVerificado !== 'invalido'));
    setSelectedIds(prev => {
      const updated = new Set(prev);
      invalidos.forEach(p => updated.delete(p.id));
      return updated;
    });
    
    toast({
      title: "Números removidos!",
      description: `${invalidos.length} número(s) sem WhatsApp foram removidos da lista.`,
    });
  };

  // Contar telefones inválidos que podem ser corrigidos
  const contarTelefonesCorrigiveis = () => {
    return pacientesLote.filter(p => {
      const v = validarTelefoneBrasileiro(p.telefone);
      return !v.valido && v.podeCorrigir;
    }).length;
  };

  // Contar números verificados por status
  const contarNumerosVerificados = () => {
    const validos = pacientesLote.filter(p => p.whatsappVerificado === 'valido').length;
    const invalidos = pacientesLote.filter(p => p.whatsappVerificado === 'invalido').length;
    const pendentes = pacientesLote.filter(p => !p.whatsappVerificado || p.whatsappVerificado === 'pendente').length;
    return { validos, invalidos, pendentes };
  };

  const carregarPacientesAtendidos = async () => {
    setLoadingPacientes(true);
    try {
      const hoje = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, nome_completo, telefone_whatsapp, data_agendamento, hora_agendamento, local_atendimento")
        .lt("data_agendamento", hoje)
        .not("data_agendamento", "is", null)
        .order("data_agendamento", { ascending: false })
        .limit(50);

      if (error) throw error;
      setPacientes(data || []);
    } catch (error) {
      console.error("Erro ao carregar pacientes:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os pacientes atendidos.",
        variant: "destructive",
      });
    } finally {
      setLoadingPacientes(false);
    }
  };

  const carregarAvaliacoesEnviadas = async () => {
    try {
      const { data, error } = await supabase
        .from("mensagens_whatsapp")
        .select("agendamento_id")
        .eq("tipo_mensagem", "avaliacao")
        .not("agendamento_id", "is", null);

      if (error) throw error;
      const ids = new Set(data?.map(m => m.agendamento_id).filter(Boolean) as string[]);
      setAvaliacoesEnviadas(ids);
    } catch (error) {
      console.error("Erro ao carregar avaliações enviadas:", error);
    }
  };

  const carregarHistoricoAvaliacoes = async () => {
    setLoadingHistorico(true);
    try {
      const { data, error } = await supabase
        .from("mensagens_whatsapp")
        .select(`
          id,
          telefone,
          conteudo,
          created_at,
          agendamentos (nome_completo)
        `)
        .eq("tipo_mensagem", "avaliacao")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistorico((data as HistoricoAvaliacao[]) || []);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // ===== Funções para Disparo em Lote (SaúdeViaNet) =====

  const buscarPacientesN8n = async () => {
    if (!dataFiltro) {
      toast({
        title: "Selecione uma data",
        description: "Escolha a data de atendimento para buscar os pacientes.",
        variant: "destructive",
      });
      return;
    }

    setLoadingLote(true);
    setErroLote(null);
    setPacientesLote([]);
    setSelectedIds(new Set());
    setTelefonesDiarioJaEnviados(new Set());
    setVerificacaoConcluida(false);

    const dataFormatada = format(dataFiltro, 'yyyy-MM-dd');

    try {
      // Busca pacientes via Edge Function (que consulta SaúdeViaNet API)
      const { data: responseData, error: invokeError } = await supabase.functions.invoke(
        'buscar-pacientes-saudevianet',
        { body: { data_atendimento: dataFormatada } }
      );

      if (invokeError) {
        throw new Error(`Erro ao chamar SaúdeViaNet: ${invokeError.message}`);
      }

      if (!responseData?.sucesso) {
        throw new Error(responseData?.erro || "Falha ao buscar pacientes do SaúdeViaNet");
      }

      const pacientesN8n: PacienteN8n[] = responseData.pacientes || [];
      const totalN8n = pacientesN8n.length;

      if (totalN8n === 0) {
        setPacientesLote([]);
        toast({
          title: "Nenhum paciente encontrado",
          description: `Não há pacientes com telefone em ${format(dataFiltro, 'dd/MM/yyyy')}.`,
        });
        return;
      }

      // Filtrar pacientes que já receberam avaliação
      const { data: mensagensEnviadas } = await supabase
        .from("mensagens_whatsapp")
        .select("telefone")
        .eq("tipo_mensagem", "avaliacao");

      const telefonesJaEnviados = new Set(
        (mensagensEnviadas || []).map(m => m.telefone.replace(/\D/g, '').slice(-8))
      );

      const pacientesPendentes = pacientesN8n.filter(p => {
        const telefoneNormalizado = p.telefone.replace(/\D/g, '').slice(-8);
        return !telefonesJaEnviados.has(telefoneNormalizado);
      });

      setPacientesLote(pacientesPendentes);

      const jaEnviados = totalN8n - pacientesPendentes.length;

      if (pacientesPendentes.length === 0) {
        toast({
          title: "Todos já receberam avaliação",
          description: `${jaEnviados} paciente(s) de ${format(dataFiltro, 'dd/MM/yyyy')} já receberam mensagem.`,
        });
      } else {
        toast({
          title: "Pacientes carregados!",
          description: `${pacientesPendentes.length} pendente(s) de ${totalN8n} total (${jaEnviados} já enviado${jaEnviados !== 1 ? 's' : ''}).`,
        });
      }
    } catch (error: any) {
      console.error("Erro ao buscar pacientes:", error);
      setErroLote(error.message || "Erro ao buscar pacientes");
      toast({
        title: "Erro ao buscar pacientes",
        description: error.message || "Não foi possível buscar os pacientes.",
        variant: "destructive",
      });
    } finally {
      setLoadingLote(false);
    }
  };

  // ===== FUNÇÃO DE ENVIO EM LOTE APRIMORADA =====
  const enviarEmLote = async () => {
    const pacientesSelecionados = pacientesLote.filter(p => selectedIds.has(p.id));

    if (pacientesSelecionados.length === 0) {
      toast({
        title: "Nenhum paciente selecionado",
        description: "Selecione pelo menos um paciente para enviar.",
        variant: "destructive",
      });
      return;
    }

    // ===== VERIFICAÇÃO DE CONEXÃO WHATSAPP ANTES DE INICIAR =====
    if (!isWhatsAppConnected) {
      toast({
        title: "WhatsApp Desconectado",
        description: "Conecte o WhatsApp antes de iniciar o envio.",
        variant: "destructive",
        duration: 10000,
        action: (
          <ToastAction 
            altText="Reconectar WhatsApp" 
            onClick={async () => {
              const result = await reconectar();
              if (result?.success) {
                toast({
                  title: "Reconectando...",
                  description: result.details?.qrcode 
                    ? "QR Code gerado. Acesse as configurações para escanear."
                    : "Tentando reconectar automaticamente...",
                });
                setTimeout(() => refreshEvolution(), 3000);
              } else {
                toast({
                  title: "Erro ao reconectar",
                  description: result?.error || "Tente novamente ou acesse as configurações.",
                  variant: "destructive",
                });
              }
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Reconectar
          </ToastAction>
        ),
      });
      return;
    }

    // Validar limites iniciais
    const validacao = validarLimitesEnvio();
    if (!validacao.permitido) {
      toast({ 
        title: "Bloqueado por segurança", 
        description: validacao.motivo, 
        variant: "destructive" 
      });
      setEstadoEnvio('interrompido_limite');
      return;
    }

    setEnviandoLote(true);
    setEstadoEnvio('enviando');
    setProgressoLote({ enviados: 0, total: pacientesSelecionados.length, sucesso: 0, falha: 0 });

    let sucessos = 0;
    let falhas = 0;
    let ultimaMensagem = '';
    let contadorPausa = 0;

    for (let i = 0; i < pacientesSelecionados.length; i++) {
      // Verificar se foi cancelado
      if (canceladoRef.current) {
        break;
      }

      // Verificar se está pausado e aguardar
      while (pausadoRef.current && !canceladoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (canceladoRef.current) {
        break;
      }

      // Revalidar limites a cada envio
      const revalidacao = validarLimitesEnvio();
      if (!revalidacao.permitido) {
        setEstadoEnvio('interrompido_limite');
        toast({
          title: "Limite atingido",
          description: revalidacao.motivo,
          variant: "destructive",
        });
        
        // Registrar log
        setLogsEnvio(prev => [...prev, {
          timestamp: new Date(),
          telefone: pacientesSelecionados[i].telefone,
          nome: pacientesSelecionados[i].primeiro_nome,
          delayAplicado: 0,
          mensagemGerada: '',
          status: 'bloqueado',
          motivo: revalidacao.motivo
        }]);
        break;
      }

      const paciente = pacientesSelecionados[i];
      
      // Gerar mensagem (variada ou template fixo)
      const mensagem = variacaoTextoAtiva 
        ? gerarMensagemVariada(paciente.primeiro_nome, ultimaMensagem)
        : renderizarMensagem(paciente.primeiro_nome);
      
      ultimaMensagem = mensagem;

      setEstadoEnvio('enviando');

      // Calcular delay que será aplicado após este envio
      let delayAplicadoSegundos = 0;
      let isPausaEstrategica = false;
      
      if (i < pacientesSelecionados.length - 1) {
        if (contadorPausa + 1 >= pausarAposEnvios) {
          // Será pausa estratégica
          isPausaEstrategica = true;
          const pausaMs = (pausaMinMin + Math.random() * (pausaMaxMin - pausaMinMin)) * 60 * 1000;
          delayAplicadoSegundos = Math.round(pausaMs / 1000);
        } else {
          // Será intervalo normal
          const delayMs = (intervaloMin + Math.random() * (intervaloMax - intervaloMin)) * 1000;
          delayAplicadoSegundos = Math.round(delayMs / 1000);
        }
      }

      try {
        await enviarAvaliacaoSequencial(paciente.telefone, paciente.primeiro_nome, undefined, mensagem);
        setTelefonesDiarioJaEnviados(prev => new Set(prev).add(paciente.telefone));
        sucessos++;
        
        // Incrementar contadores
        setEnviosSessao(prev => prev + 1);
        setEnviosDiarios(prev => prev + 1);
        contadorPausa++;

        // Registrar log de sucesso com delay que será aplicado
        setLogsEnvio(prev => [...prev, {
          timestamp: new Date(),
          telefone: paciente.telefone,
          nome: paciente.primeiro_nome,
          delayAplicado: delayAplicadoSegundos,
          mensagemGerada: mensagem,
          status: 'sucesso'
        }]);

      } catch (error) {
        console.error(`Erro ao enviar para ${paciente.nome}:`, error);
        falhas++;
        
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        const isConnectionError = (error as any)?.isConnectionError || 
          errorMessage.toLowerCase().includes('desconectado') ||
          errorMessage.toLowerCase().includes('connection closed');
        
        // Registrar log de falha com mensagem REAL
        setLogsEnvio(prev => [...prev, {
          timestamp: new Date(),
          telefone: paciente.telefone,
          nome: paciente.primeiro_nome,
          delayAplicado: 0,
          mensagemGerada: mensagem,
          status: isConnectionError ? 'conexao_perdida' : 'falha',
          motivo: errorMessage
        }]);
        
        // Se for erro de conexão, interromper o lote
        if (isConnectionError) {
          setEstadoEnvio('conexao_perdida');
          toast({
            title: "WhatsApp Desconectado",
            description: "O envio foi interrompido. Clique para reconectar.",
            variant: "destructive",
            duration: 15000,
            action: (
              <ToastAction 
                altText="Reconectar WhatsApp" 
                onClick={async () => {
                  const result = await reconectar();
                  if (result?.success) {
                    toast({
                      title: "Reconectando...",
                      description: result.details?.qrcode 
                        ? "QR Code gerado. Acesse as configurações para escanear."
                        : "Tentando reconectar automaticamente...",
                    });
                    // Atualizar status após reconexão
                    setTimeout(() => refreshEvolution(), 3000);
                  } else {
                    toast({
                      title: "Erro ao reconectar",
                      description: result?.error || "Tente novamente ou acesse as configurações.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Reconectar
              </ToastAction>
            ),
          });
          break; // Sair do loop
        }
      }

      setProgressoLote({ enviados: i + 1, total: pacientesSelecionados.length, sucesso: sucessos, falha: falhas });

      // Aplicar pausa ou intervalo
      if (i < pacientesSelecionados.length - 1 && !canceladoRef.current) {
        if (isPausaEstrategica) {
          setEstadoEnvio('pausa_seguranca');
          
          // Countdown da pausa
          for (let s = delayAplicadoSegundos; s > 0; s--) {
            if (canceladoRef.current) break;
            while (pausadoRef.current && !canceladoRef.current) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            setPausaRestante(s);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          setPausaRestante(0);
          contadorPausa = 0;
          
        } else {
          // Intervalo aleatório normal
          setEstadoEnvio('aguardando_intervalo');
          
          // Countdown do intervalo
          for (let s = delayAplicadoSegundos; s > 0; s--) {
            if (canceladoRef.current) break;
            while (pausadoRef.current && !canceladoRef.current) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            setTempoRestante(s);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          setTempoRestante(0);
        }
      }
    }

    const foiCancelado = canceladoRef.current;
    setEnviandoLote(false);
    setPausado(false);
    pausadoRef.current = false;
    canceladoRef.current = false;
    setEstadoEnvio('idle');
    carregarHistoricoAvaliacoes();

    tocarNotificacao();

    toast({
      title: foiCancelado ? "Envio cancelado!" : "Envio concluído!",
      description: foiCancelado 
        ? `Cancelado após ${sucessos} envio(s)${falhas > 0 ? `, ${falhas} falha(s)` : ""}.`
        : `${sucessos} enviado(s) com sucesso${falhas > 0 ? `, ${falhas} falha(s)` : ""}.`,
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pacientesLote.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectPaciente = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  // ===== Funções existentes =====

  const renderizarMensagem = (nome: string) => {
    return template.replace(/\{\{nome\}\}/g, nome);
  };

  const formatarTelefone = (value: string) => {
    const numeros = value.replace(/\D/g, "");
    if (numeros.length <= 2) return `(${numeros}`;
    if (numeros.length <= 7) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatarTelefone(e.target.value);
    setTelefoneAvulso(formatted);
  };

  const handleImagemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem (JPG, PNG ou WEBP).",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setImagemNome(file.name);

    const previewUrl = URL.createObjectURL(file);
    setImagemPreview(previewUrl);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImagemBase64(base64);
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

  const enviarAvaliacaoSequencial = async (
    telefone: string,
    nome: string,
    agendamentoId?: string,
    mensagemCustom?: string
  ): Promise<boolean> => {
    const telefoneNumeros = telefone.replace(/\D/g, "");
    const mensagem = mensagemCustom || renderizarMensagem(nome);

    try {
      if (imagemBase64) {
        const resultImagem = await enviarImagemWhatsApp(telefoneNumeros, imagemBase64, mensagem);
        if (!resultImagem.success) {
          // Propagar erro com flag de conexão se disponível
          const error = new Error(resultImagem.error || "Erro ao enviar imagem com texto");
          (error as any).isConnectionError = resultImagem.isConnectionError;
          throw error;
        }
      } else {
        const resultTexto = await enviarMensagemWhatsApp(telefoneNumeros, mensagem);
        if (!resultTexto.success) {
          // Propagar erro com flag de conexão se disponível
          const error = new Error(resultTexto.error || "Erro ao enviar mensagem");
          (error as any).isConnectionError = resultTexto.isConnectionError;
          throw error;
        }
      }

      await supabase.from("mensagens_whatsapp").insert({
        telefone: telefoneNumeros,
        conteudo: mensagem,
        direcao: "OUT",
        tipo_mensagem: "avaliacao",
        agendamento_id: agendamentoId || null,
        status_envio: "enviado",
      });

      return true;
    } catch (error) {
      console.error("[Avaliacoes] Erro no envio:", error);
      throw error;
    }
  };

  const enviarAvaliacaoAvulsa = async () => {
    if (!nomeAvulso.trim() || !telefoneAvulso.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e telefone do paciente.",
        variant: "destructive",
      });
      return;
    }

    // Autocorrigir telefone se possível
    const { corrigido: telefoneCorrigido, foiCorrigido } = autocorrigirTelefone(telefoneAvulso);
    
    // Validar formato do telefone brasileiro (já corrigido)
    const validacao = validarTelefoneBrasileiro(telefoneCorrigido);
    if (!validacao.valido) {
      toast({
        title: "Telefone inválido",
        description: validacao.erro,
        variant: "destructive",
      });
      return;
    }

    if (foiCorrigido) {
      toast({
        title: "Telefone corrigido automaticamente",
        description: "O dígito 9 foi adicionado após o DDD.",
      });
    }

    setEnviandoAvulso(true);
    try {
      await enviarAvaliacaoSequencial(telefoneCorrigido, nomeAvulso.trim());

      toast({
        title: "Avaliação enviada!",
        description: `Mensagem enviada para ${nomeAvulso}.`,
      });
      carregarHistoricoAvaliacoes();

      setNomeAvulso("");
      setTelefoneAvulso("");
    } catch (error: any) {
      console.error("Erro ao enviar avaliação:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setEnviandoAvulso(false);
    }
  };

  const enviarAvaliacaoPaciente = async (paciente: PacienteAtendido) => {
    setEnviandoIds(prev => new Set(prev).add(paciente.id));
    
    try {
      await enviarAvaliacaoSequencial(
        paciente.telefone_whatsapp,
        paciente.nome_completo,
        paciente.id
      );

      setAvaliacoesEnviadas(prev => new Set(prev).add(paciente.id));
      carregarHistoricoAvaliacoes();

      toast({
        title: "Avaliação enviada!",
        description: `Mensagem enviada para ${paciente.nome_completo}.`,
      });
    } catch (error: any) {
      console.error("Erro ao enviar avaliação:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setEnviandoIds(prev => {
        const updated = new Set(prev);
        updated.delete(paciente.id);
        return updated;
      });
    }
  };

  const pacientesFiltrados = pacientes.filter(p =>
    p.nome_completo.toLowerCase().includes(busca.toLowerCase()) ||
    p.telefone_whatsapp.includes(busca)
  );

  // Renderizar estado de envio
  const renderEstadoEnvio = () => {
    switch (estadoEnvio) {
      case 'enviando':
        return (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Send className="h-4 w-4 animate-pulse" />
            <span>Enviando mensagem {progressoLote.enviados + 1} de {progressoLote.total}...</span>
          </div>
        );
      case 'aguardando_intervalo':
        return (
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Clock className="h-4 w-4 animate-spin" />
            <span>Aguardando intervalo ({tempoRestante}s restantes)...</span>
          </div>
        );
      case 'pausa_seguranca':
        return (
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <Coffee className="h-4 w-4" />
            <span>Pausa de segurança ({Math.floor(pausaRestante / 60)}min {pausaRestante % 60}s)...</span>
          </div>
        );
      case 'interrompido_limite':
        return (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span>Interrompido por limite de segurança</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Star className="h-6 w-6 text-yellow-500" />
              Avaliações
            </h1>
            <p className="text-muted-foreground">
              Envie pedidos de avaliação para pacientes atendidos
            </p>
          </div>
          <EvolutionStatusBadge />
        </div>

        {/* Alert de WhatsApp Desconectado */}
        {!evolutionLoading && !isWhatsAppConnected && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>WhatsApp Desconectado</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
              <span>Não é possível verificar números ou enviar mensagens enquanto o WhatsApp estiver desconectado.</span>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={async () => {
                    const result = await reconectar();
                    if (result.success) {
                      toast({
                        title: "Reconexão iniciada",
                        description: "Aguarde a conexão ser restabelecida.",
                      });
                    } else {
                      toast({
                        title: "Falha na reconexão",
                        description: result.error || "Tente novamente ou acesse as configurações.",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reconectar
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/admin/configuracoes/evolution" className="gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" />
                    Configurações
                  </Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* ===== SEÇÃO: Disparo em Lote Seguro ===== */}
        <Card className="border-yellow-500/30 bg-gradient-to-r from-card to-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <Zap className="h-5 w-5" />
              Disparo em Lote Seguro
            </CardTitle>
            <CardDescription>
              Envie avaliações em massa com proteção anti-bloqueio integrada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Seletor de Data + Botão Buscar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Data de Atendimento:</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {dataFiltro ? format(dataFiltro, "dd/MM/yyyy") : "Selecione uma data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataFiltro}
                      onSelect={(date) => {
                        setDataFiltro(date);
                        setCalendarOpen(false);
                      }}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button 
                onClick={buscarPacientesN8n} 
                disabled={!dataFiltro || loadingLote}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                {loadingLote ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar Pacientes
              </Button>
            </div>

            {/* ===== SEÇÃO DE SEGURANÇA (Read-only) ===== */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <TooltipProvider>
                <div className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-1 cursor-help">
                        <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs text-muted-foreground">Sessão</span>
                        <span className="font-bold text-sm">{enviosSessao}/{LIMITE_SESSAO}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Máximo {LIMITE_SESSAO} mensagens por sessão</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <div className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-1 cursor-help">
                        <CalendarIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs text-muted-foreground">Diário</span>
                        <span className="font-bold text-sm">{enviosDiarios}/{LIMITE_DIARIO}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Máximo {LIMITE_DIARIO} mensagens por dia</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <div className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-1 cursor-help">
                        <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs text-muted-foreground">Horário</span>
                        <span className="font-bold text-sm">
                          {modoEnvioSemRestricao ? "Livre" : `${horarioInicio}h-${horarioFim}h`}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {modoEnvioSemRestricao 
                          ? "Envios permitidos a qualquer horário" 
                          : "Envio apenas em horário configurado"
                        }
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <div className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-1 cursor-help">
                        <Shuffle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs text-muted-foreground">Variação</span>
                        <Badge variant={variacaoTextoAtiva ? "default" : "secondary"} className="text-xs">
                          {variacaoTextoAtiva ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Mensagens únicas para cada paciente</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            {/* ===== CONFIGURAÇÕES AVANÇADAS (Colapsável) ===== */}
            <Collapsible open={configAvancadaAberta} onOpenChange={setConfigAvancadaAberta}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Configurações Avançadas de Envio
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {configAvancadaAberta ? "Fechar" : "Abrir"}
                  </span>
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-4 space-y-6 p-4 rounded-xl border bg-muted/30">
                {/* Intervalos Aleatórios */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="h-4 w-4" />
                    Intervalos Aleatórios entre Mensagens
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    O sistema sorteia um delay aleatório entre esses valores para simular comportamento humano
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="intervaloMin" className="text-xs whitespace-nowrap">Mínimo:</Label>
                      <Input
                        id="intervaloMin"
                        type="number"
                        min={30}
                        max={intervaloMax - 1}
                        value={intervaloMin}
                        onChange={(e) => setIntervaloMin(Math.max(30, Math.min(intervaloMax - 1, Number(e.target.value))))}
                        className="w-20"
                      />
                      <span className="text-xs text-muted-foreground">seg</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="intervaloMax" className="text-xs whitespace-nowrap">Máximo:</Label>
                      <Input
                        id="intervaloMax"
                        type="number"
                        min={intervaloMin + 1}
                        max={300}
                        value={intervaloMax}
                        onChange={(e) => setIntervaloMax(Math.max(intervaloMin + 1, Math.min(300, Number(e.target.value))))}
                        className="w-20"
                      />
                      <span className="text-xs text-muted-foreground">seg</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Pausas Estratégicas */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Coffee className="h-4 w-4" />
                    Pausas Estratégicas
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    A cada X mensagens, o sistema faz uma pausa maior para evitar detecção
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="pausarApos" className="text-xs whitespace-nowrap">Pausar após:</Label>
                      <Input
                        id="pausarApos"
                        type="number"
                        min={5}
                        max={20}
                        value={pausarAposEnvios}
                        onChange={(e) => setPausarAposEnvios(Math.max(5, Math.min(20, Number(e.target.value))))}
                        className="w-16"
                      />
                      <span className="text-xs text-muted-foreground">msgs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="pausaMin" className="text-xs whitespace-nowrap">Pausa mín:</Label>
                      <Input
                        id="pausaMin"
                        type="number"
                        min={1}
                        max={pausaMaxMin - 1}
                        value={pausaMinMin}
                        onChange={(e) => setPausaMinMin(Math.max(1, Math.min(pausaMaxMin - 1, Number(e.target.value))))}
                        className="w-16"
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="pausaMax" className="text-xs whitespace-nowrap">Pausa máx:</Label>
                      <Input
                        id="pausaMax"
                        type="number"
                        min={pausaMinMin + 1}
                        max={30}
                        value={pausaMaxMin}
                        onChange={(e) => setPausaMaxMin(Math.max(pausaMinMin + 1, Math.min(30, Number(e.target.value))))}
                        className="w-16"
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Variação de Texto */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <Shuffle className="h-4 w-4" />
                      Variação Automática de Mensagens
                    </Label>
                    <Switch
                      checked={variacaoTextoAtiva}
                      onCheckedChange={setVariacaoTextoAtiva}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gera mensagens únicas combinando diferentes saudações, textos e emojis. Nenhuma mensagem será igual à anterior.
                  </p>
                  
                  {variacaoTextoAtiva && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Preview de mensagem gerada:</Label>
                        <Button variant="ghost" size="sm" onClick={gerarNovoPreview}>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Gerar novo exemplo
                        </Button>
                      </div>
                      <div className="bg-background p-3 rounded-lg border text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {mensagemPreviewVariada}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Configuração de Horário de Envio */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <Clock className="h-4 w-4" />
                      Restrição de Horário de Envio
                    </Label>
                    <Switch
                      checked={!modoEnvioSemRestricao}
                      onCheckedChange={(checked) => setModoEnvioSemRestricao(!checked)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {modoEnvioSemRestricao 
                      ? "⚡ Modo livre: Envios permitidos a qualquer horário (use com cautela)"
                      : `Envios apenas entre ${horarioInicio}h e ${horarioFim}h`
                    }
                  </p>
                  
                  {!modoEnvioSemRestricao && (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Início:</Label>
                        <Input
                          type="number"
                          min={0}
                          max={horarioFim - 1}
                          value={horarioInicio}
                          onChange={(e) => setHorarioInicio(Math.max(0, Math.min(horarioFim - 1, Number(e.target.value))))}
                          className="w-16"
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Fim:</Label>
                        <Input
                          type="number"
                          min={horarioInicio + 1}
                          max={24}
                          value={horarioFim}
                          onChange={(e) => setHorarioFim(Math.max(horarioInicio + 1, Math.min(24, Number(e.target.value))))}
                          className="w-16"
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Erro */}
            {erroLote && (
              <Alert variant="destructive">
                <AlertDescription>{erroLote}</AlertDescription>
              </Alert>
            )}

            {/* Lista de pacientes do lote */}
            {pacientesLote.length > 0 && (
              <div className="space-y-4">
                {/* Selecionar todos + contador */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="select-all"
                      checked={selectedIds.size === pacientesLote.length && pacientesLote.length > 0}
                      onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                      disabled={enviandoLote}
                    />
                    <Label htmlFor="select-all" className="cursor-pointer font-medium">
                      Selecionar todos ({pacientesLote.length})
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Botão de verificação WhatsApp */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={verificarNumerosWhatsApp}
                            disabled={verificandoWhatsApp || enviandoLote || !isWhatsAppConnected}
                            className="text-emerald-600 border-emerald-500/50 hover:bg-emerald-500/10"
                          >
                            {verificandoWhatsApp ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                Verificando...
                              </>
                            ) : !isWhatsAppConnected ? (
                              <>
                                <WifiOff className="h-3.5 w-3.5 mr-1.5" />
                                WhatsApp Offline
                              </>
                            ) : (
                              <>
                                <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                                Verificar WhatsApp
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {!isWhatsAppConnected 
                            ? "Reconecte o WhatsApp para verificar números"
                            : "Verifica quais números existem no WhatsApp antes de enviar"
                          }
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {/* Botão para remover inválidos */}
                    {verificacaoConcluida && contarNumerosVerificados().invalidos > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={removerNumerosInvalidos}
                        className="text-red-600 border-red-500/50 hover:bg-red-500/10"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1.5" />
                        Remover {contarNumerosVerificados().invalidos} inválido(s)
                      </Button>
                    )}
                    
                    {contarTelefonesCorrigiveis() > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={autocorrigirTodosTelefones}
                        className="text-amber-600 border-amber-500/50 hover:bg-amber-500/10"
                      >
                        <Zap className="h-3.5 w-3.5 mr-1.5" />
                        Corrigir {contarTelefonesCorrigiveis()} telefone(s)
                      </Button>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {selectedIds.size} selecionado(s)
                    </div>
                    
                    {/* Status da verificação */}
                    {verificacaoConcluida && (
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {contarNumerosVerificados().validos} válidos
                        </Badge>
                        {contarNumerosVerificados().invalidos > 0 && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                            <XCircle className="h-3 w-3 mr-1" />
                            {contarNumerosVerificados().invalidos} sem WhatsApp
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Lista scrollável */}
                <ScrollArea className="h-72 border rounded-xl bg-gradient-to-b from-muted/20 to-transparent">
                  <div className="p-3 space-y-2">
                    {pacientesLote.map((paciente, index) => {
                      const jaEnviou = telefonesDiarioJaEnviados.has(paciente.telefone);
                      const isSelected = selectedIds.has(paciente.id);
                      
                      return (
                        <div
                          key={paciente.id}
                          className={`
                            flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200
                            ${jaEnviou 
                              ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm shadow-emerald-500/10" 
                              : isSelected 
                                ? "bg-amber-500/10 border-amber-500/40 shadow-sm shadow-amber-500/10 scale-[1.01]" 
                                : "bg-card/80 border-border/50 hover:bg-muted/60 hover:border-muted-foreground/30"
                            }
                          `}
                        >
                          <div className={`
                            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                            ${jaEnviou 
                              ? "bg-emerald-500 text-white" 
                              : isSelected 
                                ? "bg-amber-500 text-white" 
                                : "bg-muted text-muted-foreground"
                            }
                          `}>
                            {jaEnviou ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              index + 1
                            )}
                          </div>
                          
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => toggleSelectPaciente(paciente.id, !!checked)}
                            disabled={enviandoLote || jaEnviou}
                            className={`
                              h-5 w-5 border-2 transition-colors
                              ${isSelected ? "border-amber-500 data-[state=checked]:bg-amber-500" : ""}
                            `}
                          />
                          
                          <div className={`
                            flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold uppercase
                            ${jaEnviou 
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" 
                              : isSelected 
                                ? "bg-amber-500/20 text-amber-700 dark:text-amber-400" 
                                : "bg-primary/10 text-primary"
                            }
                          `}>
                            {paciente.primeiro_nome?.charAt(0) || paciente.nome?.charAt(0) || "?"}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate text-foreground">
                                {paciente.primeiro_nome || paciente.nome}
                              </span>
                              {jaEnviou && (
                                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs px-2">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Enviado
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                              <Phone className="h-3 w-3" />
                              {editandoTelefone === paciente.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={telefoneEditado}
                                    onChange={(e) => setTelefoneEditado(e.target.value)}
                                    className="w-36 h-7 text-sm px-2"
                                    placeholder="(91) 99999-9999"
                                    autoFocus
                                  />
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7"
                                    onClick={() => salvarTelefoneEditado(paciente.id)}
                                  >
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7"
                                    onClick={cancelarEdicaoTelefone}
                                  >
                                    <X className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  {(() => {
                                    const validacao = validarTelefoneBrasileiro(paciente.telefone);
                                    return (
                                      <>
                                        <span className={!validacao.valido ? "text-red-500" : "text-green-600"}>
                                          {paciente.telefone_formatado}
                                        </span>
                                        {!validacao.valido && validacao.podeCorrigir && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-5 px-1.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                                                  onClick={() => autocorrigirTelefonePaciente(paciente.id)}
                                                >
                                                  <Zap className="h-3 w-3 mr-1" />
                                                  +9
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p className="text-xs">Adicionar dígito 9 automaticamente</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                        {!validacao.valido && !validacao.podeCorrigir && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                              </TooltipTrigger>
                                              <TooltipContent className="max-w-xs">
                                                <p className="text-xs">{validacao.erro}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                        {validacao.valido && !paciente.whatsappVerificado && (
                                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                        )}
                                        {/* Status de verificação WhatsApp */}
                                        {paciente.whatsappVerificado === 'pendente' && (
                                          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                                        )}
                                        {paciente.whatsappVerificado === 'valido' && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <MessageCircle className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p className="text-xs">Número verificado no WhatsApp</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                        {paciente.whatsappVerificado === 'invalido' && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <MessageCircle className="h-3.5 w-3.5 text-red-500" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p className="text-xs">Número não encontrado no WhatsApp</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                      </>
                                    );
                                  })()}
                                  {paciente.data_atendimento_formatada && (
                                    <>
                                      <span className="text-muted-foreground/50">•</span>
                                      <span className="text-xs">{paciente.data_atendimento_formatada}</span>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Botões de ação */}
                          {!enviandoLote && !jaEnviou && editandoTelefone !== paciente.id && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-8 w-8 hover:bg-muted"
                                      onClick={() => iniciarEdicaoTelefone(paciente)}
                                    >
                                      <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar telefone</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-8 w-8 hover:bg-destructive/10"
                                      onClick={() => abrirDialogExclusao(paciente)}
                                    >
                                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remover da lista</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* Barra de progresso e estado */}
                {enviandoLote && (
                  <div className="space-y-3 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 border border-amber-500/20">
                    {/* Estado atual */}
                    <div className="flex items-center justify-between">
                      {renderEstadoEnvio()}
                      <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                        {progressoLote.enviados} / {progressoLote.total}
                      </Badge>
                    </div>
                    
                    <div className="relative">
                      <Progress 
                        value={(progressoLote.enviados / progressoLote.total) * 100} 
                        className="h-3 bg-amber-500/20"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="h-4 w-4" />
                          {progressoLote.sucesso} sucesso
                        </span>
                        {progressoLote.falha > 0 && (
                          <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4" />
                            {progressoLote.falha} falha(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Botões de envio */}
                <div className="flex gap-2">
                  {enviandoLote && (
                    <>
                      <Button
                        onClick={() => {
                          pausadoRef.current = !pausadoRef.current;
                          setPausado(!pausado);
                        }}
                        variant={pausado ? "default" : "outline"}
                        size="lg"
                        className={pausado ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {pausado ? (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Retomar
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Pausar
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          canceladoRef.current = true;
                          pausadoRef.current = false;
                          setPausado(false);
                        }}
                        variant="destructive"
                        size="lg"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                    </>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button
                            onClick={enviarEmLote}
                            disabled={selectedIds.size === 0 || enviandoLote || !isWhatsAppConnected}
                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                            size="lg"
                          >
                            {enviandoLote ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {pausado ? "Pausado" : "Enviando"} {progressoLote.enviados}/{progressoLote.total}...
                              </>
                            ) : !isWhatsAppConnected ? (
                              <>
                                <WifiOff className="h-4 w-4 mr-2" />
                                WhatsApp Desconectado
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Enviar para {selectedIds.size} paciente(s)
                              </>
                            )}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!isWhatsAppConnected && (
                        <TooltipContent>
                          Reconecte o WhatsApp para enviar mensagens
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            )}

            {/* Estado vazio após busca */}
            {!loadingLote && dataFiltro && pacientesLote.length === 0 && !erroLote && (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Nenhum paciente encontrado para esta data.</p>
                <p className="text-sm">Tente selecionar outra data de atendimento.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Template de Mensagem */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Template da Mensagem
              </CardTitle>
              <CardDescription>
                {variacaoTextoAtiva 
                  ? "Template usado quando variação está desativada ou para envios avulsos"
                  : "Personalize a mensagem que será enviada aos pacientes"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload de Imagem */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Imagem (enviada com o texto)
                </Label>
                
                {imagemPreview ? (
                  <div className="relative">
                    <img 
                      src={imagemPreview} 
                      alt="Preview" 
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={removerImagem}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">{imagemNome}</p>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Clique para selecionar uma imagem
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG ou WEBP (máx. 5MB)
                    </p>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImagemChange}
                  className="hidden"
                />
              </div>

              <Separator />

              {/* Mensagem de Texto */}
              <div className="space-y-2">
                <Label htmlFor="template">
                  💬 {imagemPreview ? "Legenda da imagem (caption)" : "Mensagem"}
                </Label>
                <Textarea
                  id="template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use <code className="bg-muted px-1 rounded">{"{{nome}}"}</code> para inserir o nome do paciente
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => setTemplate(TEMPLATE_PADRAO)}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Resetar para Padrão
              </Button>

              <Separator />

              <div className="space-y-2">
                <Label>Preview da Mensagem</Label>
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  {imagemPreview && (
                    <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-2 font-medium">
                      <ImagePlus className="h-3 w-3" />
                      Imagem + texto enviados juntos (caption)
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm">
                    {renderizarMensagem("João Silva")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Envio Avulso */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Enviar Mensagem Avulsa
              </CardTitle>
              <CardDescription>
                Envie uma avaliação para qualquer paciente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Paciente</Label>
                <Input
                  id="nome"
                  value={nomeAvulso}
                  onChange={(e) => setNomeAvulso(e.target.value)}
                  placeholder="Ex: Maria Santos"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
                <div className="space-y-1">
                  <Input
                    id="telefone"
                    value={telefoneAvulso}
                    onChange={handleTelefoneChange}
                    placeholder="(91) 99130-0174"
                    maxLength={15}
                    className={telefoneAvulso.length > 0 && !validarTelefoneBrasileiro(telefoneAvulso).valido 
                      ? "border-red-500 focus:ring-red-500" 
                      : telefoneAvulso.length >= 14 && validarTelefoneBrasileiro(telefoneAvulso).valido
                        ? "border-green-500 focus:ring-green-500"
                        : ""
                    }
                  />
                  {telefoneAvulso.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      {(() => {
                        const validacao = validarTelefoneBrasileiro(telefoneAvulso);
                        if (validacao.valido) {
                          return (
                            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Formato válido
                            </span>
                          );
                        } else if (validacao.podeCorrigir) {
                          return (
                            <div className="flex items-center gap-2">
                              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Falta dígito 9
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-5 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                                onClick={() => {
                                  const { formatado } = autocorrigirTelefone(telefoneAvulso);
                                  setTelefoneAvulso(formatado);
                                }}
                              >
                                <Zap className="h-3 w-3 mr-1" />
                                Corrigir
                              </Button>
                            </div>
                          );
                        } else {
                          return (
                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {validacao.erro}
                            </span>
                          );
                        }
                      })()}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Formato: DDD + número (ex: 91 99130-0174)
                  </p>
                </div>
              </div>

              {imagemBase64 && (
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground flex items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Imagem será enviada com o texto
                </div>
              )}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button
                        onClick={enviarAvaliacaoAvulsa}
                        disabled={enviandoAvulso || !nomeAvulso.trim() || !telefoneAvulso.trim() || !isWhatsAppConnected}
                        className="w-full"
                      >
                        {enviandoAvulso ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : !isWhatsAppConnected ? (
                          <WifiOff className="h-4 w-4 mr-2" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        {enviandoAvulso ? "Enviando..." : !isWhatsAppConnected ? "WhatsApp Desconectado" : "Enviar Avaliação"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!isWhatsAppConnected && (
                    <TooltipContent>
                      Reconecte o WhatsApp para enviar mensagens
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Pacientes Atendidos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pacientes Atendidos</CardTitle>
                <CardDescription>
                  Pacientes com consultas já realizadas (últimos 50)
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={carregarPacientesAtendidos}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Lista */}
              {loadingPacientes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pacientesFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {busca ? "Nenhum paciente encontrado." : "Nenhum paciente atendido ainda."}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {pacientesFiltrados.map((paciente) => {
                    const jaEnviou = avaliacoesEnviadas.has(paciente.id);
                    const enviando = enviandoIds.has(paciente.id);

                    return (
                      <div
                        key={paciente.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground truncate">
                              {paciente.nome_completo}
                            </p>
                            {jaEnviou && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Enviado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{paciente.telefone_whatsapp}</span>
                            {paciente.data_agendamento && (
                              <>
                                <span>•</span>
                                <span>
                                  {format(new Date(paciente.data_agendamento), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              </>
                            )}
                            <span>•</span>
                            <span className="truncate">{paciente.local_atendimento}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={jaEnviou ? "outline" : "default"}
                          onClick={() => enviarAvaliacaoPaciente(paciente)}
                          disabled={enviando}
                        >
                          {enviando ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              {jaEnviou ? "Reenviar" : "Enviar"}
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ===== LOGS DETALHADOS DA SESSÃO ===== */}
        {logsEnvio.length > 0 && (
          <Card className="border-blue-500/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <History className="h-5 w-5" />
                    Logs de Envio da Sessão
                  </CardTitle>
                  <CardDescription>
                    Registro detalhado de cada mensagem enviada nesta sessão
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setLogsEnvio([])}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {logsEnvio.slice().reverse().map((log, index) => (
                    <div
                      key={index}
                      className={`
                        p-3 rounded-lg border text-sm space-y-2
                        ${log.status === 'sucesso' 
                          ? 'bg-emerald-500/5 border-emerald-500/20' 
                          : log.status === 'falha'
                            ? 'bg-red-500/5 border-red-500/20'
                            : 'bg-amber-500/5 border-amber-500/20'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {log.status === 'sucesso' ? (
                            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : log.status === 'falha' ? (
                            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          )}
                          <span className="font-medium">{log.nome}</span>
                          <Badge variant="outline" className="text-xs">
                            {log.telefone}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(log.timestamp, "HH:mm:ss", { locale: ptBR })}
                        </span>
                      </div>
                      
                      {log.delayAplicado > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Delay: {log.delayAplicado}s
                        </div>
                      )}
                      
                      {log.motivo && (
                        <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 p-2 rounded">
                          ⚠️ {log.motivo}
                        </div>
                      )}
                      
                      {log.mensagemGerada && (
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 text-xs w-full justify-start">
                              <MessageCircle className="h-3 w-3 mr-1" />
                              Ver mensagem enviada
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-24 overflow-y-auto">
                              {log.mensagemGerada}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              {/* Resumo dos logs */}
              <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    {logsEnvio.filter(l => l.status === 'sucesso').length} sucesso
                  </span>
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <XCircle className="h-4 w-4" />
                    {logsEnvio.filter(l => l.status === 'falha').length} falha
                  </span>
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    {logsEnvio.filter(l => l.status === 'bloqueado').length} bloqueado
                  </span>
                </div>
                <span className="text-muted-foreground">
                  Total: {logsEnvio.length} registro(s)
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Avaliações Enviadas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Avaliações Enviadas
                </CardTitle>
                <CardDescription>
                  Últimas 50 mensagens de avaliação enviadas
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={carregarHistoricoAvaliacoes}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingHistorico ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historico.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma avaliação enviada ainda.
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-3">
                  {historico.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border bg-card space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="font-medium">
                            {item.agendamentos?.nome_completo || "Envio avulso"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(item.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        📱 {item.telefone}
                      </div>
                      <div className="text-sm bg-muted p-2 rounded line-clamp-2">
                        {item.conteudo}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!pacienteParaExcluir} onOpenChange={(open) => !open && setPacienteParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover paciente da lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{pacienteParaExcluir?.primeiro_nome || pacienteParaExcluir?.nome}</strong> da lista de envio? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarRemocaoPaciente}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default Avaliacoes;
