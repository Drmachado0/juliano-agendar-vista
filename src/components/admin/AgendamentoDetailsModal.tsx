import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Agendamento, atualizarStatusCrm, atualizarObservacoes, buscarObservacoesDecrypted, excluirAgendamento } from "@/services/agendamentos";
import { notificarN8n } from "@/services/integracoes";
import { listarAuditCrm, ACAO_LABELS, type CrmAuditEntry } from "@/services/crmAudit";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  CreditCard,
  Check,
  Bell,
  Loader2,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  PhoneCall,
  FileText,
  History,
  ShieldCheck,
  Zap,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getLocalBadgeClasses, LOCAL_SHORT_LABELS, getLocalGrupo } from "@/lib/localAtendimento";
import { getOrigemGrupo, ORIGEM_LABELS, ORIGEM_BADGE_SOFT_CLASSES } from "@/lib/origemLead";

const TAB_STORAGE_KEY = "crm:modal:tab";
type ModalTab = "resumo" | "consulta" | "historico" | "mensagens" | "auditoria";

interface MensagemRow {
  id: string;
  direcao: string;
  conteudo: string;
  created_at: string;
  status_envio: string | null;
}

interface AgendamentoDetailsModalProps {
  agendamento: Agendamento | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const statusColors: Record<string, string> = {
  "NOVO LEAD": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  "CLINICOR": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "HGP": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  "BELÉM": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

// Configuração de status de confirmação
const confirmationStatusConfig: Record<string, { label: string; icon: React.ElementType; className: string; description: string }> = {
  'nao_enviado': { 
    label: 'Não enviado', 
    icon: MessageSquare, 
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
    description: 'Nenhuma confirmação foi enviada ainda'
  },
  'aguardando_confirmacao': { 
    label: 'Aguardando resposta', 
    icon: Clock, 
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    description: 'Confirmação enviada, aguardando resposta do paciente'
  },
  'confirmado': { 
    label: 'Confirmado pelo paciente', 
    icon: CheckCircle, 
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    description: 'Paciente confirmou presença'
  },
  'cancelado_pelo_paciente': { 
    label: 'Cancelado pelo paciente', 
    icon: XCircle, 
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    description: 'Paciente solicitou cancelamento'
  },
  'falha_envio': { 
    label: 'Falha no envio', 
    icon: AlertTriangle, 
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    description: 'Houve falha ao enviar a confirmação'
  },
};

const AgendamentoDetailsModal = ({ agendamento, isOpen, onClose, onUpdate }: AgendamentoDetailsModalProps) => {
  const [observacoes, setObservacoes] = useState("");
  const [statusCrm, setStatusCrm] = useState("NOVO LEAD");
  const [saving, setSaving] = useState(false);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);
  const [loadingObservacoes, setLoadingObservacoes] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [tab, setTab] = useState<ModalTab>(() => {
    try {
      const v = sessionStorage.getItem(TAB_STORAGE_KEY);
      if (v === "consulta" || v === "historico" || v === "mensagens" || v === "auditoria") return v;
    } catch {/* ignore */}
    return "resumo";
  });
  const [mensagens, setMensagens] = useState<MensagemRow[]>([]);
  const [loadingMensagens, setLoadingMensagens] = useState(false);
  const [auditoria, setAuditoria] = useState<CrmAuditEntry[]>([]);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);

  useEffect(() => {
    try { sessionStorage.setItem(TAB_STORAGE_KEY, tab); } catch {/* ignore */}
  }, [tab]);

  // Update local state when agendamento changes
  useEffect(() => {
    if (agendamento) {
      setStatusCrm(agendamento.status_crm);
      
      // Fetch decrypted observations
      const fetchDecryptedObservacoes = async () => {
        setLoadingObservacoes(true);
        try {
          const { data } = await buscarObservacoesDecrypted(agendamento.id);
          setObservacoes(data || "");
        } catch (error) {
          console.error('Erro ao carregar observações:', error);
          setObservacoes("");
        } finally {
          setLoadingObservacoes(false);
        }
      };
      
      fetchDecryptedObservacoes();
    }
  }, [agendamento]);

  // Fetch mensagens when tab "mensagens" is opened
  useEffect(() => {
    if (!agendamento || !isOpen || tab !== "mensagens") return;
    let cancel = false;
    setLoadingMensagens(true);
    (async () => {
      const { data, error } = await supabase
        .from("mensagens_whatsapp")
        .select("id, direcao, conteudo, created_at, status_envio")
        .eq("agendamento_id", agendamento.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancel) {
        if (!error && data) setMensagens(data as MensagemRow[]);
        setLoadingMensagens(false);
      }
    })();
    return () => { cancel = true; };
  }, [agendamento, isOpen, tab]);

