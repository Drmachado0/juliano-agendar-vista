import { Heart, Cpu, CheckCircle } from "lucide-react";
import drJulianoPhoto from "@/assets/dr-juliano-consultorio.jpg";

const AboutSection = () => {
  const credentials = [
    "Membro SBO",
    "+13 anos de experiência",
    "Atendimento humanizado",
    "Tecnologia avançada",
  ];

  return (
    <section id="sobre" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Photo Side */}
          <div className="relative order-2 lg:order-1">
            <div className="relative max-w-md mx-auto">
              {/* Background decoration */}
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-2xl" />
              
              {/* Main photo */}
              <div className="relative rounded-3xl overflow-hidden border border-border shadow-2xl">
                <img
                  src={drJulianoPhoto}
                  alt="Dr. Juliano Machado - Médico Oftalmologista"
                  className="w-full h-auto object-cover"
                />
              </div>

              {/* Floating credentials card */}
              <div className="absolute -right-4 md:-right-8 bottom-8 card-glass rounded-2xl p-4 shadow-xl max-w-[200px]">
                <div className="space-y-2">
                  {credentials.map((credential, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs text-foreground font-medium">{credential}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Content Side */}
          <div className="order-1 lg:order-2">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">
              Sobre o médico
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-6">
              Visão perfeita em todas as fases da vida
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              Como oftalmologista com mais de 13 anos de experiência, meu compromisso é garantir 
              que você tenha uma visão perfeita em todas as fases da vida.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Oferecemos uma abordagem completa para a saúde ocular, desde a prevenção até os 
              tratamentos mais avançados.
            </p>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card-glass rounded-xl p-4 hover:border-primary/50 transition-all duration-300">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-foreground font-semibold text-sm mb-1">Atendimento Humanizado</h4>
                <p className="text-muted-foreground text-xs">Cada paciente recebe atenção personalizada e cuidado especial</p>
              </div>
              <div className="card-glass rounded-xl p-4 hover:border-primary/50 transition-all duration-300">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Cpu className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-foreground font-semibold text-sm mb-1">Tecnologia de Ponta</h4>
                <p className="text-muted-foreground text-xs">Equipamentos modernos para diagnósticos precisos</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
