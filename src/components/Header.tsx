import { Menu, X, CalendarCheck, Phone } from "lucide-react";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { DOCTOR } from "@/lib/constants";
import logoImage from "@/assets/dr-juliano-logo.svg";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  const { trackWhatsAppClick, trackCTAClick } = useGoogleTag();
  const { trackContact: trackMetaContact } = useMetaPixel();
  const { waLink, display } = useSiteWhatsApp();
  const headerWaUrl = waLink(undefined, "site_header");

  const navItems = [
    // "Sobre" tem pagina propria; os demais sao ancoras de secao da home.
    { label: "Sobre", id: "sobre", href: "/sobre" },
    { label: "Procedimentos", id: "procedimentos" },
    { label: "Glaucoma", id: "glaucoma", href: "/procedimentos/glaucoma" },
    { label: "YAG Laser", id: "yag-laser" },
    { label: "Depoimentos", id: "depoimentos" },
    { label: "Locais", id: "locais" },
    { label: "Belém", id: "belem", href: "/belem" },
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

  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Fora da home o id nao existe no DOM e o optional chaining engolia o clique:
  // o menu inteiro ficava morto em /sobre, /belem, /agendamento e nas paginas de
  // procedimento. Nesses casos navega para a home com a ancora — o ScrollToTop
  // cuida de rolar ate a secao ao chegar.
  const scrollToSection = (id: string) => {
    setIsMenuOpen(false);
    if (pathname === "/") {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    navigate(`/#${id}`);
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
            onClick={() => (pathname === "/" ? window.scrollTo({ top: 0, behavior: 'smooth' }) : navigate('/'))}
            className="flex items-center gap-2 sm:gap-2.5 group shrink-0"
          >
            <div className={`rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/25 flex items-center justify-center overflow-hidden group-hover:border-primary/40 transition-all duration-300 ${
              scrolled ? 'w-10 h-10' : 'w-11 h-11 sm:w-12 sm:h-12'
            }`}>
              <img src={logoImage} alt={`${DOCTOR.name} – ${DOCTOR.specialty}`} className={`object-contain transition-all duration-300 ${
                scrolled ? 'w-8 h-8' : 'w-9 h-9 sm:w-10 sm:h-10'
              }`} />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-foreground text-sm sm:text-base leading-tight">{DOCTOR.name}</span>
              <span className="text-xs text-primary/80 font-medium">{DOCTOR.specialty} · {DOCTOR.crm}</span>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-0.5">
            {navItems.map((item) => {
              const classes = `relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                activeSection === item.id
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`;
              const sublinhado = (
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-primary rounded-full transition-all duration-300 ${
                  activeSection === item.id ? "w-full scale-x-100" : "w-0 scale-x-0"
                }`} />
              );
              return "href" in item && item.href ? (
                <Link key={item.id} to={item.href} className={classes}>
                  {item.label}
                  {sublinhado}
                </Link>
              ) : (
                <button key={item.id} onClick={() => scrollToSection(item.id)} className={classes}>
                  {item.label}
                  {sublinhado}
                </button>
              );
            })}
          </nav>

          {/* CTA Desktop */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/agendamento"
              onClick={() => trackCTAClick('agendar_consulta', 'header_desktop', 'Agendar Online')}
            >
              <Button variant="obsidian" size="sm" className="gap-1.5 min-h-[44px]">
                <CalendarCheck className="h-5 w-5" />
                Agendar avaliação
              </Button>
            </Link>
          </div>

          {/* Mobile Actions */}
          <div className="flex xl:hidden items-center gap-1.5">
            <Link
              to="/agendamento"
              onClick={() => trackCTAClick('agendar_consulta', 'header_mobile', 'Agendar')}
            >
              <Button variant="obsidian" size="sm" className="gap-1 text-xs px-3 min-h-[44px]">
                <CalendarCheck className="h-3.5 w-3.5" />
                Agendar
              </Button>
            </Link>
            <button
              className="text-foreground p-2 rounded-lg hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`xl:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isMenuOpen ? 'max-h-[28rem] mt-3 pb-4 border-t border-border/30 pt-3' : 'max-h-0'
        }`}>
          <div className={`${isMenuOpen ? 'backdrop-blur-xl' : ''}`}>
            <nav className="flex flex-col gap-0.5">
              {navItems.map((item, index) => {
                const classes = `text-sm font-medium text-left px-4 py-2.5 rounded-lg transition-all duration-300 ${
                  activeSection === item.id
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                } ${isMenuOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`;
                const estilo = { transitionDelay: isMenuOpen ? `${index * 50}ms` : "0ms" };
                return "href" in item && item.href ? (
                  <Link
                    key={item.id}
                    to={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={classes}
                    style={estilo}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={classes}
                    style={estilo}
                  >
                    {item.label}
                  </button>
                );
              })}

              <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent my-2" />

              <a
                href={headerWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackWhatsAppClick(headerWaUrl, display, 'whatsapp_header', 'header_menu_mobile');
                  trackMetaContact('WhatsApp');
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors min-h-[44px]"
              >
                <Phone className="w-4 h-4" />
                Falar no WhatsApp
              </a>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