  // Fetch auditoria when tab "auditoria" is opened
  useEffect(() => {
    if (!agendamento || !isOpen || tab !== "auditoria") return;
    let cancel = false;
    setLoadingAuditoria(true);
    (async () => {
      const { data } = await listarAuditCrm({ agendamentoId: agendamento.id, limit: 50 });
      if (!cancel) {
        setAuditoria(data);
        setLoadingAuditoria(false);
      }
    })();
    return () => { cancel = true; };
  }, [agendamento, isOpen, tab]);


  if (!agendamento) return null;

  const confirmationStatus = agendamento.confirmation_status || 'nao_enviado';
  const statusConfig = confirmationStatusConfig[confirmationStatus] || confirmationStatusConfig['nao_enviado'];
  const StatusIcon = statusConfig.icon;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update status if changed
      if (statusCrm !== agendamento.status_crm) {
        const { error } = await atualizarStatusCrm(agendamento.id, statusCrm);
        if (error) throw error;
        
        // Notify n8n about status change
        await notificarN8n('status_crm_atualizado', { 
          ...agendamento, 
          status_crm: statusCrm 
        });
      }

      // Update observacoes if changed
      if (observacoes !== agendamento.observacoes_internas) {
        const { error } = await atualizarObservacoes(agendamento.id, observacoes);
        if (error) throw error;
      }

      toast({
        title: "Salvo!",
        description: "Alterações salvas com sucesso.",
      });

