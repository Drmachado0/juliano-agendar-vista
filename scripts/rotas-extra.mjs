/**
 * Rotas publicas que NAO entram no sitemap e ainda assim precisam de HTML.
 *
 * As duas listas respondem a perguntas diferentes:
 *
 *   public/sitemap.xml  = o que eu quero que o Google indexe
 *   este arquivo        = o que precisa existir em HTML para quem nao executa JS
 *
 * Ate 28/08/2026 a lista era uma so, o sitemap, e a auditoria daquele dia
 * mostrou o preco. /paragominas/agendamento pede noindex de proposito, e um
 * funil de agendamento e nao pagina de conteudo. So que sem HTML proprio ela
 * caia no fallback da SPA, que desde o SSG e a home inteira. Resultado: a rota
 * que pede noindex era servida como copia indexavel da home, com index,follow.
 * A intencao chegava invertida.
 *
 * Nao coloque rota noindex no sitemap para resolver isso. Sitemap com URL
 * noindex e sinal contraditorio e o Google reclama. Coloque aqui.
 *
 * /agendar e /agendar-consulta ENTRARAM em 29/08/2026, depois de ficarem de
 * fora. O motivo da exclusao era que elas nao sao paginas, sao redirects, e o
 * lugar certo delas seria um 301 de servidor.
 *
 * Esse 301 nao existe e nao vai existir tao cedo: o Cloudflare no caminho e da
 * Lovable, nao do medico. Os nameservers do dominio sao da Hostinger, ns1 e
 * ns2.dns-parking.com, entao nao ha painel onde criar a regra.
 *
 * Sem HTML proprio elas caiam no fallback da SPA e serviam a home inteira, com
 * index,follow. Com HTML proprio elas servem o noindex e o canonical que o
 * RedirectToAgendamento em src/App.tsx emite. Nao e um 301, mas resolve o que
 * o 301 resolveria para busca.
 *
 * POR QUE ESTE ARQUIVO EXISTE, EM VEZ DE UM const DENTRO DO ssg.mjs: o
 * src/test/rotasComHtml.test.ts precisa da mesma lista para garantir que nenhuma
 * rota do App.tsx fique sem HTML. Ele lia a constante do ssg.mjs por expressao
 * regular, e reformatar o const quebraria o guarda sem quebrar o build. Dado
 * puro, importado pelos dois, nao tem esse problema.
 *
 * CUIDADO AO CRESCER ESTA LISTA. Ela e paliativo, nao solucao. O problema geral
 * e que URL desconhecida serve a home com 200 e index,follow, e isso se resolve
 * com uma regra de 404 no host, nao aqui. Enquanto essa regra nao existe, cada
 * entrada nova aqui tapa um buraco especifico. Se a lista comecar a crescer,
 * pare e resolva o geral.
 */
export const ROTAS_EXTRA = [
  "/paragominas/agendamento",
  "/obrigado",
  "/auth",
  "/agendar",
  "/agendar-consulta",
]
