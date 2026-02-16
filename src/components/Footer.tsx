import { Eye, Heart, MapPin, Phone, Mail, Instagram } from "lucide-react";
import logoImage from "@/assets/dr-juliano-logo.webp";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="bg-card border-t border-border/50 relative">
      {/* Top decorative line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/25 flex items-center justify-center overflow-hidden">
                <img src={logoImage} alt="Logo" className="w-8 h-8 object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground text-sm">Dr. Juliano Machado</span>
                <span className="text-[11px] text-primary/80 font-medium">Oftalmologista</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cuidando da sua visão com excelência há mais de 13 anos em Paragominas e Belém.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-foreground font-semibold text-sm mb-4 font-sans">Navegação</h4>
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
                  className="text-sm text-muted-foreground hover:text-primary transition-colors text-left"
                >
                  {link.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Locations */}
          <div>
            <h4 className="text-foreground font-semibold text-sm mb-4 font-sans">Locais</h4>
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
            <h4 className="text-foreground font-semibold text-sm mb-4 font-sans">Contato</h4>
            <div className="space-y-3">
              <a
                href="https://api.whatsapp.com/send?phone=5519982273901"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4 text-primary" />
                (91) 98165-3200
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

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {currentYear} Dr. Juliano Machado — Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Feito com</span>
            <Heart className="w-3 h-3 text-destructive fill-destructive" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
