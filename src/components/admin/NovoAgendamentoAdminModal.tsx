import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { criarAgendamento, Agendamento } from "@/services/agendamentos";
import { listarServicos, Servico } from "@/services/servicos";
import { syncAppointmentToGoogleCalendar, checkGoogleCalendarConnection } from "@/services/googleCalendar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NovoAgendamentoAdminModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clinicaId: string;
  clinicaNome: string;
  data: string;
  hora: string;
}

const CONVENIOS = [
  'Particular',
  'Bradesco',
  'Unimed',
  'Cassi',
  'Sul América',
  'Outro',
];

const TIPOS_ATENDIMENTO = [
  'Consulta',
  'Retorno',
  'Exame',
  'Cirurgia',
];

export function NovoAgendamentoAdminModal({
  open,
  onClose,
  onSuccess,
  clinicaId,
  clinicaNome,
  data,
  hora,
}: NovoAgendamentoAdminModalProps) {
  const { user } = useAuth();
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [tipoAtendimento, setTipoAtendimento] = useState('Consulta');
  const [convenio, setConvenio] = useState('Particular');
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicoId, setServicoId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);

  useEffect(() => {
    if (open) {
      resetForm();
      carregarServicos();
      checkGcal();
    }
  }, [open, user?.id]);

  async function checkGcal() {
    if (!user?.id) return;
    const status = await checkGoogleCalendarConnection(user.id);
    setGcalConnected(status.connected);
  }

  async function carregarServicos() {
    const { data } = await listarServicos();
    setServicos(data);
  }

  function resetForm() {
    setNomeCompleto('');
    setTelefoneWhatsapp('');
    setEmail('');
    setTipoAtendimento('Consulta');
    setConvenio('Particular');
    setServicoId('');
  }

  async function handleSubmit() {
    if (!nomeCompleto.trim()) {
      toast.error('Nome completo é obrigatório');
      return;
    }

    if (!telefoneWhatsapp.trim()) {
      toast.error('Telefone WhatsApp é obrigatório');
      return;
    }

    setSaving(true);

    try {
      const { data: agendamento, error } = await criarAgendamento({
        nome_completo: nomeCompleto.trim(),
        telefone_whatsapp: telefoneWhatsapp.trim(),
        email: email.trim() || undefined,
        tipo_atendimento: tipoAtendimento,
        local_atendimento: clinicaNome,
        convenio,
        data_agendamento: data,
        hora_agendamento: hora,
        clinica_id: clinicaId,
        servico_id: servicoId || undefined,
        aceita_primeiro_horario: false,
        aceita_contato_whatsapp_email: true,
        origem: 'admin',
      });

      if (error) throw error;

      toast.success('Agendamento criado com sucesso');

      // Enviar confirmação automática via WhatsApp
      if (agendamento) {
        try {
          const { data: confirmResult, error: confirmError } = await supabase.functions.invoke('confirmar-agendamento-whatsapp', {
            body: {
              agendamento_id: agendamento.id,
              telefone: agendamento.telefone_whatsapp,
              nome_completo: agendamento.nome_completo,
              data_agendamento: agendamento.data_agendamento,
              hora_agendamento: agendamento.hora_agendamento,
              local_atendimento: agendamento.local_atendimento,
              tipo_atendimento: agendamento.tipo_atendimento,
            }
          });
          
          if (confirmResult?.success) {
            toast.success('Confirmação enviada por WhatsApp');
          }
        } catch {
          // Silently fail - agendamento já foi criado
        }

        // Sync to Google Calendar if connected
        if (gcalConnected && user?.id) {
          try {
            const gcalResult = await syncAppointmentToGoogleCalendar(agendamento.id, user.id, 'create');
            if (gcalResult.success) {
              toast.success('Agendamento sincronizado com Google Calendar');
            }
          } catch {
            // Silently fail - agendamento já foi criado
          }
        }
      }

      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar agendamento');
    } finally {
      setSaving(false);
    }
  }

  const dataFormatada = data ? format(new Date(data + 'T00:00:00'), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : '';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do Slot */}
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p><strong>Clínica:</strong> {clinicaNome}</p>
            <p><strong>Data:</strong> {dataFormatada}</p>
            <p><strong>Horário:</strong> {hora}</p>
          </div>

          {/* Nome Completo */}
          <div className="space-y-2">
            <Label>Nome Completo *</Label>
            <Input
              value={nomeCompleto}
              onChange={(e) => setNomeCompleto(e.target.value)}
              placeholder="Nome do paciente"
            />
          </div>

          {/* Telefone WhatsApp */}
          <div className="space-y-2">
            <Label>Telefone WhatsApp *</Label>
            <Input
              value={telefoneWhatsapp}
              onChange={(e) => setTelefoneWhatsapp(e.target.value)}
              placeholder="(91) 99999-9999"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label>E-mail (opcional)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          {/* Tipo de Atendimento */}
          <div className="space-y-2">
            <Label>Tipo de Atendimento</Label>
            <Select value={tipoAtendimento} onValueChange={setTipoAtendimento}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_ATENDIMENTO.map(tipo => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Serviço */}
          {servicos.length > 0 && (
            <div className="space-y-2">
              <Label>Serviço (opcional)</Label>
              <Select value={servicoId} onValueChange={setServicoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {servicos.map(servico => (
                    <SelectItem key={servico.id} value={servico.id}>
                      {servico.nome} ({servico.duracao_min}min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Convênio */}
          <div className="space-y-2">
            <Label>Convênio</Label>
            <Select value={convenio} onValueChange={setConvenio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVENIOS.map(conv => (
                  <SelectItem key={conv} value={conv}>{conv}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : 'Criar Agendamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
