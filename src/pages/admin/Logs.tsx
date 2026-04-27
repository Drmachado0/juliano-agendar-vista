import { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { ScrollText, RefreshCw, Download, Wifi, Search, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

import LogDetailsDrawer from "@/components/admin/LogDetailsDrawer";
import {
  listarSystemLogs,
  exportarLogsCsv,
  SystemLogEntry,
  LOG_CATEGORIES,
  LOG_LEVEL_META,
  LogLevel,
} from "@/services/systemLogs";
import { listarAuditCrm, ACAO_LABELS, CrmAuditEntry } from "@/services/crmAudit";

// ===========================
// Aba 1 — Sistema
// ===========================
function SystemTab() {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    search: string;
    level?: LogLevel;
    category?: string;
    source?: string;
  }>({ search: "" });
  const [selected, setSelected] = useState<SystemLogEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const refreshRef = useRef<number | null>(null);

  const fetch = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await listarSystemLogs({
      search: filters.search,
      level: filters.level,
      category: filters.category,
      source: filters.source,
      limit: 300,
    });
    if (!silent) setLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar logs", description: error.message, variant: "destructive" });
      return;
    }
    setLogs(data);
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.level, filters.category, filters.source]);

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => fetch(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  // Auto-refresh
  useEffect(() => {
    if (refreshRef.current) window.clearInterval(refreshRef.current);
    if (autoRefresh) {
      refreshRef.current = window.setInterval(() => fetch(true), 10_000);
    }
    return () => {
      if (refreshRef.current) window.clearInterval(refreshRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  // Realtime (modo "Ao vivo")
  useEffect(() => {
    if (!liveMode) return;
    const channel = supabase
      .channel("system-logs-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "system_logs" },
        (payload) => {
          const novo = payload.new as SystemLogEntry;
          // Aplica filtros locais antes de inserir
          if (filters.level && novo.level !== filters.level) return;
          if (filters.category && novo.category !== filters.category) return;
          if (filters.source && novo.source !== filters.source) return;
          setLogs((prev) => [novo, ...prev].slice(0, 300));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveMode, filters.level, filters.category, filters.source]);

  const sources = useMemo(() => Array.from(new Set(logs.map((l) => l.source))).sort(), [logs]);
  const hasFilters = !!filters.search || !!filters.level || !!filters.category || !!filters.source;

  const exportar = () => {
    const csv = exportarLogsCsv(logs);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-logs-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Mensagem, fonte ou e-mail..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nível</Label>
            <Select
              value={filters.level || "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, level: v === "all" ? undefined : (v as LogLevel) }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Aviso</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select
              value={filters.category || "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, category: v === "all" ? undefined : v }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {LOG_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fonte</Label>
            <Select
              value={filters.source || "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, source: v === "all" ? undefined : v }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{logs.length} registro(s)</span>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ search: "" })}
                className="text-muted-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={liveMode} onCheckedChange={setLiveMode} id="live" />
              <Label htmlFor="live" className="text-sm flex items-center gap-1.5 cursor-pointer">
                <Wifi className={`h-3.5 w-3.5 ${liveMode ? "text-emerald-500" : "text-muted-foreground"}`} />
                Ao vivo
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto" />
              <Label htmlFor="auto" className="text-sm cursor-pointer">Auto-refresh 10s</Label>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetch()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportar} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Quando</TableHead>
              <TableHead className="w-[90px]">Nível</TableHead>
              <TableHead className="w-[140px]">Categoria</TableHead>
              <TableHead className="w-[180px]">Fonte</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead className="w-[180px]">Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhum log encontrado.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const meta = LOG_LEVEL_META[log.level] ?? LOG_LEVEL_META.info;
                return (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelected(log);
                      setDrawerOpen(true);
                    }}
                  >
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge className={meta.className}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{log.category}</TableCell>
                    <TableCell className="text-xs font-mono">{log.source}</TableCell>
                    <TableCell className="text-sm max-w-md truncate">{log.message}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate">
                      {log.user_email || "sistema"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <LogDetailsDrawer log={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}

// ===========================
// Aba 2 — CRM (reaproveita crm_audit_log)
// ===========================
function CrmTab() {
  const [entries, setEntries] = useState<CrmAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetch = async () => {
    setLoading(true);
    const { data, error } = await listarAuditCrm({ search, limit: 200 });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar auditoria CRM", description: error.message, variant: "destructive" });
      return;
    }
    setEntries(data);
  };

  useEffect(() => {
    const t = setTimeout(fetch, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Nome do paciente ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground">{entries.length} ação(ões)</span>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Quando</TableHead>
              <TableHead className="w-[180px]">Ação</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead className="w-[200px]">Mudança</TableHead>
              <TableHead className="w-[200px]">Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhuma ação registrada.</TableCell>
              </TableRow>
            ) : (
              entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(e.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge variant="outline">{ACAO_LABELS[e.acao] || e.acao}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {e.agendamento?.nome_completo || "—"}
                    {e.agendamento?.telefone_whatsapp && (
                      <div className="text-xs text-muted-foreground">{e.agendamento.telefone_whatsapp}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {e.status_anterior || e.status_novo ? (
                      <span>
                        {e.status_anterior || "—"} → <strong>{e.status_novo || "—"}</strong>
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate">
                    {e.user_name || e.user_email || "sistema"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ===========================
// Aba 3 — WhatsApp
// ===========================
function WhatsAppTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [direcao, setDirecao] = useState<string>("all");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");

  const fetch = async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("mensagens_whatsapp")
      .select("id, telefone, direcao, conteudo, status_envio, error_message, tipo_mensagem, agendamento_id, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (direcao !== "all") q = q.eq("direcao", direcao);
    if (statusFiltro !== "all") q = q.eq("status_envio", statusFiltro);
    if (search.trim()) q = q.ilike("telefone", `%${search.trim()}%`);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar mensagens", description: error.message, variant: "destructive" });
      return;
    }
    setRows(data || []);
  };

  useEffect(() => {
    const t = setTimeout(fetch, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, direcao, statusFiltro]);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={direcao} onValueChange={setDirecao}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas direções</SelectItem>
            <SelectItem value="IN">Recebida</SelectItem>
            <SelectItem value="OUT">Enviada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
            <SelectItem value="lido">Lido</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{rows.length} mensagem(ns)</span>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Quando</TableHead>
              <TableHead className="w-[80px]">Direção</TableHead>
              <TableHead className="w-[140px]">Telefone</TableHead>
              <TableHead>Conteúdo</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhuma mensagem.</TableCell></TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.direcao === "OUT" ? "default" : "secondary"}>
                      {m.direcao === "OUT" ? "Enviada" : "Recebida"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{m.telefone}</TableCell>
                  <TableCell className="text-sm max-w-md truncate" title={m.conteudo}>
                    {m.conteudo}
                  </TableCell>
                  <TableCell>
                    {m.status_envio === "erro" ? (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" title={m.error_message || ""}>
                        Erro
                      </Badge>
                    ) : (
                      <Badge variant="outline">{m.status_envio || "—"}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ===========================
// Aba 4 — Acessos públicos (status_acesso_log)
// ===========================
function AcessosTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("status_acesso_log")
      .select("id, agendamento_id, ip_address, user_agent, referer, status_exibido, confirmation_status, status_funil, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar acessos", description: error.message, variant: "destructive" });
      return;
    }
    setRows(data || []);
  };

  useEffect(() => { fetch(); }, []);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{rows.length} acesso(s)</span>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Quando</TableHead>
              <TableHead className="w-[140px]">IP</TableHead>
              <TableHead className="w-[140px]">Status exibido</TableHead>
              <TableHead className="w-[140px]">Funil</TableHead>
              <TableHead>Origem (referer)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum acesso registrado.</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{r.ip_address || "—"}</TableCell>
                  <TableCell className="text-xs">{r.status_exibido || "—"}</TableCell>
                  <TableCell className="text-xs">{r.status_funil || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-md" title={r.referer || ""}>
                    {r.referer || "direto"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ===========================
// Página principal
// ===========================
const AdminLogs = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ScrollText className="h-6 w-6" />
              Logs do Sistema
            </h1>
            <p className="text-muted-foreground mt-1">
              Eventos, erros e ações em um só lugar para diagnóstico rápido.
            </p>
          </div>
        </div>

        <Tabs defaultValue="sistema">
          <TabsList>
            <TabsTrigger value="sistema">Sistema</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="acessos">Acessos</TabsTrigger>
          </TabsList>

          <TabsContent value="sistema" className="mt-4"><SystemTab /></TabsContent>
          <TabsContent value="crm" className="mt-4"><CrmTab /></TabsContent>
          <TabsContent value="whatsapp" className="mt-4"><WhatsAppTab /></TabsContent>
          <TabsContent value="acessos" className="mt-4"><AcessosTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminLogs;
