import { Shield, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InsuranceSectionProps {
  onScheduleClick: () => void;
}

const InsuranceSection = ({ onScheduleClick }: InsuranceSectionProps) => {
  const insurances = [
    { name: "Particular", highlight: true },
    { name: "Bradesco Saúde", highlight: false },
    { name: "Unimed", highlight: false },
    { name: "Cassi", highlight: false },
    { name: "Sul América", highlight: false },
  ];

  return (
    <section id="convenios" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50 mb-6">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Convênios aceitos</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Aceitamos diversos convênios
          </h2>
          <p className="text-muted-foreground mb-12 max-w-2xl mx-auto">
            Para sua comodidade, trabalhamos com os principais planos de saúde do mercado.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {insurances.map((insurance, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl border transition-all duration-300 hover:scale-105 ${
                  insurance.highlight
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-secondary border-border text-foreground"
                }`}
              >
                <Check className={`w-5 h-5 ${insurance.highlight ? "text-primary" : "text-primary"}`} />
                <span className="font-medium">{insurance.name}</span>
              </div>
            ))}
          </div>

          <div className="card-glass rounded-2xl p-8 md:p-12">
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4">
              Agende sua consulta agora
            </h3>
            <p className="text-muted-foreground mb-8">
              Escolha o melhor horário para você. Nossa equipe entrará em contato para confirmar.
            </p>
            <Button variant="hero" size="lg" onClick={onScheduleClick}>
              Agendar consulta
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InsuranceSection;
