

# Adicionar GA4 Property G-79BDCX4R2L

## Contexto

O site já possui GA4 (`G-T9ERC72SJE`) e Google Ads (`AW-979714971`) configurados no `index.html`. O arquivo enviado contém uma segunda property GA4: `G-79BDCX4R2L`.

## Alteração

### `index.html` (1 linha)

Adicionar `gtag('config', 'G-79BDCX4R2L');` ao bloco de configuração existente (após linha 30). Não é necessário adicionar outro script tag — o gtag.js já carregado suporta múltiplas properties.

```html
gtag('config', 'G-T9ERC72SJE');
gtag('config', 'AW-979714971');
gtag('config', 'G-79BDCX4R2L');  <!-- Nova property GA4 -->
```

Todos os eventos existentes (dataLayer.push e gtag conversion calls) serão automaticamente enviados para ambas as properties GA4.

