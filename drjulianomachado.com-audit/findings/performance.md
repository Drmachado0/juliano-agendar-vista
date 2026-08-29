# Performance e Core Web Vitals, drjulianomachado.com

Data da coleta de laboratório, 2026-08-28 (mesmo dia da virada para SSG com renderToPipeableStream).
Fonte, `claude-seo run pagespeed_check.py`, `crux_history.py`, `lcp_subparts.py` e `preload_check.py`, mais leitura direta do HTML servido em produção.

## Nota geral de performance, 74/100

Justificativa. Desktop já é excelente em todas as páginas testadas (LCP 0,7s, TBT baixo, CLS zero). O SSG resolveu o TTFB de origem, que hoje está entre 5ms e 10ms nas três páginas. O ponto que segura a nota é o mobile, o LCP mobile não bate a meta "boa" de 2,5s em nenhuma das três páginas testadas, o pior caso é a home com 3,9s. O campo (CrUX) ainda mostra "ruim", mas essa leitura é histórica, pré-SSG, e está detalhada abaixo com data.

## Pergunta central, a mudança de hoje melhorou o LCP de laboratório

Sim, no laboratório. Antes da virada a casca servida tinha 9,8 KB e nada pintava antes do JS rodar. Hoje o documento HTML devolvido pelo servidor já vem com o conteúdo, 29,4 KB comprimidos (mobile) na primeira resposta, contra os 9,8 KB de casca vazia de ontem. O tempo de resposta de origem caiu para a casa de um dígito de milissegundos (9ms mobile, 10ms desktop na home). O LCP de laboratório da home mobile hoje é 3,9s, needs improvement, não mais na faixa poor de 4s ou mais que o campo registrou. O campo ainda não mostra essa melhora porque a janela de dados mais recente do CrUX termina antes da mudança entrar no ar, isso é esperado e está detalhado na seção de campo.

## Lab vs Campo, com datas

### Laboratório, Lighthouse via PSI, coletado em 2026-08-28

| Página | Dispositivo | Performance | LCP | FCP | TBT (proxy de INP) | CLS | Speed Index | TTFB de origem |
|---|---|---|---|---|---|---|---|---|
| / | Mobile | 76 | 3,9s | 2,3s | ~70ms | 0,001 | 9,8s | 9ms |
| / | Desktop | 96 | 0,7s | 0,5s | ~10ms | 0 | 2,1s | 10ms |
| /paragominas | Mobile | 83 | 3,2s | 2,3s | 0ms | ~0 | 8,1s | 9ms |
| /paragominas | Desktop | 100 | 0,7s | 0,6s | 10ms | 0,002 | 0,8s | 7ms |
| /procedimentos/cirurgia-de-catarata | Mobile | 89 | 2,8s | 2,0s | ~0ms | 0,013 | 6,0s | 7ms |
| /procedimentos/cirurgia-de-catarata | Desktop | 100 | 0,7s | 0,5s | 0ms | 0 | 0,6s | 5ms |

Leitura, nenhuma das três páginas bate a meta "boa" de LCP no mobile (2,5s). Nenhuma chega a "ruim" (4s) hoje. TBT, CLS e TTFB de laboratório já estão todos na faixa boa em todas as páginas. Speed Index mobile é o outro sinal de alerta, 6 a 9,8s, puxado pelo hero pesado da home.

### Campo, CrUX History API, nível de origem (drjulianomachado.com)

Tentativa de CrUX por página falhou para as três URLs testadas, "No CrUX data for this URL, insufficient Chrome traffic volume". Só existe série histórica no nível de origem, com dados esparsos por baixo volume de tráfego.

| Métrica | p75 na última janela completa | Janela | Classificação |
|---|---|---|---|
| LCP | 4.132ms | 2026-07-05 a 2026-08-01 | Ruim (meta boa, até 2.500ms) |
| FCP | 3.527ms | 2026-07-05 a 2026-08-01 | Ruim (meta boa, até 1.800ms) |
| TTFB (experimental) | 2.056ms | 2026-07-05 a 2026-08-01 | Ruim (meta boa, até 800ms) |
| CLS | 0,00 | 2026-07-05 a 2026-08-01 | Bom |
| INP | sem dado em nenhuma das 25 semanas coletadas | - | Volume insuficiente |

