import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Activity, AlertTriangle, RefreshCw, CheckCircle2, XCircle, ExternalLink, Radio } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LOG_LEVEL_META } from "@/services/systemLogs";
import {
  carregarMonitor,
  classificarCanal,
  CANAL_META,
  type Canal,
  type CanalStats,
  type MonitorSnapshot,
} from "@/services/monitorCrm";

const JANELAS = [
  { valor: 1, label: "1h" },
  { valor: 24, label: "24h" },
  { valor: 168, label: "7d" },
];

function statusCanal(stats: CanalStats): { tone: "ok" | "warn" | "error"; label: string } {
  if (stats.critical > 0 || stats.error > 0) return { tone: "error", label: "Com falhas" };
  if (stats.warn > 0) return { tone: "warn", label: "Alertas" };
  return { tone: "ok", label: "Estável" };
}

const TONE_CLASS: Record<"ok" | "warn" | "error", string> = {
  ok: "border-emerald-500/40 bg-emerald-500/5",
  warn: "border-amber-500/40 bg-amber-500/5",
  error: "border-red-500/50 bg-red-500/10",
};

function CanalCard({ stats }: { stats: CanalStats }) {
  const st = statusCanal(stats);
  const Icon = st.tone === "ok" ? CheckCircle2 : st.tone === "warn" ? AlertTriangle : XCircle;
  return (
    <Card className={`border-2 ${TONE_CLASS[st.tone]}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{stats.label}</CardTitle>
          <Icon className={`h-5 w-5 ${st.tone === "ok" ? "text-emerald-500" : st.tone === "warn" ? "text-amber-500" : "text-red-500"}`} />
        </div>
        <CardDescription>{st.label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><div className="text-lg font-semibold text-emerald-600">{stats.ok}</div><div className="text-[10px] text-muted-foreground uppercase">OK</div></div>
          <div><div className="text-lg font-semibold text-amber-600">{stats.warn}</div><div className="text-[10px] text-muted-foreground uppercase">Warn</div></div>
          <div><div className="text-lg font-semibold text-red-600">{stats.error}</div><div className="text-[10px] text-muted-foreground uppercase">Error</div></div>
          <div><div className="text-lg font-semibold text-red-800">{stats.critical}</div><div className="text-[10px] text-muted-foreground uppercase">Crit</div></div>
        </div>
        {stats.ultimo_erro_at && (
          <div className="pt-2 border-t border-border/50">
            <div className="text-xs text-muted-foreground">Último erro:</div>
            <div className="text-xs font-mono truncate" title={stats.ultimo_erro_msg ?? ""}>{stats.ultimo_erro_msg}</div>
            <div className="text-[10px] text-muted-foreground">{new Date(stats.ultimo_erro_at).toLocaleString("pt-BR")}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MonitoramentoCrm() {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [janela, setJanela] = useState<number>(24);
  const [live, setLive] = useState<"CONNECTING" | "SUBSCRIBED" | "CLOSED" | "CHANNEL_ERROR" | "TIMED_OUT">("CONNECTING");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await carregarMonitor(janela);
      setSnapshot(snap);
    } catch (err: any) {
      toast.error("Falha ao carregar monitor: " + (err?.message ?? "erro"));
    } finally {
      setLoading(false);
    }
  }, [janela]);

  useEffect(() => { carregar(); }, [carregar]);

  // Realtime: recarrega quando um novo log entra
  useEffect(() => {
    const ch = supabase
      .channel("monitor-crm-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "system_logs" }, (payload: any) => {
        const row = payload?.new;
        const canal = classificarCanal(row?.source);
        if (!canal) return;
        if (row?.level === "error" || row?.level === "critical") {
          toast.error(`[${CANAL_META[canal].label}] ${row.message ?? "Falha"}`, {
            description: row.source,
          });
        }
        carregar();
      })
      .subscribe((s) => setLive(s as any));
    return () => { supabase.removeChannel(ch); };
  }, [carregar]);

  const totalErros = useMemo(
    () => (snapshot?.por_canal ?? []).reduce((a, c) => a + c.error + c.critical, 0),
    [snapshot],
  );

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Activity className="h-6 w-6" /> Monitoramento CRM
            </h1>
            <p className="text-sm text-muted-foreground">
              Status ao vivo das integrações Meta CAPI, n8n e WhatsApp por agendamento.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={live === "SUBSCRIBED" ? "default" : "secondary"} className="gap-1">
              <Radio className={`h-3 w-3 ${live === "SUBSCRIBED" ? "animate-pulse text-emerald-400" : ""}`} />
              {live === "SUBSCRIBED" ? "ao vivo" : live.toLowerCase()}
            </Badge>
            <div className="flex gap-1 border rounded-md p-1">
              {JANELAS.map((j) => (
                <Button
                  key={j.valor}
                  size="sm"
                  variant={janela === j.valor ? "default" : "ghost"}
                  onClick={() => setJanela(j.valor)}
                >
                  {j.label}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={carregar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>

        {totalErros > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{totalErros} falha(s) na janela de {janela}h</AlertTitle>
            <AlertDescription>
              Verifique os canais abaixo e a tabela de eventos. Cada erro está vinculado ao agendamento afetado (quando aplicável).
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(snapshot?.por_canal ?? Object.keys(CANAL_META).map((c) => ({
            canal: c as Canal, label: CANAL_META[c as Canal].label,
            ok: 0, warn: 0, error: 0, critical: 0, ultimo_erro_at: null, ultimo_erro_msg: null,
          }))).map((s) => <CanalCard key={s.canal} stats={s} />)}
        </div>

        <Tabs defaultValue="eventos">
          <TabsList>
            <TabsTrigger value="eventos">Últimos eventos</TabsTrigger>
            <TabsTrigger value="agendamentos">Por agendamento</TabsTrigger>
          </TabsList>

          <TabsContent value="eventos" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Falhas e alertas recentes</CardTitle>
                <CardDescription>Últimos 50 eventos com nível ≥ warn.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Agendamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(snapshot?.ultimos_erros ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        Sem falhas nesta janela.
                      </TableCell></TableRow>
                    )}
                    {(snapshot?.ultimos_erros ?? []).map((e) => {
                      const canal = classificarCanal(e.source);
                      const meta = LOG_LEVEL_META[e.level];
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(e.created_at).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{canal ? CANAL_META[canal].label : "—"}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{e.source}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={meta.className}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="text-sm truncate" title={e.message}>{e.message}</div>
                          </TableCell>
                          <TableCell>
                            {e.agendamento_id ? (
                              <Link
                                to={`/admin/crm?agendamento=${e.agendamento_id}`}
                                className="text-xs text-primary underline inline-flex items-center gap-1"
                              >
                                abrir <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agendamentos" className="mt-4">
            <AgendamentosAfetados snapshot={snapshot} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function AgendamentosAfetados({ snapshot }: { snapshot: MonitorSnapshot | null }) {
  const linhas = useMemo(() => {
    const map = new Map<string, { agendamento_id: string; canais: Record<Canal, { level: string; ultimo: string }> }>();
    for (const e of snapshot?.ultimos_erros ?? []) {
      if (!e.agendamento_id) continue;
      const canal = classificarCanal(e.source);
      if (!canal) continue;
      const cur = map.get(e.agendamento_id) ?? {
        agendamento_id: e.agendamento_id,
        canais: {
          meta_capi: { level: "-", ultimo: "" },
          n8n: { level: "-", ultimo: "" },
          whatsapp: { level: "-", ultimo: "" },
        },
      };
      // mantém o mais recente por canal
      if (!cur.canais[canal].ultimo || e.created_at > cur.canais[canal].ultimo) {
        cur.canais[canal] = { level: e.level, ultimo: e.created_at };
      }
      map.set(e.agendamento_id, cur);
    }
    return Array.from(map.values());
  }, [snapshot]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agendamentos com falha</CardTitle>
        <CardDescription>Status pior encontrado por canal, nesta janela.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agendamento</TableHead>
              <TableHead>Meta CAPI</TableHead>
              <TableHead>n8n</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                Nenhum agendamento com falha na janela.
              </TableCell></TableRow>
            )}
            {linhas.map((l) => (
              <TableRow key={l.agendamento_id}>
                <TableCell className="font-mono text-xs">{l.agendamento_id.slice(0, 8)}…</TableCell>
                {(["meta_capi", "n8n", "whatsapp"] as Canal[]).map((c) => {
                  const v = l.canais[c];
                  const lvl = v.level as any;
                  const meta = lvl in LOG_LEVEL_META ? LOG_LEVEL_META[lvl as keyof typeof LOG_LEVEL_META] : null;
                  return (
                    <TableCell key={c}>
                      {meta ? <Badge className={meta.className}>{meta.label}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  );
                })}
                <TableCell>
                  <Link
                    to={`/admin/crm?agendamento=${l.agendamento_id}`}
                    className="text-xs text-primary underline inline-flex items-center gap-1"
                  >
                    abrir <ExternalLink className="h-3 w-3" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
