## Banner de Consentimento (CMP) + Política de Privacidade

Implementar conformidade LGPD/GDPR no site público: banner de consentimento de cookies (opt-in para marketing/analytics) integrado ao `trackingGuard`, e página pública `/politica-de-privacidade` linkada no Footer.

---

### 1. Estado de consentimento (`src/lib/consent.ts` — novo)

API simples baseada em `localStorage` + evento custom `consent-changed`:

- Tipos: `ConsentState = { necessary: true; analytics: boolean; marketing: boolean; timestamp: string; version: '1.0' }`
- Funções:
  - `getConsent(): ConsentState | null` — lê `lgpd-consent` do localStorage
  - `setConsent(partial)` — grava + dispara `window.dispatchEvent(new Event('consent-changed'))`
  - `hasDecided()` — true se já existe registro
  - `acceptAll()` / `rejectAll()` — atalhos
  - `subscribe(cb)` — escuta evento

### 2. Atualizar `src/lib/trackingGuard.ts`

`isTrackingAllowed()` passa a exigir **dois** gates:
1. Não estar em rota privada (já existe)
2. `getConsent()?.analytics === true` OU `marketing === true` (variantes específicas)

Adicionar:
- `isAnalyticsAllowed()` — gate de rota + `analytics: true`
- `isMarketingAllowed()` — gate de rota + `marketing: true`
- `safeFbq` passa a usar `isMarketingAllowed`
- `safeGtag` / `safeDataLayerPush` usam `isAnalyticsAllowed` (GTM dispara tags de analytics e marketing internamente — manter no analytics gate, e adicionar push de `consent_update` ao dataLayer quando muda)

### 3. Carregamento condicional dos scripts em `index.html`

Hoje GTM e Meta Pixel carregam imediatamente (apenas bloqueados em `/admin` e `/auth`). Mudar para:

- Script base inline: define `window.dataLayer` + `gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ... })` (Google Consent Mode v2 — denied por padrão).
- **Não** injetar GTM nem Meta Pixel no boot. Apenas se já houver consentimento salvo (verifica `localStorage.getItem('lgpd-consent')` no inline script e injeta se aceito).
- O componente CMP (React) injeta os scripts dinamicamente assim que o usuário aceita, e dispara `gtag('consent', 'update', ...)` para reativar tags já carregadas.

Helper `src/lib/loadTrackingScripts.ts` (novo): funções `loadGTM()` e `loadMetaPixel()` idempotentes (checam flag global antes de injetar).

### 4. Componente `src/components/ConsentBanner.tsx` (novo)

Renderizado em `App.tsx` fora das rotas `/admin*` e `/auth`. UI dark, fixo no rodapé, mobile-friendly:

```text
+--------------------------------------------------------------+
| Usamos cookies para melhorar sua experiência e medir        |
| campanhas. Você pode aceitar todos ou personalizar.         |
| [Política de Privacidade]                                    |
|                                                              |
|   [ Personalizar ]   [ Rejeitar ]   [ Aceitar todos ]       |
+--------------------------------------------------------------+
```

- "Aceitar todos" → `acceptAll()` + carrega GTM e Pixel + `consent update granted`.
- "Rejeitar" → `rejectAll()` (apenas necessários) + nada é carregado.
- "Personalizar" → abre `Dialog` com 3 toggles: Necessários (locked, on), Analytics, Marketing. Botão "Salvar preferências".
- Não aparece se `hasDecided()` retornar true.
- Usar `Card` + `Button` existentes; respeitar paleta navy/gold.

### 5. Botão "Gerenciar cookies" no Footer

Em `src/components/Footer.tsx`, adicionar link na seção legal que reabre o modal de personalização (estado controlado via custom event `open-consent-preferences` ou contexto leve).

### 6. Página pública `/politica-de-privacidade`

- Novo arquivo `src/pages/PoliticaPrivacidade.tsx`
- Rota adicionada em `App.tsx`: `<Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />`
- Estrutura (Helmet + Header + Footer + conteúdo `prose`):
  1. Identificação do controlador (Dr. Juliano Machado, CRM, contato WhatsApp `+55 91 93618-0476`, endereços Paragominas/Belém)
  2. Encarregado (DPO) — e-mail de contato
  3. Dados coletados: nome, telefone, e-mail, data de nascimento, dados de agendamento, cookies/identificadores, IP
  4. Finalidades: agendamento, contato via WhatsApp, lembretes, marketing (com consentimento), analytics
  5. Bases legais (LGPD art. 7º): execução de contrato (agendamento), consentimento (marketing), legítimo interesse (segurança), obrigação legal (registros médicos quando aplicável)
  6. Compartilhamento: Lovable Cloud (Supabase), Evolution API (WhatsApp), Google (Calendar/Analytics/Ads), Meta (Pixel)
  7. Cookies: tabela com Necessários / Analytics (GTM, GA4) / Marketing (Meta Pixel, Google Ads) e botão "Gerenciar preferências"
  8. Direitos do titular (art. 18) + como exercer (link `wa.me/5591936180476`)
  9. Retenção e segurança
  10. Transferência internacional
  11. Atualizações (data da última versão)
- Link cruzado no Footer ("Política de Privacidade" + "Gerenciar cookies").

### 7. Detalhes técnicos

- **Versionamento de consentimento**: `version: '1.0'` salvo junto. Se mudarmos a política, bump para forçar re-consentimento (helper `requiresReconsent()`).
- **Google Consent Mode v2**: enviar `gtag('consent', 'default', { ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied', analytics_storage:'denied', functionality_storage:'granted', security_storage:'granted' })` no inline. Em `update`, mapear analytics→`analytics_storage`, marketing→`ad_storage`+`ad_user_data`+`ad_personalization`.
- **Meta Pixel**: só executar `fbq('init', ...)` + `track('PageView')` após consent marketing. Antes disso, `safeFbq` é noop.
- **Backwards compat**: se houver visitas anteriores sem registro, banner aparece e tracking fica desligado até decisão.
- **Memory update** (após implementação): atualizar `mem://index.md` core rule sobre GTM para refletir o gate de consentimento.

### 8. Arquivos

Novos:
- `src/lib/consent.ts`
- `src/lib/loadTrackingScripts.ts`
- `src/components/ConsentBanner.tsx`
- `src/pages/PoliticaPrivacidade.tsx`

Modificados:
- `index.html` — remover injeção imediata de GTM/Pixel; adicionar Consent Mode default + bootstrap condicional
- `src/lib/trackingGuard.ts` — gates por categoria
- `src/hooks/useMetaPixel.ts` — usar `safeFbq` (já usa) — sem mudança lógica, apenas vai ficar bloqueado até consentimento
- `src/App.tsx` — montar `<ConsentBanner />` + rota nova
- `src/components/Footer.tsx` — links "Política de Privacidade" e "Gerenciar cookies"

### Fora do escopo
- Persistência server-side do consentimento (fica só em localStorage por dispositivo)
- Página de Termos de Uso (só Política de Privacidade neste plano)
- Integração com plataformas CMP pagas (OneTrust/Cookiebot)