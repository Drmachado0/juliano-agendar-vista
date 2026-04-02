import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Phone, Clock, ArrowRight } from "lucide-react";
import { useGoogleTag } from "@/hooks/useGoogleTag";

import logoBradesco from "@/assets/convenios/bradesco-saude.png";
import logoSulamerica from "@/assets/convenios/sulamerica.png";
import logoUnimed from "@/assets/convenios/unimed.png";
import logoCassi from "@/assets/convenios/cassi.png";
import logoSaudeCaixa from "@/assets/convenios/saude-caixa.png";
import logoParticular from "@/assets/convenios/particular.png";

interface InsuranceSectionProps {
  onScheduleClick: () => void;
}

const InsuranceSection = ({ onScheduleClick }: InsuranceSectionProps) => {
  const { trackCTAClick } = useGoogleTag();
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

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

  const insurances = [
    { name: "Particular", logo: logoParticular, highlight: true },
    { name: "Bradesco Saúde", logo: logoBradesco, highlight: false },
    { name: "Unimed", logo: logoUnimed, highlight: false },
    { name: "Cassi", logo: logoCassi, highlight: false },
    { name: "Sul América", logo: logoSulamerica, highlight: false },
    { name: "Saúde Caixa", logo: logoSaudeCaixa, highlight: false },
  ];

  return (
    <section id="convenios" className="py-20 md:py-28 bg-background relative" ref={sectionRef}>
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className={`text-center mb-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6">
              Convênios aceitos
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Aceitamos os <span className="gradient-text">principais convênios</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Para sua comodidade, trabalhamos com os principais planos de saúde. Também atendemos particular.
            </p>
          </div>

          {/* Insurance logos */}
          <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-14">
            {insurances.map((insurance, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border transition-all duration-500 hover:scale-105 hover:-translate-y-0.5 ${
                  insurance.highlight
                    ? "bg-primary/8 border-primary/25 shadow-sm shadow-primary/10"
                    : "bg-card border-border/60 hover:border-primary/30"
                } ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: isVisible ? `${200 + index * 80}ms` : '0ms' }}
              >
                <img
                  src={insurance.logo}
                  alt={insurance.name}
                  className="h-7 w-auto object-contain"
                />
                <span className="font-medium text-foreground text-sm">{insurance.name}</span>
              </div>
            ))}
          </div>

          {/* CTA Card - Conversion focused */}
          <div className={`relative overflow-hidden rounded-3xl noise-texture transition-all duration-700 delay-300 ease-out-expo ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-card to-accent/10" />
            <div className="absolute inset-0 border border-primary/20 rounded-3xl" />

            {/* Glow effect */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/10 rounded-full blur-[80px]" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-accent/8 rounded-full blur-[80px]" />

            <div className="relative p-8 md:p-12 text-center">
              <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                Cuide da sua visão <span className="gradient-text">hoje mesmo</span>
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Agende online em menos de 2 minutos. Nossa equipe entrará em contato para confirmar o melhor horário.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                <Button
                  variant="hero"
                  size="lg"
                  onClick={() => {
                    trackCTAClick('agendar_consulta', 'convenios', 'Agendar minha consulta');
                    onScheduleClick();
                  }}
                  className="text-base group relative overflow-hidden"
                >
                  <CalendarCheck className="w-5 h-5 mr-1" />
                  Agendar minha consulta
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  <span className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                </Button>
                <a
                  href="https://api.whatsapp.com/send?phone=5591936180428&text=Ol%C3%A1!%20Gostaria%20de%20agendar%20uma%20consulta%20com%20o%20Dr.%20Juliano%20Machado."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="lg" className="w-full text-base border-border/60">
                    <Phone className="w-5 h-5 mr-1" />
                    Falar no WhatsApp
                  </Button>
                </a>
              </div>

              {/* Trust micro-copy */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Resposta em até 2 horas
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarCheck className="w-3.5 h-3.5 text-primary" />
                  Agendamento sem compromisso
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InsuranceSection;
