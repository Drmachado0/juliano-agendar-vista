import { useEffect, useRef, useState } from "react";
import { Camera, Eye, Gauge, Search, Ruler, Zap, Scissors, Wind, Target } from "lucide-react";
const ProceduresSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, {
      threshold: 0.1
    });
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);
  const procedures = [{
    icon: Camera,
    title: "Retinografia",
    description: "A Retinografia registra, por meio de fotografias em alta resolução, o fundo do olho."
  }, {
    icon: Eye,
    title: "Mapeamento de Retina",
    description: "O Mapeamento de Retina tem a função de mapear toda a estrutura da retina."
  }, {
    icon: Gauge,
    title: "Tonometria",
    description: "Medir a pressão intraocular para diagnóstico e acompanhamento do glaucoma."
  }, {
    icon: Search,
    title: "Gonioscopia",
    description: "É um exame realizado para análise do ângulo entre a córnea e a íris."
  }, {
    icon: Ruler,
    title: "Biometria Ultrassônica",
    description: "Importante para o cálculo das lentes intraoculares na cirurgia de Catarata."
  }, {
    icon: Zap,
    title: "Limpeza de Lente (YAG Laser)",
    description: "Trata a opacificação da cápsula posterior do cristalino de forma rápida e segura."
  }, {
    icon: Scissors,
    title: "Cirurgia de Catarata",
    description: "Consiste na retirada do cristalino (lente natural do olho), para implante de lente intraocular."
  }, {
    icon: Wind,
    title: "Cirurgia de Pterígio",
    description: "Raspagem do tecido que se forma sobre a esclera (parte branca do olho)."
  }, {
    icon: Target,
    title: "Iridotomia a Laser",
    description: "Utilizado no tratamento ou prevenção do glaucoma de ângulo fechado ou estreito."
  }];
  return <section id="procedimentos" className="py-24 bg-secondary/30" ref={sectionRef}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-4">
            Nossos procedimentos
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            O que você irá encontrar por aqui?
          </h2>
        </div>

        {/* Procedures Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {procedures.map((procedure, index) => <div key={index} className={`card-glass rounded-xl p-6 border-l-4 border-l-primary hover:shadow-lg transition-all duration-500 hover:-translate-y-2 hover:shadow-primary/10 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`} style={{
          transitionDelay: isVisible ? `${index * 100}ms` : '0ms'
        }}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <procedure.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-foreground font-semibold mb-2 text-lg text-center font-sans">{procedure.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{procedure.description}</p>
                </div>
              </div>
            </div>)}
        </div>
      </div>
    </section>;
};
export default ProceduresSection;