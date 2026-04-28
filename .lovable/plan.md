# Toggle manual do bot Hermes por conversa

## Situação atual
O componente `BotStatusBadge` já existe e aparece no header do chat (`WhatsAppChat.tsx`), com dropdown para pausar (15 / 30 / 60 / 240 min) e reativar. Cada ação chama as RPCs `pausar_bot_agendamento` / `reativar_bot_agendamento`, que afetam **apenas** aquele `agendamento_id` — ou seja, não impacta outras conversas.

O que falta para entregar o pedido:

1. **Visibilidade do estado do bot na lista lateral de conversas** (`WhatsAppLeadsList`) — hoje a única forma de ver se uma conversa está pausada é abrindo o chat dela.
2. **Toggle rápido (1 clique)** direto na lista, sem precisar abrir o dropdown completo.
3. **Garantir que o badge no header siga o mesmo padrão visual** e fique mais óbvio como "controle ON/OFF".

## O que será entregue

### 1. Indicador de status na lista de conversas
Em cada `WhatsAppLeadItem` da coluna esquerda, mostrar um pequeno ícone à direita do nome:
- 🟢 Bot ativo (ícone Bot)
- 🟡 Bot pausado (ícone Pause + tempo restante em tooltip, ex.: "30min")
- 🔴 Bot desligado (ícone BotOff)

O ícone fica visível em todas as conversas para a equipe identificar rapidamente onde o bot está/não está atuando.

### 2. Toggle de 1 clique na lista
Clicar no ícone:
- Se **ativo** → pausa por 30 min (valor padrão do `bot_config`).
- Se **pausado/desligado** → reativa imediatamente.

Toast confirma a ação. O clique no ícone **não** seleciona a conversa (stopPropagation).

Para opções avançadas (15min, 1h, 4h) o usuário continua usando o dropdown completo no header do chat.

### 3. Header do chat (já existe, ajustes finos)
- Manter o `BotStatusBadge` com dropdown completo no `WhatsAppChat`.
- Adicionar texto auxiliar discreto abaixo do badge quando pausado: "*só esta conversa*", deixando claro que o efeito é local e não global.

### 4. Dados em tempo real
- Estender `LeadComMensagens` com `bot_ativo`, `bot_pausado_ate`, `bot_pausa_motivo`.
- `listarLeadsComMensagens` passa a buscar essas colunas.
- Subscription Realtime no `WhatsAppLeadsList` para `UPDATE` em `agendamentos` (filtrando os IDs em tela), mantendo os ícones sincronizados quando a pausa expira ou alguém pausa de outro lugar.

## Detalhes técnicos

- **Backend**: nada novo. Reaproveita as RPCs `pausar_bot_agendamento(p_agendamento_id, p_minutos, p_motivo)` e `reativar_bot_agendamento(p_agendamento_id)` já existentes (com auditoria automática em `crm_audit_log`).
- **Isolamento**: ambas as RPCs operam em uma única linha de `agendamentos` (`WHERE id = p_agendamento_id`), garantindo que outras conversas não são afetadas.
- **Motivo da pausa manual da lista**: `"manual_lista"` (no header continua `"manual"`).
- **Componente novo**: `BotStatusToggle` (versão compacta, só ícone + tooltip + 1 clique) — usado dentro de `WhatsAppLeadItem`.
- **Reuso**: `BotStatusBadge` (dropdown completo) continua igual no header.
- **Service** `botPausa.ts`: já tem `pausarBot` / `reativarBot` / `obterStatusBot` — sem mudanças.
- **Realtime**: 1 canal único na lista (`leads_bot_status`) escutando `UPDATE` em `agendamentos` e atualizando localmente os campos de bot dos leads em memória.

## Arquivos afetados

- `src/services/mensagens.ts` — adicionar 3 campos ao tipo `LeadComMensagens` e ao `select`.
- `src/components/admin/WhatsAppLeadItem.tsx` — renderizar o novo `BotStatusToggle`.
- `src/components/admin/WhatsAppLeadsList.tsx` — subscription Realtime para campos de bot.
- `src/components/admin/BotStatusToggle.tsx` — **novo**, versão compacta.
- `src/components/admin/WhatsAppChat.tsx` — texto "*só esta conversa*" abaixo do badge quando pausado.

Sem mudanças de banco e sem mudanças em edge functions.
