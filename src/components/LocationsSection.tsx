import { MapPin, Phone, Clock, ExternalLink, Building2, Hospital, Stethoscope } from "lucide-react";
import { useState } from "react";

const LocationsSection = () => {
  const [activeLocation, setActiveLocation] = useState(0);

  const locations = [
    {
      name: "Clinicor",
      city: "Paragominas",
      address: "Rua Eixo W1, R. Célio Miranda, N° 729, Paragominas - PA",
      phone: "(91) 99999-9999",
      hours: "Seg a Sex, 8h às 18h",
      icon: Stethoscope,
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3985.7!2d-47.3527!3d-2.9958!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMsKwNTknNDUuMCJTIDQ3wrAyMScxMC4wIlc!5e0!3m2!1spt-BR!2sbr!4v1",
      mapsLink: "https://maps.google.com/?q=Rua+Célio+Miranda+729+Paragominas+PA",
    },
    {
      name: "Hospital Geral de Paragominas",
      city: "Paragominas",
      address: "R. Santa Terezinha, 304 - Centro, Paragominas - PA",
      phone: "(91) 99999-9999",
      hours: "Conforme agenda",
      icon: Hospital,
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3985.7!2d-47.3527!3d-2.9958!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMsKwNTknNDUuMCJTIDQ3wrAyMScxMC4wIlc!5e0!3m2!1spt-BR!2sbr!4v1",
      mapsLink: "https://maps.google.com/?q=R.+Santa+Terezinha+304+Centro+Paragominas+PA",
    },
    {
      name: "IOB - Instituto de Olhos da Bahia",
      city: "Belém",
      address: "Av. Generalíssimo Deodoro, 904 - Nazaré, Belém - PA",
      phone: "(91) 99999-9999",
      hours: "Conforme agenda",
      icon: Building2,
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.5!2d-48.4897!3d-1.4558!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMcKwMjcnMjAuOSJTIDQ4wrAyOSczMS4zIlc!5e0!3m2!1spt-BR!2sbr!4v1",
      mapsLink: "https://maps.google.com/?q=Av.+Generalissimo+Deodoro+904+Nazare+Belem+PA",
    },
    {
      name: "Vitria - Ed. Síntese 21",
      city: "Belém",
      address: "Av. Conselheiro Furtado, 2865 - Sobreloja, salas 08-10 - São Braz, Belém - PA",
      phone: "(91) 99999-9999",
      hours: "Conforme agenda",
      icon: Building2,
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.5!2d-48.4697!3d-1.4358!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMcKwMjYnMDguOSJTIDQ4wrAyOCcxMS4zIlc!5e0!3m2!1spt-BR!2sbr!4v1",
      mapsLink: "https://maps.google.com/?q=Av.+Conselheiro+Furtado+2865+Sao+Braz+Belem+PA",
    },
  ];

  const activeLocationData = locations[activeLocation];

  return (
    <section id="locais" className="py-24 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-4">
            Locais de atendimento
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Onde encontrar o Dr. Juliano
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Atendimento em clínicas e hospitais de referência em Paragominas e Belém para sua comodidade.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Location Cards */}
          <div className="space-y-4">
            {locations.map((location, index) => {
              const IconComponent = location.icon;
              return (
                <button
                  key={index}
                  onClick={() => setActiveLocation(index)}
                  className={`w-full text-left card-glass rounded-xl p-5 transition-all duration-300 ${
                    activeLocation === index
                      ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10"
                      : "hover:border-primary/30 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      activeLocation === index 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-primary/10 text-primary"
                    }`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold truncate transition-colors ${
                          activeLocation === index ? "text-primary" : "text-foreground"
                        }`}>
                          {location.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground shrink-0">
                          {location.city}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{location.address}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {location.hours}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Map and Details */}
          <div className="card-glass rounded-2xl overflow-hidden">
            {/* Map */}
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

            {/* Location Details */}
            <div className="p-6">
              <h3 className="text-xl font-bold text-foreground mb-4">
                {activeLocationData.name}
              </h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm">{activeLocationData.address}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm">{activeLocationData.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Clock className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm">{activeLocationData.hours}</span>
                </div>
              </div>

              <a
                href={activeLocationData.mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
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
