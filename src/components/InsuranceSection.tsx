import { Shield, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";

interface InsuranceSectionProps {
  onScheduleClick: () => void;
}

const InsuranceSection = ({ onScheduleClick }: InsuranceSectionProps) => {
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
    { name: "Particular", highlight: true },
    { name: "Bradesco Saúde", highlight: false },
    { name: "Unimed", highlight: false },
    { name: "Cassi", highlight: false },
    { name: "Sul América", highlight: false },
  ];

  return (
    <section id="convenios" className="py-24 bg-background" ref={sectionRef}>
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50 mb-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <Shield className="w-4 h-4 text-primary" />
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
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-secondary border-border text-foreground"
                } ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: isVisible ? `${300 + index * 100}ms` : '0ms' }}
              >
                <Check className={`w-5 h-5 ${insurance.highlight ? "text-primary" : "text-primary"}`} />
                <span className="font-medium">{insurance.name}</span>
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
            <Button variant="hero" size="lg" onClick={onScheduleClick} className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
              Agendar consulta
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InsuranceSection;
