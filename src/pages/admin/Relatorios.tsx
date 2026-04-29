import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart3, MessageCircle, Users, Bot, Sparkles, Send, RefreshCw } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar,
} from "recharts";

interface Relatorio {
  periodo: { inicio: string; fim: string };
  whatsapp: { mensagens_in: number; mensagens_out: number; total: number; por_tipo: Record<string, number> };
  crm: { leads_novos: number; conversoes: number; funil_atual: Record<string, number> };
  bot: { acoes_total: number; escalacoes: number; top_intencoes: Record<string, number> };
  
}

interface SerieDia {
  dia: string;
  msg_in: number;
  msg_out: number;
  leads_novos: number;
  drafts_gerados: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function Relatorios() {
  const [inicio, setInicio] = useState(daysAgo(6));
  const [fim, setFim] = useState(today());
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [serie, setSerie] = useState<SerieDia[]>([]);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      supabase.rpc("relatorio_diario", { p_data_inicio: inicio, p_data_fim: fim }),
      supabase.rpc("relatorio_diario_serie", { p_data_inicio: inicio, p_data_fim: fim }),
    ]);
    setLoading(false);
    if (r1.error) { toast.error(r1.error.message); return; }
    if (r2.error) { toast.error(r2.error.message); return; }
    setRelatorio(r1.data as unknown as Relatorio);
    setSerie((r2.data || []) as SerieDia[]);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const enviarWhatsapp = async () => {
    const tel = window.prompt("Telefone para envio (com DDI, ex: 5591999999999):");
    if (!tel) return;
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("enviar-relatorio-diario", {
      body: { telefone: tel, data_inicio: inicio, data_fim: fim },
    });
    setEnviando(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    toast.success("Relatório enviado por WhatsApp");
  };

  const tipoMensagens = relatorio
    ? Object.entries(relatorio.whatsapp.por_tipo).map(([tipo, qtd]) => ({ tipo, qtd }))
    : [];
  const intencoes = relatorio
    ? Object.entries(relatorio.bot.top_intencoes).map(([intencao, qtd]) => ({ intencao, qtd }))
    : [];

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Relatórios · WhatsApp & CRM</h1>
            <p className="text-sm text-muted-foreground">Métricas consolidadas do período selecionado.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-auto" />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-auto" />
            </div>
            <div className="flex gap-2 ml-auto flex-wrap">
              <Button onClick={() => { setInicio(today()); setFim(today()); }} variant="outline" size="sm">Hoje</Button>
              <Button onClick={() => { setInicio(daysAgo(6)); setFim(today()); }} variant="outline" size="sm">7 dias</Button>
              <Button onClick={() => { setInicio(daysAgo(29)); setFim(today()); }} variant="outline" size="sm">30 dias</Button>
              <Button onClick={carregar} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button onClick={enviarWhatsapp} disabled={enviando} variant="secondary">
                <Send className="h-4 w-4 mr-2" />
                Enviar por WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        {relatorio && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={MessageCircle} label="Mensagens (total)" value={relatorio.whatsapp.total} sub={`${relatorio.whatsapp.mensagens_in} IN · ${relatorio.whatsapp.mensagens_out} OUT`} />
              <StatCard icon={Users} label="Novos leads" value={relatorio.crm.leads_novos} sub={`${relatorio.crm.conversoes} conversões`} />
              <StatCard icon={Bot} label="Ações do bot" value={relatorio.bot.acoes_total} sub={`${relatorio.bot.escalacoes} escalações p/ humano`} />
              
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Série diária</CardTitle>
                <CardDescription>Mensagens, leads e drafts por dia</CardDescription>
              </CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="msg_in" stroke="hsl(var(--primary))" name="Msg IN" />
                    <Line type="monotone" dataKey="msg_out" stroke="hsl(var(--accent))" name="Msg OUT" />
                    <Line type="monotone" dataKey="leads_novos" stroke="#10b981" name="Leads" />
                    <Line type="monotone" dataKey="drafts_gerados" stroke="#f59e0b" name="Drafts" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Mensagens por tipo</CardTitle></CardHeader>
                <CardContent style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tipoMensagens}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="tipo" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={70} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="qtd" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Top intenções (bot)</CardTitle></CardHeader>
                <CardContent style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={intencoes} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="intencao" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip />
                      <Bar dataKey="qtd" fill="hsl(var(--accent))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Funil CRM (estado atual)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(relatorio.crm.funil_atual).map(([s, q]) => (
                    <div key={s} className="border rounded p-3 text-center bg-muted/30">
                      <div className="text-2xl font-bold">{q}</div>
                      <div className="text-xs text-muted-foreground capitalize">{s}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className="h-4 w-4" /> {label}
        </div>
        <div className="text-3xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
