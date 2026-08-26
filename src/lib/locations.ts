// Fonte unica dos locais de atendimento (NAP: nome, endereco, telefone).
//
// Antes esses dados viviam duplicados: LocationsSection.tsx tinha as 4 unidades
// para exibicao e Index.tsx repetia 2 delas no JSON-LD. A divergencia fazia o
// dado estruturado declarar metade dos enderecos reais — e o Google reconcilia
// NAP entre schema e Google Business Profile, entao divergir ali custa
// relevancia local. Endereco ou telefone muda AQUI e so aqui.
//
// Nao confundir com localAtendimento.ts, que trata de agrupamento e cor de
// badge no CRM admin. Os slugs abaixo seguem a nomenclatura de la (clinicor,
// hgp, belem) para nao criar um terceiro esquema de nomes; a diferenca e que
// aqui Belem aparece nas duas unidades reais, em vez de agrupada.

export interface ClinicLocation {
  /** Identificador estavel, usado no @id do JSON-LD. Nao mudar sem migrar o schema. */
  slug: string;
  name: string;
  city: "Paragominas" | "Belém";
  /** Logradouro isolado, como schema.org espera em streetAddress. */
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  addressCountry: string;
  /** Endereco completo em uma linha, para exibicao na interface. */
  displayAddress: string;
  /** Telefone formatado para leitura humana. */
  phone: string;
  /** Mesmo telefone em E.164, exigido pelo schema.org. */
  phoneE164: string;
  mapsLink: string;
}

export const LOCATIONS: readonly ClinicLocation[] = [
  {
    slug: "clinicor",
    name: "Clinicor",
    city: "Paragominas",
    streetAddress: "Rua Eixo W1, R. Célio Miranda, N° 729",
    addressLocality: "Paragominas",
    addressRegion: "PA",
    addressCountry: "BR",
    displayAddress: "Rua Eixo W1, R. Célio Miranda, N° 729, Paragominas - PA",
    phone: "(91) 93618-0476",
    phoneE164: "+5591936180476",
    mapsLink:
      "https://maps.google.com/?q=Clinicor+Rua+Celio+Miranda+729+Paragominas+PA",
  },
  {
    slug: "hgp",
    name: "Hospital Geral de Paragominas",
    city: "Paragominas",
    streetAddress: "R. Santa Terezinha, 304 - Centro",
    addressLocality: "Paragominas",
    addressRegion: "PA",
    addressCountry: "BR",
    displayAddress: "R. Santa Terezinha, 304 - Centro, Paragominas - PA",
    phone: "(91) 9100-0303",
    phoneE164: "+559191000303",
    mapsLink:
      "https://maps.google.com/?q=Hospital+Geral+Paragominas+Santa+Terezinha+304",
  },
  {
    slug: "belem-iob",
    name: "Instituto de Olhos de Belém",
    city: "Belém",
    streetAddress: "Av. Generalíssimo Deodoro, 904 - Nazaré",
    addressLocality: "Belém",
    addressRegion: "PA",
    addressCountry: "BR",
    displayAddress: "Av. Generalíssimo Deodoro, 904 - Nazaré, Belém - PA",
    phone: "(91) 3239-4600",
    phoneE164: "+559132394600",
    mapsLink:
      "https://maps.google.com/?q=Instituto+de+Olhos+de+Belem+Av+Generalissimo+Deodoro+904+Nazare+Belem+PA",
  },
  {
    slug: "belem-vitria",
    name: "Vitria - Ed. Síntese 21",
    city: "Belém",
    streetAddress:
      "Av. Conselheiro Furtado, 2865 - Sobreloja, salas 08-10 - São Braz",
    addressLocality: "Belém",
    addressRegion: "PA",
    addressCountry: "BR",
    displayAddress:
      "Av. Conselheiro Furtado, 2865 - Sobreloja, salas 08-10 - São Braz, Belém - PA",
    phone: "(91) 3342-1463",
    phoneE164: "+559133421463",
    mapsLink:
      "https://maps.google.com/?q=Vitria+Ed+Sintese+21+Av+Conselheiro+Furtado+2865+Sao+Braz+Belem+PA",
  },
] as const;

export const BASE_URL = "https://drjulianomachado.com";

/** @id canonico do medico no grafo JSON-LD. */
export const PHYSICIAN_ID = `${BASE_URL}/#physician`;

/**
 * Monta um no MedicalClinic por endereco fisico.
 *
 * Uma entidade Physician com varios `address` e sintaticamente valida, mas o
 * Google associa horario, telefone e avaliacoes a UM local so — os demais ficam
 * invisiveis para busca local. Uma entidade por endereco resolve isso.
 *
 * Sem `geo` e `openingHoursSpecification` de proposito: nao existe dado real de
 * coordenada nem de horario no projeto (o campo hours da interface e o texto
 * "Agende para ver disponibilidade"). Inventar NAP e pior do que omitir.
 */
export function clinicNodes() {
  return LOCATIONS.map((l) => ({
    "@type": "MedicalClinic",
    "@id": `${BASE_URL}/#clinic-${l.slug}`,
    name: l.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: l.streetAddress,
      addressLocality: l.addressLocality,
      addressRegion: l.addressRegion,
      addressCountry: l.addressCountry,
    },
    telephone: l.phoneE164,
    areaServed: { "@type": "City", name: l.city },
    medicalSpecialty: "Ophthalmology",
    hasMap: l.mapsLink,
    physician: { "@id": PHYSICIAN_ID },
  }));
}

/** Cidades atendidas, sem repetir, na ordem em que aparecem em LOCATIONS. */
export function citiesServed(): string[] {
  return [...new Set(LOCATIONS.map((l) => l.city))];
}
