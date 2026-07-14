
# Auditoria read-only — commit `bf9f46d`

Escopo: CRM/ManyChat/n8n + Rev-4.1 EXAMES_HGP. Nenhum arquivo, SQL ou deploy alterado.

Resumo: **3 correções obrigatórias**, **3 melhorias recomendadas**, **2 investigações pendentes**. Nenhuma vulnerabilidade de PII em logs identificada nos caminhos revisados.

---

## Obrigatórias

### 1. Webhook legado `message.received` ainda ativo — risco de duplicidade
- Severidade: **ALTA**
- Evidência: `supabase/migrations/20260705163330_*.sql` cria trigger `trg_mw_emit_message_received` que dispara em toda IN nova via `crm_webhook_endpoints.event='message.received'`. O banco reporta 4 endpoints ativos, incluindo esse apontando para `crm-outbound` legado.
- Impacto: com o caminho canônico ManyChat → n8n → `registrar-mensagem-in-n8n`, o trigger legado pode disparar processamento paralelo (dupla resposta, dupla auditoria, duplo handoff). Fere o contrato da seção "Arquitetura oficial 2026-07-12".
- Ação (não executada agora): desativar (`active=false`) o endpoint `message.received` ou remover o trigger `trg_mw_emit_message_received`. Preferência por desativar apenas o endpoint para preservar histórico.

### 2. Resolver pula `coletando_convenio` quando `tipo=Convênio`
- Severidade: **ALTA**
- Evidência: `supabase/functions/_shared/estadoAtendimentoResolver.ts` linhas 62-72. A verificação após `tipo_atendimento` vai direto para `local_atendimento`; não há ramo para tipo "Convênio"/"convenio" checando se `convenio` está preenchido.
- Impacto: pacientes de convênio pulam a coleta do nome do convênio quando o resolver reconstrói o estado (pivô de exame tabelado, futuras reutilizações). Contradiz `PROXIMO_DADO_POR_ESTADO` do contrato (`coletando_convenio` mapeia para "Nome do convênio").
- Ação: acrescentar campo `convenio` ao `EstadoResolverInput` e ramo `if (tipo == 'convenio' && !convenio) return "coletando_convenio"` antes do check de `local_atendimento`. Adicionar teste correspondente.

### 3. Estado `'novo'` não reconhecido como válido pelo resolver
- Severidade: **ALTA** (potencial regressão silenciosa)
- Evidência: `estadoAtendimentoResolver.ts:12-22` `ESTADOS_VALIDOS` **não** inclui `"novo"`, mas `supabase/migrations/20260511212346_*.sql` define `estado_atendimento` DEFAULT `'novo'`. Portanto `precisaRecomputar('novo') === true`. O banco reporta 5 cards em `estado_atendimento='novo'` com `bot_ativo=true`.
- Impacto atual: contido — o resolver só é chamado no side-effect de exame tabelado (`registrar-mensagem-in-n8n:321`). Mas qualquer futura chamada em NOVO LEAD comum recomputará silenciosamente e mudará o estado antes de o fluxo normal responder.
- Ação: incluir `"novo"` em `ESTADOS_VALIDOS` (idempotente por design) e adicionar teste `preserva 'novo'`.

---

## Melhorias recomendadas

### 4. `EXAMES_HGP` ausente do mapa da RPC `transicionar_estado`
- Severidade: **MÉDIA**
- Evidência: `supabase/migrations/20260712224127_*.sql` linhas 183-215. O `CASE v_novo` não trata `EXAMES_HGP`, caindo no `ELSE v_atual.status_funil` (não altera funil) e mantendo `bot_ativo` atual.
- Impacto: se um admin acionar `transicionar_estado(..., 'EXAMES_HGP', ...)` pelo Kanban, o card não vai para a coluna `exames_hgp` do Kanban (que lê `status_funil`), e o `bot_ativo` não é normalizado. O side-effect de `registrar-mensagem-in-n8n` já faz UPDATE direto correto (linhas 335-345), então o caminho automático funciona; a divergência só afeta transição manual.
- Ação: acrescentar `WHEN 'EXAMES_HGP' THEN 'exames_hgp'` em `v_novo_funil`, ajustar `v_novo_estado` para chamar resolver (ou preservar) e definir `v_bot_ativo=true` para esse status.

