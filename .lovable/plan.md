

# Adicionar Google Analytics (G-T9ERC72SJE) ao site

## O que sera feito
Adicionar o script do Google Analytics com o ID **G-T9ERC72SJE** no arquivo `index.html` do projeto.

## Contexto atual
O `index.html` nao possui nenhum script de analytics instalado diretamente. O projeto ja tem um hook `useGoogleTag.ts` para eventos do DataLayer e documentacao mencionando outros IDs GA4 (G-79BDCX4R2L, G-380EGEFL1S), mas nenhum esta no HTML atualmente.

## Alteracao

### Arquivo: `index.html`
Adicionar os dois scripts do gtag.js dentro do `<head>`, antes do fechamento:

1. Script async carregando a biblioteca do gtag.js
2. Script inline configurando o `dataLayer` e o `gtag('config', 'G-T9ERC72SJE')`

Isso ativara o rastreamento automatico de pageviews e permitira que o hook `useGoogleTag.ts` existente envie eventos customizados para essa propriedade.

