import { Heart, MapPin, Instagram, MessageCircle } from "lucide-react";
import logoImage from "@/assets/dr-juliano-logo.webp";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useMetaPixel } from "@/hooks/useMetaPixel";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { trackWhatsAppClick } = useGoogleTag();
  const { trackContact: trackMetaContact } = useMetaPixel();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="bg-gradient-to-b from-card to-background border-t border-border/50 relative noise-overlay">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4 group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/25 flex items-center justify-center overflow-hidden transition-shadow duration-300 group-hover:shadow-lg group-hover:shadow-primary/15">
                <img src={logoImage} alt="Logo" className="w-12 h-12 object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground text-base">Dr. Juliano Machado</span>
                <span className="text-xs text-primary/80 font-medium">Oftalmologista</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Oftalmologista em Paragominas e Belém. Consultas, exames e cirurgias com agendamento online.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-foreground font-semibold text-sm mb-4 font-sans border-b border-primary/20 pb-2 inline-block">Navegação</h4>
            <nav className="flex flex-col gap-2.5">
              {[
                { label: "Sobre", id: "sobre" },
                { label: "Procedimentos", id: "procedimentos" },
                { label: "Depoimentos", id: "depoimentos" },
                { label: "Locais de Atendimento", id: "locais" },
                { label: "Convênios", id: "convenios" },
              ].map(link => (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className="group relative text-sm text-muted-foreground hover:text-primary transition-colors text-left w-fit"
                >
                  {link.label}
                  <span className="absolute -bottom-0.5 left-0 h-px bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left w-full" />
                </button>
              ))}
            </nav>
          </div>

          {/* Locations */}
          <div>
            <h4 className="text-foreground font-semibold text-sm mb-4 font-sans border-b border-primary/20 pb-2 inline-block">Locais</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Clinicor — Paragominas, PA</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Hospital Geral — Paragominas, PA</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Instituto de Olhos — Belém, PA</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Vitria Ed. Síntese 21 — Belém, PA</span>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-foreground font-semibold text-sm mb-4 font-sans border-b border-primary/20 pb-2 inline-block">Contato</h4>
            <div className="space-y-3">
              <a
                href="https://wa.me/5591936180476"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { trackWhatsAppClick(); trackMetaContact('WhatsApp'); }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-primary" />
                (91) 93618-0476
              </a>
              <a
                href="https://www.instagram.com/drjulianomachado.oftalmo/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Instagram className="w-4 h-4 text-primary" />
                @drjulianomachado.oftalmo
              </a>
            </div>
          </div>
        </div>

        {/* Wave separator */}
        <div className="relative h-5 mb-4 overflow-hidden">
          <svg viewBox="0 0 1200 20" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <path
              d="M0 10 Q150 0 300 10 T600 10 T900 10 T1200 10"
              fill="none"
              stroke="hsl(var(--primary) / 0.1)"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* Bottom bar */}
        <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-3">
            <svg width="60" height="60" viewBox="0 0 60 60" className="opacity-[0.08]">
              <circle cx="30" cy="30" r="28" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.5" />
              <circle cx="30" cy="30" r="20" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.5" />
              <circle cx="30" cy="30" r="12" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.5" />
            </svg>
            <p className="text-xs text-muted-foreground">
              © {currentYear} Dr. Juliano Machado — Todos os direitos reservados.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/drjulianomachado.oftalmo/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary hover:scale-110 transition-all duration-300"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href="https://wa.me/5591936180476"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { trackWhatsAppClick(); trackMetaContact('WhatsApp'); }}
              className="text-muted-foreground hover:text-primary hover:scale-110 transition-all duration-300"
              aria-label="WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
              <span>Feito com</span>
              <Heart className="w-3 h-3 text-destructive/60 fill-destructive/60" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
