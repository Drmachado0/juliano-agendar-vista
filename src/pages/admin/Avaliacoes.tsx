import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { enviarMensagemWhatsApp, enviarImagemWhatsApp } from "@/services/integracoes";
import { Star, Send, RefreshCw, Search, Loader2, MessageCircle, CheckCircle, ImagePlus, X, Zap, CalendarIcon, Users } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, History } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

// Tipos para integração com n8n (SaudeViaNet)
interface PacienteN8n {
  id: string;
  nome: string;
  primeiro_nome: string;
  telefone: string;
  telefone_formatado: string;
  data_atendimento: string;
  data_atendimento_formatada: string;
}

interface N8nResponse {
  sucesso: boolean;
  data_consulta: string;
  total_pacientes: number;
  pacientes: PacienteN8n[];
}

const TEMPLATE_PADRAO = `Olá, {{nome}}! 👋

Foi um prazer atendê-lo(a). Sua opinião é muito importante para continuarmos oferecendo um atendimento de qualidade e em constante melhoria.

Se puder, deixe sua avaliação clicando no link abaixo:
👉 https://g.page/r/CTkTpXB1m13mEBM/review

Agradeço desde já pela confiança. 💙
Dr. Juliano Machado
Oftalmologia`;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const N8N_WEBHOOK_URL = "https://juliano-n8n.cloudfy.live/webhook/avaliacao-google-lovable";