Atenção, essa é a última janela de 28 dias com dado completo. As três janelas seguintes, terminando em 08/08, 15/08 e 22/08, vieram vazias por volume insuficiente de tráfego. A consulta ao registro atual de 28 dias (a mesma que a PSI e o `lcp_subparts.py` usam) devolveu 404, "chrome ux report data not found", tanto para a home quanto para a origem, hoje 28/08. Ou seja, o campo não tem, neste momento, nenhum ponto de dado que cubra os dias em que o SSG já estava no ar. Não confundir o 4.132ms acima com o estado atual do site, é o retrato de antes da mudança.

## Quebra do LCP em subpartes (CrUX)

Não medido. `lcp_subparts.py` usa `queryRecord`, que exige o registro atual de 28 dias, e esse registro devolveu 404 tanto para a home quanto para a origem pelo mesmo motivo acima, tráfego insuficiente na janela corrente. Não há hoje uma decomposição de campo em TTFB, atraso de carregamento, tempo de carregamento e atraso de renderização para este site. Quando houver volume suficiente, repetir esta consulta é o próximo passo natural para confirmar em campo o que o laboratório já mostra.

## Caminho crítico e preload

`preload_check.py` na home, nota 75/100. Sem regras de especulação (prefetch ou prerender), isso custou 25 pontos. Sinal de LCP via `fetchpriority="high"` presente, sem bloqueadores de bfcache, sem `rel=prerender` obsoleto.

Inspeção direta do HTML servido hoje:

- `modulepreload` na home, apenas dois arquivos, `react` (59,4 KB gzip) e `query` (react-query, cerca de 13,5 KB gzip). Não há mais modulepreload do cliente Supabase na home. Isso bate com o que o coordenador reportou, commit 41a8839 (import dinâmico do Supabase) e 811df9d (AuthProvider restrito a rotas autenticadas), o Supabase saiu da fila de alta prioridade.
- Apesar disso, o bundle do Supabase ainda é baixado e executado na home hoje, `client-Ctbgh5k7.js`, 46,7 KB gzip, com 36,2 KB (78%) marcados como código não usado nesta página pelo relatório de JavaScript não utilizado. Ele só não compete mais pela prioridade de rede logo na largada, mas o peso na rede continua.
- CSS bloqueante de renderização, `index-BPJj1o1D.css`, 27,5 KB gzip, estimativa de atraso de 492ms no mobile e 56ms no desktop.
- Dois preloads de fonte, `archivo-latin.woff2` (35,7 KB) e `inter-latin.woff2` (48,7 KB), somando cerca de 84,4 KB gzip.
- Script de entrada `index-D2dWpOjl.js`, `type="module"`, 113,3 KB gzip, não bloqueia a pintura porque o HTML já chega pintado pelo SSG, mas ainda é o maior item de JavaScript da página.
- Somando os itens que efetivamente disputam banda na largada (dois modulepreloads, dois preloads de fonte, o CSS bloqueante e o script de entrada), o total gira em torno de 298 KB gzip hoje, mais alto em bytes brutos do que os 258,6 KB citados como estado anterior. A leitura correta não é "ficou mais leve", é "o Supabase saiu da fila de alta prioridade", o peso total da home não caiu, a prioridade de quem disputa a largada mudou.

## Imagem do LCP

O elemento provável de LCP na home é o retrato do Dr. Juliano, `<img>` em WebP, arquivo `dr-juliano-hero-BvBWiQwP.webp` (variante 900w, 62.634 bytes), com `srcset` (540w e 900w), `sizes`, `width="368"` `height="480"`, `loading="eager"` e `fetchpriority="high"`. Essa imagem tem srcset, o que contradiz uma suposição de que nenhuma imagem do site tem srcset, ao menos neste elemento não é o caso, e vale conferir a fonte dessa suposição.

