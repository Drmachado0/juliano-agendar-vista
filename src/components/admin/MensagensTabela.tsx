import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MensagemRow {
  id: string;
  telefone: string;
  conteudo: string;
  direcao: string;
  status_envio: string | null;
  tipo_mensagem: string | null;
  error_message: string | null;
  created_at: string;
}

interface Props {
  /** YYYY-MM-DD */
  dataInicio: string;
  /** YYYY-MM-DD */
  dataFim: string;
}

const PAGE_SIZE = 100;

function StatusBadge({ status }: { status: string | null }) {
  if (status === "erro")
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Erro</Badge>;
  if (status === "lido")
    return <Badge className="gap-1 bg-blue-500 hover:bg-blue-600"><CheckCircle2 className="h-3 w-3" />Lido</Badge>;
  if (status === "entregue")
    return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3" />Entregue</Badge>;
  if (status === "enviado")
    return <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3" />Enviado</Badge>;
  return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
}

export default function MensagensTabela({ dataInicio, dataFim }: Props) {
  const [loading, setLoading] = useState(true);
  const [mensagens, setMensagens] = useState<MensagemRow[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      const inicioIso = `${dataInicio}T00:00:00`;
      const fimIso = `${dataFim}T23:59:59`;
      const { data, error } = await supabase
        .from("mensagens_whatsapp")
        .select("id, telefone, conteudo, direcao, status_envio, tipo_mensagem, error_message, created_at")
        .eq("direcao", "OUT")
        .gte("created_at", inicioIso)
        .lte("created_at", fimIso)
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error) setMensagens((data as any) ?? []);
      setLoading(false);
    };
    carregar();
  }, [dataInicio, dataFim]);

  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    mensagens.forEach(m => { if (m.tipo_mensagem) set.add(m.tipo_mensagem); });
    return Array.from(set).sort();
  }, [mensagens]);

  const filtradas = useMemo(() => {
    return mensagens.filter(m => {
      if (statusFiltro !== "todos") {
        if (statusFiltro === "enviado") {
          if (!["enviado", "entregue", "lido"].includes(m.status_envio ?? "")) return false;
        } else if (statusFiltro === "pendente") {
          if (m.status_envio && m.status_envio !== "pendente") return false;
        } else if (m.status_envio !== statusFiltro) return false;
      }
      if (tipoFiltro !== "todos" && m.tipo_mensagem !== tipoFiltro) return false;
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        if (!m.telefone.toLowerCase().includes(q) && !m.conteudo.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [mensagens, statusFiltro, tipoFiltro, busca]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mensagens do período</CardTitle>
        <CardDescription>
          Lista detalhada de envios (status, data, origem) — mesmos campos do Monitor de Envios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="enviado">Enviados / entregues / lidos</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Origem (tipo)</Label>
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {tiposDisponiveis.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Buscar (telefone ou conteúdo)</Label>
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex: 5591..." />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhuma mensagem para os filtros atuais.
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filtradas.slice(0, PAGE_SIZE).map(m => (
              <div key={m.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <StatusBadge status={m.status_envio} />
                  <span className="font-mono text-sm">{m.telefone}</span>
                  {m.tipo_mensagem && (
                    <Badge variant="outline" className="text-[10px]">{m.tipo_mensagem}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground truncate">{m.conteudo}</div>
                {m.error_message && (
                  <div className="text-xs text-destructive mt-1 break-words bg-destructive/10 rounded px-2 py-1">
                    {m.error_message}
                  </div>
                )}
              </div>
            ))}
            {filtradas.length > PAGE_SIZE && (
              <div className="text-center text-xs text-muted-foreground pt-2">
                Exibindo {PAGE_SIZE} de {filtradas.length}. Refine os filtros para ver mais.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
