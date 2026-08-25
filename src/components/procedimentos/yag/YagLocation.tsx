import { useEffect, useState } from "react";
import { MapPin, Phone, Navigation, Building2 } from "lucide-react";
import { buscarClinicaPorSlug } from "@/services/clinicas";
import { HGP_FALLBACK, HGP_SLUG } from "./yagContent";

/**
 * Bloco de local do procedimento — Hospital Geral de Paragominas.
 *
 * Nome, endereço e telefone vêm da tabela `clinicas` (slug "hgp"), para que
 * uma correção feita no /admin apareça aqui sem deploy. O fallback garante
 * que a seção nunca fique vazia se o banco não responder.
 *
 * O mapa só é montado no desktop, seguindo o mesmo critério do
 * LocationsSection (evita carregar iframe no celular).
 */
const YagLocation = () => {
  const [clinica, setClinica] = useState<{
    nome: string;
    endereco: string;
    telefone: string;
  }>({ ...HGP_FALLBACK });
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let ativo = true;
    buscarClinicaPorSlug(HGP_SLUG).then(({ data }) => {
      if (!ativo || !data) return;
      setClinica({
        nome: data.nome || HGP_FALLBACK.nome,
        endereco: data.endereco || HGP_FALLBACK.endereco,
        telefone: data.telefone || HGP_FALLBACK.telefone,
      });
    });
    return () => {
      ativo = false;
    };
  }, []);

  const consulta = `${clinica.nome}, ${clinica.endereco}`;
  const mapEmbedSrc = `https://www.google.com/maps?q=${encodeURIComponent(
    consulta,
  )}&z=16&hl=pt-BR&output=embed`;
  const mapsLink = `https://maps.google.com/?q=${encodeURIComponent(consulta)}`;

  return (
    <section
      aria-labelledby="local-titulo"
      className="card-glass rounded-2xl p-6 md:p-8"
    >
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/25 text-primary font-semibold text-base mb-5">
        <Building2 className="w-4 h-4" aria-hidden="true" />
        Novo local do procedimento
      </span>

      <h2
        id="local-titulo"
        className="text-2xl md:text-3xl font-bold text-foreground mb-3"
      >
        Onde o YAG Laser é realizado
      </h2>
      <p className="text-lg text-muted-foreground leading-relaxed mb-6">
        O procedimento passou a ser feito em Paragominas, no {clinica.nome}.
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        <ul className="space-y-5">
          <li className="flex items-start gap-3">
            <MapPin
              className="w-6 h-6 text-primary shrink-0 mt-1"
              aria-hidden="true"
            />
            <div>
              <p className="text-lg font-bold text-foreground">{clinica.nome}</p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {clinica.endereco}
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Phone
              className="w-6 h-6 text-primary shrink-0 mt-1"
              aria-hidden="true"
            />
            <div>
              <p className="text-lg font-bold text-foreground">
                Telefone do hospital
              </p>
              <a
                href={`tel:${clinica.telefone.replace(/\D/g, "")}`}
                className="text-lg text-primary underline underline-offset-2"
              >
                {clinica.telefone}
              </a>
            </div>
          </li>

          <li>
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 min-h-14 px-6 rounded-xl border-2 border-primary/50 text-primary text-lg font-bold hover:bg-primary/10 transition"
            >
              <Navigation className="w-5 h-5" aria-hidden="true" />
              Como chegar
            </a>
          </li>
        </ul>

        <div className="relative rounded-xl overflow-hidden border border-border/60 min-h-[260px] bg-secondary/30">
          {isDesktop ? (
            <iframe
              title={`Mapa - ${clinica.nome}`}
              src={mapEmbedSrc}
              className="absolute inset-0 w-full h-full"
              style={{
                border: 0,
                filter:
                  "invert(0.92) hue-rotate(180deg) saturate(0.85) brightness(0.95)",
              }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <div>
                <MapPin
                  className="w-9 h-9 text-primary mx-auto mb-3"
                  aria-hidden="true"
                />
                <p className="text-lg text-muted-foreground">
                  {clinica.endereco}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default YagLocation;
