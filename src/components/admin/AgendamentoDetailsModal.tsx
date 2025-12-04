import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Agendamento, atualizarStatusCrm, atualizarObservacoes } from "@/services/agendamentos";
import { notificarN8n } from "@/services/integracoes";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, MapPin, User, Phone, Mail, CreditCard, Check, Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgendamentoDetailsModalProps {
  agendamento: Agendamento | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const statusColors: Record<string, string> = {
  "NOVO LEAD": "bg-emerald-100 text-emerald-800",
  "CLINICOR": "bg-blue-100 text-blue-800",
  "HGP": "bg-purple-100 text-purple-800",
};

const AgendamentoDetailsModal = ({ agendamento, isOpen, onClose, onUpdate }: AgendamentoDetailsModalProps) => {
  const [observacoes, setObservacoes] = useState(agendamento?.observacoes_internas || "");
  const [statusCrm, setStatusCrm] = useState(agendamento?.status_crm || "NOVO LEAD");
  const [saving, setSaving] = useState(false);

  // Update local state when agendamento changes
  useState(() => {
    if (agendamento) {
      setObservacoes(agendamento.observacoes_internas || "");
      setStatusCrm(agendamento.status_crm);
    }
  });

  if (!agendamento) return null;

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
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar alterações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
                  {format(new Date(agendamento.data_agendamento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Horário
                </p>
                <p className="font-medium">{agendamento.hora_agendamento.slice(0, 5)}</p>
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
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações internas</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Adicione notas internas sobre este agendamento..."
                rows={4}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgendamentoDetailsModal;
