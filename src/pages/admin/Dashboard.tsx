import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  BarChart3,
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  Clock,
  RefreshCw,
  Filter,
  MessageCircle,
  Star,
  CheckCircle2,
  XCircle,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
  subMonths,
  isAfter,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

type PeriodFilter = "7dias" | "semana" | "mes" | "trimestre" | "todos";

interface Agendamento {
  id: string;
  created_at: string;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  nome_completo: string;
  local_atendimento: string;
  tipo_atendimento: string;
  convenio: string;
  status_crm: string;
  status_funil: string | null;
  confirmation_status: string | null;
}

interface DashboardData {
  // KPIs
  total: number;
  hoje: number;
  semana: number;
  mes: number;
  atendidos: number;
  cancelados: number;
  taxaConversao: number;
  variacaoSemanal: number;
  // Mensagens
  msgsTotal: number;
  msgsIn: number;
  msgsOut: number;
  // Reviews
  reviewsTotal: number;
  reviewsMedia: number;
  // Lembretes
  lembretesPendentes: number;
  // Charts
  porLocal: { name: string; value: number }[];
  porStatus: { name: string; value: number }[];
  porTipo: { name: string; value: number }[];
  porConvenio: { name: string; value: number }[];
  tendencia: { date: string; agendamentos: number; mensagens: number }[];
  proximos: Agendamento[];
  filteredTotal: number;
}

const COLORS = {
  status: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"],
  tipo: ["#10b981", "#6366f1", "#ec4899", "#f97316", "#06b6d4"],
  convenio: ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#64748b"],
};

const LOCAL_COLOR_BY_NAME: Record<string, string> = {
  Clinicor: "#14b8a6",
  "Hospital Geral de Paragominas": "#f59e0b",
  HGP: "#f59e0b",
  Belém: "#8b5cf6",
  "Belém (IOB / Vitria)": "#8b5cf6",
};
const LOCAL_FALLBACK = ["#14b8a6", "#f59e0b", "#8b5cf6", "#64748b"];
const colorForLocal = (name: string, idx: number) =>
  LOCAL_COLOR_BY_NAME[name] || LOCAL_FALLBACK[idx % LOCAL_FALLBACK.length];

const periodLabels: Record<PeriodFilter, string> = {
  "7dias": "Últimos 7 dias",
  semana: "Esta semana",
  mes: "Este mês",
  trimestre: "Último trimestre",
  todos: "Todos os períodos",
};

const getFilterStartDate = (filter: PeriodFilter): Date | null => {
  const now = new Date();
  switch (filter) {
    case "7dias":
      return subDays(now, 7);
    case "semana":
      return startOfWeek(now, { locale: ptBR });
    case "mes":
      return startOfMonth(now);
    case "trimestre":
      return subMonths(now, 3);
    default:
      return null;
  }
};

const AdminDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("mes");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const hojeStr = format(new Date(), "yyyy-MM-dd");
      const seteDiasAtras = subDays(new Date(), 7).toISOString();
      const quatorzeDiasAtras = subDays(new Date(), 14).toISOString();

      const [
        agRes,
        msgRes,
        revRes,
        lembRes,
        proxRes,
      ] = await Promise.all([
        supabase
          .from("agendamentos")
          .select(
            "id, created_at, data_agendamento, hora_agendamento, nome_completo, local_atendimento, tipo_atendimento, convenio, status_crm, status_funil, confirmation_status"
          )
          .neq("status_funil", "bloqueio"),
        supabase
          .from("mensagens_whatsapp")
          .select("id, direcao, created_at")
          .gte("created_at", quatorzeDiasAtras),
        supabase
          .from("avaliacoes_google")
          .select("rating")
          .eq("ativo", true),
        supabase
          .from("lembretes_anuais")
          .select("id", { count: "exact", head: true })
          .eq("lembrete_enviado", false),
        supabase
          .from("agendamentos")
          .select(
            "id, created_at, data_agendamento, hora_agendamento, nome_completo, local_atendimento, tipo_atendimento, convenio, status_crm, status_funil, confirmation_status"
          )
          .gte("data_agendamento", hojeStr)
          .neq("status_funil", "bloqueio")
          .order("data_agendamento", { ascending: true })
          .order("hora_agendamento", { ascending: true })
          .limit(6),
      ]);

      if (agRes.error) throw agRes.error;
      const agendamentos = (agRes.data || []) as Agendamento[];
      const mensagens = msgRes.data || [];
      const reviews = revRes.data || [];

      const hoje = startOfDay(new Date());
      const inicioSemana = startOfWeek(new Date(), { locale: ptBR });
      const inicioMes = startOfMonth(new Date());
      const filterStart = getFilterStartDate(periodFilter);

      const filtered = filterStart
        ? agendamentos.filter((a) => isAfter(new Date(a.created_at), filterStart))
        : agendamentos;

      const hojeCount = agendamentos.filter(
        (a) => new Date(a.created_at) >= hoje
      ).length;
      const semanaCount = agendamentos.filter(
        (a) => new Date(a.created_at) >= inicioSemana
      ).length;
      const mesCount = agendamentos.filter(
        (a) => new Date(a.created_at) >= inicioMes
      ).length;

      // Variação semanal: últimos 7 dias vs 7 dias anteriores
      const ult7 = agendamentos.filter(
        (a) => new Date(a.created_at) >= subDays(new Date(), 7)
      ).length;
      const ant7 = agendamentos.filter((a) => {
        const d = new Date(a.created_at);
        return d >= subDays(new Date(), 14) && d < subDays(new Date(), 7);
      }).length;
      const variacaoSemanal = ant7 === 0 ? (ult7 > 0 ? 100 : 0) : ((ult7 - ant7) / ant7) * 100;

      const atendidos = filtered.filter((a) => a.status_crm === "ATENDIDO").length;
      const cancelados = filtered.filter((a) => a.status_funil === "cancelado").length;
      const taxaConversao = filtered.length === 0 ? 0 : (atendidos / filtered.length) * 100;

      const count = <T extends string>(arr: T[]) => {
        const map: Record<string, number> = {};
        arr.forEach((k) => (map[k] = (map[k] || 0) + 1));
        return Object.entries(map)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);
      };

      const porLocal = count(
        filtered.map((a) => (a.local_atendimento || "—").split(" – ")[0])
      );
      const porStatus = count(filtered.map((a) => a.status_crm));
      const porTipo = count(filtered.map((a) => a.tipo_atendimento || "—"));
      const porConvenio = count(filtered.map((a) => a.convenio || "—")).slice(0, 6);

      // Tendência últimos 14 dias: agendamentos + mensagens
      const tendencia: { date: string; agendamentos: number; mensagens: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const dia = subDays(new Date(), i);
        const diaStr = format(dia, "yyyy-MM-dd");
        const ag = agendamentos.filter(
          (a) => format(new Date(a.created_at), "yyyy-MM-dd") === diaStr
        ).length;
        const ms = mensagens.filter(
          (m: any) => format(new Date(m.created_at), "yyyy-MM-dd") === diaStr
        ).length;
        tendencia.push({
          date: format(dia, "dd/MM", { locale: ptBR }),
          agendamentos: ag,
          mensagens: ms,
        });
      }

      const msgsIn = mensagens.filter((m: any) => m.direcao === "IN").length;
      const msgsOut = mensagens.filter((m: any) => m.direcao === "OUT").length;
      const reviewsMedia =
        reviews.length === 0
          ? 0
          : reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length;

      setData({
        total: agendamentos.length,
        hoje: hojeCount,
        semana: semanaCount,
        mes: mesCount,
        atendidos,
        cancelados,
        taxaConversao,
        variacaoSemanal,
        msgsTotal: mensagens.length,
        msgsIn,
        msgsOut,
        reviewsTotal: reviews.length,
        reviewsMedia,
        lembretesPendentes: lembRes.count || 0,
        porLocal,
        porStatus,
        porTipo,
        porConvenio,
        tendencia,
        proximos: (proxRes.data || []) as Agendamento[],
        filteredTotal: filtered.length,
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o dashboard.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFilter]);

  const kpis = useMemo(
    () => [
      {
        title: "Total de Leads",
        value: data?.total ?? 0,
        icon: Users,
        accent: "from-blue-500/20 to-blue-500/5 text-blue-500",
        sub: `${data?.filteredTotal ?? 0} no período`,
      },
      {
        title: "Hoje",
        value: data?.hoje ?? 0,
        icon: Clock,
        accent: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
        sub: "novos hoje",
      },
      {
        title: "Esta semana",
        value: data?.semana ?? 0,
        icon: Calendar,
        accent: "from-violet-500/20 to-violet-500/5 text-violet-500",
        sub:
          data && data.variacaoSemanal !== 0
            ? `${data.variacaoSemanal > 0 ? "+" : ""}${data.variacaoSemanal.toFixed(0)}% vs semana anterior`
            : "vs semana anterior",
        trend: data?.variacaoSemanal,
      },
      {
        title: "Este mês",
        value: data?.mes ?? 0,
        icon: TrendingUp,
        accent: "from-amber-500/20 to-amber-500/5 text-amber-500",
        sub: "novos este mês",
      },
      {
        title: "Atendidos",
        value: data?.atendidos ?? 0,
        icon: CheckCircle2,
        accent: "from-teal-500/20 to-teal-500/5 text-teal-500",
        sub: `${(data?.taxaConversao ?? 0).toFixed(0)}% de conversão`,
      },
      {
        title: "Cancelados",
        value: data?.cancelados ?? 0,
        icon: XCircle,
        accent: "from-rose-500/20 to-rose-500/5 text-rose-500",
        sub: "no período",
      },
    ],
    [data]
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 font-display">
              <BarChart3 className="h-7 w-7 text-primary" />
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Visão completa do consultório em tempo real
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={periodFilter}
                onValueChange={(v: PeriodFilter) => setPeriodFilter(v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                  <SelectItem value="semana">Esta semana</SelectItem>
                  <SelectItem value="mes">Este mês</SelectItem>
                  <SelectItem value="trimestre">Último trimestre</SelectItem>
                  <SelectItem value="todos">Todos os períodos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {kpis.map((k, i) => (
                <Card
                  key={i}
                  className="border-border/50 overflow-hidden relative group hover:border-primary/40 transition-all"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${k.accent} opacity-50 pointer-events-none`}
                  />
                  <CardContent className="p-4 relative">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        {k.title}
                      </p>
                      <k.icon className="h-4 w-4 opacity-80" />
                    </div>
                    <p className="text-3xl font-bold text-foreground tabular-nums">
                      {k.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      {typeof k.trend === "number" && k.trend !== 0 && (
                        k.trend > 0 ? (
                          <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 text-rose-500" />
                        )
                      )}
                      {k.sub}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Mini stats: WhatsApp, Reviews, Lembretes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-border/50">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Mensagens (14d)</p>
                    <p className="text-2xl font-bold tabular-nums">{data?.msgsTotal ?? 0}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-emerald-500">↓ {data?.msgsIn ?? 0} recebidas</span>
                      {" · "}
                      <span className="text-blue-500">↑ {data?.msgsOut ?? 0} enviadas</span>
                    </p>
                  </div>
                  <Link
                    to="/admin/whatsapp"
                    className="text-xs text-primary hover:underline whitespace-nowrap"
                  >
                    Abrir →
                  </Link>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                    <Star className="h-6 w-6 fill-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Avaliações Google</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {(data?.reviewsMedia ?? 0).toFixed(1)}
                      <span className="text-sm text-muted-foreground font-normal ml-1">
                        / 5
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data?.reviewsTotal ?? 0} avaliações ativas
                    </p>
                  </div>
                  <Link
                    to="/admin/avaliacoes"
                    className="text-xs text-primary hover:underline whitespace-nowrap"
                  >
                    Abrir →
                  </Link>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-violet-500/10 text-violet-500">
                    <Bell className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Lembretes anuais</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {data?.lembretesPendentes ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">pacientes pendentes</p>
                  </div>
                  <Link
                    to="/admin/lembretes"
                    className="text-xs text-primary hover:underline whitespace-nowrap"
                  >
                    Abrir →
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Period indicator */}
            {periodFilter !== "todos" && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">
                  Filtros e gráficos exibindo{" "}
                  <strong>{data?.filteredTotal ?? 0}</strong> agendamentos —{" "}
                  <strong>{periodLabels[periodFilter]}</strong>
                </span>
              </div>
            )}

            {/* Tendência (area) + Próximos agendamentos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="border-border/50 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Atividade dos últimos 14 dias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data?.tendencia || []}>
                        <defs>
                          <linearGradient id="gAg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gMs" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <YAxis
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="agendamentos"
                          stroke="hsl(var(--primary))"
                          fill="url(#gAg)"
                          strokeWidth={2}
                          name="Agendamentos"
                        />
                        <Area
                          type="monotone"
                          dataKey="mensagens"
                          stroke="#10b981"
                          fill="url(#gMs)"
                          strokeWidth={2}
                          name="Mensagens WhatsApp"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Próximos agendamentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data?.proximos.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum agendamento futuro.
                    </p>
                  )}
                  {data?.proximos.map((a) => (
                    <Link
                      key={a.id}
                      to="/admin/agendamentos"
                      className="block p-3 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{a.nome_completo}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {a.status_crm}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {a.data_agendamento
                          ? format(parseISO(a.data_agendamento), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                        {a.hora_agendamento && ` · ${a.hora_agendamento.slice(0, 5)}`}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(a.local_atendimento || "").split(" – ")[0]} · {a.tipo_atendimento}
                      </p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Funil CRM
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data?.porStatus || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {data?.porStatus.map((_, i) => (
                            <Cell key={i} fill={COLORS.status[i % COLORS.status.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Por Local de Atendimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.porLocal || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          type="number"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          width={110}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Agendamentos">
                          {data?.porLocal.map((e, i) => (
                            <Cell key={i} fill={colorForLocal(e.name, i)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Por Tipo de Atendimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data?.porTipo || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {data?.porTipo.map((_, i) => (
                            <Cell key={i} fill={COLORS.tipo[i % COLORS.tipo.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Top Convênios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.porConvenio || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          type="number"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          width={110}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Agendamentos">
                          {data?.porConvenio.map((_, i) => (
                            <Cell
                              key={i}
                              fill={COLORS.convenio[i % COLORS.convenio.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
