import dados from '@/data/guia/artigos.json';

export const GUIA_ARTIGOS = dados.filter(a => a.estado === 'publicado' && a.revisao_medica?.crm);
export type GuiaArtigo = (typeof GUIA_ARTIGOS)[number];
export const GUIA_CATEGORIAS = ['Todos', ...new Set(GUIA_ARTIGOS.map(a => a.categoria))];
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function filtrarArtigos(busca: string, categoria: string): GuiaArtigo[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  return GUIA_ARTIGOS.filter(a => (categoria === 'Todos' || a.categoria === categoria)
    && termos.every(t => normalizar(a.titulo + ' ' + a.descricao + ' ' + a.categoria).includes(t)));
}

export const TITULOS_SERVICOS: Record<string, string> = {
  '/procedimentos': 'Exames e procedimentos',
  '/procedimentos/consulta-oftalmologica': 'Consulta oftalmológica completa',
  '/procedimentos/cirurgia-de-catarata': 'Cirurgia de catarata',
  '/procedimentos/capsulotomia-yag-laser': 'Tratamento com YAG laser',
  '/procedimentos/glaucoma': 'Tratamento do glaucoma',
};

export function tituloRelacionado(url: string): string {
  return TITULOS_SERVICOS[url] ?? GUIA_ARTIGOS.find(a => '/guia/' + a.slug === url)?.titulo ?? 'Saiba mais';
}
