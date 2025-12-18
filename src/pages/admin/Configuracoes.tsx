import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Stethoscope, Plus, Pencil, Clock, MapPin, Phone, Calendar, Link2, Unlink, Loader2, Shield, DollarSign, MessageSquare, Star, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Clinica, 
  listarTodasClinicas, 
  criarClinica, 
  atualizarClinica 
} from "@/services/clinicas";
import { 
  Servico, 
  listarTodosServicos, 
  criarServico, 
  atualizarServico 
} from "@/services/servicos";
import {
  Convenio,
  listarTodosConvenios,
  criarConvenio,
  atualizarConvenio
} from "@/services/convenios";
import {
  TipoAtendimento,
  listarTodosTiposAtendimento,
  criarTipoAtendimento,
  atualizarTipoAtendimento
} from "@/services/tiposAtendimento";
import {
  checkGoogleCalendarConnection,
  initiateGoogleCalendarAuth,
  disconnectGoogleCalendar,
  buildGoogleCalendarAuthUrl,
  GoogleCalendarStatus
} from "@/services/googleCalendar";
import { useAuth } from "@/contexts/AuthContext";
import TwoFactorSetup from "@/components/admin/TwoFactorSetup";
import TemplatesWhatsAppTab from "@/components/admin/TemplatesWhatsAppTab";
import { sincronizarAvaliacoesManualmente } from "@/services/avaliacoesGoogle";

