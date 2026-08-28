# Web Vitals reais no GA4

Como ligar a medicao de Core Web Vitals de pacientes reais ao GA4, e por que
isso importa mais neste site do que na maioria.

## Por que existe

O CrUX, que e a fonte de dado de campo que o Google usa, **nao tem dados deste
dominio**. Medido em 28/08/2026, quatro chamadas retornaram a mesma resposta:

    No CrUX data for this origin. The site likely has insufficient
    Chrome traffic volume for eligibility.

Sem CrUX, a unica medida disponivel e a simulacao de laboratorio do PageSpeed.
E o laboratorio **nao mede INP**, porque nao existe interacao real para medir.
Justamente o INP e o Core Web Vital de maior risco aqui, ja que `/agendamento`
tem formulario, selecao de data e escrita no banco.

Este caminho fecha a lacuna medindo no navegador de pacientes de verdade.

## O que ja esta pronto no codigo

`src/lib/webVitals.ts`, chamado uma vez em `src/main.tsx`. Ele registra os
observadores de LCP, INP, CLS, FCP e TTFB e empurra um evento `web_vitals` no
dataLayer a cada metrica que fecha.

Passa por `safeDataLayerPush`, entao respeita o consentimento LGPD e nao dispara
em rota administrativa.

Verificado em producao em 28/08/2026, com consentimento aceito:

    eventos no dataLayer: gtm.js, web_vitals, virtualPageview, ...
    web_vitals capturados: 5
        FCP  = 5020    | poor
        TTFB = 4116    | poor
        LCP  = 5020    | poor
        INP  = 32      | good
        CLS  = 0.004   | good

Os valores de LCP e FCP acima sao de navegador headless em partida fria, nao
representam o paciente. O que importa e que os cinco eventos saem.

## O que falta, e e manual

Os eventos chegam ao dataLayer e param ali. Consulta ao GA4 em 28/08/2026
mostrou 13 tipos de evento nos ultimos 28 dias, e `web_vitals` nao esta entre
eles. Outros eventos personalizados chegam normalmente, `whatsapp_click`,
`cta_click`, `lp_step_completed`, o que prova que o caminho dataLayer para GTM
para GA4 funciona.

**Falta a tag no GTM.** Sem ela, o GTM ve o evento e nao faz nada com ele.

### Passo 1: importar o container

Arquivo pronto em `docs/gtm-web-vitals-import.json`. Ele traz:

- 1 tag GA4 de evento, enviando para `G-79BDCX4R2L`
- 1 gatilho de evento personalizado, `web_vitals`
- 5 variaveis de dataLayer, uma por campo do evento

No GTM, em Administracao, Importar container. Escolher o arquivo, selecionar o
workspace, e usar **Mesclar** com **Renomear conflitos**. Nunca Substituir, que
apagaria as tags de agendamento e do Meta Pixel que ja existem no container.

Conferir no modo de visualizacao antes de publicar: abrir o site, aceitar
cookies, rolar a pagina, e ver o evento `web_vitals` disparando a tag.

### Passo 2: registrar as dimensoes no GA4

Sem este passo os eventos chegam mas os campos ficam invisiveis nos relatorios.
Em Administrador, Definicoes personalizadas:

| Nome | Tipo | Parametro | Escopo |
|---|---|---|---|
| metric_name | Dimensao | `metric_name` | Evento |
| metric_rating | Dimensao | `metric_rating` | Evento |
| metric_navigation_type | Dimensao | `metric_navigation_type` | Evento |
| metric_value | Metrica | `metric_value` | Evento, unidade padrao |

O `metric_id` nao precisa virar dimensao. Ele serve para deduplicar quando a
mesma metrica e reenviada, e so e util em analise exportada para o BigQuery.

## Como ler depois

Relatorio livre com `metric_name` na linha, media de `metric_value` na coluna, e
`metric_rating` como filtro. Os limiares oficiais que o proprio `web-vitals`
aplica em `metric_rating`:

| Metrica | Bom | Precisa melhorar | Ruim |
|---|---|---|---|
| LCP | ate 2,5 s | 2,5 a 4,0 s | acima de 4,0 s |
| INP | ate 200 ms | 200 a 500 ms | acima de 500 ms |
| CLS | ate 0,1 | 0,1 a 0,25 | acima de 0,25 |

## O que vigiar primeiro

**INP em `/agendamento`.** E a pagina com formulario, e a unica onde o trabalho
extra de thread principal introduzido pelo SSG poderia virar travamento
perceptivel. O laboratorio nunca vai mostrar isso.

Referencia de laboratorio medida em 28/08/2026, depois do SSG, para comparar
quando o dado de campo chegar:

| Rota | LCP | TBT |
|---|---|---|
| `/` | 2.630 ms | 288 ms |
| `/agendamento` | 2.918 ms | 0 ms |
| `/paragominas` | 3.078 ms | 0 ms |
| `/procedimentos/cirurgia-de-catarata` | 2.792 ms | 8 ms |

Se o INP de campo em `/agendamento` passar de 200 ms, o suspeito e o custo de
montagem do React por cima do HTML do SSG. A saida seria adiar a hidratacao de
partes nao interativas, nao remover o SSG.
