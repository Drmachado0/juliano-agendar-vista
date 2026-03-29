import { MapPin, Phone, Clock, ExternalLink, Hospital, Heart, Eye, Glasses, Navigation } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useGoogleTag } from "@/hooks/useGoogleTag";

const LocationsSection = () => {
  const [activeLocation, setActiveLocation] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { trackPhoneClickConversion } = useGoogleTag();

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
      hours: "Conforme agenda",
      icon: Heart,
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3985.456!2d-47.3527778!3d-2.9958333!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x92a4546013c5d1b7%3A0x1!2sParagominas%2C%20PA!5e0!3m2!1spt-BR!2sbr!4v1699999999999!5m2!1spt-BR!2sbr",
      mapsLink: "https://www.google.com/maps/search/Clinicor+Rua+Celio+Miranda+729+Paragominas+PA",
    },
    {
      name: "Hospital Geral de Paragominas",
      city: "Paragominas",
      address: "R. Santa Terezinha, 304 - Centro, Paragominas - PA",
      phone: "(91) 9100-0303",
      hours: "Conforme agenda",
      icon: Hospital,
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3985.456!2d-47.3558!3d-2.9925!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x92a4546013c5d1b7%3A0x1!2sHospital%20Geral%20de%20Paragominas!5e0!3m2!1spt-BR!2sbr!4v1699999999999!5m2!1spt-BR!2sbr",
      mapsLink: "https://www.google.com/maps/search/Hospital+Geral+Paragominas+Santa+Terezinha+304",
    },
    {
      name: "Instituto de Olhos de Belém",
      city: "Belém",
      address: "Av. Generalíssimo Deodoro, 904 - Nazaré, Belém - PA",
      phone: "(91) 3239-4600",
      hours: "Conforme agenda",
      icon: Eye,
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.456!2d-48.4897!3d-1.4558!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x92a4546013c5d1b7%3A0x1!2sAv.%20General%C3%ADssimo%20Deodoro%2C%20904%20-%20Nazar%C3%A9%2C%20Bel%C3%A9m!5e0!3m2!1spt-BR!2sbr!4v1699999999999!5m2!1spt-BR!2sbr",
      mapsLink: "https://www.google.com/maps/search/Av+Generalissimo+Deodoro+904+Nazare+Belem+PA",
    },
    {
      name: "Vitria - Ed. Síntese 21",
      city: "Belém",
      address: "Av. Conselheiro Furtado, 2865 - Sobreloja, salas 08-10 - São Braz, Belém - PA",
      phone: "(91) 3342-1463",
      hours: "Conforme agenda",
      icon: Glasses,
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.456!2d-48.4697!3d-1.4358!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x92a4546013c5d1b7%3A0x1!2sAv.%20Conselheiro%20Furtado%2C%202865%20-%20S%C3%A3o%20Braz%2C%20Bel%C3%A9m!5e0!3m2!1spt-BR!2sbr!4v1699999999999!5m2!1spt-BR!2sbr",
      mapsLink: "https://www.google.com/maps/search/Av+Conselheiro+Furtado+2865+Sao+Braz+Belem+PA",
    },
  ];

  const activeLocationData = locations[activeLocation];

  return (
    <section id="locais" className="py-20 md:py-28 bg-card relative" ref={sectionRef}>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4">
        <div className={`text-center mb-14 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6">
            <Navigation className="w-3.5 h-3.5" />
            Locais de atendimento
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Onde encontrar o <span className="gradient-text">Dr. Juliano</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Atendimento em clínicas e hospitais de referência em Paragominas e Belém.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Location Cards */}
          <div className="space-y-3">
            {locations.map((location, index) => {
              const IconComponent = location.icon;
              const isActive = activeLocation === index;
              return (
                <button
                  key={index}
                  onClick={() => setActiveLocation(index)}
                  className={`w-full text-left card-glass rounded-2xl p-5 transition-all duration-400 ${
                    isActive
                      ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/8 scale-[1.01]"
                      : "hover:border-primary/25 hover:bg-primary/3"
                  } ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
                  style={{ transitionDelay: isVisible ? `${index * 80}ms` : '0ms' }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                      isActive ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-primary/10 text-primary"
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold text-sm truncate transition-colors font-sans ${isActive ? "text-primary" : "text-foreground"}`}>
                          {location.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-semibold text-muted-foreground shrink-0 uppercase tracking-wider">
                          {location.city}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{location.address}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
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

          {/* Map and Details */}
          <div className={`card-glass rounded-2xl overflow-hidden transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <div className="aspect-video bg-secondary relative">
              <iframe
                src={activeLocationData.mapUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0"
                title={`Mapa - ${activeLocationData.name}`}
              />
            </div>
            <div className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-4 font-sans">{activeLocationData.name}</h3>
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm">{activeLocationData.address}</span>
                </div>
                <a
                  href={`tel:${activeLocationData.phone.replace(/\D/g, '')}`}
                  onClick={() => trackPhoneClickConversion()}
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir no Google Maps
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LocationsSection;
