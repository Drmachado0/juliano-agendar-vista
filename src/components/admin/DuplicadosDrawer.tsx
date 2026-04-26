import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  detectarDuplicadosTelefone,
  unificarDuplicados,
  GrupoDuplicado,
} from "@/services/duplicados";
import {
  Copy,
  RefreshCw,
  Users,
  Merge,
  CalendarCheck,
  Crown,
  Phone,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DuplicadosDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged?: () => void;
}

export default function DuplicadosDrawer({ open, onOpenChange, onMerged }: DuplicadosDrawerProps) {
  const [grupos, setGrupos] = useState<GrupoDuplicado[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);
  const [principais, setPrincipais] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState<GrupoDuplicado | null>(null);

  const fetch = async () => {
    setLoading(true);
    const { data, error } = await detectarDuplicadosTelefone();
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setGrupos(data);
    // pré-seleciona o primeiro de cada grupo (ordenado por critério na RPC)
    const map: Record<string, string> = {};
    data.forEach((g) => {
      if (g.agendamentos[0]) map[g.telefone_normalizado] = g.agendamentos[0].id;
    });
    setPrincipais(map);
  };

  useEffect(() => {
    if (open) fetch();
  }, [open]);

  const handleUnificar = async (grupo: GrupoDuplicado) => {
    const principalId = principais[grupo.telefone_normalizado];
    setMerging(grupo.telefone_normalizado);
    const { error, removidos, mensagensMovidas } = await unificarDuplicados(
      grupo.telefone_normalizado,
      principalId
    );
    setMerging(null);
    setConfirmando(null);

    if (error) {
      toast({ title: "Erro ao unificar", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Duplicados unificados",
      description: `${removidos.length} removido(s) · ${mensagensMovidas} mensagem(ns) transferida(s)`,
    });
    onMerged?.();
    fetch();
  };

  const totalDuplicados = grupos.reduce((acc, g) => acc + (g.total_duplicados - 1), 0);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-3xl overflow-hidden flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Leads Duplicados por Telefone
            </SheetTitle>
            <SheetDescription>
              Identifique e unifique pacientes com o mesmo número de WhatsApp. Mensagens e
              histórico são transferidos para o registro mantido.
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center gap-2 py-3 border-b border-border">
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {grupos.length} grupo(s)
            </Badge>
            {totalDuplicados > 0 && (
              <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                <AlertTriangle className="h-3 w-3" />
                {totalDuplicados} duplicado(s) removível(is)
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={fetch}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <ScrollArea className="flex-1 -mx-6 px-6">
            {loading && grupos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Buscando duplicados...
              </div>
            ) : grupos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                🎉 Nenhum lead duplicado encontrado.
              </div>
            ) : (
              <ul className="space-y-4 py-3">
                {grupos.map((grupo) => (
                  <li
                    key={grupo.telefone_normalizado}
                    className="border border-border rounded-lg p-4 bg-card space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm font-medium">
                          {grupo.telefone_normalizado}
                        </span>
                        <Badge variant="secondary">{grupo.total_duplicados} registros</Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setConfirmando(grupo)}
                        disabled={merging === grupo.telefone_normalizado}
                      >
                        <Merge className="h-3.5 w-3.5 mr-1.5" />
                        {merging === grupo.telefone_normalizado ? "Unificando..." : "Unificar"}
                      </Button>
                    </div>

                    <RadioGroup
                      value={principais[grupo.telefone_normalizado]}
                      onValueChange={(v) =>
                        setPrincipais((p) => ({ ...p, [grupo.telefone_normalizado]: v }))
                      }
                      className="space-y-2"
                    >
                      {grupo.agendamentos.map((a) => {
                        const isPrincipal = principais[grupo.telefone_normalizado] === a.id;
                        return (
                          <div
                            key={a.id}
                            className={`flex items-start gap-3 p-2.5 rounded-md border transition-colors ${
                              isPrincipal
                                ? "border-primary bg-primary/5"
                                : "border-border bg-background"
                            }`}
                          >
                            <RadioGroupItem value={a.id} id={a.id} className="mt-1" />
                            <Label htmlFor={a.id} className="flex-1 cursor-pointer space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isPrincipal && (
                                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                                )}
                                <span className="font-medium text-sm">{a.nome_completo}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {a.status_crm}
                                </Badge>
                                {a.data_agendamento && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  >
                                    <CalendarCheck className="h-2.5 w-2.5" />
                                    {format(new Date(a.data_agendamento), "dd/MM", { locale: ptBR })}
                                    {a.hora_agendamento && ` ${a.hora_agendamento.slice(0, 5)}`}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                <span>{a.tipo_atendimento}</span>
                                <span>·</span>
                                <span>{a.local_atendimento}</span>
                                <span>·</span>
                                <span>
                                  Criado{" "}
                                  {format(new Date(a.created_at), "dd/MM/yy HH:mm", {
                                    locale: ptBR,
                                  })}
                                </span>
                              </div>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>

                    <p className="text-[11px] text-muted-foreground">
                      O registro marcado como principal será mantido. Os demais serão removidos
                      e suas mensagens/histórico transferidos.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmando} onOpenChange={(o) => !o && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar unificação</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando && (
                <>
                  Será mantido <strong>1 registro principal</strong> e removidos{" "}
                  <strong>{confirmando.total_duplicados - 1}</strong> duplicado(s) do telefone{" "}
                  <span className="font-mono">{confirmando.telefone_normalizado}</span>. Mensagens
                  WhatsApp e auditoria serão transferidas. Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmando && handleUnificar(confirmando)}>
              Unificar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
