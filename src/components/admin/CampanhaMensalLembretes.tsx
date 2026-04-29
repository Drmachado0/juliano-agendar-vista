import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarRange,
  Sparkles,
  Eye,
  CalendarCheck,
  ListChecks,
  Play,
  Pause,
  XCircle,
  Download,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  marcarLembreteEnviado,
  type LembreteAnual,
} from "@/services/lembretesAnuais";
import { enviarMensagemWhatsApp } from "@/services/integracoes";
import { useEnvioLoteConfig } from "@/hooks/useEnvioLoteConfig";

// ============================================================
// Configuração da campanha
// ============================================================
const NUMERO_REMESSAS = 4;
const DIAS_REMESSAS = [1, 2, 15, 16] as const; // dia do mês para cada remessa (índice = remessa - 1)

type StatusRemessa =
  | "agendada"
  | "disponivel"
  | "em_andamento"
  | "concluida"
  | "concluida_com_falhas"
  | "cancelada";

interface RemessaPlano {
  numero: number; // 1..4
  dataProgramada: Date;
  pacientes: LembreteAnual[];
  status: StatusRemessa;
}

interface RelatorioRemessa {
  numeroRemessa: number;
  dataProgramada: string;
  quantidadePlanejada: number;
  processados: number;
  enviados: number;
  falhas: number;
  ignorados: number;
  inicio: string | null;
  fim: string | null;
  falhasDetalhe: Array<{ id: string; nome: string; motivo: string }>;
}

// ============================================================
// Helpers
// ============================================================

