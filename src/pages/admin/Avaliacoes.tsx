import { useState, useEffect } from "react";
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
import { enviarMensagemWhatsApp } from "@/services/integracoes";
import { Star, Send, RefreshCw, Search, Loader2, MessageCircle, CheckCircle } from "lucide-react";
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

const TEMPLATE_PADRAO = `Olá! 👋
Espero que esteja tudo bem. Sua opinião faz toda a diferença para melhorar nosso atendimento.
Se puder, avalie sua consulta clicando aqui 👇
👉 https://g.page/r/CTkTpXB1m13mEBM/review

Agradecemos muito! 💙`;

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
      const mensagem = renderizarMensagem(nomeAvulso.trim());
      const telefoneNumeros = telefoneAvulso.replace(/\D/g, "");

      const result = await enviarMensagemWhatsApp(telefoneNumeros, mensagem);
      
      if (!result.success) throw new Error(result.error || "Erro ao enviar");

      // Registrar mensagem no banco
      await supabase.from("mensagens_whatsapp").insert({
        telefone: telefoneNumeros,
        conteudo: mensagem,
        direcao: "OUT",
        tipo_mensagem: "avaliacao",
        status_envio: "enviado",
      });

      toast({
        title: "Avaliação enviada!",
        description: `Mensagem enviada para ${nomeAvulso}.`,
      });

      setNomeAvulso("");
      setTelefoneAvulso("");
    } catch (error) {
      console.error("Erro ao enviar avaliação:", error);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setEnviandoAvulso(false);
    }
  };

  const enviarAvaliacaoPaciente = async (paciente: PacienteAtendido) => {
    setEnviandoIds(prev => new Set(prev).add(paciente.id));
    
    try {
      const mensagem = renderizarMensagem(paciente.nome_completo);
      const telefoneNumeros = paciente.telefone_whatsapp.replace(/\D/g, "");

      const result = await enviarMensagemWhatsApp(telefoneNumeros, mensagem);
      
      if (!result.success) throw new Error(result.error || "Erro ao enviar");

      // Registrar mensagem no banco
      await supabase.from("mensagens_whatsapp").insert({
        telefone: telefoneNumeros,
        conteudo: mensagem,
        direcao: "OUT",
        tipo_mensagem: "avaliacao",
        agendamento_id: paciente.id,
        status_envio: "enviado",
      });

      setAvaliacoesEnviadas(prev => new Set(prev).add(paciente.id));

      toast({
        title: "Avaliação enviada!",
        description: `Mensagem enviada para ${paciente.nome_completo}.`,
      });
    } catch (error) {
      console.error("Erro ao enviar avaliação:", error);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
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
              <div className="space-y-2">
                <Label htmlFor="template">Mensagem</Label>
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
                <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
                  {renderizarMensagem("João Silva")}
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
                Enviar Avaliação
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
