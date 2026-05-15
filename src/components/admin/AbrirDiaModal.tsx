import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { abrirDiaManual, abrirDiaComModelo, listarModelosHorario, ModeloHorario } from "@/services/disponibilidade";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clinicaId: string;
  clinicaNome: string;
  data: Date;
}

export function AbrirDiaModal({ open, onClose, onSuccess, clinicaId, clinicaNome, data }: Props) {
  const [tab, setTab] = useState<"manual" | "modelo">("modelo");
  const [modelos, setModelos] = useState<ModeloHorario[]>([]);
  const [modeloId, setModeloId] = useState<string>("");
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("18:00");
  const [intervalo, setIntervalo] = useState("30");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !clinicaId) return;
    listarModelosHorario(clinicaId).then((ms) => {
      setModelos(ms);
      // tenta sugerir o modelo do dia da semana correspondente
      const dia = data.getDay();
      const sugerido = ms.find((m) => m.dia_semana === dia) ?? ms[0];
      if (sugerido) setModeloId(sugerido.id);
    });
  }, [open, clinicaId, data]);

  async function handleSalvar() {
    setSaving(true);
    try {
      const dataISO = format(data, "yyyy-MM-dd");
      let result;
      if (tab === "modelo") {
        if (!modeloId) {
          toast.error("Selecione um modelo");
          return;
        }
        result = await abrirDiaComModelo({ clinicaId, data: dataISO, modeloId });
      } else {
        if (horaInicio >= horaFim) {
          toast.error("Hora de início deve ser menor que a de fim");
          return;
        }
        result = await abrirDiaManual({
          clinicaId,
          data: dataISO,
          horaInicio,
          horaFim,
          intervaloMinutos: parseInt(intervalo, 10),
        });
      }
      if (result.error) {
        toast.error("Erro ao abrir o dia");
        return;
      }
      toast.success("Dia aberto com sucesso");
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir dia para atendimento</DialogTitle>
          <DialogDescription>
            {format(data, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })} · {clinicaNome}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="modelo">Usar modelo</TabsTrigger>
            <TabsTrigger value="manual">Definir manualmente</TabsTrigger>
          </TabsList>

          <TabsContent value="modelo" className="space-y-3 pt-4">
            {modelos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum modelo de horário cadastrado para esta clínica. Cadastre em
                Disponibilidade → Modelos de horários.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Select value={modeloId} onValueChange={setModeloId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome ?? `${DIAS[m.dia_semana]} — ${m.hora_inicio.slice(0, 5)}–${m.hora_fim.slice(0, 5)}`}
                        {" · "}
                        {m.intervalo_minutos} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Início</Label>
                <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fim</Label>
                <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Intervalo</Label>
              <Select value={intervalo} onValueChange={setIntervalo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="20">20 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={saving}>
            {saving ? "Abrindo..." : "Abrir dia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
