import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { enviarMensagemWhatsApp } from "@/services/integracoes";
import {
  Bot, Sparkles, Send, Edit3, Trash2, RefreshCw, Loader2,
  ArrowRight, Phone, User, AlertCircle, CheckCircle2, Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AcaoSugerida {
  tipo: string;
  status_destino?: string;
  descricao: string;
}

interface Draft {
  id: string;
  agendamento_id: string | null;
  telefone: string | null;
  sugestao: string;
  conteudo_final: string | null;
  instrucao: string | null;
  status: string;
  tipo_origem: string;
  acoes_sugeridas: AcaoSugerida[] | null;
  contexto_resumo: any;
  modelo: string;
  latencia_ms: number | null;
  created_at: string;
}

interface Agendamento {
  id: string;
  nome_completo: string | null;
  telefone_whatsapp: string | null;
  status_crm: string | null;
  local_atendimento: string | null;
  data_agendamento: string | null;
  hora_agendamento: string | null;
}

const FILTROS = [
  { value: "pending", label: "Pendentes" },
  { value: "all", label: "Todos" },
  { value: "sent", label: "Enviados" },
  { value: "discarded", label: "Descartados" },
] as const;

const HermesPage = () => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [agendamentos, setAgendamentos] = useState<Record<string, Agendamento>>({});
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<typeof FILTROS[number]["value"]>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [acting, setActing] = useState(false);

  async function carregar() {
    setLoading(true);
    let q = supabase
      .from("hermes_drafts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    if (filtro !== "all") q = q.eq("status", filtro);
    const { data, error } = await q;
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const list = (data ?? []) as unknown as Draft[];
    setDrafts(list);

    const ids = Array.from(new Set(list.map((d) => d.agendamento_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: ags } = await supabase
        .from("agendamentos")
        .select("id, nome_completo, telefone_whatsapp, status_crm, local_atendimento, data_agendamento, hora_agendamento")
        .in("id", ids);
      const map: Record<string, Agendamento> = {};
      (ags ?? []).forEach((a: any) => { map[a.id] = a; });
      setAgendamentos(map);
    }

    if (!selectedId && list.length) setSelectedId(list[0].id);
    setLoading(false);
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [filtro]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("hermes_drafts_admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hermes_drafts" },
        () => carregar(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [filtro]);

  const selected = useMemo(() => drafts.find((d) => d.id === selectedId) ?? null, [drafts, selectedId]);
  const agSelected = selected?.agendamento_id ? agendamentos[selected.agendamento_id] : null;

  useEffect(() => {
    setEditingText(selected?.sugestao ?? "");
  }, [selected?.id]);

  async function marcarStatus(id: string, status: string, conteudo_final?: string) {
    const { error } = await supabase.rpc("marcar_hermes_draft_status", {
      p_draft_id: id,
      p_status: status,
      p_conteudo_final: conteudo_final ?? null,
      p_mensagem_id: null,
    });
    if (error) throw new Error(error.message);
  }

  async function executarAcoes(d: Draft) {
    const acoes = d.acoes_sugeridas ?? [];
    if (!d.agendamento_id || !acoes.length) return;
    for (const a of acoes) {
      if (a.tipo === "mover_status_crm" && a.status_destino) {
        const { data: ag } = await supabase
          .from("agendamentos")
          .select("status_crm")
          .eq("id", d.agendamento_id)
          .maybeSingle();
        const anterior = ag?.status_crm ?? null;
        await supabase
          .from("agendamentos")
          .update({ status_crm: a.status_destino })
          .eq("id", d.agendamento_id);
        await supabase.rpc("registrar_crm_audit", {
          p_agendamento_id: d.agendamento_id,
          p_acao: "hermes_acao",
          p_status_anterior: anterior,
          p_status_novo: a.status_destino,
          p_detalhes: { origem: "hermes_copiloto", descricao: a.descricao },
        });
      } else if (a.tipo === "marcar_atendido") {
        await supabase
          .from("agendamentos")
          .update({ status_crm: "ATENDIDO" })
          .eq("id", d.agendamento_id);
      } else if (a.tipo === "marcar_perdido") {
        await supabase
          .from("agendamentos")
          .update({ status_crm: "PERDIDO" })
          .eq("id", d.agendamento_id);
      }
    }
  }

  async function aceitarEEnviar(d: Draft) {
    if (!d.telefone) {
      toast({ title: "Telefone ausente", description: "Não dá pra enviar sem telefone.", variant: "destructive" });
      return;
    }
    setActing(true);
    try {
      const conteudo = editingText.trim();
      if (!conteudo) throw new Error("Mensagem vazia");
      const r = await enviarMensagemWhatsApp(d.telefone, conteudo);
      if (!r.success) throw new Error(r.error || "Falha ao enviar");
      await marcarStatus(d.id, conteudo === d.sugestao ? "sent" : "edited", conteudo);
      await executarAcoes(d);
      toast({ title: "Mensagem enviada", description: "Hermes registrou o uso." });
      await carregar();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha", variant: "destructive" });
    } finally {
      setActing(false);
    }
  }

  async function descartar(d: Draft) {
    setActing(true);
    try {
      await marcarStatus(d.id, "discarded");
      toast({ title: "Sugestão descartada" });
      await carregar();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha", variant: "destructive" });
    } finally {
      setActing(false);
    }
  }

  async function regenerar(d: Draft) {
    if (!d.agendamento_id && !d.telefone) return;
    setActing(true);
    try {
      const last8 = (d.telefone ?? "").replace(/\D/g, "").slice(-8);
      const { data: msgs } = await supabase
        .from("mensagens_whatsapp")
        .select("direcao, conteudo, created_at")
        .ilike("telefone", `%${last8}`)
        .order("created_at", { ascending: false })
        .limit(20);
      const mensagens = (msgs ?? []).reverse().map((m: any) => ({
        direcao: m.direcao, conteudo: m.conteudo, created_at: m.created_at,
      }));
      const ag = d.agendamento_id ? agendamentos[d.agendamento_id] : null;
      const { error } = await supabase.functions.invoke("hermes-sugerir-resposta", {
        body: {
          agendamento_id: d.agendamento_id,
          agendamento: ag,
          telefone: d.telefone,
          mensagens,
          tipo_origem: "manual",
        },
      });
      if (error) throw new Error(error.message);
      toast({ title: "Nova sugestão gerada" });
      await carregar();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha", variant: "destructive" });
    } finally {
      setActing(false);
    }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string; icon: any }> = {
      pending: { label: "Pendente", cls: "bg-amber-100 text-amber-900 border-amber-300", icon: Clock },
      sent: { label: "Enviado", cls: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: CheckCircle2 },
      edited: { label: "Editado e enviado", cls: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: CheckCircle2 },
      accepted: { label: "Aceito", cls: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: CheckCircle2 },
      discarded: { label: "Descartado", cls: "bg-muted text-muted-foreground border-border", icon: Trash2 },
      error: { label: "Erro", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle },
    };
    const v = map[s] ?? map.pending;
    const Icon = v.icon;
    return (
      <Badge variant="outline" className={`gap-1 ${v.cls}`}><Icon className="h-3 w-3" />{v.label}</Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-7 w-7 text-primary" /> Hermes Copiloto
            </h1>
            <p className="text-sm text-muted-foreground">
              Sugestões de resposta + ações no CRM geradas automaticamente quando o bot escala um lead para humano.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)}>
              <TabsList>
                {FILTROS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button variant="outline" size="icon" onClick={carregar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          {/* Lista */}
          <Card className="overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Sugestões ({drafts.length})
              </CardTitle>
            </CardHeader>
            <ScrollArea className="h-[calc(100vh-220px)]">
              {loading && (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
                </div>
              )}
              {!loading && drafts.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma sugestão {filtro !== "all" ? `(${filtro})` : ""} no momento.
                </div>
              )}
              {!loading && drafts.map((d) => {
                const ag = d.agendamento_id ? agendamentos[d.agendamento_id] : null;
                const isSel = d.id === selectedId;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={`w-full text-left px-3 py-3 border-b border-border hover:bg-muted/50 transition-colors ${isSel ? "bg-muted" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {ag?.nome_completo ?? d.telefone ?? "Sem contato"}
                        </span>
                      </div>
                      {statusBadge(d.status)}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                      {d.sugestao || "(sem sugestão)"}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{d.tipo_origem === "auto_escalacao" ? "🤖 Auto" : "👤 Manual"}</span>
                      <span>{formatDistanceToNow(new Date(d.created_at), { locale: ptBR, addSuffix: true })}</span>
                    </div>
                  </button>
                );
              })}
            </ScrollArea>
          </Card>

          {/* Detalhe */}
          <Card>
            {!selected && (
              <CardContent className="py-16 text-center text-muted-foreground">
                Selecione uma sugestão para revisar.
              </CardContent>
            )}
            {selected && (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {agSelected?.nome_completo ?? "Lead sem nome"}
                        {statusBadge(selected.status)}
                      </CardTitle>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                        {selected.telefone && (<span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {selected.telefone}</span>)}
                        {agSelected?.status_crm && (<span>Status CRM: <strong>{agSelected.status_crm}</strong></span>)}
                        {agSelected?.local_atendimento && (<span>{agSelected.local_atendimento}</span>)}
                        <span>{selected.modelo}{selected.latencia_ms ? ` · ${selected.latencia_ms}ms` : ""}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {selected.instrucao && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Contexto:</span> {selected.instrucao}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Mensagem sugerida
                      </label>
                      {selected.status === "pending" && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Edit3 className="h-3 w-3" /> Edite livremente antes de enviar
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={5}
                      disabled={selected.status !== "pending" || acting}
                      className="resize-none"
                    />
                  </div>

                  {selected.acoes_sugeridas && selected.acoes_sugeridas.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                        Ações sugeridas no CRM
                      </label>
                      <div className="space-y-2">
                        {selected.acoes_sugeridas.filter(a => a.tipo !== "nenhuma").map((a, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2 border border-border">
                            <ArrowRight className="h-3.5 w-3.5 text-primary" />
                            <span>{a.descricao}</span>
                            {a.status_destino && (
                              <Badge variant="secondary" className="ml-auto">{a.status_destino}</Badge>
                            )}
                          </div>
                        ))}
                        {selected.status === "pending" && (
                          <p className="text-[11px] text-muted-foreground">
                            As ações serão executadas automaticamente ao clicar em <strong>Aceitar e enviar</strong>.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {selected.status === "pending" && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button onClick={() => aceitarEEnviar(selected)} disabled={acting}>
                        {acting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                        Aceitar e enviar
                      </Button>
                      <Button variant="outline" onClick={() => regenerar(selected)} disabled={acting}>
                        <RefreshCw className="h-4 w-4 mr-1" /> Regenerar
                      </Button>
                      <Button variant="ghost" onClick={() => descartar(selected)} disabled={acting} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-1" /> Descartar
                      </Button>
                    </div>
                  )}

                  {selected.conteudo_final && selected.conteudo_final !== selected.sugestao && (
                    <div className="text-xs text-muted-foreground border-t pt-3">
                      <span className="font-medium">Conteúdo enviado:</span>
                      <p className="mt-1 whitespace-pre-wrap">{selected.conteudo_final}</p>
                    </div>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default HermesPage;
