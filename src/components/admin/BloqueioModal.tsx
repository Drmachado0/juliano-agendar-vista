import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { criarBloqueio, atualizarBloqueio, Bloqueio, TipoBloqueio } from "@/services/disponibilidade";
import { listarProfissionaisPorClinica, Profissional } from "@/services/profissionais";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BloqueioModalProps {
  open: boolean;
  onClose: () => void;
  clinicaId: string;
  bloqueio?: Bloqueio | null;
  initialDate?: Date | null;
}

export function BloqueioModal({ open, onClose, clinicaId, bloqueio, initialDate }: BloqueioModalProps) {
  const [date, setDate] = useState<Date | undefined>(initialDate || new Date());
  const [tipoBloqueio, setTipoBloqueio] = useState<TipoBloqueio>('dia_inteiro');
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFim, setHoraFim] = useState('12:00');
  const [motivo, setMotivo] = useState('');
  const [profissionalId, setProfissionalId] = useState<string>('');
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (clinicaId) {
      carregarProfissionais();
    }
  }, [clinicaId]);

  useEffect(() => {
    if (bloqueio) {
      setDate(new Date(bloqueio.data + 'T00:00:00'));
      setTipoBloqueio(bloqueio.tipo_bloqueio);
      setHoraInicio(bloqueio.hora_inicio?.slice(0, 5) || '08:00');
      setHoraFim(bloqueio.hora_fim?.slice(0, 5) || '12:00');
      setMotivo(bloqueio.motivo || '');
      setProfissionalId(bloqueio.profissional_id || '');
    } else {
      resetForm();
    }
  }, [bloqueio, initialDate]);

  async function carregarProfissionais() {
    const { data } = await listarProfissionaisPorClinica(clinicaId);
    setProfissionais(data);
  }

  function resetForm() {
    setDate(initialDate || new Date());
    setTipoBloqueio('dia_inteiro');
    setHoraInicio('08:00');
    setHoraFim('12:00');
    setMotivo('');
    setProfissionalId('');
  }

  async function handleSubmit() {
    if (!date) {
      toast.error('Selecione uma data');
      return;
    }

    if (tipoBloqueio === 'intervalo' && horaInicio >= horaFim) {
      toast.error('Hora de início deve ser anterior à hora de fim');
      return;
    }

    if (tipoBloqueio === 'ausencia_profissional' && !profissionalId) {
      toast.error('Selecione um profissional');
      return;
    }

    setSaving(true);

    const dados = {
      clinica_id: clinicaId,
      data: format(date, 'yyyy-MM-dd'),
      tipo_bloqueio: tipoBloqueio,
      hora_inicio: tipoBloqueio === 'intervalo' ? horaInicio : null,
      hora_fim: tipoBloqueio === 'intervalo' ? horaFim : null,
      profissional_id: tipoBloqueio === 'ausencia_profissional' ? profissionalId : null,
      motivo: motivo || null,
    };

    try {
      if (bloqueio) {
        const { error } = await atualizarBloqueio(bloqueio.id, dados);
        if (error) throw error;
        toast.success('Bloqueio atualizado');
      } else {
        const { error } = await criarBloqueio(dados);
        if (error) throw error;
        toast.success('Bloqueio criado');
      }
      onClose();
    } catch (err) {
      toast.error('Erro ao salvar bloqueio');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{bloqueio ? 'Editar Bloqueio' : 'Novo Bloqueio'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Data */}
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tipo de Bloqueio */}
          <div className="space-y-2">
            <Label>Tipo de Bloqueio</Label>
            <Select value={tipoBloqueio} onValueChange={(v) => setTipoBloqueio(v as TipoBloqueio)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dia_inteiro">Dia Inteiro</SelectItem>
                <SelectItem value="intervalo">Intervalo de Horário</SelectItem>
                <SelectItem value="feriado">Feriado</SelectItem>
                <SelectItem value="ausencia_profissional">Ausência de Profissional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Horários (apenas para intervalo) */}
          {tipoBloqueio === 'intervalo' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora Início</Label>
                <Input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora Fim</Label>
                <Input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Profissional (apenas para ausência) */}
          {tipoBloqueio === 'ausencia_profissional' && (
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select value={profissionalId} onValueChange={setProfissionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {profissionais.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {profissionais.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum profissional cadastrado nesta clínica
                </p>
              )}
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Reunião, Manutenção, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : bloqueio ? 'Atualizar' : 'Criar Bloqueio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