/** Divide total em N remessas balanceadas, distribuindo o resto nas primeiras. */
function dividirEmRemessas(total: number, n = NUMERO_REMESSAS): number[] {
  const base = Math.floor(total / n);
  const resto = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

/** Mascara telefone: mantém DDI/DDD e últimos 2 dígitos. */
function mascararTelefone(tel: string): string {
  const d = tel.replace(/\D/g, "");
  if (d.length < 6) return "***";
  const inicio = d.slice(0, 4);
  const fim = d.slice(-2);
  return `${inicio}${"*".repeat(Math.max(d.length - 6, 2))}${fim}`;
}

/** Mascara nome: mantém primeiro nome + iniciais do resto. */
function mascararNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes.slice(1).map((p) => `${p[0]}.`).join(" ")}`;
}

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarMesAno(ano: number, mes0: number) {
  return `${MESES_PT[mes0]}/${ano}`;
}

function formatarData(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

// ============================================================
// Componente
// ============================================================
interface Props {
  /** Recarrega listas externas (pendentes, dashboard) após envios. */
  onAfterEnvio?: () => void;
}

const CampanhaMensalLembretes = ({ onAfterEnvio }: Props) => {
  // Mês de vencimento selecionado (default: mês atual)
  const hoje = new Date();
  const [anoRef, setAnoRef] = useState(hoje.getFullYear());
  const [mesRef, setMesRef] = useState(hoje.getMonth()); // 0..11

  const [carregando, setCarregando] = useState(false);
  const [pacientesElegiveis, setPacientesElegiveis] = useState<LembreteAnual[]>([]);
  const [planoGerado, setPlanoGerado] = useState(false);

  // Remessa selecionada para envio
  const [remessaSelecionada, setRemessaSelecionada] = useState<number | null>(null);
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  const [visualizarOpen, setVisualizarOpen] = useState(false);
  const [visualizandoRemessa, setVisualizandoRemessa] = useState<number | null>(null);

  // Estado de envio
  const [enviando, setEnviando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const pausadoRef = useRef(false);
  const canceladoRef = useRef(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, sucesso: 0, falha: 0 });
  const [relatorios, setRelatorios] = useState<Record<number, RelatorioRemessa>>({});
  const [statusRemessas, setStatusRemessas] = useState<Record<number, StatusRemessa>>({});

  // Modo manual: override de quantidades por remessa
  const [modoManual, setModoManual] = useState(false);
  const [qtdManual, setQtdManual] = useState<number[]>([0, 0, 0, 0]);

  // Config de envio (reaproveita as mesmas regras de segurança)
  const {
    intervaloMin,
    intervaloMax,
    pausarAposEnvios,
    pausaMinMin,
    pausaMaxMin,
    isHorarioPermitido,
    validarLimitesEnvio,
  } = useEnvioLoteConfig();

  // Template do banco (lembrete_anual) — reflete edits feitas em /admin/whatsapp
  const [template, setTemplate] = useState<string>("");

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase
        .from("templates_whatsapp")
        .select("conteudo")
        .eq("tipo", "lembrete_anual")
        .eq("ativo", true)
        .maybeSingle();
      if (data?.conteudo) setTemplate(data.conteudo);
    };
    carregar();
  }, []);

  // ====== Carregar pacientes elegíveis para o mês selecionado ======
  // Estratégia (versão simplificada permitida pelo spec):
  // - usa a tabela existente lembretes_anuais
  // - elegível = data_proximo_lembrete dentro do mês/ano selecionado E lembrete_enviado = false
  const carregarElegiveis = async () => {
    setCarregando(true);
    setPlanoGerado(false);
    setRelatorios({});
    setStatusRemessas({});
    setRemessaSelecionada(null);

    const inicio = new Date(anoRef, mesRef, 1).toISOString().split("T")[0];
    const ultimoDia = new Date(anoRef, mesRef + 1, 0).getDate();
    const fim = new Date(anoRef, mesRef, ultimoDia).toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("lembretes_anuais")
      .select("*")
      .eq("lembrete_enviado", false)
      .gte("data_proximo_lembrete", inicio)
      .lte("data_proximo_lembrete", fim)
      // ordenação estável: data_ultima_consulta, nome, id
      .order("data_ultima_consulta", { ascending: true })
      .order("nome", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar pacientes", description: error.message, variant: "destructive" });
      setPacientesElegiveis([]);
    } else {
      // Filtros adicionais de elegibilidade
      const validos = (data || []).filter((l: any) => {
        const tel = (l.telefone || "").replace(/\D/g, "");
        if (tel.length < 10) return false;
        return true;
      }) as LembreteAnual[];
      setPacientesElegiveis(validos);
      setPlanoGerado(true);
      const sizes = dividirEmRemessas(validos.length);
      setQtdManual(sizes);
      setStatusRemessas(
        Object.fromEntries(
          DIAS_REMESSAS.map((dia, i) => {
            const dataProg = new Date(anoRef, mesRef, dia);
            const ehHoje = dataProg.toDateString() === new Date().toDateString();
            const passou = dataProg < new Date(new Date().toDateString());
            const status: StatusRemessa = ehHoje
              ? "disponivel"
              : passou
              ? "disponivel"
              : "agendada";
            return [i + 1, status];
          }),
        ) as Record<number, StatusRemessa>,
      );
    }
    setCarregando(false);
  };

  // ====== Plano de remessas (memo) ======
  const remessas = useMemo<RemessaPlano[]>(() => {
    if (!planoGerado) return [];
    const tamanhos = modoManual ? qtdManual : dividirEmRemessas(pacientesElegiveis.length);
    let cursor = 0;
    return DIAS_REMESSAS.map((dia, i) => {
      const qtd = Math.max(0, Math.min(tamanhos[i] || 0, pacientesElegiveis.length - cursor));
      const slice = pacientesElegiveis.slice(cursor, cursor + qtd);
      cursor += qtd;
      return {
        numero: i + 1,
        dataProgramada: new Date(anoRef, mesRef, dia),
        pacientes: slice,
        status: statusRemessas[i + 1] || "agendada",
      };
    });
  }, [planoGerado, pacientesElegiveis, modoManual, qtdManual, anoRef, mesRef, statusRemessas]);

  const totalEnviados = useMemo(
    () => Object.values(relatorios).reduce((a, r) => a + r.enviados, 0),
    [relatorios],
  );
  const totalFalhas = useMemo(
    () => Object.values(relatorios).reduce((a, r) => a + r.falhas, 0),
    [relatorios],
  );
  const restantes = pacientesElegiveis.length - totalEnviados - totalFalhas;

  // ====== Selecionar remessa de hoje ======
  const selecionarRemessaHoje = () => {
    const diaHoje = new Date().getDate();
    const idx = DIAS_REMESSAS.indexOf(diaHoje as 1 | 2 | 15 | 16);
    if (idx === -1) {
      toast({
        title: "Sem remessa hoje",
        description:
          "Hoje não há remessa programada para este mês. Você pode selecionar uma remessa manualmente, se necessário.",
      });
      return;
    }
    setRemessaSelecionada(idx + 1);
    toast({ title: `Remessa ${idx + 1} selecionada`, description: `Data: ${formatarData(new Date())}` });
  };

  // ====== Iniciar envio ======
  const abrirConfirmacao = () => {
    if (!remessaSelecionada) {
      toast({ title: "Selecione uma remessa", variant: "destructive" });
      return;
    }
    const remessa = remessas[remessaSelecionada - 1];
    if (!remessa || remessa.pacientes.length === 0) {
      toast({ title: "Remessa vazia", description: "Não há pacientes nesta remessa.", variant: "destructive" });
      return;
    }
    if (remessa.status === "concluida" || remessa.status === "concluida_com_falhas") {
      toast({
        title: "Remessa já concluída",
        description: "Esta remessa já foi processada. Reenvio de falhas é uma ação separada.",
        variant: "destructive",
      });
      return;
    }
    if (!isHorarioPermitido()) {
      toast({
        title: "Fora do horário permitido",
        description: "Ajuste em Configurações ou ative o modo sem restrição.",
        variant: "destructive",
      });
      return;
    }
    setConfirmarOpen(true);
  };

  const confirmarEIniciar = async () => {
    setConfirmarOpen(false);
    if (!remessaSelecionada) return;
    const remessa = remessas[remessaSelecionada - 1];
    if (!remessa) return;

    canceladoRef.current = false;
    pausadoRef.current = false;
    setPausado(false);
    setEnviando(true);
    setStatusRemessas((prev) => ({ ...prev, [remessa.numero]: "em_andamento" }));
    setProgresso({ atual: 0, total: remessa.pacientes.length, sucesso: 0, falha: 0 });

    const inicio = new Date().toISOString();
    let sucesso = 0;
    let falha = 0;
    let ignorados = 0;
    const falhasDetalhe: Array<{ id: string; nome: string; motivo: string }> = [];

    for (let i = 0; i < remessa.pacientes.length; i++) {
      if (canceladoRef.current) break;
      while (pausadoRef.current && !canceladoRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
      if (canceladoRef.current) break;

      // Validação de limites
      const lim = validarLimitesEnvio(0, 0);
      if (!lim.permitido) {
        toast({ title: "Limite atingido", description: lim.motivo, variant: "destructive" });
        break;
      }

      const p = remessa.pacientes[i];

      // Re-validar elegibilidade no banco (não enviado ainda)
      const { data: atual } = await supabase
        .from("lembretes_anuais")
        .select("lembrete_enviado")
        .eq("id", p.id)
        .maybeSingle();

      if (!atual || atual.lembrete_enviado) {
        ignorados++;
        setProgresso((prev) => ({ ...prev, atual: i + 1 }));
        continue;
      }

      const primeiroNome = p.primeiro_nome || p.nome.split(" ")[0];
      const mensagem = (template || `Olá, {{nome}}! 👋`).replace(/\{\{nome\}\}/g, primeiroNome);

      try {
        const r = await enviarMensagemWhatsApp(p.telefone, mensagem);
        if (r.success) {
          sucesso++;
          await marcarLembreteEnviado(p.id);
          await supabase.from("mensagens_whatsapp").insert({
            telefone: p.telefone,
            conteudo: mensagem,
            direcao: "OUT",
            tipo_mensagem: "lembrete",
            status_envio: "enviado",
          });
        } else {
          falha++;
          falhasDetalhe.push({ id: p.id, nome: mascararNome(p.nome), motivo: r.error || "Erro desconhecido" });
        }
      } catch (e: any) {
        falha++;
        falhasDetalhe.push({ id: p.id, nome: mascararNome(p.nome), motivo: e?.message || "Erro" });
      }

      setProgresso({ atual: i + 1, total: remessa.pacientes.length, sucesso, falha });

      // Pausa estratégica
      if ((i + 1) % pausarAposEnvios === 0 && i < remessa.pacientes.length - 1) {
        const pausaMs =
          (Math.floor(Math.random() * (pausaMaxMin - pausaMinMin + 1)) + pausaMinMin) * 60 * 1000;
        let restante = pausaMs;
        while (restante > 0 && !canceladoRef.current) {
          await new Promise((r) => setTimeout(r, 1000));
          restante -= 1000;
        }
      }

      // Delay aleatório entre mensagens
      if (i < remessa.pacientes.length - 1 && !canceladoRef.current) {
        const delay = Math.floor(Math.random() * (intervaloMax - intervaloMin + 1)) + intervaloMin;
        let restante = delay * 1000;
        while (restante > 0 && !canceladoRef.current && !pausadoRef.current) {
          await new Promise((r) => setTimeout(r, 1000));
          restante -= 1000;
        }
      }
    }

    const fim = new Date().toISOString();
    const statusFinal: StatusRemessa = canceladoRef.current
      ? "cancelada"
      : falha > 0
      ? "concluida_com_falhas"
      : "concluida";

    setStatusRemessas((prev) => ({ ...prev, [remessa.numero]: statusFinal }));
    setRelatorios((prev) => ({
      ...prev,
      [remessa.numero]: {
        numeroRemessa: remessa.numero,
        dataProgramada: formatarData(remessa.dataProgramada),
        quantidadePlanejada: remessa.pacientes.length,
        processados: sucesso + falha + ignorados,
        enviados: sucesso,
        falhas: falha,
        ignorados,
        inicio,
        fim,
        falhasDetalhe,
      },
    }));

    setEnviando(false);
    setPausado(false);
    pausadoRef.current = false;
    canceladoRef.current = false;

    toast({
      title: statusFinal === "cancelada" ? "Envio cancelado" : "Remessa finalizada",
      description: `${sucesso} enviado(s), ${falha} falha(s), ${ignorados} ignorado(s).`,
    });

    onAfterEnvio?.();
  };

  const togglePausa = () => {
    pausadoRef.current = !pausadoRef.current;
    setPausado(pausadoRef.current);
  };

  const cancelarEnvio = () => {
    canceladoRef.current = true;
    pausadoRef.current = false;
    setPausado(false);
  };

  // ====== Exportar CSV ======
  const exportarCSV = () => {
    if (!planoGerado) return;
    const linhas: string[] = [
      [
        "id",
        "nome_mascarado",
        "telefone_mascarado",
        "mes_vencimento",
        "remessa",
        "data_programada",
        "status_envio",
        "motivo_falha",
        "data_envio",
      ].join(","),
    ];

    remessas.forEach((rem) => {
      rem.pacientes.forEach((p) => {
        const rel = relatorios[rem.numero];
        const falha = rel?.falhasDetalhe.find((f) => f.id === p.id);
        const status = falha
          ? "falha"
          : rel
          ? "enviado"
          : statusRemessas[rem.numero] === "em_andamento"
          ? "enviando"
          : "pendente";
        linhas.push(
          [
            p.id,
            `"${mascararNome(p.nome)}"`,
            mascararTelefone(p.telefone),
            formatarMesAno(anoRef, mesRef),
            rem.numero,
            formatarData(rem.dataProgramada),
            status,
            falha ? `"${falha.motivo.replace(/"/g, "'")}"` : "",
            rel?.fim || "",
          ].join(","),
        );
      });
    });

    const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campanha_lembretes_${anoRef}-${String(mesRef + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ====== UI helpers ======
  const corStatus = (s: StatusRemessa) => {
    switch (s) {
      case "concluida":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
      case "concluida_com_falhas":
        return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
      case "em_andamento":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
      case "disponivel":
        return "bg-primary/15 text-primary border-primary/30";
      case "cancelada":
        return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const labelStatus = (s: StatusRemessa) =>
    ({
      agendada: "Agendada",
      disponivel: "Disponível",
      em_andamento: "Em andamento",
      concluida: "Concluída",
      concluida_com_falhas: "Concluída c/ falhas",
      cancelada: "Cancelada",
    }[s]);

  const proximaRemessa = remessas.find(
    (r) => r.status === "disponivel" || r.status === "agendada",
  );

  // Opções de mês de vencimento (próximos 12 meses + 2 atrás)
  const opcoesMes = useMemo(() => {
    const arr: Array<{ ano: number; mes: number; label: string }> = [];
    for (let i = -2; i <= 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      arr.push({
        ano: d.getFullYear(),
        mes: d.getMonth(),
        label: `${MESES_PT[d.getMonth()]}/${d.getFullYear()}`,
      });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseLabel = `Pacientes que consultaram em ${MESES_PT[mesRef]}/${anoRef - 1}`;
  const campanhaConcluida =
    planoGerado &&
    remessas.length > 0 &&
    remessas.every((r) => r.status === "concluida" || r.status === "concluida_com_falhas");

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-card to-primary/5 shadow-md" data-testid="lembretes-campanha-mensal">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-primary" />
              Campanha mensal de lembretes
            </CardTitle>
            <CardDescription>
              Envio parcelado em 4 remessas (dias {DIAS_REMESSAS.join(", ")}) — automático e seguro
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              data-testid="lembretes-filtro-mes"
              value={`${anoRef}-${mesRef}`}
              onChange={(e) => {
                const [a, m] = e.target.value.split("-").map(Number);
                setAnoRef(a);
                setMesRef(m);
                setPlanoGerado(false);
                setPacientesElegiveis([]);
                setRelatorios({});
                setStatusRemessas({});
                setRemessaSelecionada(null);
              }}
              className="text-sm border rounded-md px-2 py-1 bg-background min-w-[160px]"
            >
              {opcoesMes.map((o) => (
                <option key={`${o.ano}-${o.mes}`} value={`${o.ano}-${o.mes}`}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              data-testid="lembretes-gerar-plano"
              size="sm"
              onClick={carregarElegiveis}
              disabled={carregando || enviando}
            >
              {carregando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar plano do mês
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!planoGerado && !carregando && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Selecione o mês de vencimento e clique em <strong>Gerar plano do mês</strong> para visualizar
              as 4 remessas.
            </AlertDescription>
          </Alert>
        )}

        {planoGerado && (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-xs text-muted-foreground">Mês vencimento</p>
                <p className="font-semibold">{formatarMesAno(anoRef, mesRef)}</p>
              </div>
              <div className="p-3 rounded-lg border bg-card md:col-span-2">
                <p className="text-xs text-muted-foreground">Base de pacientes</p>
                <p className="font-semibold text-sm">{baseLabel}</p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-xs text-muted-foreground">Total elegível</p>
                <p className="font-semibold text-2xl text-primary" data-testid="lembretes-total-elegivel">
                  {pacientesElegiveis.length}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-xs text-muted-foreground">Restantes</p>
                <p className="font-semibold text-2xl" data-testid="lembretes-restantes">
                  {restantes}
                </p>
              </div>
            </div>

            {/* Plano de remessas */}
            <div className="space-y-2" data-testid="lembretes-plano-remessas">
              {remessas.map((r) => (
                <div
                  key={r.numero}
                  data-testid={`lembretes-remessa-${r.numero}`}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                    remessaSelecionada === r.numero
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/40",
                  )}
                  onClick={() => !enviando && setRemessaSelecionada(r.numero)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center">
                      {r.numero}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        Remessa {r.numero} — {formatarData(r.dataProgramada)}
                      </p>
                      <p className="text-xs text-muted-foreground">{r.pacientes.length} paciente(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", corStatus(r.status))}>
                      {labelStatus(r.status)}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid="lembretes-btn-visualizar-remessas"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVisualizandoRemessa(r.numero);
                        setVisualizarOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Modo manual */}
            <div className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                id="modo-manual"
                checked={modoManual}
                onChange={(e) => setModoManual(e.target.checked)}
                disabled={enviando}
              />
              <Label htmlFor="modo-manual" className="cursor-pointer">
                Modo manual (definir quantidade por remessa)
              </Label>
            </div>
            {modoManual && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {qtdManual.map((q, i) => (
                  <div key={i}>
                    <Label className="text-xs">Remessa {i + 1}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={pacientesElegiveis.length}
                      value={q}
                      onChange={(e) => {
                        const n = parseInt(e.target.value || "0", 10);
                        const novo = [...qtdManual];
                        novo[i] = isNaN(n) ? 0 : n;
                        setQtdManual(novo);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-wrap gap-2">
              <Button
                data-testid="lembretes-btn-selecionar-remessa-hoje"
                variant="default"
                onClick={selecionarRemessaHoje}
                disabled={enviando}
              >
                <CalendarCheck className="h-4 w-4 mr-2" />
                Selecionar remessa de hoje
              </Button>
              <Button
                data-testid="lembretes-btn-selecionar-remessa-manual"
                variant="outline"
                onClick={() => {
                  if (proximaRemessa) setRemessaSelecionada(proximaRemessa.numero);
                }}
                disabled={enviando || !proximaRemessa}
              >
                <ListChecks className="h-4 w-4 mr-2" />
                Selecionar próxima
              </Button>
              <Button
                data-testid="lembretes-btn-iniciar-remessa"
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={abrirConfirmacao}
                disabled={enviando || !remessaSelecionada}
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar envio da remessa{remessaSelecionada ? ` ${remessaSelecionada}` : ""}
              </Button>
              {enviando && (
                <>
                  <Button variant="outline" onClick={togglePausa}>
                    <Pause className="h-4 w-4 mr-2" />
                    {pausado ? "Retomar" : "Pausar"}
                  </Button>
                  <Button variant="destructive" onClick={cancelarEnvio}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </>
              )}
              <Button data-testid="lembretes-exportar-csv" variant="outline" onClick={exportarCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>

            {/* Progresso de envio */}
            {enviando && (
              <div className="space-y-2 p-3 rounded-lg border bg-muted/30" data-testid="lembretes-progresso-envio">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium" data-testid="lembretes-status-envio">
                    {pausado ? "Pausado" : "Enviando..."}
                  </span>
                  <span className="text-muted-foreground">
                    {progresso.atual}/{progresso.total}
                  </span>
                </div>
                <Progress value={(progresso.atual / Math.max(progresso.total, 1)) * 100} />
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span data-testid="lembretes-sucessos">✅ {progresso.sucesso}</span>
                  <span data-testid="lembretes-falhas">❌ {progresso.falha}</span>
                </div>
              </div>
            )}

            {/* Relatórios das remessas */}
            {Object.values(relatorios).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Relatórios
                </h4>
                {Object.values(relatorios)
                  .sort((a, b) => a.numeroRemessa - b.numeroRemessa)
                  .map((rel) => (
                    <div
                      key={rel.numeroRemessa}
                      data-testid="lembretes-relatorio-remessa"
                      className="p-3 rounded-lg border bg-card text-sm space-y-1"
                    >
                      <p className="font-medium">
                        Remessa {rel.numeroRemessa} — {rel.dataProgramada}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <span>Planejada: {rel.quantidadePlanejada}</span>
                        <span className="text-emerald-600">Enviados: {rel.enviados}</span>
                        <span className="text-red-600">Falhas: {rel.falhas}</span>
                        <span className="text-muted-foreground">
                          <span data-testid="lembretes-ignorados">Ignorados: {rel.ignorados}</span>
                        </span>
                      </div>
                      {rel.falhasDetalhe.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            Ver falhas ({rel.falhasDetalhe.length})
                          </summary>
                          <ul className="mt-1 space-y-0.5 text-xs">
                            {rel.falhasDetalhe.map((f, i) => (
                              <li key={i} className="text-red-600">
                                • {f.nome}: {f.motivo}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* Relatório consolidado */}
            {campanhaConcluida && (
              <div
                data-testid="lembretes-relatorio-final-campanha"
                className="p-4 rounded-lg border-2 border-primary bg-primary/5 space-y-1"
              >
                <p className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Relatório final da campanha — {formatarMesAno(anoRef, mesRef)}
                </p>
                <p className="text-sm">Total elegível inicial: {pacientesElegiveis.length}</p>
                <p className="text-sm text-emerald-600">Enviados com sucesso: {totalEnviados}</p>
                <p className="text-sm text-red-600">Falhas: {totalFalhas}</p>
                <p className="text-sm text-muted-foreground">
                  Status: {totalFalhas > 0 ? "Concluída com falhas" : "Concluída"}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Dialog de confirmação */}
      <Dialog open={confirmarOpen} onOpenChange={setConfirmarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envio da remessa</DialogTitle>
            <DialogDescription>Revise antes de iniciar.</DialogDescription>
          </DialogHeader>
          {remessaSelecionada && remessas[remessaSelecionada - 1] && (
            <div className="space-y-2 text-sm">
              <p>
                <strong>Mês:</strong> {formatarMesAno(anoRef, mesRef)}
              </p>
              <p>
                <strong>Remessa:</strong> {remessaSelecionada} de {NUMERO_REMESSAS}
              </p>
              <p>
                <strong>Data programada:</strong>{" "}
                {formatarData(remessas[remessaSelecionada - 1].dataProgramada)}
              </p>
              <p>
                <strong>Quantidade planejada:</strong>{" "}
                {remessas[remessaSelecionada - 1].pacientes.length}
              </p>
              <p>
                <strong>Restantes após esta remessa:</strong>{" "}
                {restantes - remessas[remessaSelecionada - 1].pacientes.length}
              </p>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  O envio respeita os limites de segurança (intervalo, pausa, horário). Pacientes que ficaram
                  inelegíveis serão ignorados automaticamente.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarOpen(false)}>
              Cancelar
            </Button>
            <Button
              data-testid="lembretes-btn-confirmar-iniciar-envio"
              onClick={confirmarEIniciar}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirmar e iniciar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualização */}
      <Dialog open={visualizarOpen} onOpenChange={setVisualizarOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Pacientes da remessa {visualizandoRemessa}
            </DialogTitle>
            <DialogDescription>
              Dados mascarados para proteção. Total:{" "}
              {visualizandoRemessa ? remessas[visualizandoRemessa - 1]?.pacientes.length : 0}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {visualizandoRemessa &&
                remessas[visualizandoRemessa - 1]?.pacientes.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded border text-sm"
                  >
                    <span>{mascararNome(p.nome)}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {mascararTelefone(p.telefone)}
                    </span>
                  </div>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CampanhaMensalLembretes;
