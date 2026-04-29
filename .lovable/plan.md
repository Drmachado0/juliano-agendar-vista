# Pacote de correções `/admin/whatsapp` + Relatórios + Tracking

Vou implementar **uma correção por vez**. Cada item abaixo vira um commit lógico. As correções 8 e 9 do pacote original foram adaptadas: não existe backend `mc-monitor` nesta arquitetura (usamos Evolution API direta + `bot_config`) e o Monitor de Envios já foi removido na sessão anterior.

## 1. Status real da automação (vs. "Bot ativo")

- Reaproveitar `bot_config.pausa_automatica_ativa` + criar **flag global única** `bot_global_ativo` (boolean) na tabela `bot_config` via migration.
- `BotConfigCard` e o header de `/admin/whatsapp` mostram, lado a lado:
  - Conexão Evolution (verde/vermelho) — já existe
  - Automação global (verde/vermelho/amarelo) — novo
- Quando `bot_global_ativo=false`: alerta no topo "Automação global desligada — controles individuais ficam inativos" e `BotStatusBadge` mostra "Bot pausado globalmente" com tooltip explicativo, em vermelho.

## 2. Filtro/busca limpa seleção quando lead some

Em `WhatsApp.tsx`: `useEffect` que observa `leads` + `selectedLead`. Se o lead selecionado não está mais em `leads`, chama `setSelectedLead(null)` e volta `mobileView` para `list`.

## 3. Seleção de conversa robusta

`WhatsAppLeadItem` já usa `onClick={onClick}` no card; vou auditar e garantir `e.stopPropagation()` nos botões internos (pausa bot, etc.) para não disparar seleção acidental. Loading skeleton no painel direito já existe — manter.

## 4. Aba Contatos funcional

Já está estruturada com `Tabs`. Vou validar que `WhatsAppContatos` renderiza dados (lista, busca, abrir conversa). Ajustes pontuais se houver.

## 5. Data 01/01/1970

Criar helper `formatAppointmentDate(data, hora)` em `src/lib/utils.ts` retornando "Sem data definida" para falsy/`<=1971`. Aplicar em `WhatsAppChat`, `WhatsAppLeadItem` e qualquer outro lugar com data de agendamento.

## 6. Histórico vazio — fallback por telefone

`listarMensagensPorAgendamento` já aceita telefone. Vou auditar `listarLeadsComMensagens` (preview da última mensagem) — se buscar só por `agendamento_id`, adicionar fallback por últimos 8 dígitos do telefone. Filtro extra "Com mensagens / Sem mensagens" no `WhatsAppLeadsList`.

## 7. ErrorBoundary + `/admin/relatorios` defensivo

- Criar `src/components/admin/AdminErrorBoundary.tsx`. Envolver `Relatorios` (e demais rotas admin no `App.tsx` se simples).
- Em `Relatorios.tsx`: `safeNumber`/`safeArray`, fallback se `relatorio.crm.funil_atual` for null, render do layout base mesmo sem dados. Card de erro com botão "Tentar novamente" se a RPC falhar.

## 8. Tracking bloqueado em `/admin/*`

- `index.html`: adicionar `<script>` antes do GTM checando `location.pathname.startsWith('/admin')` e pulando o init.
- `RouteChangeTracker`: não pushar `virtualPageview` em rotas `/admin/*`.
- `useGoogleTag` e `useMetaPixel`: guardar contra `/admin/*`.

## 9. Labels e CTA (rápido)

- `Nova` → `Nova conversa`
- Empty state do chat: copy melhorado e botão "Nova conversa" disparando o modal.
- `BotStatusBadge`/labels CRM exibidos em formato humano onde for trivial (sem renomear constantes do banco).

## (Pulado) Correção 9 do pacote original — Monitor Envios

Já removido. Os erros HTTP 400 detalhados podem ser vistos hoje na coluna `error_message` da `MensagensTabela` em `Relatorios`. Se quiser tooltip mais rico depois, é fácil adicionar.

## Detalhes técnicos chave

- Migration: `ALTER TABLE bot_config ADD COLUMN bot_global_ativo boolean NOT NULL DEFAULT true;`
- Hook novo `useBotGlobalStatus` lendo `bot_config` + realtime, consumido por `BotConfigCard`, header WhatsApp e `BotStatusBadge`.
- `formatAppointmentDate` em `src/lib/utils.ts`.
- ErrorBoundary class component padrão React, renderiza fallback com `Tentar novamente`.
- Guards de tracking: única função `isAdminRoute()` exportada de `src/lib/utils.ts`.

## Ordem de execução (1-by-1)

1. Migration `bot_global_ativo` + hook + UI de status global
2. Limpeza de seleção quando filtro muda
3. Auditoria de clique/stopPropagation
4. Helper de data + substituir 01/01/1970
5. Fallback de histórico por telefone + filtro com/sem mensagens
6. ErrorBoundary + Relatorios defensivo
7. Bloqueio de tracking em `/admin/*`
8. Labels e CTA finais