const Avaliacoes = () => {
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
  const [progressoLote, setProgressoLote] = useState({ enviados: 0, total: 0 });
  const [telefonesDiarioJaEnviados, setTelefonesDiarioJaEnviados] = useState<Set<string>>(new Set());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [intervaloEnvio, setIntervaloEnvio] = useState(15); // segundos

  useEffect(() => {
    carregarPacientesAtendidos();
    carregarAvaliacoesEnviadas();
    carregarHistoricoAvaliacoes();
  }, []);

  const carregarPacientesAtendidos = async () => {
    setLoadingPacientes(true);
    try {
      // D+1: Buscar agendamentos cuja data já passou (consultas realizadas)
      const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, nome_completo, telefone_whatsapp, data_agendamento, hora_agendamento, local_atendimento")
        .lt("data_agendamento", hoje) // Consultas que já aconteceram
        .not("data_agendamento", "is", null) // Ignorar leads incompletos
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

  // ===== Funções para Disparo em Lote (n8n) =====

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

    const dataFormatada = format(dataFiltro, 'yyyy-MM-dd');

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_atendimento: dataFormatada }),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data: N8nResponse = await response.json();

      if (!data.sucesso) {
        throw new Error("Falha ao buscar pacientes do sistema");
      }

      setPacientesLote(data.pacientes || []);

      if (data.pacientes.length === 0) {
        toast({
          title: "Nenhum paciente encontrado",
          description: `Não há pacientes atendidos em ${format(dataFiltro, 'dd/MM/yyyy')}.`,
        });
      } else {
        toast({
          title: "Pacientes carregados!",
          description: `${data.total_pacientes} paciente(s) encontrado(s).`,
        });
      }
    } catch (error: any) {
      console.error("Erro ao buscar pacientes n8n:", error);
      setErroLote(error.message || "Erro ao conectar com o sistema");
      toast({
        title: "Erro ao buscar pacientes",
        description: error.message || "Não foi possível conectar ao sistema SaudeViaNet.",
        variant: "destructive",
      });
    } finally {
      setLoadingLote(false);
    }
  };

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

    setEnviandoLote(true);
    setProgressoLote({ enviados: 0, total: pacientesSelecionados.length });

    let sucessos = 0;
    let falhas = 0;

    for (let i = 0; i < pacientesSelecionados.length; i++) {
      const paciente = pacientesSelecionados[i];

      try {
        // Usa primeiro_nome para personalização amigável
        await enviarAvaliacaoSequencial(paciente.telefone, paciente.primeiro_nome);
        setTelefonesDiarioJaEnviados(prev => new Set(prev).add(paciente.telefone));
        sucessos++;
      } catch (error) {
        console.error(`Erro ao enviar para ${paciente.nome}:`, error);
        falhas++;
      }

      setProgressoLote({ enviados: i + 1, total: pacientesSelecionados.length });

      // Aguardar intervalo configurado entre envios (exceto no último)
      if (i < pacientesSelecionados.length - 1) {
        await new Promise(resolve => setTimeout(resolve, intervaloEnvio * 1000));
      }
    }

    setEnviandoLote(false);
    carregarHistoricoAvaliacoes();

    toast({
      title: "Envio concluído!",
      description: `${sucessos} enviado(s) com sucesso${falhas > 0 ? `, ${falhas} falha(s)` : ""}.`,
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem (JPG, PNG ou WEBP).",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setImagemNome(file.name);

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setImagemPreview(previewUrl);

    // Convert to base64
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
    agendamentoId?: string
  ): Promise<boolean> => {
    const telefoneNumeros = telefone.replace(/\D/g, "");
    const mensagem = renderizarMensagem(nome);

    console.log("[Avaliacoes] Iniciando envio de avaliação", {
      telefoneOriginal: telefone,
      telefoneNumeros,
      nome,
      agendamentoId,
      temImagem: !!imagemBase64,
    });

    try {
      if (imagemBase64) {
        // Enviar imagem COM o texto como caption (1 única chamada)
        console.log("[Avaliacoes] Enviando imagem + caption via WhatsApp", {
          tamanhoBase64: imagemBase64.length,
          captionPreview: mensagem.length > 50 ? mensagem.slice(0, 47) + "..." : mensagem,
        });

        const resultImagem = await enviarImagemWhatsApp(telefoneNumeros, imagemBase64, mensagem);
        console.log("[Avaliacoes] Resultado envio imagem+caption:", resultImagem);

        if (!resultImagem.success) {
          console.error("[Avaliacoes] Falha no envio:", resultImagem.error);
          throw new Error(resultImagem.error || "Erro ao enviar imagem com texto");
        }
      } else {
        // Sem imagem: enviar apenas texto
        console.log("[Avaliacoes] Enviando apenas texto via WhatsApp", {
          telefoneNumeros,
          mensagemPreview: mensagem.length > 50 ? mensagem.slice(0, 47) + "..." : mensagem,
        });

        const resultTexto = await enviarMensagemWhatsApp(telefoneNumeros, mensagem);
        console.log("[Avaliacoes] Resultado envio texto:", resultTexto);

        if (!resultTexto.success) {
          console.error("[Avaliacoes] Falha no envio do texto:", resultTexto.error);
          throw new Error(resultTexto.error || "Erro ao enviar mensagem");
        }
      }

      // Registrar no banco
      console.log("[Avaliacoes] Registrando mensagem de avaliação no banco...");

      await supabase.from("mensagens_whatsapp").insert({
        telefone: telefoneNumeros,
        conteudo: mensagem,
        direcao: "OUT",
        tipo_mensagem: "avaliacao",
        agendamento_id: agendamentoId || null,
        status_envio: "enviado",
      });

      console.log("[Avaliacoes] Envio concluído com sucesso");
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

    setEnviandoAvulso(true);
    try {
      await enviarAvaliacaoSequencial(telefoneAvulso, nomeAvulso.trim());

      toast({
        title: "Avaliação enviada!",
        description: `Mensagem enviada para ${nomeAvulso}.`,
      });
      carregarHistoricoAvaliacoes(); // Atualiza o histórico

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
      carregarHistoricoAvaliacoes(); // Atualiza o histórico

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Star className="h-6 w-6 text-yellow-500" />
              Avaliações
            </h1>
            <p className="text-muted-foreground">
              Envie pedidos de avaliação para pacientes atendidos
            </p>
          </div>
        </div>

        {/* ===== NOVA SEÇÃO: Disparo em Lote ===== */}
        <Card className="border-yellow-500/30 bg-gradient-to-r from-card to-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <Zap className="h-5 w-5" />
              Disparo em Lote
            </CardTitle>
            <CardDescription>
              Busque pacientes atendidos no SaudeViaNet por data e envie avaliações em massa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Seletor de Data + Intervalo + Botão Buscar */}
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
              
              <div className="flex items-center gap-2">
                <Label htmlFor="intervalo" className="whitespace-nowrap">Intervalo:</Label>
                <Input
                  id="intervalo"
                  type="number"
                  min={5}
                  max={60}
                  value={intervaloEnvio}
                  onChange={(e) => setIntervaloEnvio(Math.max(5, Math.min(60, Number(e.target.value))))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">seg</span>
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

            {/* Instrução */}
            <Alert className="border-yellow-500/30 bg-yellow-500/10">
              <Zap className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm">
                Selecione a data e clique em "Buscar Pacientes". Após revisar a lista, 
                selecione os pacientes e clique em "Enviar". O envio respeita um 
                intervalo de <strong>{intervaloEnvio} segundos</strong> entre mensagens para evitar bloqueio.
              </AlertDescription>
            </Alert>

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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {selectedIds.size} selecionado(s)
                  </div>
                </div>

                {/* Lista scrollável */}
                <ScrollArea className="h-64 border rounded-lg">
                  <div className="p-2 space-y-2">
                    {pacientesLote.map((paciente) => {
                      const jaEnviou = telefonesDiarioJaEnviados.has(paciente.telefone);
                      
                      return (
                        <div
                          key={paciente.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            jaEnviou 
                              ? "bg-green-500/10 border-green-500/30" 
                              : selectedIds.has(paciente.id) 
                                ? "bg-yellow-500/10 border-yellow-500/30" 
                                : "bg-card hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox
                            checked={selectedIds.has(paciente.id)}
                            onCheckedChange={(checked) => toggleSelectPaciente(paciente.id, !!checked)}
                            disabled={enviandoLote || jaEnviou}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{paciente.nome}</span>
                              {jaEnviou && (
                                <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Enviado
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {paciente.telefone_formatado}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* Barra de progresso */}
                {enviandoLote && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Enviando...</span>
                      <span>{progressoLote.enviados} / {progressoLote.total}</span>
                    </div>
                    <Progress value={(progressoLote.enviados / progressoLote.total) * 100} className="h-2" />
                  </div>
                )}

                {/* Botão de envio */}
                <Button
                  onClick={enviarEmLote}
                  disabled={selectedIds.size === 0 || enviandoLote}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                  size="lg"
                >
                  {enviandoLote ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando {progressoLote.enviados}/{progressoLote.total}...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar para {selectedIds.size} paciente(s)
                    </>
                  )}
                </Button>
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
                Personalize a mensagem que será enviada aos pacientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload de Imagem */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Imagem (enviada primeiro)
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
                <Input
                  id="telefone"
                  value={telefoneAvulso}
                  onChange={handleTelefoneChange}
                  placeholder="(91) 99999-9999"
                  maxLength={15}
                />
              </div>

              {imagemBase64 && (
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground flex items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Imagem será enviada antes do texto
                </div>
              )}

              <Button
                onClick={enviarAvaliacaoAvulsa}
                disabled={enviandoAvulso || !nomeAvulso.trim() || !telefoneAvulso.trim()}
                className="w-full"
              >
                {enviandoAvulso ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {enviandoAvulso ? "Enviando..." : "Enviar Avaliação"}
              </Button>
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
    </AdminLayout>
  );
};

export default Avaliacoes;
