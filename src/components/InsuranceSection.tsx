import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGoogleTag } from "@/hooks/useGoogleTag";

// Logos dos convênios
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

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

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
    <section id="convenios" className="py-24 bg-background" ref={sectionRef}>
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50 mb-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="text-sm text-muted-foreground">Convênios aceitos</span>
          </div>

          <h2 className={`text-3xl md:text-4xl font-bold text-foreground mb-4 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            Aceitamos diversos convênios
          </h2>
          <p className={`text-muted-foreground mb-12 max-w-2xl mx-auto transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            Para sua comodidade, trabalhamos com os principais planos de saúde do mercado.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {insurances.map((insurance, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl border transition-all duration-500 hover:scale-105 hover:-translate-y-1 ${
                  insurance.highlight
                    ? "bg-primary/10 border-primary/30"
                    : "bg-secondary border-border"
                } ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: isVisible ? `${300 + index * 100}ms` : '0ms' }}
              >
                <img 
                  src={insurance.logo} 
                  alt={insurance.name} 
                  className="h-8 w-auto object-contain"
                />
                <span className="font-medium text-foreground">{insurance.name}</span>
              </div>
            ))}
          </div>

          <div className={`card-glass rounded-2xl p-8 md:p-12 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4">
              Agende sua consulta agora
            </h3>
            <p className="text-muted-foreground mb-8">
              Escolha o melhor horário para você. Nossa equipe entrará em contato para confirmar.
            </p>
            <Button 
              variant="hero" 
              size="lg" 
              onClick={() => {
                trackCTAClick('agendar_consulta', 'convenios', 'Agendar consulta');
                onScheduleClick();
              }} 
              className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
            >
              Agendar consulta
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InsuranceSection;
