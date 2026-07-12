## Escopo neste repositório

O documento cobre majoritariamente ajustes no workflow n8n (externo). Aqui aplico apenas o que é código do app:

### 1. Corrigir badge enganoso no Kanban (item 5 do prompt)

Arquivo: `src/components/admin/KanbanCard.tsx`

Regra nova para o badge:

- Mostrar **"Precisa humano"** (âmbar) quando `status_crm === "PRECISA_DE_HUMANO"`.
- Mostrar **"Humano assumiu"** (roxo, atual) quando `bot_ativo === false` ou `bot_pausado_ate` no futuro, e não for PRECISA_DE_HUMANO.
- Mostrar **"Sem resposta do bot"** (âmbar suave) quando `bot_ativo === true`, última mensagem for IN e não houver OUT posterior dentro do SLA (~5 min desde `ultima_mensagem_in_em`).
- Só mostrar **"Bot atendendo"** (azul) quando `bot_ativo === true` e nenhuma das condições acima.
- Tooltips explicando cada estado.

Campos já disponíveis no agendamento: `bot_ativo`, `bot_pausado_ate`, `bot_pausa_motivo`, `status_crm`, `ultima_mensagem_in_em`, `ultima_mensagem_out_em` (verificar; caso ausente, usar apenas `status_crm`/`bot_ativo`).

### 2. Confirmação da identificação de lead (item 1)

Já implementado em `supabase/functions/registrar-mensagem-in-n8n/index.ts`: aceita `nome_contato`, faz fallback para `pushName`/`notifyName`/`sender.pushName`/`contact.name` e backfill de nome placeholder. Nada a alterar — apenas documentar na resposta que o backend está pronto e a correção depende do n8n enviar esses campos.

### 3. Itens 2, 3, 4, 6, 7

São todos configuração no workflow n8n externo (`crm-outbound`, classificação de intenção, chamadas a `n8n-registrar-envio`, teste sandbox, backlog de revisão). Não são código deste repo. Listar como pendência para o operador do n8n, sem alterar arquivos.

## Testes

- Adicionar caso em `KanbanColumn.test.tsx` (ou novo `KanbanCard.test.tsx` mínimo) cobrindo os quatro estados do badge.

## Não fazer

- Não mexer em edge functions (backend n8n já está correto).
- Não gerar backfill/broadcast para leads antigos.
- Não publicar.
