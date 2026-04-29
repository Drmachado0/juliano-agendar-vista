import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Trash2,
  Plus,
  Minus,
  Wand2,
  RotateCcw,
  CheckCheck,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { marcarLembreteEnviado, type LembreteAnual } from "@/services/lembretesAnuais";
import { enviarMensagemWhatsApp } from "@/services/integracoes";
import { useEnvioLoteConfig } from "@/hooks/useEnvioLoteConfig";
import {
  buscarCampanha,
  buscarRemessasComPacientes,
  criarPlanoCampanha,
  excluirCampanha,
  atualizarStatusRemessa,
  atualizarPacienteCampanha,
  atualizarTotaisCampanha,
  contarEnviosHoje,
  type CampanhaRow,
  type RemessaRow,
  type PacienteCampanhaRow,
  type StatusRemessa,
  type StatusPaciente,
} from "@/services/campanhasLembretes";

const NUMERO_REMESSAS = 4;
const DIAS_REMESSAS = [1, 2, 15, 16] as const;

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarMesAno(ano: number, mes0: number) {
  return `${MESES_PT[mes0]}/${ano}`;
}
function formatarData(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return dt.toLocaleDateString("pt-BR");
}
function mascararTelefone(tel: string): string {
  const d = (tel || "").replace(/\D/g, "");
  if (d.length < 6) return "***";
  return `${d.slice(0, 4)}${"*".repeat(Math.max(d.length - 6, 2))}${d.slice(-2)}`;
}
function mascararNome(nome: string): string {
  const partes = (nome || "").trim().split(/\s+/);
  if (partes.length === 1) return partes[0] || "";
  return `${partes[0]} ${partes.slice(1).map((p) => `${p[0]}.`).join(" ")}`;
}
function dividirEmRemessas(total: number, n = NUMERO_REMESSAS): number[] {
  const base = Math.floor(total / n);
  const resto = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

const STATUS_LABEL: Record<StatusRemessa, string> = {
  agendada: "Agendada",
  disponivel: "Disponível",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  concluida_com_falhas: "Concluída c/ falhas",
  cancelada: "Cancelada",
  bloqueada_por_limite: "Bloqueada por limite",
  pendente: "Pendente",
};

function corStatus(s: StatusRemessa): string {
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
    case "bloqueada_por_limite":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30";
    case "pendente":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

interface Props {
  onAfterEnvio?: () => void;
}

const CampanhaMensalLembretes = ({ onAfterEnvio }: Props) => {
  const hoje = new Date();
  const [anoRef, setAnoRef] = useState(hoje.getFullYear());
  const [mesRef, setMesRef] = useState(hoje.getMonth()); // 0..11

  const [carregando, setCarregando] = useState(false);
  const [campanha, setCampanha] = useState<CampanhaRow | null>(null);
  const [remessas, setRemessas] = useState<RemessaRow[]>([]);
  const [pacientes, setPacientes] = useState<PacienteCampanhaRow[]>([]);

  // Para gerar plano (antes de criar)
  const [previewElegiveis, setPreviewElegiveis] = useState<
    Array<LembreteAnual & { inconsistente_data?: boolean }>
  >([]);
  const [previewCarregado, setPreviewCarregado] = useState(false);

  const [remessaSelecionada, setRemessaSelecionada] = useState<number | null>(null);
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  const [reenvioFalhasOpen, setReenvioFalhasOpen] = useState(false);
  const [visualizarOpen, setVisualizarOpen] = useState(false);
  const [visualizandoRemessa, setVisualizandoRemessa] = useState<number | null>(null);
  const [confirmarExcluirOpen, setConfirmarExcluirOpen] = useState(false);
  const [relatorioOpen, setRelatorioOpen] = useState(false);

  // Envio
  const [enviando, setEnviando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const pausadoRef = useRef(false);
  const canceladoRef = useRef(false);
  const [progresso, setProgresso] = useState({
    atual: 0,
    total: 0,
    sucesso: 0,
    falha: 0,
    ignorado: 0,
  });
  const enviosSessaoRef = useRef(0);
  const [enviosHoje, setEnviosHoje] = useState(0);

  // Modo manual
  const [modoManual, setModoManual] = useState(false);
  const [qtdManual, setQtdManual] = useState<number[]>([0, 0, 0, 0]);
  const [confirmaParcial, setConfirmaParcial] = useState(false);

  // Config
  const {
    intervaloMin,
    intervaloMax,
    pausarAposEnvios,
    pausaMinMin,
    pausaMaxMin,
    isHorarioPermitido,
    validarLimitesEnvio,
  } = useEnvioLoteConfig();

  // Template
  const [template, setTemplate] = useState<string>("");
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("templates_whatsapp")
        .select("conteudo")
        .eq("tipo", "lembrete_anual")
        .eq("ativo", true)
        .maybeSingle();
      if (data?.conteudo) setTemplate(data.conteudo);
    })();
  }, []);

  // Carrega contagem de envios de hoje (limites realistas)
  useEffect(() => {
    contarEnviosHoje().then(setEnviosHoje);
  }, []);

  // ====== Carregar campanha existente ao mudar mês ======
  const carregarCampanhaExistente = useCallback(
    async (ano: number, mes0: number) => {
      setCarregando(true);
      try {
        const camp = await buscarCampanha(ano, mes0 + 1);
        if (camp) {
          const { remessas: rs, pacientes: ps } = await buscarRemessasComPacientes(camp.id);
          setCampanha(camp);
          setRemessas(rs);
          setPacientes(ps);
          setPreviewCarregado(false);
          setPreviewElegiveis([]);
        } else {
          setCampanha(null);
          setRemessas([]);
          setPacientes([]);
        }
      } catch (e: any) {
        toast({ title: "Erro ao carregar campanha", description: e.message, variant: "destructive" });
      }
      setCarregando(false);
    },
    [],
  );

  useEffect(() => {
    carregarCampanhaExistente(anoRef, mesRef);
  }, [anoRef, mesRef, carregarCampanhaExistente]);

  // ====== Buscar elegíveis (preview antes de gerar) ======
  const carregarPreviewElegiveis = async () => {
    setCarregando(true);
    try {
      const inicio = new Date(anoRef, mesRef, 1).toISOString().split("T")[0];
      const ultimoDia = new Date(anoRef, mesRef + 1, 0).getDate();
      const fim = new Date(anoRef, mesRef, ultimoDia).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("lembretes_anuais")
        .select("*")
        .eq("lembrete_enviado", false)
        .gte("data_proximo_lembrete", inicio)
        .lte("data_proximo_lembrete", fim)
        .order("data_ultima_consulta", { ascending: true })
        .order("nome", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;

      // Base esperada: data_ultima_consulta no mesmo mês do ano anterior
      const inicioBase = new Date(anoRef - 1, mesRef, 1).toISOString().split("T")[0];
      const ultimoBase = new Date(anoRef - 1, mesRef + 1, 0).getDate();
      const fimBase = new Date(anoRef - 1, mesRef, ultimoBase).toISOString().split("T")[0];

      const norm = (s: string) => (s || "").replace(/\D/g, "");
      const normNome = (s: string) =>
        (s || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim()
          .replace(/\s+/g, " ");
      const chaveDedup = (l: any) => `${norm(l.telefone)}|${normNome(l.nome)}`;

      const baseValidos = (data || []).filter(
        (l: any) => norm(l.telefone).length >= 10,
      );

      // ===== Dedup interno: 1 por (telefone+nome), mantém consulta mais ANTIGA =====
      // (já vem ordenado por data_ultima_consulta ASC)
      const mapDedup = new Map<string, any>();
      let removidosDedup = 0;
      for (const l of baseValidos) {
        const k = chaveDedup(l);
        if (mapDedup.has(k)) {
          removidosDedup++;
          continue;
        }
        mapDedup.set(k, l);
      }
      const deduplicados = Array.from(mapDedup.values());

      // ===== Bloquear quem já recebeu lembrete nos últimos 12 meses =====
      const corte12m = new Date();
      corte12m.setMonth(corte12m.getMonth() - 12);
      const corteIso = corte12m.toISOString();

      const telefones = Array.from(
        new Set(deduplicados.map((l: any) => norm(l.telefone))),
      );

      const jaEnviadosSet = new Set<string>();
      // Consulta em lotes de 200 para evitar URL gigante
      for (let i = 0; i < telefones.length; i += 200) {
        const lote = telefones.slice(i, i + 200);
        const { data: msgs, error: errMsg } = await supabase
          .from("mensagens_whatsapp")
          .select("telefone")
          .eq("direcao", "OUT")
          .eq("tipo_mensagem", "lembrete_anual")
          .gte("created_at", corteIso)
          .in("telefone", lote);
        // Fallback: a coluna telefone pode estar formatada — tenta também por sufixo
        if (!errMsg && msgs) {
          for (const m of msgs) jaEnviadosSet.add(norm(m.telefone));
        }
      }
      // Match adicional por sufixo (últimos 10 dígitos), pois telefones podem
      // estar gravados com/sem DDI 55
      const jaEnviadosSufixos = new Set<string>(
        Array.from(jaEnviadosSet).map((t) => t.slice(-10)),
      );
      const jaRecebeu = (tel: string) => {
        const n = norm(tel);
        return jaEnviadosSet.has(n) || jaEnviadosSufixos.has(n.slice(-10));
      };

      const filtrados = deduplicados.filter((l: any) => !jaRecebeu(l.telefone));
      const removidos12m = deduplicados.length - filtrados.length;

      const validos = filtrados.map((l: any) => ({
        ...l,
        inconsistente_data: !(
          l.data_ultima_consulta &&
          l.data_ultima_consulta >= inicioBase &&
          l.data_ultima_consulta <= fimBase
        ),
      })) as Array<LembreteAnual & { inconsistente_data?: boolean }>;

      setPreviewElegiveis(validos);
      setPreviewCarregado(true);
      setQtdManual(dividirEmRemessas(validos.length));

      if (removidosDedup > 0 || removidos12m > 0) {
        toast({
          title: "Deduplicação aplicada",
          description: `${removidosDedup} duplicado(s) no mês + ${removidos12m} já receberam lembrete nos últimos 12 meses.`,
        });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setCarregando(false);
  };

  // ====== Validação modo manual ======
  const totalManual = qtdManual.reduce((a, b) => a + b, 0);
  const totalElegivel = campanha?.total_elegivel ?? previewElegiveis.length;
  const manualExcede = modoManual && totalManual > totalElegivel;
  const manualParcial = modoManual && totalManual < totalElegivel;
  const podeGerar =
    previewCarregado &&
    !campanha &&
    totalElegivel > 0 &&
    (!modoManual || (!manualExcede && (!manualParcial || confirmaParcial)));

  // ====== Gerar plano (congela) ======
  const gerarPlano = async () => {
    if (!previewCarregado) {
      await carregarPreviewElegiveis();
      return;
    }
    if (!podeGerar) {
      if (manualExcede) {
        toast({
          title: "Soma excede o total",
          description: "A soma das remessas excede o total elegível. Ajuste antes de gerar.",
          variant: "destructive",
        });
      }
      return;
    }
    setCarregando(true);
    try {
      await criarPlanoCampanha({
        ano: anoRef,
        mes1a12: mesRef + 1,
        pacientes: previewElegiveis,
        quantidades: modoManual ? qtdManual : undefined,
      });
      toast({ title: "Plano gerado e congelado", description: `${totalElegivel} paciente(s).` });
      await carregarCampanhaExistente(anoRef, mesRef);
    } catch (e: any) {
      toast({ title: "Erro ao gerar plano", description: e.message, variant: "destructive" });
    }
    setCarregando(false);
  };

  // ====== Excluir campanha ======
  const onExcluirCampanha = async () => {
    if (!campanha) return;
    setConfirmarExcluirOpen(false);
    setCarregando(true);
    try {
      await excluirCampanha(campanha.id);
      toast({ title: "Campanha excluída" });
      setCampanha(null);
      setRemessas([]);
      setPacientes([]);
      setRemessaSelecionada(null);
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
    setCarregando(false);
  };

  // ====== Helpers ======
  const remessaPorNumero = (n: number) => remessas.find((r) => r.numero_remessa === n);
  const pacientesDaRemessa = (remessaId: string) =>
    pacientes.filter((p) => p.remessa_id === remessaId);

  const proximaRemessa = useMemo(() => {
    return [...remessas]
      .sort((a, b) => a.numero_remessa - b.numero_remessa)
      .find((r) =>
        ["disponivel", "agendada", "pendente", "bloqueada_por_limite"].includes(r.status),
      );
  }, [remessas]);

  // ====== Selecionar remessa de hoje ======
  const selecionarRemessaHoje = () => {
    const dia = new Date().getDate();
    const idx = DIAS_REMESSAS.indexOf(dia as any);
    if (idx === -1) {
      toast({
        title: "Sem remessa hoje",
        description: "Hoje não há remessa programada. Você pode selecionar manualmente.",
      });
      return;
    }
    setRemessaSelecionada(idx + 1);
  };

  // ====== Iniciar envio (regular) ======
  const abrirConfirmacao = () => {
    if (!remessaSelecionada) {
      toast({ title: "Selecione uma remessa", variant: "destructive" });
      return;
    }
    const rem = remessaPorNumero(remessaSelecionada);
    if (!rem) return;
    if (rem.status === "concluida" || rem.status === "concluida_com_falhas") {
      toast({
        title: "Remessa já concluída",
        description: "Use o botão de reenvio de falhas se necessário.",
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

  const executarEnvio = async (remessa: RemessaRow, somenteFalhas = false) => {
    setConfirmarOpen(false);
    setReenvioFalhasOpen(false);

    const lista = pacientesDaRemessa(remessa.id).filter((p) =>
      somenteFalhas ? p.status === "falha" : p.status === "pendente",
    );
    if (lista.length === 0) {
      toast({ title: "Nada a enviar", description: "Nenhum paciente elegível nesta remessa." });
      return;
    }

    canceladoRef.current = false;
    pausadoRef.current = false;
    setPausado(false);
    setEnviando(true);
    enviosSessaoRef.current = 0;
    let enviosHojeLocal = enviosHoje;

    setProgresso({ atual: 0, total: lista.length, sucesso: 0, falha: 0, ignorado: 0 });
    await atualizarStatusRemessa(remessa.id, {
      status: "em_andamento",
      inicio_em: new Date().toISOString(),
      motivo_bloqueio: null,
    });

    let sucesso = 0;
    let falha = 0;
    let ignorado = 0;
    let bloqueado = false;
    let motivoBloqueio: string | null = null;

    for (let i = 0; i < lista.length; i++) {
      if (canceladoRef.current) break;
      while (pausadoRef.current && !canceladoRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
      if (canceladoRef.current) break;

      // Limites reais
      const lim = validarLimitesEnvio(enviosSessaoRef.current, enviosHojeLocal);
      if (!lim.permitido) {
        bloqueado = true;
        motivoBloqueio = lim.motivo || "Limite atingido";
        toast({ title: "Limite atingido", description: motivoBloqueio, variant: "destructive" });
        break;
      }

      const p = lista[i];

      // Re-validar elegibilidade
      const { data: atual } = await supabase
        .from("lembretes_anuais")
        .select("lembrete_enviado")
        .eq("id", p.lembrete_id)
        .maybeSingle();

      if (!atual || atual.lembrete_enviado) {
        ignorado++;
        await atualizarPacienteCampanha(p.id, {
          status: "ignorado",
          motivo_ignorado: "já enviado",
        });
        setProgresso((prev) => ({ ...prev, atual: i + 1, ignorado }));
        continue;
      }

      const primeiroNome = p.primeiro_nome || (p.nome || "").split(" ")[0];
      const mensagem = (template || `Olá, {{nome}}! 👋`).replace(/\{\{nome\}\}/g, primeiroNome);

      try {
        const r = await enviarMensagemWhatsApp(p.telefone, mensagem);
        if (r.success) {
          sucesso++;
          enviosSessaoRef.current += 1;
          enviosHojeLocal += 1;
          await marcarLembreteEnviado(p.lembrete_id);
          await atualizarPacienteCampanha(p.id, {
            status: "enviado",
            ultimo_envio_em: new Date().toISOString(),
            motivo_falha: null,
          });
          await supabase.from("mensagens_whatsapp").insert({
            telefone: p.telefone,
            conteudo: mensagem,
            direcao: "OUT",
            tipo_mensagem: "lembrete",
            status_envio: "enviado",
          });
        } else {
          falha++;
          await atualizarPacienteCampanha(p.id, {
            status: "falha",
            motivo_falha: r.error || "Erro desconhecido",
          });
        }
      } catch (e: any) {
        falha++;
        await atualizarPacienteCampanha(p.id, {
          status: "falha",
          motivo_falha: e?.message || "Erro",
        });
      }

      setProgresso({ atual: i + 1, total: lista.length, sucesso, falha, ignorado });

      // Pausa estratégica
      if (
        enviosSessaoRef.current > 0 &&
        enviosSessaoRef.current % pausarAposEnvios === 0 &&
        i < lista.length - 1
      ) {
        const pausaMs =
          (Math.floor(Math.random() * (pausaMaxMin - pausaMinMin + 1)) + pausaMinMin) * 60 * 1000;
        let restante = pausaMs;
        while (restante > 0 && !canceladoRef.current) {
          await new Promise((r) => setTimeout(r, 1000));
          restante -= 1000;
        }
      }

      // Delay aleatório entre mensagens
      if (i < lista.length - 1 && !canceladoRef.current) {
        const delay = Math.floor(Math.random() * (intervaloMax - intervaloMin + 1)) + intervaloMin;
        let restante = delay * 1000;
        while (restante > 0 && !canceladoRef.current && !pausadoRef.current) {
          await new Promise((r) => setTimeout(r, 1000));
          restante -= 1000;
        }
      }
    }

    // Status final
    let statusFinal: StatusRemessa;
    if (bloqueado) statusFinal = "bloqueada_por_limite";
    else if (canceladoRef.current) statusFinal = "cancelada";
    else if (falha > 0) statusFinal = "concluida_com_falhas";
    else statusFinal = "concluida";

    await atualizarStatusRemessa(remessa.id, {
      status: statusFinal,
      fim_em: new Date().toISOString(),
      processados: (remessa.processados || 0) + sucesso + falha + ignorado,
      enviados: (remessa.enviados || 0) + sucesso,
      falhas: somenteFalhas ? falha : (remessa.falhas || 0) + falha,
      ignorados: (remessa.ignorados || 0) + ignorado,
      motivo_bloqueio: motivoBloqueio,
    });
    if (campanha) await atualizarTotaisCampanha(campanha.id);

    setEnviando(false);
    setPausado(false);
    pausadoRef.current = false;
    canceladoRef.current = false;
    setEnviosHoje(enviosHojeLocal);

    toast({
      title:
        statusFinal === "cancelada"
          ? "Envio cancelado"
          : statusFinal === "bloqueada_por_limite"
          ? "Bloqueada por limite"
          : "Remessa finalizada",
      description: `${sucesso} enviado(s), ${falha} falha(s), ${ignorado} ignorado(s).`,
    });

    await carregarCampanhaExistente(anoRef, mesRef);
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

  // ====== CSV ======
  const exportarCSV = () => {
    if (!campanha) return;
    const linhas: string[] = [
      [
        "lembrete_id",
        "nome_mascarado",
        "telefone_mascarado",
        "mes_vencimento",
        "remessa",
        "data_programada",
        "status_envio",
        "motivo_falha",
        "motivo_ignorado",
        "data_envio",
        "inconsistente_data",
      ].join(","),
    ];
    pacientes.forEach((p) => {
      const rem = remessaPorNumero(p.numero_remessa);
      linhas.push(
        [
          p.lembrete_id,
          `"${mascararNome(p.nome)}"`,
          mascararTelefone(p.telefone),
          formatarMesAno(anoRef, mesRef),
          p.numero_remessa,
          rem ? formatarData(rem.data_programada) : "",
          p.status,
          p.motivo_falha ? `"${p.motivo_falha.replace(/"/g, "'")}"` : "",
          p.motivo_ignorado ? `"${p.motivo_ignorado.replace(/"/g, "'")}"` : "",
          p.ultimo_envio_em || "",
          p.inconsistente_data ? "sim" : "nao",
        ].join(","),
      );
    });
    const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campanha_lembretes_${anoRef}-${String(mesRef + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Opções de mês
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
  const inconsistencias =
    campanha?.inconsistencias ??
    previewElegiveis.filter((p) => p.inconsistente_data).length;

  const totalEnviados = campanha?.total_enviados ?? 0;
  const totalFalhas = campanha?.total_falhas ?? 0;
  const totalIgnorados = campanha?.total_ignorados ?? 0;
  const restantes =
    (campanha?.total_elegivel ?? 0) - totalEnviados - totalFalhas - totalIgnorados;
  const campanhaConcluida =
    !!campanha &&
    remessas.length > 0 &&
    remessas.every((r) => r.status === "concluida" || r.status === "concluida_com_falhas");

  const remessaSelecionadaObj = remessaSelecionada ? remessaPorNumero(remessaSelecionada) : null;
  const pacientesRemessaSelecionada = remessaSelecionadaObj
    ? pacientesDaRemessa(remessaSelecionadaObj.id)
    : [];
  const pendentesNaRemessa = pacientesRemessaSelecionada.filter((p) => p.status === "pendente").length;
  const inconsistentesNaRemessa = pacientesRemessaSelecionada.filter(
    (p) => p.inconsistente_data,
  ).length;
  const falhasNaRemessa = pacientesRemessaSelecionada.filter((p) => p.status === "falha").length;

  return (
    <Card
      className="border-primary/30 bg-gradient-to-br from-card to-primary/5 shadow-md"
      data-testid="lembretes-campanha-mensal"
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-primary" />
              Campanha mensal de lembretes
            </CardTitle>
            <CardDescription>
              Envio parcelado em 4 remessas (dias {DIAS_REMESSAS.join(", ")}) — plano persistido e auditável
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
                setRemessaSelecionada(null);
                setPreviewCarregado(false);
                setPreviewElegiveis([]);
              }}
              className="text-sm border rounded-md px-2 py-1 bg-background min-w-[160px]"
              disabled={enviando}
            >
              {opcoesMes.map((o) => (
                <option key={`${o.ano}-${o.mes}`} value={`${o.ano}-${o.mes}`}>
                  {o.label}
                </option>
              ))}
            </select>
            {!campanha && (
              <Button
                data-testid="lembretes-gerar-plano"
                size="sm"
                onClick={previewCarregado ? gerarPlano : carregarPreviewElegiveis}
                disabled={carregando || enviando || (previewCarregado && !podeGerar)}
              >
                {carregando ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {previewCarregado ? "Confirmar e congelar plano" : "Pré-visualizar elegíveis"}
              </Button>
            )}
            {campanha && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmarExcluirOpen(true)}
                disabled={enviando}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir plano
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sem campanha + sem preview */}
        {!campanha && !previewCarregado && !carregando && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhum plano para <strong>{formatarMesAno(anoRef, mesRef)}</strong>. Clique em{" "}
              <strong>Pré-visualizar elegíveis</strong> para ver os pacientes antes de congelar o plano.
              <br />
              <span className="text-xs text-muted-foreground">
                Critério técnico: <code>data_proximo_lembrete</code> dentro de{" "}
                {formatarMesAno(anoRef, mesRef)} · Base esperada: consultas de{" "}
                {MESES_PT[mesRef]}/{anoRef - 1}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Preview antes de congelar */}
        {!campanha && previewCarregado && (
          <div className="space-y-3">
            <Alert>
              <AlertDescription className="text-sm">
                <strong>{previewElegiveis.length}</strong> paciente(s) elegível(is) para{" "}
                {formatarMesAno(anoRef, mesRef)}.
                {inconsistencias > 0 && (
                  <span className="block text-amber-600 mt-1">
                    ⚠ {inconsistencias} paciente(s) com <code>data_ultima_consulta</code> fora de{" "}
                    {MESES_PT[mesRef]}/{anoRef - 1}. Revise antes de gerar.
                  </span>
                )}
              </AlertDescription>
            </Alert>

            {/* Toggle Modo Manual */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
              <div className="flex flex-col">
                <Label htmlFor="modo-manual-preview" className="cursor-pointer text-sm font-medium">
                  Modo manual
                </Label>
                <span className="text-xs text-muted-foreground">
                  Definir manualmente quantos pacientes vão em cada remessa.
                  {!modoManual && " (Padrão: divide igualmente)"}
                </span>
              </div>
              <Switch
                id="modo-manual-preview"
                checked={modoManual}
                onCheckedChange={(v) => {
                  setModoManual(v);
                  setConfirmaParcial(false);
                  if (v) setQtdManual(dividirEmRemessas(previewElegiveis.length));
                }}
              />
            </div>

            {modoManual && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                {/* Cabeçalho com totais e ações rápidas */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    Distribua os <strong>{previewElegiveis.length}</strong> pacientes elegíveis
                    entre as 4 remessas.
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setQtdManual(dividirEmRemessas(previewElegiveis.length));
                        setConfirmaParcial(false);
                      }}
                    >
                      <Wand2 className="h-3 w-3 mr-1" />
                      Distribuir igualmente
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        // Atribui o restante à última remessa não-vazia (ou à 4)
                        const soma = qtdManual.reduce((a, b) => a + b, 0);
                        const diff = previewElegiveis.length - soma;
                        if (diff === 0) return;
                        const novo = [...qtdManual];
                        if (diff > 0) {
                          novo[3] = (novo[3] || 0) + diff;
                        } else {
                          // remove o excesso da última que tem valor
                          let restante = -diff;
                          for (let i = 3; i >= 0 && restante > 0; i--) {
                            const tirar = Math.min(novo[i], restante);
                            novo[i] -= tirar;
                            restante -= tirar;
                          }
                        }
                        setQtdManual(novo);
                        setConfirmaParcial(false);
                      }}
                    >
                      <CheckCheck className="h-3 w-3 mr-1" />
                      Ajustar para o total
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => {
                        setQtdManual([0, 0, 0, 0]);
                        setConfirmaParcial(false);
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Zerar
                    </Button>
                  </div>
                </div>

                {/* Cartões por remessa */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {qtdManual.map((q, i) => {
                    const dataProg = new Date(anoRef, mesRef, DIAS_REMESSAS[i]);
                    const restanteAtual = previewElegiveis.length - totalManual;
                    const maxPermitido = q + Math.max(restanteAtual, 0);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "p-3 rounded-lg border bg-card space-y-2 transition-colors",
                          q > 0 ? "border-primary/40" : "border-border",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Remessa {i + 1}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatarData(dataProg)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {q} pac.
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 shrink-0"
                            disabled={q <= 0}
                            aria-label={`Diminuir remessa ${i + 1}`}
                            onClick={() => {
                              const novo = [...qtdManual];
                              novo[i] = Math.max(0, novo[i] - 1);
                              setQtdManual(novo);
                              setConfirmaParcial(false);
                            }}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={maxPermitido}
                            value={q}
                            aria-label={`Quantidade da remessa ${i + 1}`}
                            className="h-8 text-center"
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                const novo = [...qtdManual];
                                novo[i] = 0;
                                setQtdManual(novo);
                                return;
                              }
                              const n = parseInt(raw, 10);
                              if (isNaN(n)) return;
                              const novo = [...qtdManual];
                              // não trava no máx, deixa o usuário ver o aviso de excesso
                              novo[i] = Math.max(0, n);
                              setQtdManual(novo);
                              setConfirmaParcial(false);
                            }}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 shrink-0"
                            disabled={restanteAtual <= 0}
                            aria-label={`Aumentar remessa ${i + 1}`}
                            onClick={() => {
                              const novo = [...qtdManual];
                              novo[i] = novo[i] + 1;
                              setQtdManual(novo);
                              setConfirmaParcial(false);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Barra de distribuição visual */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Distribuição</span>
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        manualExcede
                          ? "text-destructive"
                          : totalManual === previewElegiveis.length
                          ? "text-emerald-600"
                          : "text-amber-600",
                      )}
                    >
                      {totalManual} / {previewElegiveis.length}
                    </span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    {qtdManual.map((q, i) => {
                      const pct = previewElegiveis.length
                        ? (Math.min(q, previewElegiveis.length) / previewElegiveis.length) * 100
                        : 0;
                      const cores = [
                        "bg-primary",
                        "bg-blue-500",
                        "bg-emerald-500",
                        "bg-amber-500",
                      ];
                      return (
                        <div
                          key={i}
                          style={{ width: `${pct}%` }}
                          className={cn("h-full transition-all", cores[i])}
                          title={`Remessa ${i + 1}: ${q}`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Status / validação */}
                {manualExcede && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      A soma das remessas é <strong>{totalManual}</strong>, mas há apenas{" "}
                      <strong>{previewElegiveis.length}</strong> pacientes elegíveis. Reduza{" "}
                      <strong>{totalManual - previewElegiveis.length}</strong> antes de gerar o plano.
                    </AlertDescription>
                  </Alert>
                )}

                {!manualExcede && manualParcial && (
                  <Alert className="border-amber-500/40 bg-amber-500/5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs space-y-2">
                      <div>
                        Faltam <strong>{previewElegiveis.length - totalManual}</strong> paciente(s)
                        para completar a campanha. Eles ficarão de fora.
                      </div>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={confirmaParcial}
                          onChange={(e) => setConfirmaParcial(e.target.checked)}
                        />
                        <span>
                          Confirmo que quero deixar{" "}
                          <strong>{previewElegiveis.length - totalManual}</strong> paciente(s) fora
                          desta campanha.
                        </span>
                      </label>
                    </AlertDescription>
                  </Alert>
                )}

                {!manualExcede && !manualParcial && totalManual > 0 && (
                  <Alert className="border-emerald-500/40 bg-emerald-500/5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="text-xs">
                      Distribuição válida: todos os {previewElegiveis.length} pacientes estão
                      atribuídos.
                    </AlertDescription>
                  </Alert>
                )}

                {totalManual === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Defina pelo menos uma quantidade ou clique em{" "}
                    <strong>Distribuir igualmente</strong>.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Campanha congelada */}
        {campanha && (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-xs text-muted-foreground">Mês vencimento</p>
                <p className="font-semibold">{formatarMesAno(anoRef, mesRef)}</p>
              </div>
              <div className="p-3 rounded-lg border bg-card md:col-span-2">
                <p className="text-xs text-muted-foreground">Base esperada</p>
                <p className="font-semibold text-sm">{baseLabel}</p>
                {inconsistencias > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠ {inconsistencias} fora da base esperada
                  </p>
                )}
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-xs text-muted-foreground">Total elegível</p>
                <p
                  className="font-semibold text-2xl text-primary"
                  data-testid="lembretes-total-elegivel"
                >
                  {campanha.total_elegivel}
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
              {[...remessas]
                .sort((a, b) => a.numero_remessa - b.numero_remessa)
                .map((r) => {
                  const ps = pacientesDaRemessa(r.id);
                  return (
                    <div
                      key={r.id}
                      data-testid={`lembretes-remessa-${r.numero_remessa}`}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                        remessaSelecionada === r.numero_remessa
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/40",
                      )}
                      onClick={() => !enviando && setRemessaSelecionada(r.numero_remessa)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center">
                          {r.numero_remessa}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            Remessa {r.numero_remessa} — {formatarData(r.data_programada)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ps.length} paciente(s) · ✅ {r.enviados} · ❌ {r.falhas} · ⚪{" "}
                            {r.ignorados}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-xs", corStatus(r.status))}>
                          {STATUS_LABEL[r.status]}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid="lembretes-btn-visualizar-remessas"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVisualizandoRemessa(r.numero_remessa);
                            setVisualizarOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>

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
                data-testid="lembretes-btn-selecionar-proxima"
                variant="outline"
                onClick={() => proximaRemessa && setRemessaSelecionada(proximaRemessa.numero_remessa)}
                disabled={enviando || !proximaRemessa}
              >
                <ListChecks className="h-4 w-4 mr-2" />
                Selecionar próxima
              </Button>
              <Button
                data-testid="lembretes-btn-selecionar-remessa-manual"
                variant="ghost"
                disabled={enviando || remessas.length === 0}
                onClick={() => {
                  if (!remessaSelecionada && remessas[0]) {
                    setRemessaSelecionada(remessas[0].numero_remessa);
                  }
                }}
              >
                Selecionar manualmente
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
              {remessaSelecionadaObj && falhasNaRemessa > 0 && !enviando && (
                <Button
                  data-testid="lembretes-btn-reenviar-falhas"
                  variant="outline"
                  className="border-amber-500/50 text-amber-700 dark:text-amber-300"
                  onClick={() => setReenvioFalhasOpen(true)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reenviar apenas falhas ({falhasNaRemessa})
                </Button>
              )}
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
              <Button
                data-testid="lembretes-btn-relatorio-detalhado"
                variant="outline"
                onClick={() => setRelatorioOpen(true)}
                disabled={!campanha}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver relatório detalhado
              </Button>
              <Button data-testid="lembretes-exportar-csv" variant="outline" onClick={exportarCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>

            {/* Progresso */}
            {enviando && (
              <div
                className="space-y-2 p-3 rounded-lg border bg-muted/30"
                data-testid="lembretes-progresso-envio"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium" data-testid="lembretes-status-envio">
                    {pausado ? "Pausado" : "Enviando..."}
                  </span>
                  <span className="text-muted-foreground">
                    {progresso.atual}/{progresso.total}
                  </span>
                </div>
                <Progress value={(progresso.atual / Math.max(progresso.total, 1)) * 100} />
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span data-testid="lembretes-sucessos" className="text-emerald-600">
                    ✅ {progresso.sucesso}
                  </span>
                  <span data-testid="lembretes-falhas" className="text-red-600">
                    ❌ {progresso.falha}
                  </span>
                  <span data-testid="lembretes-ignorados">⚪ {progresso.ignorado}</span>
                  <span data-testid="lembretes-pendentes-remessa">
                    Pendentes: {Math.max(progresso.total - progresso.atual, 0)}
                  </span>
                </div>
              </div>
            )}

            {/* Relatórios por remessa */}
            {remessas.some(
              (r) => r.processados > 0 || r.status === "bloqueada_por_limite" || r.status === "cancelada",
            ) && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Relatórios das remessas
                </h4>
                {[...remessas]
                  .sort((a, b) => a.numero_remessa - b.numero_remessa)
                  .filter((r) => r.processados > 0 || r.status === "bloqueada_por_limite")
                  .map((rel) => {
                    const ignList = pacientesDaRemessa(rel.id).filter(
                      (p) => p.status === "ignorado",
                    );
                    const falhaList = pacientesDaRemessa(rel.id).filter((p) => p.status === "falha");
                    return (
                      <div
                        key={rel.id}
                        data-testid="lembretes-relatorio-remessa"
                        className="p-3 rounded-lg border bg-card text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium">
                            Remessa {rel.numero_remessa} — {formatarData(rel.data_programada)}
                          </p>
                          <Badge variant="outline" className={cn("text-xs", corStatus(rel.status))}>
                            {STATUS_LABEL[rel.status]}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <span>Planejada: {rel.quantidade_planejada}</span>
                          <span className="text-emerald-600">Enviados: {rel.enviados}</span>
                          <span className="text-red-600">Falhas: {rel.falhas}</span>
                          <span className="text-muted-foreground">Ignorados: {rel.ignorados}</span>
                        </div>
                        {rel.motivo_bloqueio && (
                          <p className="text-xs text-orange-600">
                            Motivo: {rel.motivo_bloqueio}
                          </p>
                        )}
                        {falhaList.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              Ver falhas ({falhaList.length})
                            </summary>
                            <ul className="mt-1 space-y-0.5 text-xs">
                              {falhaList.map((f) => (
                                <li key={f.id} className="text-red-600">
                                  • {mascararNome(f.nome)}: {f.motivo_falha || "—"}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                        {ignList.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              Ver ignorados ({ignList.length})
                            </summary>
                            <ul className="mt-1 space-y-0.5 text-xs">
                              {ignList.map((f) => (
                                <li key={f.id} className="text-muted-foreground">
                                  • {mascararNome(f.nome)}: {f.motivo_ignorado || "—"}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    );
                  })}
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
                  Relatório final — {formatarMesAno(anoRef, mesRef)}
                </p>
                <p className="text-sm">Total elegível inicial: {campanha.total_elegivel}</p>
                <p className="text-sm text-emerald-600">Enviados: {totalEnviados}</p>
                <p className="text-sm text-red-600">Falhas: {totalFalhas}</p>
                <p className="text-sm text-muted-foreground">Ignorados: {totalIgnorados}</p>
                <p className="text-sm">
                  Status: {totalFalhas > 0 ? "Concluída com falhas" : "Concluída"}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Confirmação envio */}
      <Dialog open={confirmarOpen} onOpenChange={setConfirmarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envio da remessa</DialogTitle>
            <DialogDescription>Revise antes de iniciar.</DialogDescription>
          </DialogHeader>
          {remessaSelecionadaObj && (
            <div className="space-y-2 text-sm">
              <p>
                <strong>Mês:</strong> {formatarMesAno(anoRef, mesRef)}
              </p>
              <p>
                <strong>Base esperada:</strong> Consultas de {MESES_PT[mesRef]}/{anoRef - 1}
              </p>
              <p>
                <strong>Critério técnico:</strong> data_proximo_lembrete em{" "}
                {formatarMesAno(anoRef, mesRef)}
              </p>
              <p>
                <strong>Remessa:</strong> {remessaSelecionadaObj.numero_remessa} de {NUMERO_REMESSAS}
              </p>
              <p>
                <strong>Data programada:</strong> {formatarData(remessaSelecionadaObj.data_programada)}
              </p>
              <p>
                <strong>Quantidade planejada:</strong> {remessaSelecionadaObj.quantidade_planejada}
              </p>
              <p>
                <strong>Pendentes nesta remessa:</strong> {pendentesNaRemessa}
              </p>
              <p>
                <strong>Alertas de inconsistência:</strong> {inconsistentesNaRemessa}
              </p>
              <p>
                <strong>Restantes após esta remessa:</strong>{" "}
                {Math.max(restantes - pendentesNaRemessa, 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                Envios hoje (geral): {enviosHoje} · Sessão: {enviosSessaoRef.current}
              </p>
              {inconsistentesNaRemessa > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Existem pacientes com data_ultima_consulta fora de {MESES_PT[mesRef]}/{anoRef - 1}.
                    Revise antes de enviar.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarOpen(false)}>
              Cancelar
            </Button>
            <Button
              data-testid="lembretes-btn-confirmar-iniciar-envio"
              onClick={() => remessaSelecionadaObj && executarEnvio(remessaSelecionadaObj, false)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirmar e iniciar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação reenvio falhas */}
      <Dialog open={reenvioFalhasOpen} onOpenChange={setReenvioFalhasOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reenviar apenas falhas</DialogTitle>
            <DialogDescription>
              Esta ação reenvia somente os pacientes com status <code>falha</code> desta remessa.
              Pacientes já enviados não são reenviados.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Falhas a reenviar: <strong>{falhasNaRemessa}</strong>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReenvioFalhasOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!remessaSelecionadaObj) return;
                // marca falhas como pendentes para o ciclo
                Promise.all(
                  pacientesDaRemessa(remessaSelecionadaObj.id)
                    .filter((p) => p.status === "falha")
                    .map((p) => atualizarPacienteCampanha(p.id, { status: "pendente", motivo_falha: null })),
                ).then(async () => {
                  await carregarCampanhaExistente(anoRef, mesRef);
                  const refreshed = await buscarRemessasComPacientes(campanha!.id);
                  const rem = refreshed.remessas.find(
                    (r) => r.numero_remessa === remessaSelecionadaObj.numero_remessa,
                  );
                  if (rem) executarEnvio(rem, true);
                });
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirmar reenvio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir campanha */}
      <Dialog open={confirmarExcluirOpen} onOpenChange={setConfirmarExcluirOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir plano da campanha?</DialogTitle>
            <DialogDescription>
              Esta ação remove o plano congelado e todos os relatórios desta campanha. Os envios já
              feitos não são desfeitos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarExcluirOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onExcluirCampanha}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualizar pacientes */}
      <Dialog open={visualizarOpen} onOpenChange={setVisualizarOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pacientes da remessa {visualizandoRemessa}</DialogTitle>
            <DialogDescription>
              Dados mascarados para proteção. Total:{" "}
              {visualizandoRemessa
                ? pacientesDaRemessa(remessaPorNumero(visualizandoRemessa)?.id || "").length
                : 0}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {visualizandoRemessa &&
                pacientesDaRemessa(remessaPorNumero(visualizandoRemessa)?.id || "").map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded border text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span>{mascararNome(p.nome)}</span>
                      {p.inconsistente_data && (
                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                          fora da base
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {p.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {mascararTelefone(p.telefone)}
                      </span>
                    </div>
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
