import { MapPin, Phone, Clock } from "lucide-react";

const LocationsSection = () => {
  const locations = [
    {
      name: "Clinicor",
      city: "Paragominas",
      address: "Paragominas - PA",
      phone: "(91) 99999-9999",
      hours: "Seg a Sex, 8h às 18h",
    },
    {
      name: "Hospital Geral de Paragominas",
      city: "Paragominas",
      address: "HGP - Paragominas - PA",
      phone: "(91) 99999-9999",
      hours: "Conforme agenda",
    },
    {
      name: "IOB / Vitria",
      city: "Belém",
      address: "Belém - PA",
      phone: "(91) 99999-9999",
      hours: "Conforme agenda",
    },
  ];

  return (
    <section id="locais" className="py-24 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-wider">
            Locais de atendimento
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            Onde encontrar o Dr. Juliano
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Atendimento em clínicas e hospitais de referência para sua comodidade.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {locations.map((location, index) => (
            <div
              key={index}
              className="card-glass rounded-2xl p-8 hover:border-primary/50 transition-all duration-300 hover:-translate-y-2 group"
            >
              {/* Location badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <MapPin className="w-4 h-4" />
                {location.city}
              </div>

              <h3 className="text-xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors">
                {location.name}
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm">{location.address}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm">{location.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Clock className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm">{location.hours}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LocationsSection;