Não há `<link rel="preload" as="image">` explícito para essa imagem, só o hint de `fetchpriority` no próprio `<img>`. O Lighthouse reprova o audit `lcp-discovery-insight` em mobile e desktop, sinal de que um preload explícito ainda ajudaria.

No mobile, o relatório de entrega de imagem aponta 54.939 bytes desperdiçados dos 62.634 do arquivo 900w, 87%, indício de que o navegador está baixando a variante maior quando o layout mobile provavelmente pede a variante 540w.

O vídeo do consultório usa `preload="none"`, correto, não é o elemento de LCP.

Sobre a hero de `/agendamento`, relatada pelo coordenador como JPG de 122.380 bytes, com `loading="lazy"` e sem `width` ou `height`, não verifiquei essa página diretamente nesta bateria de testes. Se confirmado, `loading="lazy"` no elemento de LCP é um problema sério, o navegador só descobre o recurso depois do layout, atrasando a pintura, e a ausência de `width` e `height` favorece CLS. Fica marcado como achado a confirmar, não medido por mim.

## Achados por severidade

### Crítico

1. Imagem de LCP mobile na home baixando a variante 900w quando a tela provavelmente precisa da 540w, 55 KB desperdiçados, contribui direto para os 3,9s de LCP mobile.
2. CSS bloqueante de 27,5 KB atrasando a pintura em até 492ms no mobile.
3. Hero de `/agendamento` relatada com `loading="lazy"` e sem dimensões no elemento de LCP, a confirmar, se verdadeiro é o pior caso de todos porque atrasa a descoberta do próprio recurso de LCP.

### Médio

4. Falta de `<link rel="preload" as="image" fetchpriority="high">` explícito para o retrato do Dr. Juliano, mesmo com `fetchpriority` no `<img>`.
5. `client-Ctbgh5k7.js` (Supabase) ainda baixa 46,7 KB com 78% de código não usado na home, mesmo fora da fila de alta prioridade.
6. Ausência de Speculation Rules, prefetch ou prerender, 25 pontos perdidos no `preload_check.py`.

### Baixo, ruído que não muda a agulha agora

7. CLS já é bom em todas as páginas testadas, 0 a 0,013.
8. TBT (proxy de INP) já é bom em laboratório, 0 a 70ms, bem abaixo de 200ms.
9. TTFB de origem já é ótimo, 5 a 10ms, o SSG resolveu esse ponto.

## Não medido

- Quebra do LCP em subpartes de campo (TTFB, atraso de carregamento, tempo de carregamento, atraso de renderização), CrUX sem registro atual de 28 dias.
- INP de campo, nenhuma das 25 janelas semanais coletadas tem esse dado.
- CrUX por página para `/paragominas` e `/procedimentos/cirurgia-de-catarata`, 404 por volume insuficiente no nível de URL.
- Estado real da hero de `/agendamento`, citado pelo coordenador, não inspecionado por mim nesta sessão.
- Efeito do SSG no campo, a janela de campo disponível é inteiramente anterior à mudança de hoje.

## O que muda a agulha vs o que é ruído

Muda a agulha, o par imagem de LCP mobile mais CSS bloqueante, juntos respondem por boa parte da distância entre os 3,9s atuais e a meta de 2,5s. Servir a variante 540w no mobile e adicionar preload explícito da imagem de LCP são as duas ações de maior retorno imediato. Confirmar e corrigir a hero de `/agendamento` é prioridade equivalente, se o relato do coordenador se confirmar.

É ruído neste momento, perseguir o peso total de JavaScript (298 KB gzip) como se fosse o problema central. O Supabase já saiu do caminho de alta prioridade, reduzir ainda mais o peso bruto do bundle é ganho marginal comparado ao ganho de corrigir a imagem de LCP e o CSS bloqueante. Também é ruído tratar o número de campo de 4.132ms como estado atual, ele descreve a arquitetura antiga.
