import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  BarChart3, 
  Calendar, 
  MapPin, 
  Users, 
  TrendingUp, 
  Clock,
  RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Legend
} from "recharts";
import { format, startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Stats {
  total: number;
  hoje: number;
  semana: number;
  mes: number;
  porLocal: { name: string; value: number }[];
  porStatus: { name: string; value: number }[];
  porTipo: { name: string; value: number }[];
  ultimosDias: { date: string; count: number }[];
}

const COLORS = {
  status: ['#10b981', '#3b82f6', '#8b5cf6'],
  local: ['#3b82f6', '#8b5cf6', '#f59e0b'],
  tipo: ['#10b981', '#6366f1', '#ec4899', '#f97316'],
};

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: agendamentos, error } = await supabase
        .from('agendamentos')
        .select('*');

      if (error) throw error;

      const hoje = startOfDay(new Date());
      const inicioSemana = startOfWeek(new Date(), { locale: ptBR });
      const inicioMes = startOfMonth(new Date());

      // Calcular estatísticas
      const total = agendamentos?.length || 0;
      const hojeCount = agendamentos?.filter(a => 
        new Date(a.created_at) >= hoje
      ).length || 0;
      const semanaCount = agendamentos?.filter(a => 
        new Date(a.created_at) >= inicioSemana
      ).length || 0;
      const mesCount = agendamentos?.filter(a => 
        new Date(a.created_at) >= inicioMes
      ).length || 0;

      // Por local
      const localCounts: Record<string, number> = {};
      agendamentos?.forEach(a => {
        const local = a.local_atendimento.split(' – ')[0];
        localCounts[local] = (localCounts[local] || 0) + 1;
      });
      const porLocal = Object.entries(localCounts).map(([name, value]) => ({ name, value }));

      // Por status CRM
      const statusCounts: Record<string, number> = {};
      agendamentos?.forEach(a => {
        statusCounts[a.status_crm] = (statusCounts[a.status_crm] || 0) + 1;
      });
      const porStatus = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

      // Por tipo de atendimento
      const tipoCounts: Record<string, number> = {};
      agendamentos?.forEach(a => {
        tipoCounts[a.tipo_atendimento] = (tipoCounts[a.tipo_atendimento] || 0) + 1;
      });
      const porTipo = Object.entries(tipoCounts).map(([name, value]) => ({ name, value }));

      // Últimos 7 dias
      const ultimosDias: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const dia = subDays(new Date(), i);
        const diaStr = format(dia, 'yyyy-MM-dd');
        const count = agendamentos?.filter(a => 
          format(new Date(a.created_at), 'yyyy-MM-dd') === diaStr
        ).length || 0;
        ultimosDias.push({
          date: format(dia, 'dd/MM', { locale: ptBR }),
          count
        });
      }

      setStats({
        total,
        hoje: hojeCount,
        semana: semanaCount,
        mes: mesCount,
        porLocal,
        porStatus,
        porTipo,
        ultimosDias,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar as estatísticas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    { 
      title: "Total de Agendamentos", 
      value: stats?.total || 0, 
      icon: Users, 
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30"
    },
    { 
      title: "Hoje", 
      value: stats?.hoje || 0, 
      icon: Clock, 
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30"
    },
    { 
      title: "Esta Semana", 
      value: stats?.semana || 0, 
      icon: Calendar, 
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30"
    },
    { 
      title: "Este Mês", 
      value: stats?.mes || 0, 
      icon: TrendingUp, 
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30"
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Visão geral dos agendamentos
            </p>
          </div>
          <Button variant="outline" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((stat, index) => (
                <Card key={index} className="border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                        <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                      </div>
                      <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                        <stat.icon className={`h-6 w-6 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Últimos 7 dias */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Últimos 7 dias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.ultimosDias || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis 
                          dataKey="date" 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          allowDecimals={false}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Bar 
                          dataKey="count" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                          name="Agendamentos"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Por Status CRM */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Por Status CRM
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats?.porStatus || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {stats?.porStatus.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS.status[index % COLORS.status.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Second Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Por Local */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Por Local de Atendimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.porLocal || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis 
                          type="number"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          allowDecimals={false}
                        />
                        <YAxis 
                          type="category"
                          dataKey="name"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          width={100}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          radius={[0, 4, 4, 0]}
                          name="Agendamentos"
                        >
                          {stats?.porLocal.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS.local[index % COLORS.local.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Por Tipo de Atendimento */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Por Tipo de Atendimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats?.porTipo || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {stats?.porTipo.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS.tipo[index % COLORS.tipo.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
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
