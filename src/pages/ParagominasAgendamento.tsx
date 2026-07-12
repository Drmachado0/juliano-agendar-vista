import { useEffect, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Stethoscope,
  CalendarDays,
  CheckCircle2,
  BadgeCheck,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import PersonalDataStep from "@/components/scheduling/PersonalDataStep";
import ConsultationDetailsStep from "@/components/scheduling/ConsultationDetailsStep";
import DateTimeStep from "@/components/scheduling/DateTimeStep";
import ParagominasConfirmationStep from "@/components/scheduling/ParagominasConfirmationStep";
import SuccessStep from "@/components/scheduling/SuccessStep";
import { useAgendamentoFlow } from "@/features/agendamento/useAgendamentoFlow";
import type { Clinica } from "@/services/clinicas";
import type { TipoAtendimento } from "@/services/tiposAtendimento";
import { DOCTOR } from "@/lib/constants";
import drJulianoHero from "@/assets/dr-juliano-hero.jpg";

const STEPS: { id: number; label: string; short: string; icon: typeof User }[] = [
  { id: 1, label: "Dados", short: "Dados", icon: User },
  { id: 2, label: "Atendimento", short: "Atendimento", icon: Stethoscope },
  { id: 3, label: "Horário", short: "Horário", icon: CalendarDays },
  { id: 4, label: "Confirmação", short: "Confirmação", icon: CheckCircle2 },
];

const STEP_HEADINGS: Record<number, { title: string; helper?: string }> = {
  1: {
    title: "Como podemos falar com você?",
    helper: "Usaremos seu WhatsApp apenas para confirmar o atendimento.",
  },
  2: {
    title: "Qual atendimento você procura?",
    helper: "Atendimento em Paragominas — Clinicor e HGP.",
  },
  3: {
    title: "Escolha o melhor horário disponível.",
    helper: "A equipe confirma a vaga por WhatsApp em seguida.",
  },
  4: {
    title: "Revise antes de confirmar.",
    helper: "Confira seus dados, o local e o horário escolhido.",
  },
};

// Filtros — landing Paragominas mostra só Clinicor / HGP e nunca YAG.
const isParagominasClinica = (c: Clinica) => {
  const nome = (c.nome || "").toLowerCase();
  const slug = (c.slug || "").toLowerCase();
  if (/bel[eé]m|iob|vitria/.test(nome + " " + slug)) return false;
  return /clinicor|hgp|hospital geral|paragominas/.test(nome + " " + slug);
};
const isParagominasTipo = (t: TipoAtendimento) => {
  const nome = (t.nome || "").toLowerCase();
  const slug = (t.slug || "").toLowerCase();
  return !/yag/.test(nome + " " + slug);
};

const ParagominasAgendamento = () => {
  const flow = useAgendamentoFlow({
    pageType: "landing_agendamento",
    experienceVariant: "paragominas_premium",
  });
  const {
    currentStep,
    formData,
    isSubmitted,
    isSubmitting,
    totalSteps,
    updateFormData,
    nextStep,
    prevStep,
    goToStep,
    handleSubmit,
    handleReset,
  } = flow;

  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);

  // Focus management: ao trocar de etapa, foca no H2 da nova e sobe o scroll
  // no mobile pra revelar o topo do formulário.
  useEffect(() => {
    if (isSubmitted) return;
    const el = stepHeadingRef.current;
    if (el) {
      el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: false });
    }
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentStep, isSubmitted]);

  const heading = STEP_HEADINGS[currentStep];

  const canGoTo = (step: number) => step <= currentStep;

  const progress = useMemo(
    () => STEPS.map((s) => ({
      ...s,
      state:
        s.id < currentStep ? ("done" as const) :
        s.id === currentStep ? ("current" as const) :
        ("upcoming" as const),
    })),
    [currentStep],
  );

  return (
    <div className="theme-paragominas-premium theme-paragominas-agendamento min-h-screen">
      <Helmet>
        <title>Agendamento em Paragominas | Dr. Juliano Machado</title>
        <meta name="robots" content="noindex,follow" />
        <meta
          name="description"
          content="Agende sua consulta com o Dr. Juliano Machado nas unidades de Paragominas (Clinicor e HGP)."
        />
        <link rel="canonical" href="/paragominas/agendamento" />
      </Helmet>

      {/* Header mobile compacto */}
      <header
        className="lg:hidden sticky top-0 z-40 border-b"
        style={{ borderColor: "var(--pgm-line)", background: "rgba(243,240,232,0.94)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            to="/paragominas"
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: "var(--pgm-petroleo)" }}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="text-right">
            <p className="text-[13px] font-semibold pgm-serif leading-tight">Dr. Juliano Machado</p>
            <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--pgm-ink-soft)" }}>
              Agendamento · Paragominas
            </p>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[40%_60%] min-h-screen">
        {/* PAINEL ESQUERDO — desktop apenas */}
        <aside
          className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen flex-col justify-between p-10 xl:p-14 overflow-hidden"
          style={{ background: "var(--pgm-petroleo)", color: "var(--pgm-marfim)" }}
        >
          <div className="pgm-grain absolute inset-0 opacity-40 pointer-events-none" aria-hidden />
          <div className="relative">
            <Link
              to="/paragominas"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] pgm-btn--link-dark"
              style={{ color: "var(--pgm-champagne)", borderBottomColor: "var(--pgm-champagne)" }}
            >
              <ArrowLeft className="h-3 w-3" /> Voltar para /paragominas
            </Link>

            <div className="mt-12">
              <p className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>
                Agendamento · Paragominas
              </p>
              <h1 className="pgm-serif text-3xl xl:text-4xl leading-[1.1] mt-4">
                Vamos cuidar do seu agendamento.
              </h1>
              <p className="mt-5 text-sm xl:text-base leading-relaxed max-w-md" style={{ color: "rgba(243,240,232,0.78)" }}>
                Escolha o atendimento, o local e o horário com tranquilidade. A confirmação chega por WhatsApp.
              </p>
            </div>

            <div className="mt-10 flex items-center gap-4">
              <img
                src={drJulianoHero}
                alt=""
                aria-hidden
                loading="lazy"
                decoding="async"
                className="h-16 w-16 rounded-full object-cover object-top ring-1"
                style={{ borderColor: "var(--pgm-champagne)", boxShadow: "0 0 0 1px var(--pgm-champagne)" }}
              />
              <div>
                <p className="pgm-serif text-lg leading-tight">{DOCTOR.name}</p>
                <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "rgba(243,240,232,0.62)" }}>
                  {DOCTOR.specialty} · {DOCTOR.crm}
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-12">
            <div className="pgm-rule-dark mb-6" />
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--pgm-champagne)" }} />
                <div>
                  <p className="pgm-serif text-base leading-tight">Clinicor · Paragominas</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(243,240,232,0.65)" }}>
                    Consultório particular e convênios
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--pgm-champagne)" }} />
                <div>
                  <p className="pgm-serif text-base leading-tight">Hospital Geral de Paragominas</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(243,240,232,0.65)" }}>
                    Atendimento hospitalar
                  </p>
                </div>
              </li>
            </ul>

            <div className="pgm-rule-dark my-6" />

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>Experiência</p>
                <p className="pgm-serif text-base mt-2 leading-tight">{DOCTOR.yearsExperienceLong}</p>
              </div>
              <div>
                <p className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>Registro</p>
                <p className="pgm-serif text-base mt-2 leading-tight">{DOCTOR.crm}</p>
              </div>
            </div>

            {DOCTOR.memberships && DOCTOR.memberships.length > 0 && (
              <>
                <div className="pgm-rule-dark my-6" />
                <div className="space-y-2">
                  {DOCTOR.memberships.map((m) => (
                    <p key={m} className="text-xs flex items-start gap-2" style={{ color: "rgba(243,240,232,0.75)" }}>
                      <BadgeCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "var(--pgm-champagne)" }} />
                      <span>{m}</span>
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* PAINEL DIREITO — formulário */}
        <section
          ref={formSectionRef}
          className="px-4 py-8 sm:px-8 sm:py-12 lg:px-14 lg:py-16 xl:px-20"
          style={{ background: "var(--pgm-marfim)" }}
        >
          <div className="mx-auto max-w-2xl">
            {/* Título curto mobile */}
            <div className="lg:hidden mb-6">
              <p className="pgm-eyebrow" style={{ color: "var(--pgm-petroleo)" }}>
                Agendamento em Paragominas
              </p>
              <h1 className="pgm-serif text-[26px] leading-[1.15] mt-2">
                Vamos cuidar do seu agendamento.
              </h1>
              <p className="text-sm mt-3" style={{ color: "var(--pgm-ink-soft)" }}>
                Preencha seus dados e escolha uma das opções disponíveis em Paragominas.
              </p>
            </div>

            {/* Indicador de progresso */}
            {!isSubmitted && (
              <nav aria-label="Etapas do agendamento" className="mb-10">
                {/* Desktop: linha horizontal com rótulos */}
                <ol className="hidden md:flex items-center gap-2">
                  {progress.map((step, idx) => {
                    const Icon = step.icon;
                    const clickable = canGoTo(step.id);
                    return (
                      <li key={step.id} className="flex items-center gap-2 flex-1 last:flex-none">
                        <button
                          type="button"
                          className="pgm-step-btn flex items-center gap-3 text-left disabled:cursor-not-allowed"
                          disabled={!clickable}
                          aria-current={step.state === "current" ? "step" : undefined}
                          aria-label={`Etapa ${step.id} de ${totalSteps}: ${step.label}${step.state === "done" ? " (concluída)" : step.state === "current" ? " (atual)" : " (bloqueada)"}`}
                          onClick={() => clickable && goToStep(step.id)}
                        >
                          <span
                            className={
                              "pgm-step-icon " +
                              (step.state === "current" ? "pgm-step-icon--current " : "") +
                              (step.state === "done" ? "pgm-step-icon--done " : "")
                            }
                          >
                            <Icon className="h-4 w-4" strokeWidth={1.75} />
                          </span>
                          <span
                            className="text-[11px] uppercase tracking-[0.22em] font-semibold"
                            style={{
                              color: step.state === "upcoming" ? "var(--pgm-ink-soft)" : "var(--pgm-petroleo)",
                            }}
                          >
                            {step.label}
                          </span>
                        </button>
                        {idx < progress.length - 1 && (
                          <span
                            aria-hidden
                            className={"pgm-step-line " + (step.state === "done" ? "pgm-step-line--done" : "")}
                          />
                        )}
                      </li>
                    );
                  })}
                </ol>

                {/* Mobile: rótulo atual + dots */}
                <div className="md:hidden">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color: "var(--pgm-petroleo)" }}>
                      {STEPS[currentStep - 1].label}
                    </p>
                    <p className="sr-only">Etapa {currentStep} de {totalSteps}</p>
                  </div>
                  <div className="flex items-center gap-1.5" role="list">
                    {progress.map((s) => (
                      <span
                        key={s.id}
                        role="listitem"
                        aria-label={`${s.label}${s.state === "done" ? " concluída" : s.state === "current" ? " atual" : ""}`}
                        className="h-1.5 flex-1 rounded-full"
                        style={{
                          background:
                            s.state === "done"
                              ? "var(--pgm-champagne)"
                              : s.state === "current"
                                ? "var(--pgm-petroleo)"
                                : "var(--pgm-line)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </nav>
            )}

            {/* Título da etapa atual */}
            {!isSubmitted && heading && (
              <div className="mb-8">
                <h2
                  ref={stepHeadingRef}
                  className="pgm-serif text-2xl md:text-3xl leading-tight outline-none"
                >
                  {heading.title}
                </h2>
                {heading.helper && (
                  <p className="mt-2 text-sm" style={{ color: "var(--pgm-ink-soft)" }}>
                    {heading.helper}
                  </p>
                )}
              </div>
            )}

            {/* Formulário / Sucesso */}
            <div
              className="pgm-form-card rounded-2xl p-6 md:p-8 md:shadow-sm"
              style={{ background: "#fff", border: "1px solid var(--pgm-line)" }}
            >
              {isSubmitted ? (
                <SuccessStep onClose={handleReset} formData={formData} />
              ) : (
                <>
                  {currentStep === 1 && (
                    <PersonalDataStep
                      formData={formData}
                      updateFormData={updateFormData}
                      onNext={nextStep}
                    />
                  )}
                  {currentStep === 2 && (
                    <ConsultationDetailsStep
                      formData={formData}
                      updateFormData={updateFormData}
                      onNext={nextStep}
                      onPrev={prevStep}
                      filterClinicas={isParagominasClinica}
                      filterTipos={isParagominasTipo}
                    />
                  )}
                  {currentStep === 3 && (
                    <DateTimeStep
                      formData={formData}
                      updateFormData={updateFormData}
                      onNext={nextStep}
                      onPrev={prevStep}
                    />
                  )}
                  {currentStep === 4 && (
                    <ParagominasConfirmationStep
                      formData={formData}
                      onSubmit={handleSubmit}
                      onPrev={prevStep}
                      onEditStep={goToStep}
                      isSubmitting={isSubmitting}
                    />
                  )}
                </>
              )}
            </div>

            {/* Nota de privacidade */}
            {!isSubmitted && (
              <p className="mt-5 text-xs flex items-center justify-center gap-1.5" style={{ color: "var(--pgm-ink-soft)" }}>
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--pgm-champagne)" }} />
                Seus dados são usados apenas para confirmar o atendimento — sem compartilhamento.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ParagominasAgendamento;
