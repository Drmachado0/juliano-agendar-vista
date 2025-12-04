import { Stethoscope, Eye, ScanEye, Zap, CheckCircle } from "lucide-react";
import drJulianoPhoto from "@/assets/dr-juliano-consultorio.jpg";

const AboutSection = () => {
  const services = [
    { icon: Stethoscope, title: "Consultas Oftalmológicas", description: "Avaliações completas para detectar e tratar problemas oculares" },
    { icon: Eye, title: "Cirurgias de Catarata e Pterígio", description: "Procedimentos seguros e eficazes para restaurar sua visão" },
    { icon: ScanEye, title: "Exames Oftalmológicos", description: "Diagnósticos precisos para uma visão clara e saudável" },
    { icon: Zap, title: "Capsulotomia YAG Laser", description: "Tratamento avançado para opacificação da cápsula posterior" },
  ];

  const credentials = [
    "CRM Ativo",
    "Membro SBO",
    "+11 anos de experiência",
    "+5000 cirurgias",
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
              Como oftalmologista com mais de 11 anos de experiência, meu compromisso é garantir 
              que você tenha uma visão perfeita em todas as fases da vida.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Oferecemos uma abordagem completa para a saúde ocular, desde a prevenção até os 
              tratamentos mais avançados.
            </p>

            {/* Services Grid */}
            <h3 className="text-foreground font-semibold mb-4">Nossos Serviços:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map((service, index) => (
                <div
                  key={index}
                  className="card-glass rounded-xl p-4 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <service.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="text-foreground font-semibold text-sm mb-1">{service.title}</h4>
                  <p className="text-muted-foreground text-xs">{service.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