export default function Configuracoes() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [tiposAtendimento, setTiposAtendimento] = useState<TipoAtendimento[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Google Calendar state
  const [gcalStatus, setGcalStatus] = useState<GoogleCalendarStatus>({ connected: false });
  const [gcalLoading, setGcalLoading] = useState(false);
  
  // Google Reviews state
  const [reviewsSyncing, setReviewsSyncing] = useState(false);
  const [reviewsSyncResult, setReviewsSyncResult] = useState<{
    success: boolean;
    message: string;
    synced?: number;
  } | null>(null);
  
  // Modal states
  const [clinicaModalOpen, setClinicaModalOpen] = useState(false);
  const [servicoModalOpen, setServicoModalOpen] = useState(false);
  const [convenioModalOpen, setConvenioModalOpen] = useState(false);
  const [tipoModalOpen, setTipoModalOpen] = useState(false);
  const [editingClinica, setEditingClinica] = useState<Clinica | null>(null);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [editingConvenio, setEditingConvenio] = useState<Convenio | null>(null);
  const [editingTipo, setEditingTipo] = useState<TipoAtendimento | null>(null);

  // Form states
  const [clinicaForm, setClinicaForm] = useState({
    nome: "",
    slug: "",
    endereco: "",
    telefone: "",
    ativo: true,
  });

  const [servicoForm, setServicoForm] = useState({
    nome: "",
    descricao: "",
    duracao_min: 30,
    ativo: true,
  });

  const [convenioForm, setConvenioForm] = useState({
    nome: "",
    slug: "",
    valor_consulta: null as number | null,
    ativo: true,
  });

  const [tipoForm, setTipoForm] = useState({
    nome: "",
    slug: "",
    descricao: "",
    ativo: true,
  });

  useEffect(() => {
    carregarDados();
    
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success === 'true') {
      toast.success('Google Calendar conectado com sucesso!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      toast.error(`Erro ao conectar: ${error}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user?.id) {
      checkGCalConnection();
    }
  }, [user?.id]);

  async function checkGCalConnection() {
    if (!user?.id) return;
    setGcalLoading(true);
    const status = await checkGoogleCalendarConnection(user.id);
    setGcalStatus(status);
    setGcalLoading(false);
  }

  async function carregarDados() {
    setLoading(true);
    const [clinicasRes, servicosRes, conveniosRes, tiposRes] = await Promise.all([
      listarTodasClinicas(),
      listarTodosServicos(),
      listarTodosConvenios(),
      listarTodosTiposAtendimento(),
    ]);

    if (clinicasRes.data) setClinicas(clinicasRes.data);
    if (servicosRes.data) setServicos(servicosRes.data);
    if (conveniosRes.data) setConvenios(conveniosRes.data);
    if (tiposRes.data) setTiposAtendimento(tiposRes.data);
    setLoading(false);
  }

  async function handleConnectGoogleCalendar() {
    if (!user?.id) {
      toast.error('Você precisa estar logado');
      return;
    }

    setGcalLoading(true);
    const { auth_url, error } = await initiateGoogleCalendarAuth();
    
    if (error || !auth_url) {
      toast.error(error || 'Erro ao iniciar conexão');
      setGcalLoading(false);
      return;
    }

    const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-callback`;
    const appRedirect = `${window.location.origin}/admin/configuracoes`;
    
    const fullAuthUrl = buildGoogleCalendarAuthUrl(auth_url, user.id, callbackUrl, appRedirect);
    window.location.href = fullAuthUrl;
  }

  async function handleDisconnectGoogleCalendar() {
    if (!user?.id) return;

    setGcalLoading(true);
    const { success, error } = await disconnectGoogleCalendar(user.id);
    
    if (success) {
      toast.success('Google Calendar desconectado');
      setGcalStatus({ connected: false });
    } else {
      toast.error(error || 'Erro ao desconectar');
    }
    setGcalLoading(false);
  }

  async function handleSyncGoogleReviews() {
    setReviewsSyncing(true);
    setReviewsSyncResult(null);
    
    const result = await sincronizarAvaliacoesManualmente();
    setReviewsSyncResult(result);
    
    if (result.success) {
      toast.success(`${result.synced || 0} avaliações sincronizadas!`);
    } else {
      toast.error(result.message || 'Erro ao sincronizar avaliações');
    }
    
    setReviewsSyncing(false);
  }

  // Clinica handlers
  function abrirModalClinica(clinica?: Clinica) {
    if (clinica) {
      setEditingClinica(clinica);
      setClinicaForm({
        nome: clinica.nome,
        slug: clinica.slug,
        endereco: clinica.endereco || "",
        telefone: clinica.telefone || "",
        ativo: clinica.ativo,
      });
    } else {
      setEditingClinica(null);
      setClinicaForm({ nome: "", slug: "", endereco: "", telefone: "", ativo: true });
    }
    setClinicaModalOpen(true);
  }

  async function salvarClinica() {
    if (!clinicaForm.nome || !clinicaForm.slug) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }

    if (editingClinica) {
      const { error } = await atualizarClinica(editingClinica.id, clinicaForm);
      if (error) {
        toast.error("Erro ao atualizar clínica");
        return;
      }
      toast.success("Clínica atualizada");
    } else {
      const { error } = await criarClinica(clinicaForm);
      if (error) {
        toast.error("Erro ao criar clínica");
        return;
      }
      toast.success("Clínica criada");
    }

    setClinicaModalOpen(false);
    carregarDados();
  }

  async function toggleClinicaAtivo(clinica: Clinica) {
    const { error } = await atualizarClinica(clinica.id, { ativo: !clinica.ativo });
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success(clinica.ativo ? "Clínica desativada" : "Clínica ativada");
    carregarDados();
  }

  // Servico handlers
  function abrirModalServico(servico?: Servico) {
    if (servico) {
      setEditingServico(servico);
      setServicoForm({
        nome: servico.nome,
        descricao: servico.descricao || "",
        duracao_min: servico.duracao_min,
        ativo: servico.ativo,
      });
    } else {
      setEditingServico(null);
      setServicoForm({ nome: "", descricao: "", duracao_min: 30, ativo: true });
    }
    setServicoModalOpen(true);
  }

  async function salvarServico() {
    if (!servicoForm.nome) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (editingServico) {
      const { error } = await atualizarServico(editingServico.id, servicoForm);
      if (error) {
        toast.error("Erro ao atualizar serviço");
        return;
      }
      toast.success("Serviço atualizado");
    } else {
      const { error } = await criarServico(servicoForm);
      if (error) {
        toast.error("Erro ao criar serviço");
        return;
      }
      toast.success("Serviço criado");
    }

    setServicoModalOpen(false);
    carregarDados();
  }

  async function toggleServicoAtivo(servico: Servico) {
    const { error } = await atualizarServico(servico.id, { ativo: !servico.ativo });
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success(servico.ativo ? "Serviço desativado" : "Serviço ativado");
    carregarDados();
  }

  // Convenio handlers
  function abrirModalConvenio(convenio?: Convenio) {
    if (convenio) {
      setEditingConvenio(convenio);
      setConvenioForm({
        nome: convenio.nome,
        slug: convenio.slug,
        valor_consulta: convenio.valor_consulta,
        ativo: convenio.ativo,
      });
    } else {
      setEditingConvenio(null);
      setConvenioForm({ nome: "", slug: "", valor_consulta: null, ativo: true });
    }
    setConvenioModalOpen(true);
  }

  async function salvarConvenio() {
    if (!convenioForm.nome || !convenioForm.slug) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }

    if (editingConvenio) {
      const { error } = await atualizarConvenio(editingConvenio.id, convenioForm);
      if (error) {
        toast.error("Erro ao atualizar convênio");
        return;
      }
      toast.success("Convênio atualizado");
    } else {
      const { error } = await criarConvenio(convenioForm);
      if (error) {
        toast.error("Erro ao criar convênio");
        return;
      }
      toast.success("Convênio criado");
    }

    setConvenioModalOpen(false);
    carregarDados();
  }

  async function toggleConvenioAtivo(convenio: Convenio) {
    const { error } = await atualizarConvenio(convenio.id, { ativo: !convenio.ativo });
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success(convenio.ativo ? "Convênio desativado" : "Convênio ativado");
    carregarDados();
  }

  // Tipo Atendimento handlers
  function abrirModalTipo(tipo?: TipoAtendimento) {
    if (tipo) {
      setEditingTipo(tipo);
      setTipoForm({
        nome: tipo.nome,
        slug: tipo.slug,
        descricao: tipo.descricao || "",
        ativo: tipo.ativo,
      });
    } else {
      setEditingTipo(null);
      setTipoForm({ nome: "", slug: "", descricao: "", ativo: true });
    }
    setTipoModalOpen(true);
  }

  async function salvarTipo() {
    if (!tipoForm.nome || !tipoForm.slug) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }

    if (editingTipo) {
      const { error } = await atualizarTipoAtendimento(editingTipo.id, tipoForm);
      if (error) {
        toast.error("Erro ao atualizar tipo");
        return;
      }
      toast.success("Tipo de atendimento atualizado");
    } else {
      const { error } = await criarTipoAtendimento(tipoForm);
      if (error) {
        toast.error("Erro ao criar tipo");
        return;
      }
      toast.success("Tipo de atendimento criado");
    }

    setTipoModalOpen(false);
    carregarDados();
  }

  async function toggleTipoAtivo(tipo: TipoAtendimento) {
    const { error } = await atualizarTipoAtendimento(tipo.id, { ativo: !tipo.ativo });
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success(tipo.ativo ? "Tipo desativado" : "Tipo ativado");
    carregarDados();
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie clínicas, serviços, convênios e integrações</p>
        </div>

        <Tabs defaultValue="clinicas" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-6">
            <TabsTrigger value="clinicas" className="gap-2 text-xs sm:text-sm">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clínicas</span>
            </TabsTrigger>
            <TabsTrigger value="tipos" className="gap-2 text-xs sm:text-sm">
              <Stethoscope className="h-4 w-4" />
              <span className="hidden sm:inline">Tipos</span>
            </TabsTrigger>
            <TabsTrigger value="convenios" className="gap-2 text-xs sm:text-sm">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Convênios</span>
            </TabsTrigger>
            <TabsTrigger value="servicos" className="gap-2 text-xs sm:text-sm">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Serviços</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2 text-xs sm:text-sm">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="integracoes" className="gap-2 text-xs sm:text-sm">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Integrações</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Clínicas */}
          <TabsContent value="clinicas" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Clínicas Cadastradas</h2>
              <Button onClick={() => abrirModalClinica()} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Clínica
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {clinicas.map((clinica) => (
                  <Card key={clinica.id} className={!clinica.ativo ? "opacity-60" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{clinica.nome}</CardTitle>
                          <p className="text-sm text-muted-foreground font-mono">{clinica.slug}</p>
                        </div>
                        <Badge variant={clinica.ativo ? "default" : "secondary"}>
                          {clinica.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {clinica.endereco && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{clinica.endereco}</span>
                          </div>
                        )}
                        {clinica.telefone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span>{clinica.telefone}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => abrirModalClinica(clinica)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleClinicaAtivo(clinica)}>
                          {clinica.ativo ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab Tipos de Atendimento */}
          <TabsContent value="tipos" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Tipos de Atendimento</h2>
              <Button onClick={() => abrirModalTipo()} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Tipo
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tiposAtendimento.map((tipo) => (
                  <Card key={tipo.id} className={!tipo.ativo ? "opacity-60" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{tipo.nome}</CardTitle>
                          <p className="text-sm text-muted-foreground font-mono">{tipo.slug}</p>
                        </div>
                        <Badge variant={tipo.ativo ? "default" : "secondary"}>
                          {tipo.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {tipo.descricao && (
                        <p className="text-sm text-muted-foreground mb-4">{tipo.descricao}</p>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => abrirModalTipo(tipo)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleTipoAtivo(tipo)}>
                          {tipo.ativo ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab Convênios */}
          <TabsContent value="convenios" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Convênios</h2>
              <Button onClick={() => abrirModalConvenio()} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Convênio
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {convenios.map((convenio) => (
                  <Card key={convenio.id} className={!convenio.ativo ? "opacity-60" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{convenio.nome}</CardTitle>
                          <p className="text-sm text-muted-foreground font-mono">{convenio.slug}</p>
                        </div>
                        <Badge variant={convenio.ativo ? "default" : "secondary"}>
                          {convenio.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="h-4 w-4" />
                          <span>
                            {convenio.valor_consulta 
                              ? `R$ ${convenio.valor_consulta.toFixed(2)}` 
                              : "Valor não definido"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => abrirModalConvenio(convenio)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleConvenioAtivo(convenio)}>
                          {convenio.ativo ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab Serviços */}
          <TabsContent value="servicos" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Serviços Disponíveis</h2>
              <Button onClick={() => abrirModalServico()} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Serviço
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {servicos.map((servico) => (
                  <Card key={servico.id} className={!servico.ativo ? "opacity-60" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{servico.nome}</CardTitle>
                        <Badge variant={servico.ativo ? "default" : "secondary"}>
                          {servico.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{servico.duracao_min} minutos</span>
                        </div>
                        {servico.descricao && (
                          <p className="text-muted-foreground line-clamp-2">{servico.descricao}</p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => abrirModalServico(servico)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleServicoAtivo(servico)}>
                          {servico.ativo ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab Integrações */}
          <TabsContent value="integracoes" className="mt-6">
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Integrações</h2>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        Google Calendar
                        {gcalStatus.connected && (
                          <Badge variant="default" className="bg-green-600">Conectado</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Sincronize agendamentos automaticamente com o Google Calendar
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {gcalStatus.connected ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Calendário:</span>
                        <code className="px-2 py-1 bg-muted rounded">
                          {gcalStatus.calendar_id || 'primary'}
                        </code>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Novos agendamentos serão automaticamente adicionados ao seu Google Calendar.
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleDisconnectGoogleCalendar}
                        disabled={gcalLoading}
                        className="gap-2"
                      >
                        {gcalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                        Desconectar
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Conecte sua conta Google para sincronizar automaticamente os agendamentos.
                      </p>
                      <Button
                        onClick={handleConnectGoogleCalendar}
                        disabled={gcalLoading}
                        className="gap-2"
                      >
                        {gcalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                        Conectar Google Calendar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Google Reviews Sync */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Star className="h-6 w-6 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">Google Reviews</CardTitle>
                      <CardDescription>
                        Sincronize avaliações do Google Places automaticamente
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      As avaliações são sincronizadas automaticamente todos os dias às 6h. 
                      Use o botão abaixo para sincronizar manualmente.
                    </p>
                    
                    {reviewsSyncResult && (
                      <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                        reviewsSyncResult.success 
                          ? 'bg-green-500/10 text-green-600' 
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {reviewsSyncResult.success 
                          ? <CheckCircle2 className="h-4 w-4" />
                          : <XCircle className="h-4 w-4" />
                        }
                        <span>{reviewsSyncResult.message}</span>
                      </div>
                    )}
                    
                    <Button
                      onClick={handleSyncGoogleReviews}
                      disabled={reviewsSyncing}
                      className="gap-2"
                    >
                      {reviewsSyncing 
                        ? <Loader2 className="h-4 w-4 animate-spin" /> 
                        : <RefreshCw className="h-4 w-4" />
                      }
                      {reviewsSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Two-Factor Authentication */}
              <TwoFactorSetup />
            </div>
          </TabsContent>

          {/* Tab Templates WhatsApp */}
          <TabsContent value="templates" className="mt-6">
            <TemplatesWhatsAppTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Clínica */}
      <Dialog open={clinicaModalOpen} onOpenChange={setClinicaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClinica ? "Editar Clínica" : "Nova Clínica"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={clinicaForm.nome}
                onChange={(e) => setClinicaForm({ ...clinicaForm, nome: e.target.value })}
                placeholder="Nome da clínica"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug * (identificador único)</Label>
              <Input
                value={clinicaForm.slug}
                onChange={(e) => setClinicaForm({ ...clinicaForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="clinicor"
              />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={clinicaForm.endereco}
                onChange={(e) => setClinicaForm({ ...clinicaForm, endereco: e.target.value })}
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={clinicaForm.telefone}
                onChange={(e) => setClinicaForm({ ...clinicaForm, telefone: e.target.value })}
                placeholder="(91) 98165-3200"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={clinicaForm.ativo}
                onCheckedChange={(checked) => setClinicaForm({ ...clinicaForm, ativo: checked })}
              />
              <Label>Clínica ativa</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setClinicaModalOpen(false)}>Cancelar</Button>
              <Button onClick={salvarClinica}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Serviço */}
      <Dialog open={servicoModalOpen} onOpenChange={setServicoModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingServico ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={servicoForm.nome}
                onChange={(e) => setServicoForm({ ...servicoForm, nome: e.target.value })}
                placeholder="Nome do serviço"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={servicoForm.descricao}
                onChange={(e) => setServicoForm({ ...servicoForm, descricao: e.target.value })}
                placeholder="Descrição do serviço"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Duração (minutos)</Label>
              <Input
                type="number"
                value={servicoForm.duracao_min}
                onChange={(e) => setServicoForm({ ...servicoForm, duracao_min: parseInt(e.target.value) || 30 })}
                min={5}
                max={240}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={servicoForm.ativo}
                onCheckedChange={(checked) => setServicoForm({ ...servicoForm, ativo: checked })}
              />
              <Label>Serviço ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setServicoModalOpen(false)}>Cancelar</Button>
              <Button onClick={salvarServico}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Convênio */}
      <Dialog open={convenioModalOpen} onOpenChange={setConvenioModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConvenio ? "Editar Convênio" : "Novo Convênio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={convenioForm.nome}
                onChange={(e) => setConvenioForm({ ...convenioForm, nome: e.target.value })}
                placeholder="Nome do convênio"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug * (identificador único)</Label>
              <Input
                value={convenioForm.slug}
                onChange={(e) => setConvenioForm({ ...convenioForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="particular"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor da Consulta (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={convenioForm.valor_consulta ?? ""}
                onChange={(e) => setConvenioForm({ 
                  ...convenioForm, 
                  valor_consulta: e.target.value ? parseFloat(e.target.value) : null 
                })}
                placeholder="250.00"
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para convênios (o valor é coberto pelo plano)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={convenioForm.ativo}
                onCheckedChange={(checked) => setConvenioForm({ ...convenioForm, ativo: checked })}
              />
              <Label>Convênio ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setConvenioModalOpen(false)}>Cancelar</Button>
              <Button onClick={salvarConvenio}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Tipo de Atendimento */}
      <Dialog open={tipoModalOpen} onOpenChange={setTipoModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTipo ? "Editar Tipo de Atendimento" : "Novo Tipo de Atendimento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={tipoForm.nome}
                onChange={(e) => setTipoForm({ ...tipoForm, nome: e.target.value })}
                placeholder="Nome do tipo"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug * (identificador único)</Label>
              <Input
                value={tipoForm.slug}
                onChange={(e) => setTipoForm({ ...tipoForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="consulta"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (mostrada no formulário)</Label>
              <Textarea
                value={tipoForm.descricao}
                onChange={(e) => setTipoForm({ ...tipoForm, descricao: e.target.value })}
                placeholder="Ex: Campo visual, OCT, mapeamento etc."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={tipoForm.ativo}
                onCheckedChange={(checked) => setTipoForm({ ...tipoForm, ativo: checked })}
              />
              <Label>Tipo ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setTipoModalOpen(false)}>Cancelar</Button>
              <Button onClick={salvarTipo}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
