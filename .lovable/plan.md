## Objetivo
Atualizar `src/pages/Agendamento.tsx` para usar o mesmo layout, prova social e destaque de WhatsApp já aprovados em `src/pages/Agendar.tsx`, **mantendo os trackings específicos** dessa LP (page_view, lp_step_view, lp_lead_generated, lp_appointment_scheduled, captura de UTMs e conversão Google Ads).

## Arquivo editado
- `src/pages/Agendamento.tsx`

## Mudanças visuais (espelhando /agendar)
- **Header minimalista**: link "Voltar ao site" à esquerda e bloco central "Dr. Juliano Machado · Oftalmologista · CRM-PA". Sem botão WhatsApp duplicado no topo (já existe no destaque).
- **Layout em duas colunas no desktop** (`lg:grid-cols-[1fr_minmax(320px,400px)]`):
  - Esquerda: título persuasivo, banner mobile de prova social (5.0 / 6.000+ pacientes / 13+ anos), CTA WhatsApp em destaque (mobile), carrossel de depoimentos auto-rotativo (5s) e card do formulário multi-step.
  - Direita (sticky, desktop): bloco `WhatsAppHighlight` no topo, card "Por que escolher o Dr. Juliano?" com foto (`@/assets/dr-juliano-hero.png`), 5 estrelas e bullets de autoridade, e card de depoimento curto.
- **WhatsAppHighlight**: mesmo componente verde (`#25D366`) com animação `animate-ping`, copy "Prefere falar com nossa secretária?" e CTA "Chamar no WhatsApp agora".
- **Carrossel de depoimentos**: mesma constante `DEPOIMENTOS` (6 itens com nome, cidade, data, texto), `setInterval` de 5s e dots clicáveis.
- **Footer**: linha simples com CRM e aviso de contato.

## Tracking preservado (específicos da LP /agendamento)
- `useEffect` inicial mantém: `trackViewContent("Landing Agendamento", ...)`, `pushDL({ event: "page_view", page_type: "landing_agendamento", page_path: "/agendamento" })` e captura de UTMs em `sessionStorage` (`lp_agendamento_utms`).
- `useEffect` por step continua disparando `lp_step_view` com `page_type: "landing_agendamento"`.
- Criação do lead (step 2 → 3) continua disparando `lp_lead_generated`.
- Submit final continua disparando `lp_appointment_scheduled`, `trackSchedule`, `trackCompleteRegistration`, `trackFormSubmitConversion` e a conversão `gtag('event','conversion', { send_to: 'AW-436492720/...' })`.
- Cliques no novo `WhatsAppHighlight` chamam `trackWhatsAppClick(WHATSAPP_URL, "Falar com a secretária", "whatsapp_<location>", location)`, `trackWhatsAppGoogleAdsConversion()` e `trackMetaContact('WhatsApp')`, com `location` distinto para mobile/desktop (`agendamento_destaque_secretaria_mobile` / `_desktop`) — permite segmentar conversões da LP separadamente de `/agendar`.

## SEO/Helmet (mantidos)
- `<title>` e meta description atuais voltados a "Agendar Consulta — Dr. Juliano Machado".
- `og:url` e `link rel="canonical"` para `https://drjulianomachado.com/agendamento` permanecem.

## Fluxo de dados (sem alteração)
- `criarLead` (step 2→3), `converterLeadEmAgendamento` (submit), `notificarN8n("agendamento_criado", ...)`, invocações de `confirmar-agendamento-whatsapp` e `notificar-agendamento-email` com `Promise.race` de 8s, redirecionamento para `/obrigado`.
- Mesmas validações e mensagens de erro de disponibilidade que já existem.

## Não muda
- Componentes de step (`PersonalDataStep`, `ConsultationDetailsStep`, `DateTimeStep`, `ConfirmationStep`, `SuccessStep`, `StepIndicator`).
- Edge functions, services, RLS, schema do banco.
- Página `/agendar` permanece como está.
- Botão flutuante global `WhatsAppButton` segue ativo.
