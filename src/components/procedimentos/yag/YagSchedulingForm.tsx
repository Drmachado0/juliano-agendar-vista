import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Eye,
  Loader2,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { criarLead } from "@/services/leads";
import { listarConvenios, type Convenio } from "@/services/convenios";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import {
  AVISO_AMBOS_OLHOS,
  AVISO_CONTATO,
  AVISO_POR_OLHO,
  LOCAL_ATENDIMENTO,
  TIPO_ATENDIMENTO,
  WHATSAPP_MENSAGEM,
  WHATSAPP_ORIGEM,
} from "./yagContent";
import {
  limparRotuloConvenio,
  mascararData,
  mascararTelefone,
  montarDetalhe,
  dataBrParaIso,
  validarFormulario,
  OLHOS,
  ORDEM_CAMPOS,
  valorConvenioCrm,
  type YagFormErrors,
  type YagFormValues,
} from "./yagFormUtils";

const VALORES_INICIAIS: YagFormValues = {
  nome: "",
  dataNascimento: "",
  telefone: "",
  olho: "",
  convenio: "",
};

/** Mensagem de resgate quando o envio falha — deliberadamente sem dado
 *  pessoal, para não trafegar PII na URL do wa.me. */
const MENSAGEM_FALLBACK =
  "Olá! Tentei enviar o formulário do YAG Laser pelo site e não consegui. Quero agendar no HGP em Paragominas.";

