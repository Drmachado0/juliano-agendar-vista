import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ListChecks, CheckCircle2, ArrowRight, MessageCircle, Shield } from "lucide-react";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { Button } from "@/components/ui/button";

// Ordem alinhada ao fluxo real do formulário em /agendamento
// (PersonalDataStep → ConsultationDetailsStep + DateTimeStep → ConfirmationStep).
const steps = [
  {
    number: "01",
    icon: ListChecks,
    title: "Informe seus dados",
    description: "Nome e WhatsApp para a equipe entrar em contato.",
  },
  {
    number: "02",
    icon: CalendarDays,
    title: "Escolha o atendimento",
    description: "Tipo, local, convênio, data e horário disponíveis.",
  },
  {
    number: "03",
    icon: CheckCircle2,
    title: "Receba a confirmação",
    description: "A equipe confirma pelo WhatsApp com data, local e orientações.",
  },
];

const AgendarSimplesSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { trackCTAClick, trackWhatsAppClick } = useGoogleTag();
  const { waLink } = useSiteWhatsApp();
  const waUrl = waLink("Olá! Vi no site que agendar é simples e gostaria de tirar uma dúvida antes de marcar. (origem: agendar_simples)");

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="agendar-simples"
      className="py-20 md:py-28 bg-gradient-to-b from-secondary/20 via-background to-card relative noise-overlay"
      ref={sectionRef}
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4">
        {/* Header */}
        <div
          className={`text-center mb-14 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6 uppercase tracking-[0.08em]">
            Sem complicação
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-foreground mb-4">
            Agendar é <span className="gradient-text">simples</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            Em três passos rápidos você registra seu pedido e a equipe confirma pelo WhatsApp.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={`group card-glass card-shimmer rounded-2xl p-6 md:p-7 relative overflow-hidden border border-border/40 hover:border-primary/25 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-500 ease-out-expo ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: isVisible ? `${index * 100}ms` : "0ms" }}
              >
                {/* Top gradient accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px]"
                  style={{
                    background:
                      "linear-gradient(to right, hsl(var(--primary) / 0.4), hsl(var(--accent) / 0.3), transparent)",
                  }}
                />

                {/* Icon top-right */}
                <div className="absolute top-5 right-5 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary/70 group-hover:text-primary group-hover:bg-primary/15 transition-all duration-300" aria-hidden="true">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>

                {/* Large number */}
                <span className="block text-5xl md:text-6xl font-extrabold text-primary/20 leading-none mb-4 font-sans tabular-nums">
                  {step.number}
                </span>

                {/* Title */}
                <h3 className="text-lg font-bold text-foreground mb-2 font-sans group-hover:text-primary transition-colors duration-300">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTAs */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-300 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <Link to="/agendamento?utm_source=site&utm_medium=cta&utm_campaign=agendar_simples" className="w-full sm:w-auto">
            <Button
              variant="obsidian"
              size="lg"
              onClick={() =>
                trackCTAClick("agendar_consulta", "agendar_simples", "Agendar consulta online")
              }
              className="w-full sm:w-auto text-base py-6 sm:py-3 min-h-[48px] group"
            >
              Agendar consulta online
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackWhatsAppClick(
                waUrl,
                "Prefere falar antes? Chamar no WhatsApp",
                "whatsapp_agendar_simples",
                "agendar_simples"
              )
            }
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 py-3 px-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background min-h-[48px]"
            aria-label="Chamar no WhatsApp para tirar dúvidas antes de agendar"
          >
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            Prefere falar antes? Chamar no WhatsApp
          </a>
        </div>

        {/* Privacy reassurance */}
        <div
          className={`flex items-center justify-center gap-2 mt-5 text-xs md:text-sm text-muted-foreground/80 text-center transition-all duration-700 delay-400 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>
            Seus dados são usados apenas para contato e confirmação do agendamento. Não compartilhamos com terceiros.
          </span>
        </div>
      </div>
    </section>
  );
};

export default AgendarSimplesSection;
