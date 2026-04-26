import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ACAO_LABELS,
  AuditUserOption,
  CrmAuditEntry,
  STATUS_CRM_OPCOES,
  listarAuditCrm,
  listarUsuariosAudit,
} from "@/services/crmAudit";
import {
  ArrowRight,
  CalendarIcon,
  ChevronDown,
  Clock,
  ExternalLink,
  Filter,
  MessageCircle,
  RefreshCw,
  Search,
  User,
  X,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AuditLogDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAgendamento?: (agendamentoId: string) => void;
  onOpenWhatsApp?: (agendamentoId: string, telefone: string) => void;
}

const acaoColors: Record<string, string> = {
  status_change: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  reprocess_welcome: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  manual_whatsapp: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  automation_trigger: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
};

const TODAS = "todas";
const QUALQUER = "qualquer";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export default function AuditLogDrawer({
  open,
  onOpenChange,
  onOpenAgendamento,
  onOpenWhatsApp,
}: AuditLogDrawerProps) {
  const [entries, setEntries] = useState<CrmAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [usuarios, setUsuarios] = useState<AuditUserOption[]>([]);
  const [filtrosOpen, setFiltrosOpen] = useState(false);

  // Filtros
  const [filtroAcao, setFiltroAcao] = useState<string>(TODAS);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState<string>(TODAS);
  const [filtroStatusAnterior, setFiltroStatusAnterior] = useState<string>(QUALQUER);
  const [filtroStatusNovo, setFiltroStatusNovo] = useState<string>(QUALQUER);
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);

  // Refs para o callback do Realtime ler valores atuais
  const filtroAcaoRef = useRef(filtroAcao);
  const searchRef = useRef(debouncedSearch);
  const filtroUsuarioRef = useRef(filtroUsuario);
  const filtroStatusAntRef = useRef(filtroStatusAnterior);
  const filtroStatusNovoRef = useRef(filtroStatusNovo);
  const dataInicioRef = useRef<Date | undefined>(dataInicio);
  const dataFimRef = useRef<Date | undefined>(dataFim);
  useEffect(() => { filtroAcaoRef.current = filtroAcao; }, [filtroAcao]);
  useEffect(() => { searchRef.current = debouncedSearch; }, [debouncedSearch]);
  useEffect(() => { filtroUsuarioRef.current = filtroUsuario; }, [filtroUsuario]);
  useEffect(() => { filtroStatusAntRef.current = filtroStatusAnterior; }, [filtroStatusAnterior]);
  useEffect(() => { filtroStatusNovoRef.current = filtroStatusNovo; }, [filtroStatusNovo]);
  useEffect(() => { dataInicioRef.current = dataInicio; }, [dataInicio]);
  useEffect(() => { dataFimRef.current = dataFim; }, [dataFim]);

  // Debounce do campo de busca (300 ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Conta filtros avançados ativos (excluindo ação e busca, que ficam no header principal)
  const advCount = useMemo(() => {
    let c = 0;
    if (filtroUsuario !== TODAS) c++;
    if (filtroStatusAnterior !== QUALQUER) c++;
    if (filtroStatusNovo !== QUALQUER) c++;
    if (dataInicio) c++;
    if (dataFim) c++;
    return c;
  }, [filtroUsuario, filtroStatusAnterior, filtroStatusNovo, dataInicio, dataFim]);

  const hasAnyFilter =
    advCount > 0 || filtroAcao !== TODAS || debouncedSearch.length > 0;

  const fetch = async () => {
    setLoading(true);
    const { data } = await listarAuditCrm({
      limit: 200,
      acao: filtroAcao === TODAS ? undefined : filtroAcao,
      search: debouncedSearch || undefined,
      userId: filtroUsuario === TODAS ? undefined : filtroUsuario,
      statusAnterior:
        filtroStatusAnterior === QUALQUER ? undefined : filtroStatusAnterior,
      statusNovo: filtroStatusNovo === QUALQUER ? undefined : filtroStatusNovo,
      dataInicio: dataInicio ? dataInicio.toISOString() : undefined,
      // Inclui o dia inteiro da data fim
      dataFim: dataFim
        ? new Date(dataFim.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
        : undefined,
    });
    setEntries(data);
    setLoading(false);
  };

  // Carrega usuários disponíveis na primeira abertura
  useEffect(() => {
    if (open && usuarios.length === 0) {
      listarUsuariosAudit().then((r) => setUsuarios(r.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Refaz busca quando qualquer filtro muda
  useEffect(() => {
    if (open) fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    filtroAcao,
    debouncedSearch,
    filtroUsuario,
    filtroStatusAnterior,
    filtroStatusNovo,
    dataInicio,
    dataFim,
  ]);

  // Realtime: aplica todos os filtros no callback (via refs) antes de inserir
  useEffect(() => {
    if (!open) {
      setLiveConnected(false);
      return;
    }

    const channel = supabase
      .channel("crm-audit-log-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crm_audit_log" },
        async (payload) => {
          const novo = payload.new as CrmAuditEntry;

          // Filtros simples
          if (filtroAcaoRef.current !== TODAS && novo.acao !== filtroAcaoRef.current) return;
          if (filtroUsuarioRef.current !== TODAS && novo.user_id !== filtroUsuarioRef.current) return;
          if (
            filtroStatusAntRef.current !== QUALQUER &&
            novo.status_anterior !== filtroStatusAntRef.current
          ) return;
          if (
            filtroStatusNovoRef.current !== QUALQUER &&
            novo.status_novo !== filtroStatusNovoRef.current
          ) return;
          const created = new Date(novo.created_at);
          if (dataInicioRef.current && created < dataInicioRef.current) return;
          if (dataFimRef.current) {
            const fim = new Date(dataFimRef.current.getTime() + 24 * 60 * 60 * 1000 - 1);
            if (created > fim) return;
          }

          // Enriquece com dados do paciente (Realtime não traz joins)
          let agendamento: CrmAuditEntry["agendamento"] = null;
          if (novo.agendamento_id) {
            try {
              const { data: ag } = await supabase
                .from("agendamentos")
                .select("nome_completo, telefone_whatsapp")
                .eq("id", novo.agendamento_id)
                .maybeSingle();
              agendamento = ag ?? null;
            } catch {
              agendamento = null;
            }
          }

          // Filtro de busca textual (pós enriquecimento)
          const searchTerm = searchRef.current;
          if (searchTerm) {
            const nome = agendamento?.nome_completo?.toLowerCase() ?? "";
            const tel = digitsOnly(agendamento?.telefone_whatsapp ?? "");
            const termoLower = searchTerm.toLowerCase();
            const termoDigits = digitsOnly(searchTerm);
            const matchNome = nome.includes(termoLower);
            const matchTel = termoDigits.length >= 3 && tel.includes(termoDigits);
            if (!matchNome && !matchTel) return;
          }

          const enriched: CrmAuditEntry = { ...novo, agendamento };

          setEntries((prev) => {
            if (prev.some((e) => e.id === enriched.id)) return prev;
            return [enriched, ...prev].slice(0, 200);
          });
        },
      )
      .subscribe((status) => {
        setLiveConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setLiveConnected(false);
    };
  }, [open]);

  function limparFiltros() {
    setFiltroAcao(TODAS);
    setSearch("");
    setFiltroUsuario(TODAS);
    setFiltroStatusAnterior(QUALQUER);
    setFiltroStatusNovo(QUALQUER);
    setDataInicio(undefined);
    setDataFim(undefined);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Log de Auditoria do CRM
          </SheetTitle>
          <SheetDescription>
            Registro de todas as ações realizadas: mudanças de status, reprocessamentos e automações.
          </SheetDescription>
        </SheetHeader>

        {/* Linha principal: busca + ação + atualizar + status live */}
        <div className="flex flex-col gap-2 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar paciente por nome ou telefone..."
                className="h-9 pl-8 pr-8 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={filtroAcao} onValueChange={setFiltroAcao}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas as ações</SelectItem>
                {Object.entries(ACAO_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetch} disabled={loading} title="Recarregar">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Filtros avançados (colapsável) */}
          <Collapsible open={filtrosOpen} onOpenChange={setFiltrosOpen}>
            <div className="flex items-center justify-between gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5">
                  <Filter className="h-3.5 w-3.5" />
                  Filtros avançados
                  {advCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                      {advCount}
                    </Badge>
                  )}
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", filtrosOpen && "rotate-180")}
                  />
                </Button>
              </CollapsibleTrigger>
              <div className="flex items-center gap-2">
                {hasAnyFilter && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={limparFiltros}>
                    <X className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                )}
                {liveConnected && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    </span>
                    ao vivo
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{entries.length} registro(s)</span>
              </div>
            </div>

            <CollapsibleContent className="pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Usuário */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Usuário</label>
                  <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODAS}>Todos os usuários</SelectItem>
                      {usuarios.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.user_name ?? u.user_email ?? u.user_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status anterior */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Status anterior</label>
                  <Select value={filtroStatusAnterior} onValueChange={setFiltroStatusAnterior}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Qualquer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={QUALQUER}>Qualquer</SelectItem>
                      {STATUS_CRM_OPCOES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status novo */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Status novo</label>
                  <Select value={filtroStatusNovo} onValueChange={setFiltroStatusNovo}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Qualquer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={QUALQUER}>Qualquer</SelectItem>
                      {STATUS_CRM_OPCOES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Datas */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Período</label>
                  <div className="flex items-center gap-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 flex-1 justify-start text-left font-normal text-xs",
                            !dataInicio && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {dataInicio ? format(dataInicio, "dd/MM/yy") : "De"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataInicio}
                          onSelect={setDataInicio}
                          locale={ptBR}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 flex-1 justify-start text-left font-normal text-xs",
                            !dataFim && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {dataFim ? format(dataFim, "dd/MM/yy") : "Até"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataFim}
                          onSelect={setDataFim}
                          locale={ptBR}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading && entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum registro encontrado.
            </div>
          ) : (
            <ul className="space-y-3 py-3">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="border border-border rounded-lg p-3 bg-card space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className={acaoColors[e.acao] ?? ""}>
                      {ACAO_LABELS[e.acao] ?? e.acao}
                    </Badge>
                    <div className="text-xs text-muted-foreground text-right">
                      <div title={format(new Date(e.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}>
                        {format(new Date(e.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </div>
                      <div className="text-[10px] opacity-70">
                        {formatDistanceToNow(new Date(e.created_at), { locale: ptBR, addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{e.user_name ?? e.user_email ?? "—"}</span>
                    {e.user_email && e.user_name !== e.user_email && (
                      <span className="text-xs text-muted-foreground">({e.user_email})</span>
                    )}
                  </div>

                  {e.agendamento_id && (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="text-muted-foreground truncate">
                        Paciente:{" "}
                        {e.agendamento ? (
                          <span className="font-medium text-foreground">{e.agendamento.nome_completo}</span>
                        ) : (
                          <span className="italic">registro removido</span>
                        )}
                        {e.agendamento?.telefone_whatsapp && (
                          <> · {e.agendamento.telefone_whatsapp}</>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {onOpenAgendamento && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            disabled={!e.agendamento}
                            title={e.agendamento ? "Abrir agendamento" : "Registro removido"}
                            onClick={() => {
                              onOpenChange(false);
                              onOpenAgendamento(e.agendamento_id!);
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {onOpenWhatsApp && e.agendamento?.telefone_whatsapp && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            title="Abrir WhatsApp do paciente"
                            onClick={() => {
                              onOpenChange(false);
                              onOpenWhatsApp(e.agendamento_id!, e.agendamento!.telefone_whatsapp);
                            }}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {e.acao === "status_change" && (
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary">{e.status_anterior ?? "—"}</Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge>{e.status_novo ?? "—"}</Badge>
                    </div>
                  )}

                  {e.detalhes && Object.keys(e.detalhes).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Detalhes
                      </summary>
                      <pre className="mt-1 p-2 bg-muted rounded text-[11px] overflow-x-auto">
                        {JSON.stringify(e.detalhes, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
