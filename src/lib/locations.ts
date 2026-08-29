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
  /**
   * CEP. O Google espera este campo em negocio local e ele estava ausente nos
   * quatro enderecos ate 29/08/2026.
   *
   * De onde vieram: tres sairam da geocodificacao do proprio Google, lidos nos
   * perfis do Google Business Profile depois de criados. O da Clinicor veio da
   * base dos Correios e foi confirmado pelo medico.
   *
   * Note que o Google e os Correios discordam de bairro em dois casos, em Belem.
   * O CEP e que vale, o bairro fica como esta.
   */
  postalCode: string;
  /**
   * Coordenadas do ponto, lidas do Google Maps em 29/08/2026.
   *
   * A do Hospital Geral saiu do proprio perfil do medico no Google Business
   * Profile, entao e o pino que ele ja mantem. As outras tres vieram da
   * resolucao de endereco do Maps.
   *
   * Isto NAO substitui o perfil. O Google posiciona o negocio pelo perfil, nao
   * por este campo. Ele serve para quem le o dado estruturado sem consultar o
   * Maps, como assistente de IA respondendo "qual o mais perto de mim".
   */
  latitude: string;
  longitude: string;
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
    postalCode: "68625-050",
    latitude: "-3.0013246",
    longitude: "-47.3549239",
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
    postalCode: "68625-080",
    latitude: "-2.9927566",
    longitude: "-47.3552377",
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
    postalCode: "66055-240",
    latitude: "-1.4487456",
    longitude: "-48.4829544",
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
    postalCode: "66025-160",
    latitude: "-1.4559713",
    longitude: "-48.4732988",
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
 *
 * `city` filtra as unidades. Pagina de cidade so deve declarar os enderecos que
 * ela de fato exibe — /belem emitindo a Clinicor de Paragominas seria dado
 * estruturado divergindo do que esta na tela. Os @id continuam ancorados em
 * BASE_URL, entao e a MESMA entidade que a home referencia, nao uma copia.
 */
/**
 * Endereco de uma unidade no formato que o schema.org espera.
 *
 * POR QUE EXISTE: os campos de endereco eram montados a mao em tres lugares,
 * aqui, no physicianNode de lib/schema.ts e no no Hospital da capsulotomia YAG.
 * Acrescentar o postalCode em 29/08/2026 exigiu tres edicoes coordenadas para
 * um campo so, que e exatamente o custo que a fonte unica de NAP deveria
 * eliminar. O proximo campo, geo, repetiria a conta.
 *
 * FICA NESTE ARQUIVO E NAO EM schema.ts de proposito: locations.ts nao importa
 * nada, e schema.ts importa dele. O contrario criaria import circular.
 */
export function postalAddressNode(local: ClinicLocation) {
  return {
    "@type": "PostalAddress",
    streetAddress: local.streetAddress,
    addressLocality: local.addressLocality,
    addressRegion: local.addressRegion,
    addressCountry: local.addressCountry,
    postalCode: local.postalCode,
  };
}

/** Coordenadas no formato do schema.org. Mesmo motivo do postalAddressNode. */
export function geoNode(local: ClinicLocation) {
  return {
    "@type": "GeoCoordinates",
    latitude: local.latitude,
    longitude: local.longitude,
  };
}

export function clinicNodes(city?: ClinicLocation["city"]) {
  const unidades = city ? LOCATIONS.filter((l) => l.city === city) : LOCATIONS;
  return unidades.map((l) => ({
    "@type": "MedicalClinic",
    "@id": `${BASE_URL}/#clinic-${l.slug}`,
    name: l.name,
    address: postalAddressNode(l),
    geo: geoNode(l),
    telephone: l.phoneE164,
    areaServed: { "@type": "City", name: l.city },
    medicalSpecialty: "Ophthalmology",
    hasMap: l.mapsLink,
    physician: { "@id": PHYSICIAN_ID },
  }));
}

/**
 * Unidade por slug, lancando quando nao existe.
 *
 * POR QUE LANCA, em vez de devolver undefined: os slugs sao literais deste
 * arquivo, entao chamador que passa slug valido nunca recebe undefined na
 * pratica, mas o tipo obriga cada um a tratar um ramo que nunca acontece. O
 * resultado foi ternario morto no JSON-LD da capsulotomia YAG.
 *
 * ATENCAO ao alcance do throw: ele NAO derruba o build. O scripts/ssg.mjs
 * envolve cada rota em try/catch e apenas empurra a rota para "puladas",
 * saindo com codigo 0. Quem transforma isso em alarme e o monitor, que desde
 * 28/08/2026 falha quando "puladas" nao esta vazio. Lancar aqui garante que a
 * pagina nao seja publicada com schema pela metade, nao que alguem perceba na
 * hora.
 */
export function localPorSlug(slug: string): ClinicLocation {
  const encontrado = LOCATIONS.find((l) => l.slug === slug)
  if (!encontrado) {
    throw new Error("Unidade sem cadastro em LOCATIONS: " + slug)
  }
  return encontrado
}

/** Cidades atendidas, sem repetir, na ordem em que aparecem em LOCATIONS. */
export function citiesServed(): string[] {
  return [...new Set(LOCATIONS.map((l) => l.city))];
}
