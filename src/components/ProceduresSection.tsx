import { useEffect, useRef, useState } from "react";
import { RetinografiaIcon, MapeamentoRetinaIcon, TonometriaIcon, GonioscopiaIcon, BiometriaIcon, CatarataIcon, PterigioIcon, YagLaserIcon, IridotomiaIcon } from "./ProcedureIcons";

const ProceduresSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"all" | "exames" | "cirurgias" | "laser">("all");
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.05 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const procedures = [
    { icon: RetinografiaIcon, title: "Retinografia", description: "Fotografia detalhada do fundo do olho. Essencial para acompanhar diabetes, glaucoma e doenças da retina.", category: "exames" },
    { icon: MapeamentoRetinaIcon, title: "Mapeamento de Retina", description: "Avaliação completa da retina para detectar problemas antes que afetem sua visão.", category: "exames" },
    { icon: TonometriaIcon, title: "Tonometria", description: "Mede a pressão do olho — o principal exame para prevenir e controlar o glaucoma.", category: "exames" },
    { icon: GonioscopiaIcon, title: "Gonioscopia", description: "Examina a drenagem interna do olho para avaliar o risco de glaucoma.", category: "exames" },
    { icon: BiometriaIcon, title: "Biometria Ultrassônica", description: "Calcula o grau exato da lente que será implantada na cirurgia de catarata.", category: "exames" },
    { icon: CatarataIcon, title: "Cirurgia de Catarata", description: "Troca do cristalino opaco por uma lente artificial. Procedimento rápido, seguro e que pode até reduzir a dependência de óculos.", category: "cirurgias" },
    { icon: PterigioIcon, title: "Cirurgia de Pterígio", description: "Remove a membrana que cresce sobre o olho, causando irritação e vermelhidão. Técnica com baixo índice de retorno.", category: "cirurgias" },
    { icon: YagLaserIcon, title: "YAG Laser", description: "Procedimento rápido (poucos minutos) para limpar a lente quando ela fica embaçada após cirurgia de catarata.", category: "laser" },
    { icon: IridotomiaIcon, title: "Iridotomia a Laser", description: "Laser preventivo para pacientes com risco de glaucoma agudo. Indolor e feito no consultório.", category: "laser" },
  ];

  const categories = [
    { key: "all" as const, label: "Todos" },
    { key: "exames" as const, label: "Exames" },
    { key: "cirurgias" as const, label: "Cirurgias" },
    { key: "laser" as const, label: "Laser" },
  ];

  const filteredProcedures = activeCategory === "all"
    ? procedures
    : procedures.filter(p => p.category === activeCategory);

  const getCategoryBadgeClasses = (category: string) => {
    switch (category) {
      case "cirurgias": return "bg-accent/8 text-accent";
      case "laser": return "bg-amber-400/8 text-amber-400";
      default: return "bg-primary/8 text-primary";
    }
  };

  // Bento: index 0 (Retinografia) = tall, index 5 (Catarata) = big featured
  const isBento = activeCategory === "all";
  const cataractIndex = filteredProcedures.findIndex(p => p.title === "Cirurgia de Catarata");
  const retinoIndex = filteredProcedures.findIndex(p => p.title === "Retinografia");

  return (
    <section id="procedimentos" className="py-20 md:py-28 bg-secondary/20 relative noise-overlay" ref={sectionRef}>
      {/* Angular decorative top */}
      <div
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"
        style={{ transform: 'rotate(-0.3deg)' }}
      />

      {/* Dots pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }} />

      <div className="container mx-auto px-4">
        {/* Header */}
        <div className={`text-center lg:text-left mb-12 transition-all duration-700 ease-out-expo ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6 ${isVisible ? 'animate-blur-in' : ''}`}>
            O que tratamos
          </span>
          <h2 className={`text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-foreground mb-4 ${isVisible ? 'animate-blur-in animation-delay-100' : ''}`}>
            Exames, cirurgias <span className="gradient-text">e laser</span>
          </h2>
          <p className={`text-muted-foreground max-w-2xl lg:max-w-none text-lg ${isVisible ? 'animate-blur-in animation-delay-200' : ''}`}>
            Diagnóstico completo e tratamento no mesmo lugar. Conheça os principais procedimentos realizados pelo Dr. Juliano.
          </p>
        </div>

        {/* Category filter */}
        <div className={`flex flex-wrap justify-center gap-3 mb-10 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeCategory === cat.key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.label}
              {/* Animated underline */}
              <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary rounded-full transition-all duration-300 ${
                activeCategory === cat.key ? 'w-8 opacity-100 scale-x-100' : 'w-0 opacity-0 scale-x-0'
              }`} />
            </button>
          ))}
        </div>

        {/* Procedures Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5`}>
          {filteredProcedures.map((procedure, index) => {
            const isFeatured = isBento && index === cataractIndex;
            const isTall = isBento && index === retinoIndex;

            return (
              <div
                key={procedure.title}
                className={`group card-shimmer card-glass rounded-2xl relative overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1.5 transition-all duration-500 ease-out-expo ${
                  isFeatured ? 'lg:col-span-2 lg:row-span-2 p-8' : isTall ? 'lg:row-span-2 p-8' : 'p-6'
                } ${isFeatured ? 'bg-gradient-to-br from-primary/8 to-transparent' : ''} ${
                  isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
                }`}
                style={{ transitionDelay: isVisible ? `${index * 80}ms` : '0ms' }}
              >
                {/* Gradient left border */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{
                  background: 'linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--accent)))'
                }} />

                <div className={`flex ${isFeatured || isTall ? 'flex-col gap-5' : 'items-start gap-4'}`}>
                  <div className={`${isFeatured ? 'w-14 h-14' : 'w-12 h-12'} rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-300`}>
                    <procedure.icon className={`${isFeatured ? 'w-7 h-7' : 'w-5 h-5'} text-primary`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`text-foreground font-semibold font-sans group-hover:text-primary transition-colors duration-300 ${isFeatured ? 'text-xl' : 'text-base'}`}>
                        {procedure.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${getCategoryBadgeClasses(procedure.category)}`}>
                        {procedure.category === "exames" ? "Exame" : procedure.category === "cirurgias" ? "Cirurgia" : "Laser"}
                      </span>
                    </div>
                    <p className={`text-muted-foreground leading-relaxed ${isFeatured ? 'text-base' : 'text-sm'}`}>
                      {procedure.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProceduresSection;
