import { Heart, Cpu, CheckCircle, Stethoscope, GraduationCap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import drJulianoPhoto from "@/assets/dr-juliano-consultorio.jpg";
import { useParallax } from "@/hooks/useParallax";

const AboutSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const aboutParallax = useParallax(0.08);

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

  const credentials = [
    { icon: GraduationCap, text: "Membro da SBO" },
    { icon: Stethoscope, text: "+13 anos de experiência" },
    { icon: Heart, text: "Atendimento humanizado" },
    { icon: Cpu, text: "Tecnologia avançada" },
  ];

  return (
    <section id="sobre" className="py-20 md:py-28 bg-background relative overflow-hidden" ref={sectionRef}>
      {/* Decorative line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-transparent via-primary/30 to-transparent" />

      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Photo Side */}
          <div className={`relative order-2 lg:order-1 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
            <div className="relative max-w-md mx-auto">
              {/* Background decoration */}
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-[2rem] blur-2xl" />

              {/* Main photo */}
              <div className="relative rounded-[2rem] overflow-hidden border border-border/50 shadow-2xl">
                <img
                  src={drJulianoPhoto}
                  alt="Dr. Juliano Machado em seu consultório"
                  className="w-full h-auto object-cover"
                />
                {/* Subtle overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
              </div>

              {/* Floating credentials card */}
              <div className={`absolute -right-4 md:-right-10 bottom-8 bg-card/95 backdrop-blur-lg rounded-2xl p-5 shadow-xl border border-border/60 max-w-[220px] transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Credenciais</p>
                <div className="space-y-3">
                  {credentials.map((cred, index) => (
                    <div key={index} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <cred.icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-xs text-foreground font-medium leading-tight">{cred.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Content Side */}
          <div className={`order-1 lg:order-2 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6">
              Sobre o médico
            </span>

            <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-foreground leading-[1.15] mb-6">
              Cuidando da sua visão em{" "}
              <span className="gradient-text">todas as fases da vida</span>
            </h2>

            <p className="text-muted-foreground text-lg leading-relaxed mb-5">
              Com mais de 13 anos dedicados à oftalmologia, o Dr. Juliano Machado alia{" "}
              <span className="text-foreground font-medium">experiência clínica</span> e{" "}
              <span className="text-foreground font-medium">tecnologia de ponta</span> para oferecer diagnósticos
              precisos e tratamentos que transformam a qualidade de vida dos seus pacientes.
            </p>

            <p className="text-muted-foreground leading-relaxed mb-10">
              Do exame de rotina às cirurgias mais complexas, cada paciente recebe um atendimento
              acolhedor e individualizado, com a atenção que merece.
            </p>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4">
              <div
                className={`group card-glass rounded-2xl p-5 hover:border-primary/40 transition-all duration-500 hover:-translate-y-1 cursor-default ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: '400ms' }}
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-foreground font-semibold text-sm mb-1.5 font-sans">Atendimento Humanizado</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Cada paciente é único e recebe atenção personalizada do início ao fim.
                </p>
              </div>
              <div
                className={`group card-glass rounded-2xl p-5 hover:border-primary/40 transition-all duration-500 hover:-translate-y-1 cursor-default ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: '500ms' }}
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Cpu className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-foreground font-semibold text-sm mb-1.5 font-sans">Tecnologia de Ponta</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Equipamentos modernos para diagnósticos precisos e procedimentos seguros.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
