import { Menu, X, Settings, LogIn, CalendarCheck, Phone } from "lucide-react";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logoImage from "@/assets/dr-juliano-logo.webp";

interface HeaderProps {
  onScheduleClick: () => void;
}

const Header = ({ onScheduleClick }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  const { user, isAdmin } = useAuth();
  const { trackWhatsAppClick } = useGoogleTag();
  const { trackContact: trackMetaContact } = useMetaPixel();

  const navItems = [
    { label: "Sobre", id: "sobre" },
    { label: "Procedimentos", id: "procedimentos" },
    { label: "Depoimentos", id: "depoimentos" },
    { label: "Locais", id: "locais" },
    { label: "Convênios", id: "convenios" },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    navItems.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setIsMenuOpen(false);
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? "bg-background/95 backdrop-blur-xl border-b border-border/40 shadow-sm shadow-black/10"
        : "bg-background/70 backdrop-blur-md border-b border-transparent"
    }`}>
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 sm:gap-2.5 group shrink-0"
          >
            <div className={`rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/25 flex items-center justify-center overflow-hidden group-hover:border-primary/40 transition-all duration-300 ${
              scrolled ? 'w-10 h-10' : 'w-11 h-11 sm:w-12 sm:h-12'
            }`}>
              <img src={logoImage} alt="Logo" className={`object-contain transition-all duration-300 ${
                scrolled ? 'w-8 h-8' : 'w-9 h-9 sm:w-10 sm:h-10'
              }`} />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-foreground text-sm sm:text-base leading-tight">Dr. Juliano Machado</span>
              <span className="text-xs text-primary/80 font-medium">Oftalmologista</span>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                  activeSection === item.id
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {item.label}
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-primary rounded-full transition-all duration-300 ${
                  activeSection === item.id ? 'w-full scale-x-100' : 'w-0 scale-x-0'
                }`} />
              </button>
            ))}
          </nav>

          {/* CTA Desktop */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <Link to="/admin/dashboard">
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-5 w-5" />
                  {isAdmin ? "Admin" : "Painel"}
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                  <LogIn className="h-5 w-5" />
                  Entrar
                </Button>
              </Link>
            )}
            <Link to="/agendar">
              <Button variant="hero" size="sm" className="gap-1.5 card-shimmer">
                <CalendarCheck className="h-5 w-5" />
                Agendar Online
              </Button>
            </Link>
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-1.5">
            <a
              href="https://wa.me/5591936180476"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { trackWhatsAppClick(); trackMetaContact('WhatsApp'); }}
              className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
              aria-label="WhatsApp"
            >
              <Phone className="w-4 h-4" />
            </a>
            <Link to="/agendar">
              <Button variant="hero" size="sm" className="gap-1 text-xs px-2.5 py-1.5 h-auto">
                <CalendarCheck className="h-3.5 w-3.5" />
                Agendar
              </Button>
            </Link>
            <button
              className="text-foreground p-2 rounded-lg hover:bg-secondary transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isMenuOpen ? 'max-h-[28rem] mt-3 pb-4 border-t border-border/30 pt-3' : 'max-h-0'
        }`}>
          <div className={`${isMenuOpen ? 'backdrop-blur-xl' : ''}`}>
            <nav className="flex flex-col gap-0.5">
              {navItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-sm font-medium text-left px-4 py-2.5 rounded-lg transition-all duration-300 ${
                    activeSection === item.id
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  } ${isMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                  style={{ transitionDelay: isMenuOpen ? `${index * 50}ms` : '0ms' }}
                >
                  {item.label}
                </button>
              ))}

              <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent my-2" />

              <div className={`transition-all duration-300 ${isMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                style={{ transitionDelay: isMenuOpen ? `${navItems.length * 50}ms` : '0ms' }}
              >
                {user ? (
                  <Link to="/admin/dashboard" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <Settings className="h-4 w-4" />
                      {isAdmin ? "Admin" : "Painel"}
                    </Button>
                  </Link>
                ) : (
                  <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full gap-2 justify-start px-4">
                      <LogIn className="h-4 w-4" />
                      Entrar
                    </Button>
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
