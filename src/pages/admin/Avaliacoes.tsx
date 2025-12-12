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
import { Star, Send, RefreshCw, Search, Loader2, MessageCircle, CheckCircle, ImagePlus, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PacienteAtendido {
  id: string;
  nome_completo: string;
  telefone_whatsapp: string;
  data_agendamento: string;
  hora_agendamento: string;
  local_atendimento: string;
  avaliacaoEnviada?: boolean;
}

const TEMPLATE_PADRAO = `Olá, {{nome}}! 👋

Foi um prazer atendê-lo(a). Sua opinião é muito importante para continuarmos oferecendo um atendimento de qualidade e em constante melhoria.

Se puder, deixe sua avaliação clicando no link abaixo:
👉 https://g.page/r/CTkTpXB1m13mEBM/review

Agradeço desde já pela confiança. 💙
Dr. Juliano Machado
Oftalmologia`;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

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
  
  // Image state
  const [imagemBase64, setImagemBase64] = useState<string | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemNome, setImagemNome] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregarPacientesAtendidos();
    carregarAvaliacoesEnviadas();
  }, []);

  const carregarPacientesAtendidos = async () => {
    setLoadingPacientes(true);
    try {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, nome_completo, telefone_whatsapp, data_agendamento, hora_agendamento, local_atendimento")
        .eq("status_funil", "confirmado")
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
                <Label htmlFor="template">💬 Mensagem (enviada após a imagem)</Label>
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
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <ImagePlus className="h-3 w-3" />
                      1º: Imagem será enviada
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <MessageCircle className="h-3 w-3" />
                    {imagemPreview ? "2º: " : ""}Texto:
                  </div>
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
                  Pacientes com consultas confirmadas (últimos 50)
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
      </div>
    </AdminLayout>
  );
};

export default Avaliacoes;
