import { GraduationCap, Stethoscope, Eye, Heart } from "lucide-react";

const AboutSection = () => {
  const specialties = [
    { icon: Eye, title: "Catarata", description: "Cirurgia moderna e segura" },
    { icon: Stethoscope, title: "Pterígio", description: "Tratamento especializado" },
    { icon: GraduationCap, title: "Campo Visual", description: "Exames de diagnóstico" },
    { icon: Heart, title: "OCT", description: "Tecnologia avançada" },
  ];

  return (
    <section id="sobre" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">
              Sobre o médico
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-6">
              Compromisso com a saúde dos seus olhos
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              O Dr. Juliano Machado é médico oftalmologista com mais de 15 anos de experiência, 
              dedicado a proporcionar atendimento de excelência e humanizado aos seus pacientes.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Formado em medicina com especialização em oftalmologia, atua em clínicas e hospitais 
              de referência em Paragominas e Belém. Especialista em cirurgias de catarata, pterígio, 
              e diagnósticos através de exames como campo visual, OCT e mapeamento de retina.
            </p>

            {/* Credentials */}
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                CRM Ativo
              </span>
              <span className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                Membro SBO
              </span>
              <span className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                +5000 cirurgias
              </span>
            </div>
          </div>

          {/* Specialties Grid */}
          <div className="grid grid-cols-2 gap-4">
            {specialties.map((specialty, index) => (
              <div
                key={index}
                className="card-glass rounded-2xl p-6 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <specialty.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-foreground font-semibold mb-1">{specialty.title}</h3>
                <p className="text-muted-foreground text-sm">{specialty.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
