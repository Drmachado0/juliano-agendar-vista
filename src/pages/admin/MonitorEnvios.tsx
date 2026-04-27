import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EvolutionStatusBadge } from "@/components/admin/EvolutionStatusBadge";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Send, XCircle } from "lucide-react";
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

export default function MonitorEnvios() {
  const [loading, setLoading] = useState(true);
  const [mensagens, setMensagens] = useState<MensagemRow[]>([]);
  const [tab, setTab] = useState<"todos" | "erro" | "enviado" | "pendente">("erro");

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
            <p className="text-sm text-muted-foreground">Fila, falhas e últimos erros (últimas 24h)</p>
          </div>
          <div className="flex items-center gap-2">
            <EvolutionStatusBadge />
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

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
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Falhas</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{stats.erros}</div></CardContent>
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
