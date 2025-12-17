import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Star, Quote } from "lucide-react";

interface Testimonial {
  id: string;
  name: string;
  avatar: string;
  image?: string;
  rating: 4 | 5;
  text: string;
  date: string;
  source: 'Google';
}

const AUTO_ROTATE_INTERVAL = 6000; // 6 seconds

// Avaliações reais do perfil do Google
const ALL_TESTIMONIALS: Testimonial[] = [
  {
    id: "1",
    name: "Amanda Machado",
    avatar: "AM",
    image: "https://lh3.googleusercontent.com/a-/ALV-UjVr4IwRV0mKIccKAdcCNGLiadt03y_FVzG3JrNajeCrTYX2IcTI=w72-h72-p-rp-mo-br100",
    rating: 5,
    text: "Gostei muito da consulta! Excelente profissional, explica tudo muito bem, e nos deixa seguros.",
    date: "há 2 anos",
    source: 'Google',
  },
  {
    id: "2",
    name: "Gislene Alves da Silva",
    avatar: "GA",
    image: "https://lh3.googleusercontent.com/a/ACg8ocJDkwVCCYhIu0Ek2a-WYH0Pd5MSrjq_hPQ4dcFE_qlVuMfcYg=w72-h72-p-rp-mo-ba2-br100",
    rating: 5,
    text: "Excelente profissional!",
    date: "há 2 anos",
    source: 'Google',
  },
  {
    id: "3",
    name: "Ambulatórios Pedfamaz",
    avatar: "AP",
    image: "https://lh3.googleusercontent.com/a/ACg8ocLQnzEQT1_J76p0h2RmkkoKi-wQBPVKn2jYclq0fa-YFPSAPg=w72-h72-p-rp-mo-br100",
    rating: 5,
    text: "Atendimento excelente, profissional muito competente e atencioso.",
    date: "há 2 anos",
    source: 'Google',
  },
  {
    id: "4",
    name: "Josinete Brito",
    avatar: "JB",
    rating: 5,
    text: "Ótimo profissional, muito atencioso e dedicado. Recomendo!",
    date: "há 1 ano",
    source: 'Google',
  },
  {
    id: "5",
    name: "Maria das Graças",
    avatar: "MG",
    rating: 5,
    text: "Médico muito competente e humano. Me senti muito bem acolhida durante toda a consulta.",
    date: "há 1 ano",
    source: 'Google',
  },
  {
    id: "6",
    name: "Carlos Eduardo",
    avatar: "CE",
    rating: 5,
    text: "Profissional excepcional! Muito conhecimento e paciência para explicar tudo sobre o tratamento.",
    date: "há 8 meses",
    source: 'Google',
  },
];

const TestimonialsSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [displayedTestimonials, setDisplayedTestimonials] = useState<Testimonial[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  // Shuffle array using Fisher-Yates algorithm
  const shuffleArray = useCallback((array: Testimonial[]): Testimonial[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Load new set of testimonials with transition
  const loadNewTestimonials = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      const shuffled = shuffleArray(ALL_TESTIMONIALS);
      setDisplayedTestimonials(shuffled.slice(0, 3));
      setIsTransitioning(false);
    }, 300);
  }, [shuffleArray]);

  // Initial load
  useEffect(() => {
    const shuffled = shuffleArray(ALL_TESTIMONIALS);
    setDisplayedTestimonials(shuffled.slice(0, 3));
  }, [shuffleArray]);

  // Auto-rotate testimonials
  useEffect(() => {
    if (isHovered) {
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
        autoRotateRef.current = null;
      }
      return;
    }

    autoRotateRef.current = setInterval(() => {
      loadNewTestimonials();
    }, AUTO_ROTATE_INTERVAL);

    return () => {
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
      }
    };
  }, [isHovered, loadNewTestimonials]);

  // Calculate average rating dynamically
  const averageRating = useMemo(() => {
    if (displayedTestimonials.length === 0) return "5.0";
    const sum = displayedTestimonials.reduce((acc, t) => acc + t.rating, 0);
    return (sum / displayedTestimonials.length).toFixed(1);
  }, [displayedTestimonials]);

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

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <Star
        key={index}
        className={`w-4 h-4 ${
          index < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
        }`}
      />
    ));
  };

  return (
    <section id="depoimentos" className="py-24 bg-secondary/30" ref={sectionRef}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-4">
            Depoimentos
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            O que nossos pacientes dizem
          </h2>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="flex items-center gap-1">
              {renderStars(Math.round(parseFloat(averageRating)))}
            </div>
            <span className="font-semibold text-foreground">{averageRating}</span>
            <span>• Avaliações do Google</span>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {displayedTestimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className={`card-glass rounded-xl p-6 relative hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 ${
                isVisible 
                  ? isTransitioning 
                    ? 'opacity-0 scale-95' 
                    : 'opacity-100 translate-y-0 scale-100'
                  : 'opacity-0 translate-y-12'
              }`}
              style={{ 
                transitionDelay: isVisible && !isTransitioning ? `${index * 100}ms` : '0ms'
              }}
            >
              {/* Quote Icon */}
              <Quote className="absolute top-4 right-4 w-8 h-8 text-primary/10" />
              
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                {testimonial.image ? (
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary font-semibold text-sm border-2 border-primary/20">
                    {testimonial.avatar}
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-foreground">{testimonial.name}</h4>
                  <p className="text-xs text-muted-foreground">{testimonial.date}</p>
                </div>
              </div>

              {/* Stars */}
              <div className="flex items-center gap-0.5 mb-3">
                {renderStars(testimonial.rating)}
              </div>

              {/* Text */}
              <p className="text-muted-foreground text-sm leading-relaxed">
                "{testimonial.text}"
              </p>

              {/* Google Badge */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-xs text-muted-foreground">Avaliação do Google</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className={`text-center mt-12 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <a
            href="https://g.page/r/CTkTpXB1m13mEBI/review"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-card border border-border hover:border-primary/50 transition-all text-foreground font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Ver todas as avaliações no Google
          </a>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
