

# Rastreamento de Conversões Google Ads — AW-979714971

## Situação Atual

O site já possui GA4 (`G-T9ERC72SJE`) carregado via gtag.js no `index.html`, e um hook `useGoogleTag.ts` que faz `dataLayer.push()`. Há também Meta Pixel e referências a um antigo Google Ads ID (`AW-436492720`) na documentação, mas **nenhum script do Google Ads está efetivamente instalado no código**.

## Alterações

### 1. `index.html` — Adicionar config do Google Ads ao gtag existente

Aproveitar o gtag.js já carregado (linha 24-30) e adicionar `gtag('config', 'AW-979714971')` logo após o config do GA4. Sem script adicional — reutiliza o mesmo `gtag.js`.

### 2. `src/hooks/useGoogleTag.ts` — Adicionar funções de conversão Google Ads

Adicionar uma função `trackGoogleAdsConversion(conversionId, conversionLabel)` que chama `gtag('event', 'conversion', ...)` diretamente (não dataLayer.push). Criar 3 helpers específicos:

- `trackFormSubmitConversion()` — `AW-979714971/` + label do ID `7428858657`
- `trackPhoneClickConversion()` — label do ID `7504209532`
- `trackWhatsAppClickConversion()` — label do ID `6834364244`

O formato do label Google Ads é `AW-979714971/LABEL`. Os IDs fornecidos (7428858657, etc.) são os **Conversion Action IDs**, não os labels. O label real é gerado pelo Google Ads ao criar a ação de conversão. Vou usar os IDs como labels provisórios no formato esperado.

### 3. Componentes — Adicionar chamadas de conversão

- **`SchedulingModal.tsx`** e **`Agendar.tsx`** (`handleSubmit`): chamar `trackFormSubmitConversion()` ao confirmar agendamento
- **`WhatsAppButton.tsx`**: chamar `trackWhatsAppClickConversion()` no onClick
- **`Footer.tsx`**: adicionar tracking nos links WhatsApp
- **`LocationsSection.tsx`**: adicionar tracking nos links de telefone
- **`Header.tsx`**: adicionar tracking no link WhatsApp mobile

### 4. Documentação

Atualizar `docs/GTM-EVENTOS-DATALAYER.md` com os novos IDs e conversões.

## Nota sobre Conversion Labels

Os IDs informados (7428858657, 7504209532, 6834364244) são **Conversion Action IDs** do Google Ads. Para o snippet `gtag('event', 'conversion')`, o Google Ads usa um formato `AW-CONVERSION_ID/CONVERSION_LABEL` onde o label é uma string alfanumérica (ex: `AW-979714971/AbCdEf`). Vou implementar usando os IDs numéricos como placeholder — após publicar, basta substituir pelos labels reais obtidos no painel do Google Ads.

