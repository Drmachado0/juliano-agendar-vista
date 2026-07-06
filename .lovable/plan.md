# Aplicar Blocos A + B1 + B2 + C1 – Auditoria de Tracking

Migration de auditoria (B2) já foi criada e aprovada — trigger `trg_log_site_config_pixel_change` grava em `system_logs` toda alteração do Pixel ID. Falta o código.

## Correção importante ao relatório anterior
`trackLead` e `trackCompleteRegistration` do `useMetaPixel` **NÃO são código morto** — ainda são chamados em `src/pages/Agendamento.tsx` (linhas 210 e 327) e em `src/components/scheduling/SchedulingModal.tsx` (linhas 175-176). Só o `/obrigado` deixou de disparar. Portanto **não vou remover as funções**; vou apenas atualizar o inventário para refletir as origens reais.

---

## Arquivos a alterar

### 1. `supabase/functions/meta-capi/index.ts`
Adicionar `logSystem({ level: 'info', source: 'meta-capi', message: 'CAPI OK <event>', … })` logo após o `console.log` de sucesso (linha 395). Assim a seção CAPI da tela consegue mostrar contagem de sucessos. Erros já são logados.

### 2. `src/pages/admin/AuditoriaTracking.tsx` — reescrita
- **Bloco A1.** Atualizar `TRACKING_INVENTORY` (adicionar entradas para os eventos e origens hoje ausentes) e `DATALAYER_EVENTS` com a lista completa real:
  - `view_scheduling_page`, `lp_step_view`, `lead_created`, `lp_appointment_scheduled` (Agendamento.tsx)
  - `lp_form_start`, `lp_step_completed`, `lp_appointment_success`, `lp_appointment_error`, `modal_form_start`, `modal_step_completed`, `modal_appointment_success`, `modal_appointment_error` (useGoogleTag)
  - `meta_appointment_form_started`, `meta_appointment_booked`, `meta_appointment_confirmed` (useMetaPixel)
  - `thank_you_page_view` (Obrigado.tsx)
  - fallback `meta_<eventName>` (useMetaPixel.trackEvent)
- **Bloco A2.** `meta_lead` / `meta_complete_registration` continuam ativos — atualizar origens para incluir `Agendamento.tsx` e `SchedulingModal.tsx` em vez de marcar como mortos.
- **Bloco A3.** `RuntimeBadge` de `gtag()` sem prop `optional` (esperado, não opcional).
- **Bloco A4.** Banner amarelo no topo:
  > "Esta tela roda em /admin, onde GTM/Pixel podem estar bloqueados por Consent Mode / guard de admin. O 'Status em Runtime' abaixo pode aparecer vazio mesmo com tudo funcionando. Para validar runtime real, abra páginas públicas."
- **Bloco A5.** 4 botões no cabeçalho: "Abrir /agendamento", "Abrir /obrigado", "Abrir GTM Preview" (`https://tagassistant.google.com/`), "Abrir Meta Events Manager" (`https://business.facebook.com/events_manager2/list/pixel/{pixelId}/overview`).
- **Bloco B1.** No mount, `SELECT expected_meta_pixel_id FROM site_config` via supabase. Usar valor do banco como fonte da verdade; `1003792428067622` só como fallback visual se select falhar, com badge "fallback" na UI. Manter `localStorage` apenas como cache inicial otimista (mostra rápido enquanto o banco carrega), reidratado imediatamente pelo valor real.
- **Bloco B1.** Botão "Salvar": `UPDATE site_config SET expected_meta_pixel_id = ..., updated_by = auth.uid()` (o trigger já cuida do log). Se falhar por RLS, toast avisa "somente admins podem alterar".
- **Bloco C1.** Nova seção **Meta CAPI** que consulta `system_logs WHERE source = 'meta-capi'`:
  - contagem success (`level='info'`) vs erro (`level in ('warn','error','critical')`) nas últimas 24h e 7d;
  - timestamp e mensagem do último evento;
  - timestamp e detalhes do último erro (se houver);
  - tabela dos 10 últimos eventos (created_at, level, message, event_name/event_id de `details`);
  - se retornar 0 linhas: card vazio com texto "Nenhum log CAPI encontrado ainda. Após o próximo evento server-side, ele aparecerá aqui."
  - botão "Atualizar".

Sem alteração em `useMetaPixel.ts`, `useGoogleTag.ts` ou `Obrigado.tsx`.

---

## Pontos de teste manual
1. **B1 leitura.** Abrir `/admin/auditoria-tracking` → campo "Pixel ID esperado" mostra o valor do banco (`1003792428067622` atual), sem depender de localStorage.
2. **B1 escrita.** Alterar para outro Pixel válido (ex.: `1234567890123456`) → toast de sucesso; recarregar página em outra sessão → valor persistiu.
3. **B2 auditoria.** `SELECT message, details, user_email, created_at FROM system_logs WHERE source='admin/auditoria-tracking' ORDER BY created_at DESC LIMIT 3` deve mostrar a alteração com `old_value` e `new_value`.
4. **B1 permissão.** Logar como não-admin e tentar salvar → toast de erro, valor não muda.
5. **A5 botões.** Cada um dos 4 botões abre a URL correta em nova aba. "Meta Events Manager" usa o Pixel ID atual do banco.
6. **A4 banner.** Aviso aparece no topo em amarelo/gold.
7. **A1/A3.** Verificar tabelas de inventário e eventos com os novos itens listados; badge de `gtag()` marca como "Ausente" (não "Não usado") se estiver bloqueado em /admin.
8. **C1 vazio.** Antes do próximo evento CAPI, a seção mostra "Nenhum log CAPI encontrado ainda."
9. **C1 populado.** Chamar `/agendamento` em outra aba e concluir um lead (dispara CAPI). Voltar à auditoria → contador 24h > 0, tabela mostra a última linha `info / CAPI OK Lead`.
10. **C1 erro.** Se ocorrer erro CAPI real (token inválido), aparece card vermelho "Último erro" com `fbtrace_id` e mensagem.

Confirma que posso executar?