### 5. Divergência entre `TERMINAIS_CRM` (TS) e índice único ativo (SQL)
- Severidade: **MÉDIA**
- Evidência: `supabase/functions/_shared/statusTerminais.ts:8` lista `['ATENDIDO','CANCELADO','COMPARECEU','FALTOU','EXCLUIDO']`. Os índices/queries em `20260712235017_*.sql` e `20260713220147_*.sql` só excluem `('ATENDIDO','CANCELADO','COMPARECEU')`.
- Impacto: um card com `status_crm='FALTOU'` ou `'EXCLUIDO'` é considerado terminal no TS mas continua "ativo" no filtro SQL, podendo bloquear criação de NOVO LEAD legítimo pelo mesmo telefone.
- Ação: alinhar — expandir lista SQL para incluir `FALTOU` e `EXCLUIDO`, ou remover esses dois de `TERMINAIS_CRM`. Precisa ADR curto para escolher.

### 6. Migração histórica `20260713232801` grava estado inválido `'coleta'`
- Severidade: **MÉDIA** (regressão em ambientes novos)
- Evidência: linha 14 `estado_atendimento = COALESCE(NULLIF(estado_atendimento,'aguardando_humano'), 'coleta')`. O contrato Rev-4.1 proíbe `'coleta'` como estado. Reparo do card `ff5ee055…` já foi feito por UPDATE manual posterior, mas essa migração continua no repositório e reintroduziria o bug se reexecutada em novo ambiente.
- Ação: substituir o COALESCE por `coletando_data_nascimento` (que é o caso real do card) ou por chamada equivalente ao resolver. Preservar idempotência restrita ao UUID atual.

---

## Investigar (sem evidência suficiente ainda)

### 7. `whatsapp-n8n send-text logical_error` (1 ocorrência 24h)
- Não há função/arquivo com esse nome no repositório (só `enviar-whatsapp`). Provável label vindo de `system_logs`. Precisa `SELECT` em `system_logs` filtrando `source ilike '%whatsapp%'` para localizar payload real. Sem código-fonte visível, não é possível classificar.

### 8. Fail-open em `enviar-whatsapp`
- `supabase/functions/enviar-whatsapp/index.ts` linhas 100 e 145: retorna HTTP 200 mesmo em erro de envio (`SEND_ERROR`, `INTERNAL_ERROR`), com `ok:false` no body. Intencional para não travar n8n (retry), mas mascara falha em monitores que só olham status HTTP. Não é bug funcional; recomendo alerta com base em `system_logs`/`ok:false`.

---

## Verificações que passaram

- **PII em logs (registrar-mensagem-in-n8n)**: `notification_summary` é composto por helper com telefone mascarado; `console.error/log` no arquivo não imprimem `conteudo` cru nem PII. Sem achado.
- **Fail-open em `mcp-agendamento` / `criar-agendamento`**: já são fail-closed (exigem UUID e validação de slot). Sem regressão.
- **Índice único `agendamento_ativo_por_telefone_uidx`**: previne slots duplicados e telefones ambíguos ativos (0/0 no banco confere).
- **Kanban EXAMES_HGP**: `useKanbanColumnsConfig.ts` (v4) e `normalizeStatusFunil` reconhecem `exames_hgp`; sem conflito de índices/enums no client.

---

## Ordem sugerida quando entrar em modo build

1. Achado 1 (desativar endpoint legado) — mitigação imediata sem código.
2. Achados 2 e 3 (resolver: convenio + novo) — 1 arquivo + testes.
3. Achado 4 (RPC transicionar_estado) — 1 migração.
4. Achado 5 (alinhar terminais) — decisão de produto, depois migração + edição TS.
5. Achado 6 (reescrever migração histórica) — só após confirmar que não é reexecutada em produção.
6. Achado 7 (query system_logs) — investigação; talvez vire task própria.

Nada foi editado, deployado ou aplicado no banco.
