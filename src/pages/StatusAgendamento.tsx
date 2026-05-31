import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  Clock,
  MapPin,
  Stethoscope,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  MessageCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";

interface StatusAgendamento {
  id: string;
  primeiro_nome: string;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  local_atendimento: string;
  tipo_atendimento: string;
  detalhe_exame_ou_cirurgia: string | null;
  convenio: string;
  status_crm: string | null;
  status_funil: string | null;
  confirmation_status: string | null;
  confirmation_response_at: string | null;
  created_at: string;
}

type StatusTipo = "confirmado" | "atendido" | "cancelado" | "aguardando" | "recebido";

interface StatusInfo {
  tipo: StatusTipo;
  label: string;
  descricao: string;
  Icon: typeof CheckCircle2;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

function classificarStatus(s: StatusAgendamento): StatusInfo {
  if (s.status_crm === "ATENDIDO") {
    return {
      tipo: "atendido",
      label: "Atendido",
      descricao: "Sua consulta já foi realizada.",
      Icon: CheckCircle2,
      bgClass: "bg-emerald-500/10",
      textClass: "text-emerald-600 dark:text-emerald-400",
      borderClass: "border-emerald-500/30",
    };
  }
  if (s.confirmation_status === "confirmado") {
    return {
      tipo: "confirmado",
      label: "Confirmado",
      descricao: "Sua presença foi confirmada. Aguardamos você no horário.",
      Icon: CheckCircle2,
      bgClass: "bg-emerald-500/10",
      textClass: "text-emerald-600 dark:text-emerald-400",
      borderClass: "border-emerald-500/30",
    };
  }
  if (s.confirmation_status === "cancelado") {
    return {
      tipo: "cancelado",
      label: "Cancelado",
      descricao: "Este agendamento foi cancelado. Entre em contato para reagendar.",
      Icon: XCircle,
      bgClass: "bg-red-500/10",
      textClass: "text-red-600 dark:text-red-400",
      borderClass: "border-red-500/30",
    };
  }
  if (s.status_funil === "lead" || !s.data_agendamento || !s.hora_agendamento) {
    return {
      tipo: "aguardando",
      label: "Aguardando contato",
      descricao: "Recebemos seu interesse. Nossa equipe entrará em contato em breve para confirmar data e horário.",
      Icon: AlertCircle,
      bgClass: "bg-amber-500/10",
      textClass: "text-amber-600 dark:text-amber-400",
      borderClass: "border-amber-500/30",
    };
  }
  return {
    tipo: "recebido",
    label: "Agendamento recebido",
    descricao: "Seu agendamento foi recebido. Em breve confirmaremos por WhatsApp.",
    Icon: FileText,
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-600 dark:text-blue-400",
    borderClass: "border-blue-500/30",
  };
}

function formatarData(d: string): string {
  try {
    return format(parseISO(d), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
      .replace(/^./, (c) => c.toUpperCase());
  } catch {
    return d;
  }
}

function formatarHora(h: string): string {
  return h.slice(0, 5);
}

export default function StatusAgendamentoPage() {
  const { id } = useParams<{ id: string }>();
  const { waLinkBare } = useSiteWhatsApp();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<StatusAgendamento | null>(null);

  useEffect(() => {
    async function carregar() {
      if (!id) {
        setErro("Link inválido.");
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("status-agendamento", {
          body: { id },
        });
        if (error) {
          setErro("Agendamento não encontrado.");
        } else if (data?.error) {
          setErro(data.error);
        } else {
          setDados(data as StatusAgendamento);
        }
      } catch {
        setErro("Não foi possível carregar o agendamento. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [id]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Status do Agendamento · Dr. Juliano Machado</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="description" content="Acompanhe o status do seu agendamento na clínica do Dr. Juliano Machado." />
        <link rel="canonical" href={`https://drjulianomachado.com/status-agendamento/${id ?? ""}`} />
        <meta property="og:title" content="Status do Agendamento · Dr. Juliano Machado" />
        <meta property="og:description" content="Acompanhe em tempo real o status da sua consulta com o Dr. Juliano Machado." />
        <meta property="og:url" content={`https://drjulianomachado.com/status-agendamento/${id ?? ""}`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
            Dr. Juliano Machado · Oftalmologista
          </Link>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Voltar ao site
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 sm:py-12 max-w-2xl w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm">Carregando seu agendamento...</p>
          </div>
        ) : erro || !dados ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <XCircle className="h-12 w-12 mx-auto text-red-500" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Agendamento não encontrado</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Este link pode estar incorreto ou expirado.
                </p>
              </div>
              <Button asChild variant="outline">
                <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Falar com a clínica
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <StatusContent dados={dados} />
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Dr. Juliano Machado · Oftalmologista
      </footer>
    </div>
  );
}

function StatusContent({ dados }: { dados: StatusAgendamento }) {
  const statusInfo = classificarStatus(dados);
  const { Icon } = statusInfo;

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
          Olá, {dados.primeiro_nome}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Veja abaixo o status do seu agendamento.
        </p>
      </div>

      {/* Badge de status */}
      <Card className={`border-2 ${statusInfo.borderClass}`}>
        <CardContent className="pt-6">
          <div className={`rounded-lg ${statusInfo.bgClass} p-4 flex items-start gap-3`}>
            <Icon className={`h-6 w-6 ${statusInfo.textClass} shrink-0 mt-0.5`} />
            <div>
              <Badge variant="outline" className={`${statusInfo.textClass} ${statusInfo.borderClass} mb-1.5`}>
                {statusInfo.label}
              </Badge>
              <p className="text-sm text-foreground/90">{statusInfo.descricao}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalhes */}
      {(dados.data_agendamento || dados.hora_agendamento) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
              Detalhes do agendamento
            </h2>

            <div className="space-y-3">
              {dados.data_agendamento && (
                <DetalheLinha
                  Icon={CalendarDays}
                  label="Data"
                  valor={formatarData(dados.data_agendamento)}
                />
              )}
              {dados.hora_agendamento && (
                <DetalheLinha
                  Icon={Clock}
                  label="Horário"
                  valor={formatarHora(dados.hora_agendamento)}
                  hint="O atendimento é por ordem de chegada — recomendamos chegar com antecedência."
                />
              )}
              <DetalheLinha
                Icon={MapPin}
                label="Local"
                valor={dados.local_atendimento}
              />
              <DetalheLinha
                Icon={Stethoscope}
                label="Tipo de atendimento"
                valor={
                  dados.detalhe_exame_ou_cirurgia
                    ? `${dados.tipo_atendimento} · ${dados.detalhe_exame_ou_cirurgia}`
                    : dados.tipo_atendimento
                }
              />
              <DetalheLinha
                Icon={CreditCard}
                label="Convênio"
                valor={dados.convenio}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* CTA WhatsApp */}
      <Card className="bg-card">
        <CardContent className="pt-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Precisa reagendar, cancelar ou tem alguma dúvida?
          </p>
          <Button asChild size="lg" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5 mr-2" />
              Falar com a clínica no WhatsApp
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DetalheLinha({
  Icon,
  label,
  valor,
  hint,
}: {
  Icon: typeof CalendarDays;
  label: string;
  valor: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{valor}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1 italic">{hint}</p>}
      </div>
    </div>
  );
}
