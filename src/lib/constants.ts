// URL oficial para deixar avaliação no Google Business Profile
// do Dr. Juliano Machado - Oftalmologista (Paragominas).
// Validada em produção: abre direto o popup "Escrever avaliação".
export const GOOGLE_REVIEW_URL = "https://g.page/r/CTkTpXB1m13mEAE/review";

// Número real de avaliações do Google — usado em toda a interface
// para evitar inconsistência entre páginas. Atualizar conforme as
// avaliações reais crescem no perfil do Google Business.
export const GOOGLE_REVIEWS = {
  rating: 5.0,
  // 14 e a contagem real do pool sincronizado do Google. Estava em 10, e como o
  // hero usa esta constante enquanto a secao de depoimentos usa o pool, a mesma
  // pagina exibia 10 no topo e 14 mais abaixo.
  count: 14,
} as const;

// Identidade profissional — exibida no header/hero/rodapé.
export const DOCTOR = {
  name: "Dr. Juliano Machado",
  specialty: "Oftalmologista",
  crm: "CRM-PA 15253",
  yearsExperience: 15,
  yearsExperienceLabel: "Mais de 15 anos",
  yearsExperienceLong: "Mais de 15 anos de experiência",
  cities: "Paragominas e Belém",
  memberships: [
    "Sociedade Brasileira de Oftalmologia",
    "Sociedade Brasileira de Glaucoma",
  ],
} as const;

// Formacao academica e trajetoria. Fonte: Curriculo Lattes (CNPq), id K4525719A1.
// Ordem cronologica inversa — o mais recente e o mais relevante para o paciente.
export interface ItemFormacao {
  periodo: string;
  titulo: string;
  instituicao: string;
  /** Carga horaria ou observacao curta, quando houver. */
  detalhe?: string;
}

export const FORMACAO: readonly ItemFormacao[] = [
  {
    periodo: "2017 – 2019",
    titulo: "Fellowship em Glaucoma",
    instituicao: "Unidade Paulista de Oftalmologia (UPO)",
    detalhe: "1.980 horas",
  },
  {
    periodo: "2016 – 2017",
    titulo: "Glaucoma Clínico e Cirúrgico",
    instituicao: "Universidade Federal de São Paulo (UNIFESP)",
    detalhe: "360 horas",
  },
  {
    periodo: "2013 – 2016",
    titulo: "Residência Médica em Oftalmologia",
    instituicao: "Hospital Federal de Bonsucesso (HFB)",
  },
  {
    periodo: "2013 – 2016",
    titulo: "Pós-Graduação Lato Sensu",
    instituicao: "Universidade Estácio de Sá (UNESA)",
    detalhe: "2.090 horas",
  },
  {
    periodo: "2006 – 2012",
    titulo: "Graduação em Medicina",
    instituicao: "Centro Universitário do Estado do Pará (CESUPA)",
  },
] as const;

/** Instituicoes de formacao, para alumniOf no JSON-LD. Sem repetir. */
export const INSTITUICOES_FORMACAO = [
  "Unidade Paulista de Oftalmologia (UPO)",
  "Universidade Federal de São Paulo (UNIFESP)",
  "Hospital Federal de Bonsucesso (HFB)",
  "Universidade Estácio de Sá (UNESA)",
  "Centro Universitário do Estado do Pará (CESUPA)",
] as const;

// Areas de atuacao clinica. Alimentam knowsAbout no JSON-LD e a secao
// "Areas de atuacao" da pagina Sobre — mesma fonte, para o dado estruturado
// nunca declarar competencia que o texto visivel nao sustenta.
export const AREAS_CONHECIMENTO = [
  "Glaucoma",
  "Cirurgia de catarata",
  "Pterígio",
  "Capsulotomia YAG laser",
  "Campo visual",
  "Tomografia de coerência óptica (OCT)",
] as const;

// Perfis oficiais, para sameAs no JSON-LD. E como o Google reconcilia a
// entidade do site com o Google Business Profile e as redes.
//
// So entram URLs verificadas que respondem 200 e sao a pagina oficial. O
// Lattes (id K4525719A1) ficou de fora de proposito: a URL do buscatextual
// devolve captcha, e sameAs apontando para captcha nao prova nada.
export const PERFIS_SOCIAIS = [
  "https://www.instagram.com/drjulianomachado.oftalmo/",
  // Google Business Profile canonico (CID extraido do link g.page oficial).
  "https://www.google.com/maps?cid=16599594730260861753",
] as const;

// Revisao clinica do conteudo medico do site.
//
// Conteudo medico e YMYL: o Google avalia quem assina e quando foi revisado.
// schema.org tem propriedades proprias para isso — MedicalWebPage.lastReviewed
// e reviewedBy — e elas so podem ser emitidas quando a revisao de fato existe.
//
// Atualizar a data a cada nova revisao. Datar sem revisar e sinal falso.
export const REVISAO_CLINICA = {
  /** ISO 8601, formato exigido por lastReviewed. */
  data: "2026-08-26",
  /** Como a data aparece para o paciente. */
  dataLegivel: "26 de agosto de 2026",
  por: DOCTOR.name,
  crm: DOCTOR.crm,
} as const;
