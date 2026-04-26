## Objetivo

Transformar a página `/agendar` (`src/pages/Agendar.tsx`) em uma landing de conversão no mesmo padrão de `/agendar-consulta`, porém:
- exibindo **5,0 estrelas** (em vez de 4,9);
- com **CTA do WhatsApp em destaque** (botão verde grande, com pulso/chamariz e copy: *"Prefere falar com nossa secretária? Chame no WhatsApp"*);
- mantendo todo o fluxo, integrações e tracking que já funcionam hoje em `/agendar`.

## O que muda

### 1. `src/pages/Agendar.tsx` (refatoração de UI)

Reaproveitar a estrutura visual de `AgendarConsulta.tsx` adaptando-a:

**Layout em duas colunas (desktop ≥ lg) / empilhado (mobile):**
- **Coluna esquerda:** título + subtítulo + card do formulário multi-step (mantém `StepIndicator` + `PersonalDataStep` → `ConsultationDetailsStep` → `DateTimeStep` → `ConfirmationStep` → `SuccessStep`, sem alterar a lógica).
- **Coluna direita (sticky):** prova social com foto do Dr. Juliano (`@/assets/dr-juliano-hero.png`), bullets de credibilidade (13+ anos, 6.000+ pacientes, Paragominas/Belém, convênios, resposta em até 1h) e card de depoimento.

**Header minimalista:**
- Nome do médico + CRM-PA à esquerda.
- Link "Voltar ao site" (manter, é diferencial vs. `/agendar-consulta`).
- CTA WhatsApp à direita no header.

**Avaliações = 5,0 estrelas:**
- Banner mobile: `5.0 · 200+ avaliações`.
- Card de prova social desktop: 5 estrelas preenchidas + texto `5.0/5 (200+ avaliações)`.
- Mini-card de depoimento: 5 estrelas.

**CTA WhatsApp em destaque (novo bloco — diferencial pedido):**
- Banner verde (`bg-[#25D366]`) logo abaixo do header (mobile) e dentro da coluna direita acima do card de prova social (desktop), com:
  - Ícone `MessageCircle` animado (`animate-pulse` no halo).
  - Título: **"Prefere falar com nossa secretária?"**
  - Subtítulo: *"Atendimento humano pelo WhatsApp — tire dúvidas e agende em minutos."*
  - Botão grande: **"Chamar no WhatsApp agora"** com seta.
  - URL: `https://wa.me/5591936180476?text=Ol%C3%A1%21+Gostaria+de+agendar+uma+consulta+oftalmol%C3%B3gica+com+o+Dr.+Juliano+Machado.`
- O botão WhatsApp do header também fica mais visível (estilo "pill" verde, não apenas link em accent).

**Rodapé:**
- Linha sutil com CRM e disclaimer de contato (mesmo padrão da landing).

### 2. Tracking / integrações (preservar)

- Manter `useMetaPixel` (`trackViewContent`, `trackLead`, `trackSchedule`, `trackCompleteRegistration`) e `useGoogleTag` (`trackFormSubmitConversion`) já existentes.
- Reaproveitar `useGoogleTag` para disparar `trackWhatsAppClick` + `trackWhatsAppGoogleAdsConversion` em **todos** os cliques nos novos CTAs WhatsApp (header, banner destaque, eventual repetição mobile), com `button_location` distinto por posição (`agendar_header`, `agendar_destaque_secretaria`).
- Manter o fluxo `criarLead` → `converterLeadEmAgendamento` → notificações WhatsApp/E-mail → redirect `/obrigado` exatamente como está.

### 3. SEO

- Atualizar `<Helmet>`: `<title>` e `<meta name="description">` para refletir copy persuasivo ("Agende online ou fale com nossa secretária no WhatsApp"). Manter `lang="pt-BR"` global já configurado.

## O que NÃO muda

- Lógica de steps, validações e estado do formulário.
- Edge functions, serviços (`leads.ts`, `notificarN8n`, etc.) e tracking de conversão.
- Página `/agendar-consulta` permanece como está (continua sendo a landing dedicada para campanhas).
- `WhatsAppButton` flutuante global continua presente.

## Arquivos a editar

- `src/pages/Agendar.tsx` — refatoração completa do JSX (lógica preservada).

## Arquivos lidos para validar implementação

- `src/pages/AgendarConsulta.tsx` (referência de layout).
- `src/components/WhatsAppButton.tsx` (referência de animação/estilo verde).
- `src/hooks/useGoogleTag.ts` (assinatura de `trackWhatsAppClick`).

## Critérios de aceite

1. `/agendar` exibe **5 estrelas cheias** e o texto "5.0/5" em todos os pontos de prova social.
2. Há um **bloco verde de destaque** com a chamada "Prefere falar com nossa secretária?" e botão grande para WhatsApp, visível tanto em mobile (acima do form) quanto em desktop (topo da coluna direita).
3. Todos os cliques nos CTAs WhatsApp disparam `trackWhatsAppClick` + conversão Google Ads.
4. Fluxo de agendamento (4 steps + sucesso) continua funcionando idêntico ao atual.
5. Layout responsivo: mobile empilhado, desktop em 2 colunas com aside sticky.
