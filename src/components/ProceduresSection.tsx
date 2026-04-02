import { useEffect, useRef, useState } from "react";
import { RetinografiaIcon, MapeamentoRetinaIcon, TonometriaIcon, GonioscopiaIcon, BiometriaIcon, CatarataIcon, PterigioIcon, YagLaserIcon, IridotomiaIcon } from "./ProcedureIcons";

const ProceduresSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"all" | "exames" | "cirurgias" | "laser">("all");
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
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
    { icon: RetinografiaIcon, title: "Retinografia", description: "Fotografia detalhada do fundo do olho. Essencial para acompanhar diabetes, glaucoma e doenças da retina.", category: "exames", image: "https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=600&q=80" },
    { icon: MapeamentoRetinaIcon, title: "Mapeamento de Retina", description: "Avaliação completa da retina para detectar problemas antes que afetem sua visão.", category: "exames", image: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=600&q=80" },
    { icon: TonometriaIcon, title: "Tonometria", description: "Mede a pressão do olho — o principal exame para prevenir e controlar o glaucoma.", category: "exames", image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80" },
    { icon: GonioscopiaIcon, title: "Gonioscopia", description: "Examina a drenagem interna do olho para avaliar o risco de glaucoma.", category: "exames", image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80" },
    { icon: BiometriaIcon, title: "Biometria Ultrassônica", description: "Calcula o grau exato da lente que será implantada na cirurgia de catarata.", category: "exames", image: "https://images.unsplash.com/photo-1631549916768-4f697bbf6509?auto=format&fit=crop&w=600&q=80" },
    { icon: CatarataIcon, title: "Cirurgia de Catarata", description: "Troca do cristalino opaco por uma lente artificial. Procedimento rápido, seguro e que pode até reduzir a dependência de óculos.", category: "cirurgias", image: "https://images.unsplash.com/photo-1551190822-a9ce113ac100?auto=format&fit=crop&w=600&q=80" },
    { icon: PterigioIcon, title: "Cirurgia de Pterígio", description: "Remove a membrana que cresce sobre o olho, causando irritação e vermelhidão. Técnica com baixo índice de retorno.", category: "cirurgias", image: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=600&q=80" },
    { icon: YagLaserIcon, title: "YAG Laser", description: "Procedimento rápido (poucos minutos) para limpar a lente quando ela fica embaçada após cirurgia de catarata.", category: "laser", image: "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=600&q=80" },
    { icon: IridotomiaIcon, title: "Iridotomia a Laser", description: "Laser preventivo para pacientes com risco de glaucoma agudo. Indolor e feito no consultório.", category: "laser", image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=600&q=80" },
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

  const isBento = activeCategory === "all";
  const cataractIndex = filteredProcedures.findIndex(p => p.title === "Cirurgia de Catarata");
  const retinoIndex = filteredProcedures.findIndex(p => p.title === "Retinografia");

  const handleImageError = (title: string) => {
    setImageErrors(prev => ({ ...prev, [title]: true }));
  };

  return (
    <section id="procedimentos" className="py-20 md:py-28 bg-secondary/20 relative noise-overlay" ref={sectionRef}>
      <div
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"
        style={{ transform: 'rotate(-0.3deg)' }}
      />
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
              <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary rounded-full transition-all duration-300 ${
                activeCategory === cat.key ? 'w-8 opacity-100 scale-x-100' : 'w-0 opacity-0 scale-x-0'
              }`} />
            </button>
          ))}
        </div>

        {/* Procedures Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProcedures.map((procedure, index) => {
            const isFeatured = isBento && index === cataractIndex;
            const isTall = isBento && index === retinoIndex;
            const hasImageError = imageErrors[procedure.title];
            const imageHeight = (isFeatured || isTall) ? 'h-48' : 'h-40';

            return (
              <div
                key={procedure.title}
                className={`group card-glass rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1.5 transition-all duration-500 ease-out-expo ${
                  isFeatured ? 'lg:col-span-2 lg:row-span-2' : isTall ? 'lg:row-span-2' : ''
                } ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`}
                style={{ transitionDelay: isVisible ? `${index * 80}ms` : '0ms' }}
              >
                {/* Image */}
                <div className={`relative ${imageHeight} overflow-hidden`}>
                  {!hasImageError ? (
                    <img
                      src={procedure.image}
                      alt={procedure.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                      onError={() => handleImageError(procedure.title)}
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <procedure.icon className="w-12 h-12 opacity-40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-sm text-[11px] font-bold uppercase tracking-wider text-primary">
                    {procedure.category === "exames" ? "Exame" : procedure.category === "cirurgias" ? "Cirurgia" : "Laser"}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className={`text-foreground font-semibold font-sans mb-2 group-hover:text-primary transition-colors duration-300 ${isFeatured ? 'text-xl' : 'text-base'}`}>
                    {procedure.title}
                  </h3>
                  <p className={`text-muted-foreground leading-relaxed ${isFeatured ? 'text-base' : 'text-sm'}`}>
                    {procedure.description}
                  </p>
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