      onUpdate();
      onClose();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar alterações.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResendConfirmation = async () => {
    setSendingConfirmation(true);
    try {
      // Chamar a edge function de confirmação diretamente
      const { data, error } = await supabase.functions.invoke('confirmar-agendamento-whatsapp', {
        body: {
          telefone: agendamento.telefone_whatsapp,
          nome_completo: agendamento.nome_completo,
          data_agendamento: agendamento.data_agendamento,
          hora_agendamento: agendamento.hora_agendamento,
          local_atendimento: agendamento.local_atendimento,
          agendamento_id: agendamento.id,
        }
      });

      if (error) throw error;

      // Atualizar status no banco
      await supabase
        .from('agendamentos')
        .update({ 
          confirmation_status: 'aguardando_confirmacao',
          confirmation_sent_at: new Date().toISOString(),
          confirmation_channel: 'whatsapp'
        })
        .eq('id', agendamento.id);

      toast({
        title: "Confirmação reenviada!",
        description: "Mensagem de confirmação enviada para o WhatsApp do paciente.",
      });

      onUpdate();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao reenviar confirmação.";
      toast({
        title: "Erro ao enviar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSendingConfirmation(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await excluirAgendamento(agendamento.id);
      if (error) throw error;

      toast({
        title: "Excluído!",
        description: "Agendamento excluído com sucesso.",
      });

      onUpdate();
      onClose();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao excluir agendamento.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Sticky header com identidade do paciente + CTAs principais */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 sticky top-0 bg-background/95 backdrop-blur z-10">
          <DialogTitle className="sr-only">
            Detalhes do agendamento de {agendamento.nome_completo}
          </DialogTitle>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-11 w-11 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-semibold shrink-0">
                {agendamento.nome_completo.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-lg text-foreground truncate tracking-tight">
                  {agendamento.nome_completo}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  {agendamento.telefone_whatsapp}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("font-medium", statusColors[agendamento.status_crm])}>
                {agendamento.status_crm}
              </Badge>
              {(() => {
                const og = getOrigemGrupo(agendamento.origem);
                return (
                  <Badge variant="outline" className={cn("text-[11px] font-medium border", ORIGEM_BADGE_SOFT_CLASSES[og])}>
                    {ORIGEM_LABELS[og]}
                  </Badge>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button asChild size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              <a
                href={`https://wa.me/${(agendamento.telefone_whatsapp || "").replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={`tel:${(agendamento.telefone_whatsapp || "").replace(/\D/g, "")}`}>
                <PhoneCall className="h-4 w-4" />
                Ligar
              </a>
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 space-y-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as ModalTab)} className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="resumo" className="gap-1.5">
                <User className="h-3.5 w-3.5" />
                Resumo
              </TabsTrigger>
              <TabsTrigger value="consulta" className="gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Consulta
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Histórico
              </TabsTrigger>
              <TabsTrigger value="mensagens" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Mensagens
              </TabsTrigger>
              <TabsTrigger value="auditoria" className="gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Auditoria
              </TabsTrigger>
            </TabsList>

            {/* RESUMO: Dados do paciente + Tracking + Preferências */}
            <TabsContent value="resumo" className="space-y-5 mt-0">
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  Dados do Paciente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/40 p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Nome completo</p>
                    <p className="font-medium text-sm">{agendamento.nome_completo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telefone/WhatsApp
                    </p>
                    <p className="font-medium text-sm">{agendamento.telefone_whatsapp}</p>
                  </div>
                  {agendamento.email && (
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> E-mail
                      </p>
                      <p className="font-medium text-sm break-all">{agendamento.email}</p>
                    </div>
                  )}
                  {agendamento.data_nascimento && (
                    <div>
                      <p className="text-xs text-muted-foreground">Data de nascimento</p>
                      <p className="font-medium text-sm">
                        {format(new Date(agendamento.data_nascimento), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {(agendamento.aceita_primeiro_horario || agendamento.aceita_contato_whatsapp_email) && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground text-sm">Preferências</h3>
                  <div className="flex flex-wrap gap-2">
                    {agendamento.aceita_primeiro_horario && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Aceita primeiro horário disponível
                      </Badge>
                    )}
                    {agendamento.aceita_contato_whatsapp_email && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Bell className="h-3 w-3" />
                        Aceita receber notificações
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Origem & Tracking */}
              {(() => {
                const a = agendamento as any;
                const trackingFields: Array<[string, string | null | undefined]> = [
                  ['Origem', a.origem],
                  ['utm_source', a.utm_source],
                  ['utm_medium', a.utm_medium],
                  ['utm_campaign', a.utm_campaign],
                  ['utm_content', a.utm_content],
                  ['utm_term', a.utm_term],
                  ['fbclid', a.fbclid],
                  ['gclid', a.gclid],
                  ['gbraid', a.gbraid],
                  ['wbraid', a.wbraid],
                  ['referrer', a.referrer],
                ];
                const hasAny = trackingFields.some(([, v]) => !!v) || !!a.landing_page;
                if (!hasAny) return null;
                return (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground text-sm">Origem & Tracking</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 bg-muted/40 p-4 rounded-lg text-sm">
                      {trackingFields.map(([label, value]) =>
                        value ? (
                          <div key={label} className="break-words">
                            <span className="text-xs text-muted-foreground">{label}: </span>
                            <span className="font-mono text-xs">{value}</span>
                          </div>
                        ) : null,
                      )}
                      {a.landing_page && (
                        <div className="md:col-span-2 break-words">
                          <span className="text-xs text-muted-foreground">landing_page: </span>
                          <a
                            href={a.landing_page}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {a.landing_page}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            {/* CONSULTA: detalhes da consulta + confirmação WhatsApp + status / observações */}
            <TabsContent value="consulta" className="space-y-5 mt-0">
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  Detalhes da Consulta
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/40 p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Data
                    </p>
                    <p className="font-medium text-sm">
                      {agendamento.data_agendamento
                        ? format(new Date(agendamento.data_agendamento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        : <span className="text-amber-600 italic">Aguardando</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Horário
                    </p>
                    <p className="font-medium text-sm">
                      {agendamento.hora_agendamento
                        ? agendamento.hora_agendamento.slice(0, 5)
                        : <span className="text-amber-600 italic">Aguardando</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo de atendimento</p>
                    <p className="font-medium text-sm">{agendamento.tipo_atendimento}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Local
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[11px] px-2 py-0.5 border", getLocalBadgeClasses(agendamento.local_atendimento))}>
                        {LOCAL_SHORT_LABELS[getLocalGrupo(agendamento.local_atendimento)]}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">{agendamento.local_atendimento}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Convênio
                    </p>
                    <p className="font-medium text-sm">
                      {agendamento.convenio === "Outro" ? agendamento.convenio_outro : agendamento.convenio}
                    </p>
                  </div>
                  {agendamento.detalhe_exame_ou_cirurgia && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground">Detalhes (exame/cirurgia)</p>
                      <p className="font-medium text-sm">{agendamento.detalhe_exame_ou_cirurgia}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* WhatsApp Confirmation Status */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  Confirmação WhatsApp
                </h3>
                <div className="bg-muted/40 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge className={cn("flex items-center gap-1.5", statusConfig.className)}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {statusConfig.label}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResendConfirmation}
                      disabled={sendingConfirmation || confirmationStatus === 'confirmado'}
                      className="gap-1.5"
                    >
                      {sendingConfirmation ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      {confirmationStatus === 'nao_enviado' ? 'Enviar' : 'Reenviar'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{statusConfig.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {agendamento.confirmation_sent_at && (
                      <div>
                        <p className="text-muted-foreground">Enviado em</p>
                        <p className="font-medium">
                          {format(new Date(agendamento.confirmation_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    )}
                    {agendamento.confirmation_response_at && (
                      <div>
                        <p className="text-muted-foreground">Respondido em</p>
                        <p className="font-medium">
                          {format(new Date(agendamento.confirmation_response_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    )}
                  </div>
                  {confirmationStatus === 'falha_envio' && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-md border border-orange-200 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Falha ao enviar confirmação. Tente reenviar manualmente.
                    </div>
                  )}
                </div>
              </div>

              {/* Gerenciamento — Status + Observações */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground text-sm">Gerenciamento</h3>
                <div className="space-y-2">
                  <Label className="text-xs">Status CRM</Label>
                  <Select value={statusCrm} onValueChange={setStatusCrm}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOVO LEAD">Novo contato</SelectItem>
                      <SelectItem value="PRECISA_DE_HUMANO">Aguarda recepção</SelectItem>
                      <SelectItem value="AGUARDANDO">Em análise</SelectItem>
                      <SelectItem value="CLINICOR">Clinicor</SelectItem>
                      <SelectItem value="HGP">HGP</SelectItem>
                      <SelectItem value="BELÉM">Belém</SelectItem>
                      <SelectItem value="ATENDIDO">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Observações internas (criptografadas)</Label>
                  {loadingObservacoes ? (
                    <div className="flex items-center gap-2 text-muted-foreground h-24 border rounded-md px-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Descriptografando...</span>
                    </div>
                  ) : (
                    <Textarea
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Adicione notas internas sobre este agendamento..."
                      rows={4}
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* HISTÓRICO: última conversa + qualquer histórico futuro */}
            <TabsContent value="historico" className="space-y-4 mt-0">
              {(() => {
                const a = agendamento as any;
                if (!a.ultima_msg) {
                  return (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Sem histórico de conversa registrado.</p>
                    </div>
                  );
                }
                const dt = a.ultima_msg_at ? new Date(a.ultima_msg_at) : null;
                const rel = dt ? formatDistanceToNow(dt, { locale: ptBR, addSuffix: true }) : '';
                return (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-foreground text-sm">Última conversa</h3>
                    <div className="bg-muted/40 p-4 rounded-lg text-sm space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="font-mono">
                          {a.ultima_msg_direcao === 'IN' ? '← recebida' : '→ enviada'}
                        </Badge>
                        <span>{rel}</span>
                      </div>
                      <p className="text-foreground whitespace-pre-wrap">{a.ultima_msg}</p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                      <a href="/admin/whatsapp">
                        Abrir conversa completa <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                );
              })()}
            </TabsContent>

            {/* MENSAGENS: últimas 20 mensagens do agendamento */}
            <TabsContent value="mensagens" className="mt-0">
              {loadingMensagens ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : mensagens.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma mensagem vinculada a este agendamento.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {mensagens.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-lg border p-3 text-sm",
                        m.direcao === "IN"
                          ? "bg-muted/40 border-border/60"
                          : "bg-primary/5 border-primary/20"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {m.direcao === "IN" ? "← recebida" : "→ enviada"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {format(new Date(m.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-foreground/90">{m.conteudo}</p>
                      {m.status_envio && m.direcao === "OUT" && (
                        <p className="text-[10px] text-muted-foreground mt-1">{m.status_envio}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* AUDITORIA: eventos do crm_audit_log */}
            <TabsContent value="auditoria" className="mt-0">
              {loadingAuditoria ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : auditoria.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum evento de auditoria registrado.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {auditoria.map((e) => (
                    <div key={e.id} className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Zap className="h-2.5 w-2.5" />
                          {ACAO_LABELS[e.acao] || e.acao}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {format(new Date(e.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {(e.status_anterior || e.status_novo) && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span>{e.status_anterior || "—"}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="font-medium text-foreground">{e.status_novo || "—"}</span>
                        </div>
                      )}
                      {(e.user_name || e.user_email) && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          por <span className="text-foreground/80">{e.user_name || e.user_email}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Actions footer (sempre visível) */}
          <div className="flex justify-between gap-3 pt-2 flex-wrap">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Fechar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default AgendamentoDetailsModal;
