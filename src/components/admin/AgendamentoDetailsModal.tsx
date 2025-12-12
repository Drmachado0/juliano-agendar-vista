import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Agendamento, atualizarStatusCrm, atualizarObservacoes, buscarObservacoesDecrypted, excluirAgendamento } from "@/services/agendamentos";
import { notificarN8n } from "@/services/integracoes";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
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
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Detalhes do Agendamento</span>
            <Badge className={cn("font-medium", statusColors[agendamento.status_crm])}>
              {agendamento.status_crm}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados do Paciente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Nome completo</p>
                <p className="font-medium">{agendamento.nome_completo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Telefone/WhatsApp
                </p>
                <p className="font-medium">{agendamento.telefone_whatsapp}</p>
              </div>
              {agendamento.email && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> E-mail
                  </p>
                  <p className="font-medium">{agendamento.email}</p>
                </div>
              )}
              {agendamento.data_nascimento && (
                <div>
                  <p className="text-sm text-muted-foreground">Data de nascimento</p>
                  <p className="font-medium">
                    {format(new Date(agendamento.data_nascimento), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Appointment details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Detalhes da Consulta
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Data
                </p>
                <p className="font-medium">
                  {agendamento.data_agendamento 
                    ? format(new Date(agendamento.data_agendamento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : <span className="text-amber-600 italic">Aguardando</span>
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Horário
                </p>
                <p className="font-medium">
                  {agendamento.hora_agendamento 
                    ? agendamento.hora_agendamento.slice(0, 5)
                    : <span className="text-amber-600 italic">Aguardando</span>
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo de atendimento</p>
                <p className="font-medium">{agendamento.tipo_atendimento}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Local
                </p>
                <p className="font-medium">{agendamento.local_atendimento}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Convênio
                </p>
                <p className="font-medium">
                  {agendamento.convenio === "Outro" ? agendamento.convenio_outro : agendamento.convenio}
                </p>
              </div>
              {agendamento.detalhe_exame_ou_cirurgia && (
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Detalhes (exame/cirurgia)</p>
                  <p className="font-medium">{agendamento.detalhe_exame_ou_cirurgia}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* WhatsApp Confirmation Status */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Confirmação WhatsApp
            </h3>
            <div className="bg-muted/50 p-4 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className={cn("flex items-center gap-1.5", statusConfig.className)}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {statusConfig.label}
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleResendConfirmation}
                  disabled={sendingConfirmation || confirmationStatus === 'confirmado'}
                  className="flex items-center gap-2"
                >
                  {sendingConfirmation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {confirmationStatus === 'nao_enviado' ? 'Enviar confirmação' : 'Reenviar'}
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground">{statusConfig.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-md border border-orange-200 dark:border-orange-800">
                  <p className="text-sm text-orange-700 dark:text-orange-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Falha ao enviar confirmação. Tente reenviar manualmente.
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Preferences */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Preferências</h3>
            <div className="flex flex-wrap gap-3">
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

          <Separator />

          {/* Editable fields */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Gerenciamento</h3>
            
            <div className="space-y-2">
              <Label>Status CRM</Label>
              <Select value={statusCrm} onValueChange={setStatusCrm}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOVO LEAD">Novo Lead</SelectItem>
                  <SelectItem value="CLINICOR">Clinicor</SelectItem>
                  <SelectItem value="HGP">HGP</SelectItem>
                  <SelectItem value="BELÉM">Belém</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações internas (criptografadas)</Label>
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

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4">
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
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
