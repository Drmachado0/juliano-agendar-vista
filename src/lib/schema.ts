// Fonte unica do grafo JSON-LD do site.
//
// POR QUE ESTE ARQUIVO EXISTE: o no Physician estava escrito tres vezes — na
// home, em /sobre e em /agendamento — e as tres versoes divergiam:
//
//   - /agendamento nao declarava @id, entao para o Google era um SEGUNDO
//     medico, com dois dos quatro enderecos hardcoded no proprio arquivo;
//   - o identifier saia como {CRM, "CRM-PA 15253"} na home e
//     {CRM-PA, "15253"} em /agendamento, dois formatos para o mesmo registro;
//   - alumniOf e knowsAbout so existiam em /sobre, fora da pagina mais forte;
//   - url apontava para a home num arquivo e para /sobre no outro, com o
//     MESMO @id — a mesma entidade declarando dois enderecos canonicos.
//
// O Google reconcilia entidades por @id. Divergir ali nao e detalhe de estilo:
// e fragmentar o profissional em duas pessoas e entregar sinal conflitante
// sobre qual pagina o representa. Endereco, telefone, CRM e formacao mudam
// AQUI (ou em constants.ts / locations.ts) e so aqui.

import {
  DOCTOR,
  AREAS_CONHECIMENTO,
  PERFIS_SOCIAIS,
  INSTITUICOES_FORMACAO,
  REVISAO_CLINICA,
} from "@/lib/constants";
import {
  LOCATIONS,
  BASE_URL,
  PHYSICIAN_ID,
  clinicNodes,
  citiesServed,
} from "@/lib/locations";

export const WEBSITE_ID = `${BASE_URL}/#website`;

export interface PhysicianNodeOpts {
  /**
   * Telefone em E.164 sem o "+". Vem do site_config via useSiteWhatsApp para a
   * pagina acompanhar a troca de numero no admin. Sem valor, cai no telefone
   * da primeira unidade — o mesmo que a interface ja mostra.
   */
  telephoneRaw?: string;
  /** Nota e total reais do Google. Omitir quando a pagina nao exibe avaliacao. */
  rating?: { rating: number; count: number };
  /**
   * URL da pagina que descreve a entidade. Note que NAO e `url`: `url` e sempre
   * a home, porque e o endereco canonico do profissional. mainEntityOfPage e o
   * jeito correto de dizer "esta pagina aqui fala dele".
   */
  mainEntityOfPage?: string;
}

/**
 * No canonico do medico. Sempre com o mesmo @id, em qualquer pagina.
 *
 * O `address` no proprio Physician existe porque Physician e subtipo de
 * LocalBusiness e o Google exige address no negocio local — sem ele o no fica
 * inelegivel para o resultado local. Usa a primeira unidade, a mesma de onde
 * sai o telefone padrao; os outros tres enderecos vivem nos MedicalClinic
 * ligados por workLocation, cada um com o seu proprio telefone.
 */
export function physicianNode(opts: PhysicianNodeOpts = {}) {
  const principal = LOCATIONS[0];
  const telefone = opts.telephoneRaw
    ? `+${opts.telephoneRaw}`
    : principal.phoneE164;

  return {
    "@type": "Physician",
    "@id": PHYSICIAN_ID,
    name: DOCTOR.name,
    description:
      "Oftalmologista especializado em catarata, pterígio, exames de campo visual e OCT. Atendimento em Paragominas e Belém.",
    // "Ophthalmology" nao pertence a enumeracao MedicalSpecialty do schema.org
    // (que so tem Optometric, profissao diferente). Fica como texto livre de
    // proposito: o Google aceita, e trocar por Optometric seria declarar o
    // profissional como optometrista.
    medicalSpecialty: "Ophthalmology",
    url: BASE_URL,
    ...(opts.mainEntityOfPage ? { mainEntityOfPage: opts.mainEntityOfPage } : {}),
    image: `${BASE_URL}/og-image.jpg`,
    telephone: telefone,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: principal.streetAddress,
      addressLocality: principal.addressLocality,
      addressRegion: principal.addressRegion,
      addressCountry: principal.addressCountry,
    },
    identifier: {
      "@type": "PropertyValue",
      propertyID: "CRM",
      value: DOCTOR.crm,
    },
    alumniOf: INSTITUICOES_FORMACAO.map((nome) => ({
      "@type": "CollegeOrUniversity",
      name: nome,
    })),
    memberOf: DOCTOR.memberships.map((m) => ({
      "@type": "Organization",
      name: m,
    })),
    knowsAbout: [...AREAS_CONHECIMENTO],
    areaServed: citiesServed().map((c) => ({ "@type": "City", name: c })),
    ...(opts.rating
      ? {
          // ratingCount = total EXATO, exigido pelo Google
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: String(opts.rating.rating),
            bestRating: "5",
            ratingCount: String(opts.rating.count),
          },
        }
      : {}),
    workLocation: clinicNodes().map((c) => ({ "@id": c["@id"] })),
    sameAs: [...PERFIS_SOCIAIS],
  };
}

/** No do site. Ancora publisher/isPartOf sem repetir o objeto em cada pagina. */
export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "Dr. Juliano Machado — Oftalmologista",
    url: BASE_URL,
    inLanguage: "pt-BR",
    publisher: { "@id": PHYSICIAN_ID },
  };
}

export interface MedicalWebPageOpts {
  name: string;
  description: string;
  url: string;
}

/**
 * Pagina de conteudo medico.
 *
 * lastReviewed e reviewedBy sao as propriedades que o Google le para saber
 * quem assina conteudo YMYL e quando foi revisado. A data vem de
 * REVISAO_CLINICA — datar sem revisar e sinal falso.
 */
export function medicalWebPageNode(opts: MedicalWebPageOpts) {
  return {
    "@type": "MedicalWebPage",
    "@id": `${opts.url}#webpage`,
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inLanguage: "pt-BR",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": PHYSICIAN_ID },
    mainEntity: { "@id": PHYSICIAN_ID },
    audience: { "@type": "MedicalAudience", audienceType: "Patient" },
    lastReviewed: REVISAO_CLINICA.data,
    reviewedBy: {
      "@type": "Physician",
      "@id": PHYSICIAN_ID,
      name: REVISAO_CLINICA.por,
      identifier: {
        "@type": "PropertyValue",
        propertyID: "CRM",
        value: REVISAO_CLINICA.crm,
      },
    },
  };
}

/**
 * FAQ. So deve ser chamada com perguntas que existem VISIVEIS na pagina —
 * por isso recebe o mesmo array que o componente renderiza, em vez de uma
 * copia. Marcar FAQ que o usuario nao ve e violacao de diretriz.
 */
export function faqPageNode(
  faqs: readonly { question: string; answer: string }[],
  url: string
) {
  return {
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}
