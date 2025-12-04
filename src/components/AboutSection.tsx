import { GraduationCap, Stethoscope, Eye, Heart, CheckCircle } from "lucide-react";
import drJulianoPhoto from "@/assets/dr-juliano-machado.jpg";

const AboutSection = () => {
  const specialties = [
    { icon: Eye, title: "Catarata", description: "Cirurgia moderna e segura" },
    { icon: Stethoscope, title: "Pterígio", description: "Tratamento especializado" },
    { icon: GraduationCap, title: "Campo Visual", description: "Exames de diagnóstico" },
    { icon: Heart, title: "OCT", description: "Tecnologia avançada" },
  ];

  const credentials = [
    "CRM Ativo",
    "Membro SBO",
    "Especialista em Glaucoma",
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
              Compromisso com a saúde dos seus olhos
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              O Dr. Juliano Machado é médico oftalmologista com mais de 11 anos de experiência, 
              dedicado a proporcionar atendimento de excelência e humanizado aos seus pacientes.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Formado em medicina com especialização em oftalmologia, atua em clínicas e hospitais 
              de referência em Paragominas e Belém. Especialista em cirurgias de catarata, pterígio, 
              e diagnósticos através de exames como campo visual, OCT e mapeamento de retina.
            </p>

            {/* Specialties Grid */}
            <div className="grid grid-cols-2 gap-4">
              {specialties.map((specialty, index) => (
                <div
                  key={index}
                  className="card-glass rounded-xl p-4 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <specialty.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-foreground font-semibold text-sm mb-1">{specialty.title}</h3>
                  <p className="text-muted-foreground text-xs">{specialty.description}</p>
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
