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
import { Building2, Stethoscope, Plus, Pencil, Clock, MapPin, Phone, Calendar, Link2, Unlink, Loader2 } from "lucide-react";
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
  checkGoogleCalendarConnection,
  initiateGoogleCalendarAuth,
  disconnectGoogleCalendar,
  buildGoogleCalendarAuthUrl,
  GoogleCalendarStatus
} from "@/services/googleCalendar";
import { useAuth } from "@/contexts/AuthContext";

export default function Configuracoes() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Google Calendar state
  const [gcalStatus, setGcalStatus] = useState<GoogleCalendarStatus>({ connected: false });
  const [gcalLoading, setGcalLoading] = useState(false);
  
  // Modal states
  const [clinicaModalOpen, setClinicaModalOpen] = useState(false);
  const [servicoModalOpen, setServicoModalOpen] = useState(false);
  const [editingClinica, setEditingClinica] = useState<Clinica | null>(null);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);

  // Form states for clinica
  const [clinicaForm, setClinicaForm] = useState({
    nome: "",
    slug: "",
    endereco: "",
    telefone: "",
    ativo: true,
  });

  // Form states for servico
  const [servicoForm, setServicoForm] = useState({
    nome: "",
    descricao: "",
    duracao_min: 30,
    ativo: true,
  });

  useEffect(() => {
    carregarDados();
    
    // Handle OAuth callback parameters
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success === 'true') {
      toast.success('Google Calendar conectado com sucesso!');
      // Clear URL params
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
    const [clinicasRes, servicosRes] = await Promise.all([
      listarTodasClinicas(),
      listarTodosServicos(),
    ]);

    if (clinicasRes.data) setClinicas(clinicasRes.data);
    if (servicosRes.data) setServicos(servicosRes.data);
    setLoading(false);
  }

  async function handleConnectGoogleCalendar() {
    if (!user?.id) {
      toast.error('Você precisa estar logado');
      return;
    }

    setGcalLoading(true);
    
    // Get the base auth URL
    const { auth_url, error } = await initiateGoogleCalendarAuth();
    
    if (error || !auth_url) {
      toast.error(error || 'Erro ao iniciar conexão');
      setGcalLoading(false);
      return;
    }

    // Build URL with state parameter for callback
    const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-callback`;
    const appRedirect = `${window.location.origin}/admin/configuracoes`;
    
    const fullAuthUrl = buildGoogleCalendarAuthUrl(
      auth_url,
      user.id,
      callbackUrl,
      appRedirect
    );

    // Redirect to Google OAuth
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

  async function toggleClinicaAtivo(clinica: Clinica) {
    const { error } = await atualizarClinica(clinica.id, { ativo: !clinica.ativo });
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success(clinica.ativo ? "Clínica desativada" : "Clínica ativada");
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie clínicas, serviços e integrações</p>
        </div>

        <Tabs defaultValue="clinicas" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="clinicas" className="gap-2">
              <Building2 className="h-4 w-4" />
              Clínicas
            </TabsTrigger>
            <TabsTrigger value="servicos" className="gap-2">
              <Stethoscope className="h-4 w-4" />
              Serviços
            </TabsTrigger>
            <TabsTrigger value="integracoes" className="gap-2">
              <Link2 className="h-4 w-4" />
              Integrações
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => abrirModalClinica(clinica)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleClinicaAtivo(clinica)}
                        >
                          {clinica.ativo ? "Desativar" : "Ativar"}
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
                          <p className="text-muted-foreground line-clamp-2">
                            {servico.descricao}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => abrirModalServico(servico)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleServicoAtivo(servico)}
                        >
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

              {/* Google Calendar Card */}
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
                          <Badge variant="default" className="bg-green-600">
                            Conectado
                          </Badge>
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
                        Alterações em agendamentos existentes também serão sincronizadas.
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleDisconnectGoogleCalendar}
                        disabled={gcalLoading}
                        className="gap-2"
                      >
                        {gcalLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Unlink className="h-4 w-4" />
                        )}
                        Desconectar
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Conecte sua conta Google para sincronizar automaticamente os agendamentos 
                        com seu Google Calendar. Isso permite visualizar os compromissos da clínica 
                        diretamente no seu calendário pessoal ou compartilhado.
                      </p>
                      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                        <span className="text-muted-foreground">
                          <strong>Benefícios:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            <li>Visualize agendamentos no Google Calendar</li>
                            <li>Receba notificações de compromissos</li>
                            <li>Sincronização bidirecional automática</li>
                            <li>Compartilhe agenda com equipe</li>
                          </ul>
                        </span>
                      </div>
                      <Button
                        onClick={handleConnectGoogleCalendar}
                        disabled={gcalLoading}
                        className="gap-2"
                      >
                        {gcalLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Calendar className="h-4 w-4" />
                        )}
                        Conectar Google Calendar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Clínica */}
      <Dialog open={clinicaModalOpen} onOpenChange={setClinicaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingClinica ? "Editar Clínica" : "Nova Clínica"}
            </DialogTitle>
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
              <Button variant="outline" onClick={() => setClinicaModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarClinica}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Serviço */}
      <Dialog open={servicoModalOpen} onOpenChange={setServicoModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingServico ? "Editar Serviço" : "Novo Serviço"}
            </DialogTitle>
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
              <Button variant="outline" onClick={() => setServicoModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarServico}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
