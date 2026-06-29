import { MapPin, Phone, Clock, ExternalLink, Hospital, Heart, Eye, Glasses, Navigation } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useGoogleTag } from "@/hooks/useGoogleTag";

const LocationsSection = () => {
  const [activeLocation, setActiveLocation] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { trackPhoneClick } = useGoogleTag();

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
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const locations = [
    {
      name: "Clinicor",
      city: "Paragominas",
      address: "Rua Eixo W1, R. Célio Miranda, N° 729, Paragominas - PA",
      phone: "(91) 93618-0476",
      hours: "Agende para ver disponibilidade",
      icon: Heart,
      mapUrl: "https://www.openstreetmap.org/export/embed.html?bbox=-47.355%2C-2.998%2C-47.350%2C-2.993&layer=mapnik&marker=-2.9958%2C-47.3528",
      mapsLink: "https://maps.google.com/?q=Clinicor+Rua+Celio+Miranda+729+Paragominas+PA",
    },
    {
      name: "Hospital Geral de Paragominas",
      city: "Paragominas",
      address: "R. Santa Terezinha, 304 - Centro, Paragominas - PA",
      phone: "(91) 9100-0303",
      hours: "Agende para ver disponibilidade",
      icon: Hospital,
      mapUrl: "https://www.openstreetmap.org/export/embed.html?bbox=-47.358%2C-2.995%2C-47.353%2C-2.990&layer=mapnik&marker=-2.9925%2C-47.3558",
      mapsLink: "https://maps.google.com/?q=Hospital+Geral+Paragominas+Santa+Terezinha+304",
    },
    {
      name: "Instituto de Olhos de Belém",
      city: "Belém",
      address: "Av. Generalíssimo Deodoro, 904 - Nazaré, Belém - PA",
      phone: "(91) 3239-4600",
      hours: "Agende para ver disponibilidade",
      icon: Eye,
      mapUrl: "https://www.openstreetmap.org/export/embed.html?bbox=-48.492%2C-1.458%2C-48.487%2C-1.453&layer=mapnik&marker=-1.4558%2C-48.4897",
      mapsLink: "https://maps.google.com/?q=Instituto+de+Olhos+de+Belem+Av+Generalissimo+Deodoro+904+Nazare+Belem+PA",
    },
    {
      name: "Vitria - Ed. Síntese 21",
      city: "Belém",
      address: "Av. Conselheiro Furtado, 2865 - Sobreloja, salas 08-10 - São Braz, Belém - PA",
      phone: "(91) 3342-1463",
      hours: "Agende para ver disponibilidade",
      icon: Glasses,
      mapUrl: "https://www.openstreetmap.org/export/embed.html?bbox=-48.472%2C-1.438%2C-48.467%2C-1.433&layer=mapnik&marker=-1.4358%2C-48.4697",
      mapsLink: "https://maps.google.com/?q=Vitria+Ed+Sintese+21+Av+Conselheiro+Furtado+2865+Sao+Braz+Belem+PA",
    },
  ];

  const activeLocationData = locations[activeLocation];

  return (
    <section id="locais" className="py-20 md:py-28 bg-card relative noise-overlay" ref={sectionRef}>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* Topographic rings decoration */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none hidden lg:block">
        <div className="w-[600px] h-[600px] rounded-full border border-foreground" />
        <div className="absolute inset-[15%] rounded-full border border-foreground" />
        <div className="absolute inset-[30%] rounded-full border border-foreground" />
        <div className="absolute inset-[45%] rounded-full border border-foreground" />
      </div>

      <div className="container mx-auto px-4">
        <div className={`text-center mb-14 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6">
            <Navigation className="w-3.5 h-3.5" />
            Onde atendemos
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            4 locais em <span className="gradient-text">Paragominas e Belém</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Escolha o local mais perto de você. Todos com estrutura completa para consultas e procedimentos.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-0 items-stretch">
          {/* Location Cards */}
          <div className="space-y-3 lg:pr-6 relative z-10">
            {locations.map((location, index) => {
              const IconComponent = location.icon;
              const isActive = activeLocation === index;
              const isBelem = location.city === "Belém";
              const borderColor = isActive
                ? isBelem ? "border-accent/40" : "border-primary/40"
                : "border-border/50";
              return (
                <button
                  key={index}
                  onClick={() => setActiveLocation(index)}
                  className={`card-shimmer w-full text-left card-glass rounded-2xl p-5 transition-all duration-400 ${borderColor} ${
                    isActive
                      ? `bg-primary/5 shadow-lg shadow-primary/10 scale-[1.01] ${isBelem ? 'border-r-2 border-r-accent' : 'border-r-2 border-r-primary'}`
                      : "hover:border-primary/25 hover:bg-primary/3"
                  } ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
                  style={{ transitionDelay: isVisible ? `${index * 80}ms` : '0ms' }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                      isActive
                        ? isBelem ? "bg-accent text-accent-foreground shadow-md shadow-accent/20" : "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "bg-primary/10 text-primary"
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold text-sm truncate transition-colors font-sans ${isActive ? (isBelem ? "text-accent" : "text-primary") : "text-foreground"}`}>
                          {location.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold shrink-0 uppercase tracking-wider ${
                          isBelem ? 'bg-accent/10 text-accent' : 'bg-secondary text-muted-foreground'
                        }`}>
                          {location.city}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{location.address}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3 text-primary" />
                          {location.phone}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Map — painel escuro estilizado (premium, sem iframe/WebGL) */}
          <div className={`relative rounded-3xl overflow-hidden min-h-[500px] border border-border/60 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            {/* Faux dark map backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 via-card to-background" aria-hidden="true">
              {/* street grid */}
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage:
                    "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
                  backgroundSize: "44px 44px",
                }}
              />
              {/* diagonal avenues */}
              <div className="absolute -inset-1/4 rotate-[18deg]">
                <div className="absolute top-1/3 left-0 right-0 h-px bg-primary/10" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-primary/10" />
                <div className="absolute left-1/4 top-0 bottom-0 w-px bg-primary/10" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-accent/10" />
              </div>
              {/* teal glow under pin */}
              <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/15 blur-[90px]" />
            </div>

            {/* Pin com anéis pulsantes */}
            <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center" aria-hidden="true">
              <span className="absolute w-28 h-28 rounded-full border border-primary/20" />
              <span className="absolute w-44 h-44 rounded-full border border-primary/10" />
              <span className="absolute w-28 h-28 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "3s" }} />
              <div className="relative w-14 h-14 rounded-2xl glass-panel flex items-center justify-center glow-teal">
                <activeLocationData.icon className="w-6 h-6 text-primary" />
              </div>
            </div>

            {/* badge cidade */}
            <div className="absolute top-5 left-5 px-3 py-1.5 rounded-full glass-panel text-xs font-semibold text-foreground">
              {activeLocationData.city} · PA
            </div>

            {/* Details overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card/95 via-card/80 to-transparent p-6 pt-12">
              <h3 className="text-lg font-bold text-foreground mb-3 font-sans">{activeLocationData.name}</h3>
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm">{activeLocationData.address}</span>
                </div>
                <a
                  href={`tel:${activeLocationData.phone.replace(/\D/g, '')}`}
                  onClick={() => { trackPhoneClick(`tel:${activeLocationData.phone.replace(/\D/g, '')}`); }}
                  className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm">{activeLocationData.phone}</span>
                </a>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm">{activeLocationData.hours}</span>
                </div>
              </div>
              <a
                href={activeLocationData.mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-colors text-sm font-semibold"
              >
                <Navigation className="w-4 h-4" />
                Como chegar
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LocationsSection;