const YagSchedulingForm = () => {
  const [values, setValues] = useState<YagFormValues>(VALORES_INICIAIS);
  const [errors, setErrors] = useState<YagFormErrors>({});
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [lembretes, setLembretes] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [falhou, setFalhou] = useState(false);

  const { waLink } = useSiteWhatsApp();
  const { trackLead: trackLeadGoogle, trackFormSubmitConversion } = useGoogleTag();
  const { trackLead: trackLeadMeta } = useMetaPixel();

  useEffect(() => {
    let ativo = true;
    listarConvenios().then(({ data }) => {
      if (ativo) setConvenios(data);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const set = (campo: keyof YagFormValues, valor: string) => {
    setValues((prev) => ({ ...prev, [campo]: valor }));
    setErrors((prev) => {
      if (!prev[campo]) return prev;
      const { [campo]: _descartado, ...resto } = prev;
      return resto;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFalhou(false);

    const novosErros = validarFormulario(values);
    setErrors(novosErros);

    if (Object.keys(novosErros).length > 0) {
      const primeiro = ORDEM_CAMPOS.find((c) => novosErros[c]);
      if (primeiro) {
        document.getElementById(`yag-${primeiro}`)?.focus();
      }
      return;
    }

    setEnviando(true);

    const dadosLead = {
      nome_completo: values.nome.trim(),
      telefone_whatsapp: values.telefone,
      data_nascimento: dataBrParaIso(values.dataNascimento) || null,
      email: null,
      tipo_atendimento: TIPO_ATENDIMENTO,
      detalhe_exame_ou_cirurgia: montarDetalhe(values.olho),
      local_atendimento: LOCAL_ATENDIMENTO,
      convenio: values.convenio || "Não informado",
      convenio_outro: null,
    };

    const { lead_id, error } = await criarLead(dadosLead);

    setEnviando(false);

    if (error || !lead_id) {
      setFalhou(true);
      return;
    }

    // Notificação para a equipe com os dados do paciente.
    // O `criar-lead` já avisa o n8n, mas o e-mail vem desta função, que no
    // fluxo principal só é chamada quando há data escolhida. Como aqui a data
    // ainda será combinada, enviamos sem data — a função trata esse caso e
    // manda o e-mail como "Novo Lead".
    // Fire-and-forget: uma falha aqui nunca pode travar a tela do paciente.
    supabase.functions
      .invoke("notificar-agendamento-email", {
        body: {
          nome_completo: dadosLead.nome_completo,
          telefone_whatsapp: dadosLead.telefone_whatsapp,
          email_paciente: null,
          data_nascimento: dadosLead.data_nascimento,
          tipo_atendimento: dadosLead.tipo_atendimento,
          detalhe_exame_ou_cirurgia: dadosLead.detalhe_exame_ou_cirurgia,
          local_atendimento: dadosLead.local_atendimento,
          convenio: dadosLead.convenio,
          convenio_outro: null,
          data_agendamento: "",
          hora_agendamento: "",
        },
      })
      .catch((e) =>
        console.warn("[yag] notificar-agendamento-email falhou:", e),
      );

    // O `criar-lead` dispara o evento Lead da CAPI usando lead_id como
    // event_id. Passamos o mesmo id ao Pixel para o Meta deduplicar.
    trackLeadMeta("Capsulotomia YAG Laser - HGP", lead_id);
    trackLeadGoogle("yag_hgp_formulario");
    trackFormSubmitConversion();
    setEnviado(true);
  };

  if (enviado) {
    return (
      <section
        id="agendar"
        aria-labelledby="sucesso-titulo"
        className="card-glass rounded-2xl p-6 md:p-10 border-2 border-primary/40 scroll-mt-28"
      >
        <div aria-live="polite">
          <CheckCircle2
            className="w-14 h-14 text-primary mb-4"
            aria-hidden="true"
          />
          <h2
            id="sucesso-titulo"
            className="text-2xl md:text-3xl font-bold text-foreground mb-4"
          >
            Recebemos seu pedido, {values.nome.trim().split(/\s+/)[0]}.
          </h2>
          <p className="text-lg md:text-xl text-foreground/90 leading-relaxed mb-3">
            <strong className="text-primary">
              Este ainda não é um agendamento confirmado.
            </strong>{" "}
            {AVISO_CONTATO}
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Guarde o número que aparecer no WhatsApp. Se preferir adiantar, você
            mesmo pode nos chamar agora.
          </p>
        </div>

        <a
          href={waLink(
            "Olá! Acabei de enviar o formulário do YAG Laser pelo site.",
            `${WHATSAPP_ORIGEM}_sucesso`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2.5 mt-7 min-h-14 px-7 rounded-xl bg-[#25D366] text-white text-lg font-bold hover:brightness-110 transition"
        >
          <MessageCircle className="w-5 h-5" aria-hidden="true" />
          Falar no WhatsApp
        </a>
      </section>
    );
  }

  return (
    <section
      id="agendar"
      aria-labelledby="form-titulo"
      className="card-glass rounded-2xl p-6 md:p-8 border-2 border-primary/25 scroll-mt-28"
    >
      <h2
        id="form-titulo"
        className="text-2xl md:text-3xl font-bold text-foreground mb-3"
      >
        Solicitar agendamento do YAG Laser
      </h2>
      <p className="text-lg text-muted-foreground leading-relaxed mb-7">
        Procedimento realizado no Hospital Geral de Paragominas (HGP). Preencha
        abaixo e nossa equipe entra em contato.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-7">
        {/* Nome */}
        <div className="space-y-2">
          <Label
            htmlFor="yag-nome"
            className="text-lg font-semibold text-foreground"
          >
            Nome completo
          </Label>
          <Input
            id="yag-nome"
            value={values.nome}
            onChange={(e) => set("nome", e.target.value)}
            autoComplete="name"
            placeholder="Como está no seu documento"
            aria-invalid={!!errors.nome}
            aria-describedby={errors.nome ? "yag-nome-erro" : undefined}
            className={`h-14 text-lg ${errors.nome ? "border-destructive" : ""}`}
          />
          {errors.nome && (
            <p
              id="yag-nome-erro"
              role="alert"
              className="text-base text-destructive"
            >
              {errors.nome}
            </p>
          )}
        </div>

        {/* Data de nascimento */}
        <div className="space-y-2">
          <Label
            htmlFor="yag-dataNascimento"
            className="text-lg font-semibold text-foreground"
          >
            Data de nascimento
          </Label>
          <Input
            id="yag-dataNascimento"
            value={values.dataNascimento}
            onChange={(e) => set("dataNascimento", mascararData(e.target.value))}
            inputMode="numeric"
            autoComplete="bday"
            placeholder="DD/MM/AAAA"
            aria-invalid={!!errors.dataNascimento}
            aria-describedby={
              errors.dataNascimento ? "yag-dataNascimento-erro" : undefined
            }
            className={`h-14 text-lg ${
              errors.dataNascimento ? "border-destructive" : ""
            }`}
          />
          {errors.dataNascimento && (
            <p
              id="yag-dataNascimento-erro"
              role="alert"
              className="text-base text-destructive"
            >
              {errors.dataNascimento}
            </p>
          )}
        </div>

        {/* WhatsApp */}
        <div className="space-y-2">
          <Label
            htmlFor="yag-telefone"
            className="text-lg font-semibold text-foreground"
          >
            WhatsApp para contato
          </Label>
          <Input
            id="yag-telefone"
            value={values.telefone}
            onChange={(e) => set("telefone", mascararTelefone(e.target.value))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="(91) 99999-9999"
            aria-invalid={!!errors.telefone}
            aria-describedby={errors.telefone ? "yag-telefone-erro" : undefined}
            className={`h-14 text-lg ${
              errors.telefone ? "border-destructive" : ""
            }`}
          />
          {errors.telefone && (
            <p
              id="yag-telefone-erro"
              role="alert"
              className="text-base text-destructive"
            >
              {errors.telefone}
            </p>
          )}
        </div>

        {/* Olho operado */}
        <fieldset>
          <legend className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" aria-hidden="true" />
            Qual olho foi operado de catarata?
          </legend>
          <div
            id="yag-olho"
            tabIndex={-1}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {OLHOS.map((olho) => {
              const selecionado = values.olho === olho;
              return (
                <button
                  key={olho}
                  type="button"
                  aria-pressed={selecionado}
                  onClick={() => set("olho", olho)}
                  className={`min-h-16 rounded-xl border-2 text-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60 ${
                    selecionado
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/40 text-foreground border-border/70 hover:border-primary/60"
                  }`}
                >
                  {olho}
                </button>
              );
            })}
          </div>
          {errors.olho && (
            <p role="alert" className="text-base text-destructive mt-2">
              {errors.olho}
            </p>
          )}

          {/* Estrutura de cobrança, sem valor — evita surpresa em "Ambos". */}
          <p
            className={`text-base mt-3 leading-relaxed ${
              values.olho === "Ambos"
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            }`}
          >
            {values.olho === "Ambos" ? AVISO_AMBOS_OLHOS : AVISO_POR_OLHO}
          </p>
        </fieldset>

        {/* Convênio — opcional */}
        <div className="space-y-2">
          <Label
            htmlFor="yag-convenio"
            className="text-lg font-semibold text-foreground"
          >
            Particular ou convênio?{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <select
            id="yag-convenio"
            value={values.convenio}
            onChange={(e) => set("convenio", e.target.value)}
            className="w-full h-14 px-4 text-lg rounded-md border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Prefiro combinar depois</option>
            {convenios.map((c) => {
              // Nunca exibir valor: alguns registros trazem o preço no nome.
              const rotulo = limparRotuloConvenio(c.nome);
              // O paciente lê "Particular"; o CRM recebe "Particular (YAG)".
              return (
                <option key={c.id} value={valorConvenioCrm(rotulo)}>
                  {rotulo}
                </option>
              );
            })}
          </select>
          <p className="text-base text-muted-foreground">
            Ajuda a equipe a já verificar a cobertura antes de te ligar.
          </p>
        </div>

        {/* Aviso principal */}
        <div className="rounded-xl border-2 border-primary/40 bg-primary/10 p-5">
          <p className="flex items-start gap-3 text-lg text-foreground leading-relaxed">
            <ShieldCheck
              className="w-6 h-6 shrink-0 mt-0.5 text-primary"
              aria-hidden="true"
            />
            <span>
              <strong>Não é um agendamento confirmado.</strong> {AVISO_CONTATO}
            </span>
          </p>
        </div>

        {/* Lembretes */}
        <div className="flex items-start gap-3">
          <Checkbox
            id="yag-lembretes"
            checked={lembretes}
            onCheckedChange={(c) => setLembretes(c as boolean)}
            className="mt-1 w-6 h-6"
          />
          <Label
            htmlFor="yag-lembretes"
            className="text-base text-muted-foreground cursor-pointer leading-relaxed font-normal"
          >
            Quero receber a confirmação e os lembretes pelo WhatsApp.
          </Label>
        </div>

        <Button
          type="submit"
          variant="hero"
          size="lg"
          disabled={enviando}
          className="w-full min-h-16 text-xl gap-2.5"
        >
          {enviando ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
              Enviando...
            </>
          ) : (
            <>
              <CalendarCheck className="w-6 h-6" aria-hidden="true" />
              Solicitar agendamento
            </>
          )}
        </Button>

        {/* LGPD — transparência sem travar o envio */}
        <p className="text-base text-muted-foreground leading-relaxed text-center">
          Seus dados são usados apenas para o contato sobre este agendamento.
          Veja a{" "}
          <Link
            to="/politica-de-privacidade"
            className="text-primary underline underline-offset-2"
          >
            Política de Privacidade
          </Link>
          .
        </p>

        {/* Plano B quando o envio falha */}
        {falhou && (
          <div
            role="alert"
            className="rounded-xl border-2 border-destructive/50 bg-destructive/10 p-5"
          >
            <p className="flex items-start gap-3 text-lg text-foreground leading-relaxed">
              <AlertTriangle
                className="w-6 h-6 shrink-0 mt-0.5 text-destructive"
                aria-hidden="true"
              />
              <span>
                Não conseguimos enviar agora. Não perca a viagem: fale direto
                com a gente pelo WhatsApp.
              </span>
            </p>
            <a
              href={waLink(MENSAGEM_FALLBACK, `${WHATSAPP_ORIGEM}_falha`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 mt-4 min-h-14 px-7 rounded-xl bg-[#25D366] text-white text-lg font-bold hover:brightness-110 transition"
            >
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
              Falar no WhatsApp
            </a>
          </div>
        )}
      </form>

      {/* WhatsApp secundário — alternativa para quem prefere conversar */}
      <div className="mt-8 pt-7 border-t border-border/60 text-center">
        <p className="text-lg text-muted-foreground mb-4">
          Prefere falar agora, sem preencher?
        </p>
        <a
          href={waLink(WHATSAPP_MENSAGEM, WHATSAPP_ORIGEM)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2.5 min-h-14 px-7 rounded-xl border-2 border-[#25D366] text-[#25D366] text-lg font-bold hover:bg-[#25D366] hover:text-white transition"
        >
          <MessageCircle className="w-5 h-5" aria-hidden="true" />
          Chamar no WhatsApp
        </a>
      </div>
    </section>
  );
};

export default YagSchedulingForm;
