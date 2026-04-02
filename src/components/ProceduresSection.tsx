import { useEffect, useRef, useState } from "react";
import { Camera, Eye, Gauge, Search, Ruler, Zap, Scissors, Wind, Target } from "lucide-react";

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
    { icon: Camera, title: "Retinografia", description: "Fotografias em alta resolução do fundo do olho para diagnóstico preciso.", category: "exames" },
    { icon: Eye, title: "Mapeamento de Retina", description: "Mapeamento completo de toda a estrutura da retina para detecção precoce.", category: "exames" },
    { icon: Gauge, title: "Tonometria", description: "Medição da pressão intraocular para diagnóstico e acompanhamento do glaucoma.", category: "exames" },
    { icon: Search, title: "Gonioscopia", description: "Análise detalhada do ângulo entre a córnea e a íris.", category: "exames" },
    { icon: Ruler, title: "Biometria Ultrassônica", description: "Cálculo preciso das lentes intraoculares para cirurgia de Catarata.", category: "exames" },
    { icon: Scissors, title: "Cirurgia de Catarata", description: "Substituição do cristalino opacificado por lente intraocular de última geração.", category: "cirurgias" },
    { icon: Wind, title: "Cirurgia de Pterígio", description: "Remoção do tecido que se forma sobre a esclera, com técnicas modernas e seguras.", category: "cirurgias" },
    { icon: Zap, title: "YAG Laser", description: "Tratamento rápido e seguro da opacificação da cápsula posterior do cristalino.", category: "laser" },
    { icon: Target, title: "Iridotomia a Laser", description: "Prevenção e tratamento do glaucoma de ângulo fechado ou estreito.", category: "laser" },
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

  return (
    <section id="procedimentos" className="py-20 md:py-28 bg-secondary/20 relative" ref={sectionRef}>
      {/* Decorative */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4">
        {/* Header */}
        <div className={`text-center lg:text-left mb-12 transition-all duration-700 ease-out-expo ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6">
            Nossos procedimentos
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-foreground mb-4">
            Excelência em cada <span className="gradient-text">procedimento</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Oferecemos exames de alta precisão, cirurgias modernas e tratamentos a laser com tecnologia avançada.
          </p>
        </div>

        {/* Category filter */}
        <div className={`flex flex-wrap justify-center gap-2 mb-10 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeCategory === cat.key
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Procedures Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProcedures.map((procedure, index) => (
            <div
              key={procedure.title}
              className={`group card-glass rounded-2xl p-6 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1.5 transition-all duration-500 border-l-[3px] border-l-primary/60 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
              style={{ transitionDelay: isVisible ? `${index * 80}ms` : '0ms' }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                  <procedure.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-foreground font-semibold text-base font-sans">{procedure.title}</h3>
                    <span className="px-2 py-0.5 rounded-md bg-primary/8 text-primary text-[10px] font-bold uppercase tracking-wider">
                      {procedure.category === "exames" ? "Exame" : procedure.category === "cirurgias" ? "Cirurgia" : "Laser"}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{procedure.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProceduresSection;
