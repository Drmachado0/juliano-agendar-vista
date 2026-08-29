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

export interface BreadcrumbItem {
  name: string;
  /** URL absoluta. O Google descarta a trilha inteira se um item for relativo. */
  url: string;
}

/**
 * Trilha de navegacao.
 *
 * Ate 28/08/2026 so as paginas de procedimento e o indice tinham BreadcrumbList.
 * /sobre, /belem, /paragominas e /agendamento ficavam sem, e sem ela o Google
 * exibe a URL crua no resultado em vez do caminho legivel.
 *
 * Estas quatro sao paginas de primeiro nivel, entao a trilha tem dois degraus.
 * Nao invente um nivel intermediario que nao existe como pagina. Uma trilha que
 * aponta para URL inexistente e pior que trilha nenhuma.
 */
export function breadcrumbNode(
  items: readonly BreadcrumbItem[],
  pageUrl: string
) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface ProcedureGraphOpts {
  /** URL canonica da pagina do procedimento. */
  url: string;
  pageTitle: string;
  metaDescription: string;
  procedureName: string;
  faqs: readonly { question: string; answer: string }[];
  /** Default: TherapeuticProcedure. */
  procedureType?: string;
  /** Default: Olho. */
  bodyLocation?: string;
  /**
   * Local exclusivo do procedimento. So use quando ele nao for feito em todas
   * as unidades, senao o lugar da informacao e o workLocation do Physician.
   */
  location?: Record<string, unknown>;
}

/**
 * Grafo completo de uma pagina de procedimento.
 *
 * POR QUE ISTO E UMA FUNCAO, E NAO ESTA NO ProcedurePageLayout: dez das doze
 * paginas usam aquele layout, mas a de capsulotomia YAG nao usa, ela tem
 * estrutura propria. Ate 29/08/2026 as duas montavam o mesmo grafo de seis nos
 * a mao, e a correcao de 28/08, que ligou performer e reviewedBy ao no canonico
 * do medico, precisou ser escrita duas vezes. A proxima correcao de schema
 * teria o mesmo risco: acertar num arquivo e esquecer o outro.
 *
 * O ponto de reuso tem que ser esta lib justamente porque a YAG nao usa o
 * layout. Forcar a YAG dentro do layout exigiria props de escape que deixariam
 * o layout mais raso para as outras dez.
 */
export function procedureGraph(opts: ProcedureGraphOpts) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      physicianNode({ mainEntityOfPage: opts.url }),
      websiteNode(),
      medicalWebPageNode({
        name: opts.pageTitle,
        description: opts.metaDescription,
        url: opts.url,
      }),
      breadcrumbNode(
        [
          { name: "Início", url: `${BASE_URL}/` },
          { name: "Procedimentos", url: `${BASE_URL}/procedimentos` },
          { name: opts.procedureName, url: opts.url },
        ],
        opts.url,
      ),
      {
        "@type": "MedicalProcedure",
        "@id": `${opts.url}#procedure`,
        name: opts.procedureName,
        procedureType:
          opts.procedureType || "https://schema.org/TherapeuticProcedure",
        bodyLocation: opts.bodyLocation || "Olho",
        description: opts.metaDescription,
        url: opts.url,
        // Referencia ao no canonico, em vez de repetir nome e especialidade.
        performer: { "@id": PHYSICIAN_ID },
        ...(opts.location ? { location: opts.location } : {}),
      },
      faqPageNode(opts.faqs, opts.url),
    ],
  };
}
