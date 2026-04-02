import { Heart, Cpu, CheckCircle, Stethoscope, GraduationCap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import drJulianoPhoto from "@/assets/dr-juliano-consultorio.jpg";

const AboutSection = () => {
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

  const credentials = [
    { icon: GraduationCap, text: "Membro da SBO" },
    { icon: Stethoscope, text: "13+ anos de oftalmologia" },
    { icon: Heart, text: "Explica cada passo ao paciente" },
    { icon: Cpu, text: "Equipamentos de última geração" },
  ];

  return (
    <section id="sobre" className="py-20 md:py-28 bg-background relative overflow-hidden noise-overlay" ref={sectionRef}>
      {/* Angular top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-20 bg-secondary/20"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 0 100%)' }}
      />

      {/* Large decorative iris circle */}
      <div className="absolute -right-32 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-primary/5 hidden lg:block">
        <div className="absolute inset-[20%] rounded-full border border-primary/[0.03]" />
      </div>

      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-0 items-center">
          {/* Photo Side */}
          <div className={`relative order-2 lg:order-1 lg:pr-0 lg:-mr-16 transition-all duration-700 ease-out-expo ${isVisible ? 'opacity-100 translate-x-0 rotate-0' : 'opacity-0 -translate-x-12 rotate-1'}`}>
            <div className="relative max-w-md mx-auto">
              {/* Background decoration */}
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl blur-2xl" />

              {/* Vertical decorative bar */}
              <div className="absolute left-0 top-[10%] bottom-[10%] w-1 bg-gradient-to-b from-transparent via-primary/40 to-transparent z-10 rounded-full" />

              {/* Main photo */}
              <div className="relative rounded-3xl rounded-tr-[5rem] overflow-hidden border border-border/50 shadow-2xl">
                <img
                  src={drJulianoPhoto}
                  alt="Dr. Juliano Machado em seu consultório"
                  className="w-full h-auto object-cover"
                />
                {/* Subtle overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
              </div>

              {/* Floating credentials card */}
              <div className={`card-shimmer absolute -bottom-6 -right-6 md:-right-12 bg-card/95 backdrop-blur-lg rounded-2xl p-5 shadow-xl border border-border/60 border-l-2 border-l-primary max-w-[220px] transition-all duration-700 delay-300 ease-out-expo transform -rotate-[1.5deg] hover:rotate-0 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
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
          <div className={`order-1 lg:order-2 lg:pl-24 transition-all duration-700 delay-200 ease-out-expo ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/8 border border-accent/15 text-accent font-semibold text-sm mb-6">
              Quem é o Dr. Juliano
            </span>

            <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-foreground leading-[1.15] mb-6">
              Do consultório à sala de cirurgia,{" "}
              <span className="gradient-text">sempre ao seu lado</span>
            </h2>

            <p className="text-muted-foreground text-lg leading-relaxed mb-5">
              O Dr. Juliano é oftalmologista há mais de 13 anos e atende em Paragominas e Belém. No consultório, ele é conhecido por{" "}
              <span className="text-foreground font-medium">explicar cada detalhe</span> com calma — porque acredita que um{" "}
              <span className="text-foreground font-medium">paciente bem informado</span> faz melhores escolhas sobre sua saúde.
            </p>

            <p className="text-muted-foreground leading-relaxed mb-10">
              Desde exames de rotina até cirurgias de catarata e pterígio, o foco é sempre o mesmo: resolver o problema com segurança e devolver a qualidade de visão que você merece.
            </p>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4">
              <div
                className={`group card-shimmer card-glass rounded-2xl p-5 hover:border-primary/40 transition-all duration-500 hover:-translate-y-2 hover:rotate-[0.5deg] cursor-default ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: '400ms' }}
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-foreground font-semibold text-sm mb-1.5 font-sans">Consulta sem pressa</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  O Dr. Juliano dedica o tempo necessário para ouvir, examinar e explicar cada resultado com clareza.
                </p>
              </div>
              <div
                className={`group card-shimmer card-glass rounded-2xl p-5 hover:border-primary/40 transition-all duration-500 hover:-translate-y-2 hover:rotate-[0.5deg] cursor-default ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: '500ms' }}
              >
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <Cpu className="w-5 h-5 text-accent" />
                </div>
                <h4 className="text-foreground font-semibold text-sm mb-1.5 font-sans">Equipamentos atualizados</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Retinógrafo digital, biometria ultrassônica e laser — tudo o que você precisa em um só lugar.
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
