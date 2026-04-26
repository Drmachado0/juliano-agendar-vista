
## Revisão da Conexão com Google Calendar

Investiguei o estado atual (logs, banco, código) e a conexão **está funcionando** (check ✅, list ✅, update-calendar ✅, test ✅), mas identifiquei **5 problemas reais** que vou corrigir.

---

### 🔴 Problema 1 — Fuso horário errado nos eventos
O código em `google-calendar-sync/index.ts` (linhas 118-119) cria eventos **hardcoded em `America/Sao_Paulo`**, mas o calendário do usuário está em `America/Belem` (1h de diferença). Eventos estão sendo criados no horário errado no Google Calendar.

**Correção:**
- Adicionar coluna `time_zone` em `google_calendar_tokens`.
- Salvar o timezone retornado pelo Google (já vem no `test` e em `calendarList`) no momento da conexão e da seleção de calendário.
- `buildEvent` passa a usar esse timezone (fallback `America/Sao_Paulo`).

---

### 🔴 Problema 2 — `google_email` salvando como `null`
O response do `check` mostra `google_email: null` mesmo após reconexão. O `userinfo` no callback está em `try/catch` silencioso — se falhar, fica null para sempre.

**Correção:**
- Nova action `refresh-email` em `google-calendar-sync` que consulta `oauth2/v2/userinfo` usando o access token atual e atualiza o registro.
- Botão "Atualizar info da conta" no card de status (executa automaticamente uma vez se `google_email` estiver null).

---

### 🟡 Problema 3 — Falhas transitórias quebram a UI
Log mostra `FunctionsFetchError: Failed to fetch` esporádico no `check`. Hoje isso reseta o status para `{ connected: false }` na UI mesmo com a conexão válida.

**Correção:**
- Em `services/googleCalendar.ts`, adicionar **retry com backoff** (2 tentativas, 500ms) no `checkGoogleCalendarConnection`.
- Tratar erro de rede separadamente de "desconectado": manter o último status conhecido em vez de mostrar "desconectado".

---

### 🟡 Problema 4 — Toggle `auto_sync_enabled` sem feedback visual
Existe a configuração mas a UI não mostra de forma clara quando a sincronização automática está pausada, nem o `_shared/syncGoogleCalendar.ts` informa no log o motivo.

**Correção:**
- Banner amarelo no card quando `auto_sync_enabled = false`: "⏸ Sincronização automática pausada — eventos novos não serão criados no Google Calendar até reativar".
- Manter botão "Resincronizar" sempre disponível para forçar manualmente.

---

### 🟢 Problema 5 — Sem visibilidade de eventos órfãos
Hoje não há como saber quantos agendamentos estão sincronizados vs. pendentes.

**Correção:**
- Adicionar contador no card: "📅 X agendamentos sincronizados • Y pendentes (próximos 30 dias)".
- Nova action leve `sync-stats` que retorna apenas counts (sem chamar Google).

---

### 📋 Resumo de Arquivos

**Migration (1):**
- Adicionar `time_zone TEXT` em `google_calendar_tokens`.

**Edge Functions:**
- `google-calendar-sync/index.ts`: 
  - Usar timezone salvo em `buildEvent`.
  - Nova action `refresh-email`.
  - Nova action `sync-stats`.
  - `update-calendar` também salva o `time_zone` do calendário escolhido.
  - `test` atualiza o `time_zone` no DB.
- `google-calendar-callback/index.ts`: log mais verboso quando userinfo falha (para diagnóstico).

**Frontend:**
- `src/services/googleCalendar.ts`: retry no `check`, novas funções `refreshGoogleEmail` e `getSyncStats`.
- `src/pages/admin/Configuracoes.tsx`:
  - Banner de pausa automática.
  - Contador de sincronização.
  - Auto-refresh do email se vier null.
  - Mostrar timezone do calendário selecionado.

---

### ⚠️ O que NÃO vou fazer
- **Webhooks (push notifications) do Google** — exigem URL pública verificada e renovação a cada 7 dias; complexidade alta para o ganho. Posso adicionar depois se você quiser sincronização bidirecional real.
- **Forçar reconexão** — sua conexão atual continua válida, só vamos corrigir/enriquecer os dados em background.
