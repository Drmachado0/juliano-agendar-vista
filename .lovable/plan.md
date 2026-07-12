## Objetivo

Criar `/paragominas/agendamento` com direção visual da landing premium, sem tocar em `/agendamento` (comportamento, visual e integrações preservados). Reutilizar 100% do motor (estado, validações, hooks, tracking, edge functions, CRM/CAPI, Obrigado).

## Estratégia arquitetural

Extrair de `src/pages/Agendamento.tsx` (727 linhas) apenas a **máquina de estados + integrações** para um hook compartilhado. Cada rota fica com um **shell visual próprio** que consome esse hook e monta os steps existentes.

```
src/pages/Agendamento.tsx           (shell atual, intocado visualmente)
src/pages/ParagominasAgendamento.tsx (novo shell premium)
src/features/agendamento/
  useAgendamentoFlow.ts             (extraído — estado, submit, tracking, UTMs)
  filters.ts                        (filtro Clinicor/HGP, sem YAG — só p/ premium)
  types.ts
```

Os steps (`PersonalDataStep`, `ConsultationDetailsStep`, `DateTimeStep`, `ConfirmationStep`, `SuccessStep`) permanecem os mesmos componentes de campo — o shell define o wrapper visual (tokens, tipografia, indicador de progresso, painel lateral).

`ConsultationDetailsStep` já recebe listas via props/hook de opções — o shell premium injeta uma prop `locationFilter` que restringe a Clinicor/HGP e oculta YAG. A rota antiga passa `undefined` e mantém o comportamento atual.

Passo a passo:

1. **Extrair `useAgendamentoFlow`** de `Agendamento.tsx` sem mudar comportamento:
   - Estado (`currentStep`, `formData`, `leadId`, `isSubmitted`, `isSubmitting`), refs (`formStartFiredRef`, etc.), `totalSteps`.
   - Handlers: `handleNext`, `handleBack`, `handleSubmit`, `handleChange`, validações.
   - Efeitos de tracking (`booking_view`, `booking_start`, `booking_step_completed`, `booking_submit`, ViewContent/Lead/Schedule/CompleteRegistration).
   - Captura/persistência de UTMs + fbclid/gclid.
   - Aceitar `options: { experienceVariant?: string, locationFilter?: (l) => boolean, basePath?: string }` — apenas metadados de tracking e filtro. Zero mudança no payload de submit.
   - `Agendamento.tsx` passa a chamar o hook sem passar opções extras — comportamento idêntico.

2. **Criar `/paragominas/agendamento` (`ParagominasAgendamento.tsx`)**:
   - Aplica classe `theme-paragominas-premium` no root.
   - Layout desktop 40/60: painel esquerdo sticky em petróleo (nome, título, apoio, foto pequena existente, Clinicor+HGP, CRM, "Mais de 15 anos", associações, link "Voltar para /paragominas"). Painel direito marfim com formulário.
   - Layout mobile: header compacto (logo + link voltar), pequena identificação, formulário fluido, safe-area.
   - Indicador de progresso editorial: rótulos + ícones (Dados/Atendimento/Horário/Confirmação), filete horizontal desktop, dots+rótulo atual mobile, `aria-current="step"`, cliques em steps futuros bloqueados.
   - Consome `useAgendamentoFlow({ experienceVariant: "paragominas_premium", locationFilter: onlyParagominas, basePath: "/paragominas/agendamento" })`.
   - `<Helmet>`: `<meta name="robots" content="noindex,follow">`, título "Agendamento em Paragominas | Dr. Juliano Machado", sem sitemap.
   - Focus management: mover foco ao H2 da nova etapa ao trocar; scroll top mobile.

3. **`buildAgendamentoLink`**:
   - Aceitar `basePath?: string` (default `/agendamento`).
   - Atualizar CTAs de `src/pages/Paragominas.tsx` para `buildAgendamentoLink({ ..., basePath: "/paragominas/agendamento" })`.
   - Home, sticky CTA, procedimentos e demais chamadas continuam sem `basePath` → `/agendamento`.

4. **Rota**: adicionar `<Route path="/paragominas/agendamento" element={<ParagominasAgendamento />} />` em `src/App.tsx` acima da 404. Sitemap não alterado.

5. **Filtro Clinicor/HGP**: função `onlyParagominas(location)` que filtra Belém e serviços YAG antes de passar para `ConsultationDetailsStep`. Se o step hoje lê listas hardcoded, refatorar aceitando prop opcional `filterOptions`; fallback ao comportamento atual.

6. **Tracking**:
   - Adicionar `experience_variant: "paragominas_premium"` nos eventos `booking_view/start/step_completed/submit` **apenas quando** o hook recebe a opção — na rota antiga o campo é omitido.
   - Sem novos eventos Meta. Sem duplicação CAPI. Sem PII em nenhum evento.

## Testes

- `src/pages/ParagominasAgendamento.test.tsx`:
  - Renderiza shell premium (título "Vamos cuidar do seu agendamento.").
  - `<meta robots noindex,follow>` presente.
  - Filtro: Belém e YAG ausentes da etapa Atendimento.
  - Progresso: aria-current no step atual; futuros não clicáveis.
  - `experience_variant=paragominas_premium` no dataLayer.
- `src/pages/Agendamento.test.tsx` (novo ou existente): garantir shell atual + ausência de `experience_variant`.
- `src/lib/agendamentoLink.test.ts`: `basePath` respeitado; UTMs externas não sobrescritas; default continua `/agendamento`.
- Rodar suíte completa (incluindo `Obrigado.test`, `Paragominas.test`) + typecheck.

## QA visual

Playwright em 360, 390, 768, 1440, 1920 nas duas rotas. Screenshots comparativos, zero console error, zero overflow.

## Fora de escopo (não mexer)

Schema, edge functions, webhooks, secrets, `criarLead`, `converterLeadEmAgendamento`, `notificarN8n`, `Obrigado.tsx`, CAPI, disponibilidade, sitemap, tema global.

## Riscos e mitigação

- **Regressão em /agendamento**: extração puramente mecânica; hook com opções default equivalentes ao código atual. Teste snapshot do shell antigo antes/depois.
- **Steps hardcoded de local**: se `ConsultationDetailsStep` não aceitar filtro, adiciono prop opcional com fallback — nenhuma mudança de comportamento quando ausente.
- **Tamanho do arquivo Agendamento.tsx (727 linhas)**: extração incremental, mantendo import e assinatura pública iguais.

## Entregáveis finais

Lista de arquivos criados/alterados, rotas, resumo de tracking, suíte verde, SHA do commit e URLs de preview de ambas as rotas. Sem publicar.
