import { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EvolutionStatusBadge } from "@/components/admin/EvolutionStatusBadge";
import { AlertCircle, Bell, BellOff, CheckCircle2, Clock, RefreshCw, Send, Settings, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MensagemRow {
  id: string;
  telefone: string;
  conteudo: string;
  direcao: string;
  status_envio: string | null;
  tipo_mensagem: string | null;
  error_message: string | null;
  mensagem_externa_id: string | null;
  created_at: string;
  payload: any;
}

const PAGE_SIZE = 50;

interface AlertConfig {
  enabled: boolean;
  threshold: number;        // nº de falhas
  windowMin: number;        // janela em minutos
  browserNotif: boolean;
  sound: boolean;
}

const DEFAULT_CONFIG: AlertConfig = {
  enabled: true,
  threshold: 3,
  windowMin: 10,
  browserNotif: true,
  sound: true,
};

const STORAGE_KEY = "monitor-envios-alert-config";

function loadConfig(): AlertConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CONFIG;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {}
}

export default function MonitorEnvios() {
  const [loading, setLoading] = useState(true);
  const [mensagens, setMensagens] = useState<MensagemRow[]>([]);
  const [tab, setTab] = useState<"todos" | "erro" | "enviado" | "pendente">("erro");
  const [config, setConfig] = useState<AlertConfig>(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [thresholdAlertActive, setThresholdAlertActive] = useState(false);

  const seenErrorIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const lastThresholdToastRef = useRef<number>(0);

  // Persist config
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
  }, [config]);

  // Request browser notification permission when enabled
  useEffect(() => {
    if (config.enabled && config.browserNotif && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [config.enabled, config.browserNotif]);

  const carregar = async () => {
    setLoading(true);
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("mensagens_whatsapp")
      .select("id, telefone, conteudo, direcao, status_envio, tipo_mensagem, error_message, mensagem_externa_id, created_at, payload")
      .eq("direcao", "OUT")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast.error("Erro ao carregar fila: " + error.message);
    } else {
      setMensagens((data as any) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel("monitor-envios")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagens_whatsapp", filter: "direcao=eq.OUT" },
        () => carregar()
      )
      .subscribe();
    const interval = setInterval(carregar, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const enviados = mensagens.filter(m => m.status_envio === "enviado" || m.status_envio === "entregue" || m.status_envio === "lido").length;
    const erros = mensagens.filter(m => m.status_envio === "erro").length;
    const pendentes = mensagens.filter(m => !m.status_envio || m.status_envio === "pendente").length;
    const total = mensagens.length;
    const taxa = total > 0 ? Math.round((enviados / total) * 100) : 0;
    return { enviados, erros, pendentes, total, taxa };
  }, [mensagens]);

  // Erros dentro da janela configurada
  const errosNaJanela = useMemo(() => {
    const cutoff = Date.now() - config.windowMin * 60 * 1000;
    return mensagens.filter(
      m => m.status_envio === "erro" && new Date(m.created_at).getTime() >= cutoff
    );
  }, [mensagens, config.windowMin]);

  // Detectar novos erros + disparar alertas
  useEffect(() => {
    const errorRows = mensagens.filter(m => m.status_envio === "erro");

    // Primeira passagem: marcar como já vistos sem alertar
    if (!initializedRef.current) {
      errorRows.forEach(m => seenErrorIdsRef.current.add(m.id));
      initializedRef.current = true;
      return;
    }

    if (!config.enabled) return;

    const novos = errorRows.filter(m => !seenErrorIdsRef.current.has(m.id));
    novos.forEach(m => seenErrorIdsRef.current.add(m.id));

    if (novos.length > 0) {
      // Toast por novos erros
      novos.slice(0, 3).forEach(n => {
        const isSendFailed = (n.error_message ?? "").includes("SEND_FAILED") || (n.error_message ?? "").toLowerCase().includes("send_failed");
        toast.error(
          isSendFailed ? "SEND_FAILED no WhatsApp" : "Falha de envio WhatsApp",
          {
            description: `${n.telefone} · ${(n.error_message ?? "Sem detalhe").slice(0, 120)}`,
            duration: 8000,
          }
        );
      });
      if (novos.length > 3) {
        toast.error(`+${novos.length - 3} novas falhas registradas`);
      }

      if (config.sound) playBeep();
      if (config.browserNotif && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("Falhas de envio WhatsApp", {
            body: `${novos.length} nova(s) falha(s) detectada(s).`,
            icon: "/favicon.ico",
            tag: "monitor-envios-falha",
          });
        } catch {}
      }
    }

    // Threshold da janela
    const overThreshold = errosNaJanela.length >= config.threshold;
    setThresholdAlertActive(overThreshold);

    if (overThreshold) {
      const now = Date.now();
      // dispara no máximo a cada 2 min
      if (now - lastThresholdToastRef.current > 120000) {
        lastThresholdToastRef.current = now;
        toast.error("⚠️ Limite de falhas atingido", {
          description: `${errosNaJanela.length} falhas em ${config.windowMin} min (limite: ${config.threshold}).`,
          duration: 10000,
        });
        if (config.browserNotif && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("⚠️ Limite de falhas WhatsApp", {
              body: `${errosNaJanela.length} falhas nos últimos ${config.windowMin} min.`,
              icon: "/favicon.ico",
              tag: "monitor-envios-threshold",
              requireInteraction: true,
            });
          } catch {}
        }
      }
    }
  }, [mensagens, config, errosNaJanela]);

  const filtradas = useMemo(() => {
    if (tab === "todos") return mensagens;
    if (tab === "erro") return mensagens.filter(m => m.status_envio === "erro");
    if (tab === "enviado") return mensagens.filter(m => ["enviado", "entregue", "lido"].includes(m.status_envio ?? ""));
    return mensagens.filter(m => !m.status_envio || m.status_envio === "pendente");
  }, [mensagens, tab]);

  const ultimosErros = useMemo(
    () => mensagens.filter(m => m.status_envio === "erro").slice(0, 5),
    [mensagens]
  );

  const reenviar = async (m: MensagemRow) => {
    try {
      const { data, error } = await supabase.functions.invoke("enviar-whatsapp-queue", {
        body: { telefone: m.telefone, mensagem: m.conteudo, campaign: m.tipo_mensagem ?? "manual" },
      });
      if (error) throw error;
      if ((data as any)?.success) {
        toast.success("Reenvio enviado com sucesso");
      } else {
        toast.error("Falha no reenvio: " + ((data as any)?.message || "Erro desconhecido"));
      }
      carregar();
    } catch (e: any) {
      toast.error("Erro ao reenviar: " + e.message);
    }
  };

  const StatusBadge = ({ status }: { status: string | null }) => {
    if (status === "erro") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Erro</Badge>;
    if (status === "lido") return <Badge className="gap-1 bg-blue-500 hover:bg-blue-600"><CheckCircle2 className="h-3 w-3" />Lido</Badge>;
    if (status === "entregue") return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3" />Entregue</Badge>;
    if (status === "enviado") return <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3" />Enviado</Badge>;
    return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Monitor de Envios WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              Fila, falhas e reenvio de envios automáticos (confirmações, lembretes, boas-vindas, lote) e manuais — últimas 24h.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EvolutionStatusBadge />
            <Button
              variant={config.enabled ? "default" : "outline"}
              size="sm"
              onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
              title={config.enabled ? "Alertas ativos" : "Alertas desativados"}
            >
              {config.enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(s => !s)}>
              <Settings className="h-4 w-4 mr-2" />Alertas
            </Button>
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Painel de configuração de alertas */}
        {showSettings && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />Configuração de alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="threshold">Limite de falhas</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  value={config.threshold}
                  onChange={(e) => setConfig(c => ({ ...c, threshold: Math.max(1, Number(e.target.value) || 1) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="window">Janela (minutos)</Label>
                <Input
                  id="window"
                  type="number"
                  min={1}
                  value={config.windowMin}
                  onChange={(e) => setConfig(c => ({ ...c, windowMin: Math.max(1, Number(e.target.value) || 1) }))}
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border p-3">
                <Label htmlFor="notif" className="text-sm">Notificação do navegador</Label>
                <Switch
                  id="notif"
                  checked={config.browserNotif}
                  onCheckedChange={(v) => setConfig(c => ({ ...c, browserNotif: v }))}
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border p-3">
                <Label htmlFor="sound" className="text-sm">Som de alerta</Label>
                <Switch
                  id="sound"
                  checked={config.sound}
                  onCheckedChange={(v) => setConfig(c => ({ ...c, sound: v }))}
                />
              </div>
              <div className="md:col-span-4 text-xs text-muted-foreground">
                Será disparado um alerta quando houver <b>{config.threshold}+ falhas</b> em <b>{config.windowMin} min</b>. Cada nova falha individual também gera um toast.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Banner de alerta de threshold */}
        {thresholdAlertActive && config.enabled && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Limite de falhas ultrapassado</AlertTitle>
            <AlertDescription>
              {errosNaJanela.length} falhas registradas nos últimos {config.windowMin} minutos
              (limite configurado: {config.threshold}). Verifique a conexão da Evolution API.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total (24h)</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold flex items-center gap-2"><Send className="h-5 w-5 text-muted-foreground" />{stats.total}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Enviados</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-600">{stats.enviados}</div><div className="text-xs text-muted-foreground">{stats.taxa}% sucesso</div></CardContent>
          </Card>
          <Card className={thresholdAlertActive ? "border-destructive" : ""}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Falhas</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.erros}</div>
              <div className="text-xs text-muted-foreground">{errosNaJanela.length} em {config.windowMin}min</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pendentes</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-600">{stats.pendentes}</div></CardContent>
          </Card>
        </div>

        {/* Últimos erros em destaque */}
        {ultimosErros.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive text-lg">
                <AlertCircle className="h-5 w-5" />Últimos erros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ultimosErros.map(e => (
                <div key={e.id} className="text-sm border-l-2 border-destructive pl-3 py-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono">{e.telefone}</span>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.created_at), { locale: ptBR, addSuffix: true })}</span>
                    {e.tipo_mensagem && <Badge variant="outline" className="text-[10px]">{e.tipo_mensagem}</Badge>}
                  </div>
                  <div className="text-xs text-destructive mt-1 break-words">{e.error_message ?? "Sem detalhe"}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fila de envios</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="grid grid-cols-4 w-full md:w-auto">
                <TabsTrigger value="erro">Falhas ({stats.erros})</TabsTrigger>
                <TabsTrigger value="pendente">Pendentes ({stats.pendentes})</TabsTrigger>
                <TabsTrigger value="enviado">Enviados ({stats.enviados})</TabsTrigger>
                <TabsTrigger value="todos">Todos ({stats.total})</TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="mt-4">
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : filtradas.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem nesta categoria.</div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {filtradas.slice(0, PAGE_SIZE).map(m => (
                      <div key={m.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <StatusBadge status={m.status_envio} />
                              <span className="font-mono text-sm">{m.telefone}</span>
                              {m.tipo_mensagem && <Badge variant="outline" className="text-[10px]">{m.tipo_mensagem}</Badge>}
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(m.created_at), { locale: ptBR, addSuffix: true })}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground truncate">{m.conteudo}</div>
                            {m.error_message && (
                              <div className="text-xs text-destructive mt-1 break-words bg-destructive/10 rounded px-2 py-1">
                                {m.error_message}
                              </div>
                            )}
                          </div>
                          {m.status_envio === "erro" && (
                            <Button size="sm" variant="outline" onClick={() => reenviar(m)}>
                              <RefreshCw className="h-3 w-3 mr-1" />Reenviar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {filtradas.length > PAGE_SIZE && (
                      <div className="text-center text-xs text-muted-foreground pt-2">
                        Exibindo {PAGE_SIZE} de {filtradas.length}. Use os filtros para refinar.
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
