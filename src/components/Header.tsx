import { Eye, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import logoImage from "@/assets/dr-juliano-logo.webp";

interface HeaderProps {
  onScheduleClick: () => void;
}

const Header = ({ onScheduleClick }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { label: "Sobre", id: "sobre" },
    { label: "Procedimentos", id: "procedimentos" },
    { label: "Locais", id: "locais" },
    { label: "Convênios", id: "convenios" },
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 flex items-center justify-center overflow-hidden">
              <img 
                src={logoImage} 
                alt="Dr. Juliano Machado Logo" 
                className="w-8 h-8 object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-foreground text-base leading-tight">
                Dr. Juliano Machado
              </span>
              <span className="text-xs text-primary/80">Oftalmologia</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="px-4 py-2 text-muted-foreground hover:text-primary transition-colors text-sm font-medium rounded-lg hover:bg-primary/5"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Button variant="hero" size="default" onClick={onScheduleClick}>
              Agendar consulta
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-foreground p-2 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-border/30 pt-4 animate-fade-in">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors text-sm font-medium text-left px-4 py-3 rounded-lg"
                >
                  {item.label}
                </button>
              ))}
              <Button variant="hero" onClick={onScheduleClick} className="w-full mt-4">
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
