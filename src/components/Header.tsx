import { Eye, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface HeaderProps {
  onScheduleClick: () => void;
}

const Header = ({ onScheduleClick }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Eye className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-foreground text-lg leading-tight">
                Dr. Juliano Machado
              </span>
              <span className="text-xs text-muted-foreground">Oftalmologia</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection("sobre")}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Sobre
            </button>
            <button
              onClick={() => scrollToSection("locais")}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Locais
            </button>
            <button
              onClick={() => scrollToSection("convenios")}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Convênios
            </button>
          </nav>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Button variant="hero" onClick={onScheduleClick}>
              Agendar consulta
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-foreground p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-border/50 pt-4 animate-fade-in">
            <nav className="flex flex-col gap-4">
              <button
                onClick={() => scrollToSection("sobre")}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium text-left"
              >
                Sobre
              </button>
              <button
                onClick={() => scrollToSection("locais")}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium text-left"
              >
                Locais
              </button>
              <button
                onClick={() => scrollToSection("convenios")}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium text-left"
              >
                Convênios
              </button>
              <Button variant="hero" onClick={onScheduleClick} className="w-full mt-2">
                Agendar consulta
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
