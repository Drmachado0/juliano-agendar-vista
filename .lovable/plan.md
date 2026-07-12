
# Auditoria da mensageria e plano de migração para ManyChat + n8n

Análise **somente leitura**. Nada foi editado, deployado ou publicado. Não presumo nós existentes nos painéis ManyChat/n8n (autenticados).

## 1. Estado atual do envio (o que o código faz hoje)

Boa notícia: o "helper legado" `_shared/evolutionApiClient.ts` **já não fala com a Evolution API**. Ele é hoje um shim que re-exporta `sendWhatsappTextMessage` / `sendWhatsappImageMessage` chamando `_shared/whatsappSender.ts`, que dispara para um **webhook do n8n** (`N8N_WHATSAPP_WEBHOOK_URL`, header `X-Webhook-Secret`). Ou seja, o "envio direto" já foi neutralizado no runtime.

O problema real, e que o pedido do usuário torna explícito, é **arquitetural e semântico**:

- Nome "Evolution" ainda em imports/log induz erro de leitura e permite regressão fácil.
- Várias Edge Functions chamam esse helper e **decidem entrega/status como se fossem elas quem enviou**, escrevendo `status_envio` (`enviado` / `entregue` / `lido` / `erro`) e avançando o funil (`AGUARDANDO`, `confirmacao_enviada=true`, `confirmation_status='aguardando_confirmacao'`) **antes** de o ManyChat confirmar. O único fato real é "n8n aceitou o payload". Isso é o que gera risco de **duplicidade, status incorreto e conflito com o ManyChat**.

### Edge Functions que ainda "enviam" (isto é, disparam payload para n8n, mas se tratam como emissoras oficiais)

| Função | Papel hoje | Risco na arquitetura ManyChat+n8n |
|---|---|---|
| `enviar-whatsapp` | Envio manual do admin (texto/imagem) | Duplica caminho: front deveria pedir a um flow do ManyChat via n8n, não a uma função Supabase que reenvia. |
| `enviar-whatsapp-queue` | Fila de envio em lote | Concorre com throttling/janela 24h do ManyChat; pode disparar fora de política. |
| `enviar-whatsapp-imagem` | Imagem manual | Mesmo problema; ManyChat trata mídia no flow. |
| `enviar-boas-vindas-lead` (cron `*/5 * * * *`) | Boas-vindas para novos leads | Se o ManyChat já responde no `message.received`, boas-vindas aqui vira **mensagem duplicada** ao mesmo paciente. |
| `retentar-boas-vindas-pendentes` (cron `*/10 * * * *`) | Reenvio quando status ficou "pendente" | Baseia decisão em `status_envio` inferido, sem ACK real do ManyChat → reenvia mensagem que já saiu. |
| `enviar-confirmacao-whatsapp` (cron diário 12:00) | Confirmação 24h antes | Deveria ser um Flow agendado no ManyChat; hoje avança `confirmation_status` sem confirmação real de entrega. |
| `lembrete-consulta-whatsapp` (cron diário 09:00) | Lembrete véspera/dia | Idem: template de conteúdo no código competindo com template no ManyChat. |
| `assistente-pre-agendamento` | Classificador + resposta ao paciente | Faz o envio da sugestão de horário direto pelo helper. Deveria só decidir e devolver ao n8n. |
| `lembretes-runner` | Campanhas anuais via `enviarFlowManyChat` (ManyChat direto) | Coerente com a nova arquitetura, mas **coexiste com** o webhook n8n → dois caminhos oficiais para ManyChat. |
| `verificar-numeros-whatsapp` | "phone-exists" via n8n | ManyChat não oferece phone-exists público; hoje depende do n8n implementar. Baixo risco, mas contrato precisa estar documentado. |
| `whatsapp-status` / `zapi-status` | Diagnóstico | `zapi-status` é vestígio morto (Z-API foi removida); mantê-lo confunde o admin. |

### Helpers compartilhados envolvidos

- `_shared/whatsappSender.ts` — dispara para webhook n8n. **Fica**.
- `_shared/evolutionApiClient.ts` — shim + utilidades de sanitização/status. **Renomear e enxugar**. O mapeamento `SERVER_ACK/DELIVERY_ACK/READ` só faz sentido se a fonte de verdade for o provedor; com ManyChat, quem carimba entrega é o próprio ManyChat via webhook de status → n8n → nosso endpoint.
- `_shared/manychat.ts` — chama a API do ManyChat direto (subscriber + sendFlow). Usado pelo `lembretes-runner`. Coexistência com webhook n8n gera **dois canais oficiais**; precisa de decisão explícita.
- `_shared/rateLimitOutbound.ts`, `_shared/whatsappGuards.ts`, `_shared/envioStatusGlobal.ts` — hoje protegem contra flood no lado Supabase. Depois da migração, throttling/janela 24h é responsabilidade do ManyChat/n8n; esses guards viram **defesa em profundidade** (bloquear reenvio nosso), não o controlador principal.

### Crons ativos que disparam envio (após migração 20260712223249)

- `cron-boas-vindas-lead` → `enviar-boas-vindas-lead` (*/5 min)
- `cron-retry-boas-vindas-pendentes` → `retentar-boas-vindas-pendentes` (*/10 min)
- `cron-confirmacao-whatsapp` → `enviar-confirmacao-whatsapp` (0 12 * * *)
- `cron-lembrete-consulta` → `lembrete-consulta-whatsapp` (0 9 * * *)

Todos precisam ser **desativados no Supabase** e reencarnados como triggers dentro do n8n (que decide quando chamar o ManyChat).

### Componentes/UI do admin que ainda assumem envio direto

- `src/components/admin/NovaMensagemWhatsAppModal.tsx`, `WhatsAppChat.tsx`, `KanbanCard.tsx`, `KanbanColumn.tsx`, `AgendamentosTable.tsx`, `TesteEnvioWhatsAppCard.tsx`, páginas `admin/CRM.tsx`, `admin/Avaliacoes.tsx`, `admin/Lembretes.tsx`, `admin/Agendamentos.tsx` — invocam `enviar-whatsapp` / `enviar-whatsapp-imagem` / `enviar-whatsapp-queue`. Precisam apontar para um novo endpoint "solicitar envio" (`request-outbound`) que apenas empurra a intenção para o n8n; a confirmação vem depois.

## 2. Riscos concretos hoje

1. **Mensagem duplicada ao paciente**
   - Boas-vindas: cron Supabase envia via n8n e, se o flow do ManyChat também responder ao `message.received`, o paciente recebe duas mensagens.
   - Retry: `retentar-boas-vindas-pendentes` reenvia sem esperar ACK real do ManyChat.
   - Lembrete/Confirmação: cron Supabase + qualquer flow agendado no ManyChat = duplicidade silenciosa.
   - Assistente: envia sugestão de horário e também deixa o n8n livre para responder → duas mensagens.
   - `lembretes-runner` (ManyChat direto) + qualquer flow do ManyChat que responda ao mesmo evento = duplicidade.

2. **Status incorreto no CRM**
   - `status_envio='enviado'` gravado assim que o webhook n8n devolve 200, sem ACK do WhatsApp.
   - `agendamentos.confirmacao_enviada=true` e `confirmation_status='aguardando_confirmacao'` marcados no disparo, não na entrega.
   - `mapEvolutionStatusToDelivery` traduz status "Evolution-like" que o ManyChat não fornece → normalização mentirosa.
   - `bot_ativo=false` na escalada humana só ocorre se a função Supabase enviar; se o envio real for do ManyChat, escalada humana pode não ser refletida.

3. **Conflito com ManyChat**
   - Dois caminhos "oficiais": webhook n8n (via `whatsappSender`) e API ManyChat direta (via `manychat.ts`) — flows, janela 24h e opt-in podem divergir.
   - Templates de texto duplicados: código Deno tem `buildAppointmentConfirmationMessage`, `templateRenderer`, variações; ManyChat tem os mesmos textos no flow. Alterar em um lugar não altera no outro.
   - `verificar-numeros-whatsapp` depende de um endpoint que o ManyChat não expõe publicamente; se o nó no n8n não existir, retorna erro silencioso.
   - Idempotência de OUT: nada garante que o `mensagem_externa_id` gravado pelo Supabase seja o mesmo que o ManyChat usa (subscriber_id/message_id do provedor).

4. **Race no funil**
   - `assistente-pre-agendamento` chama `transicionar_estado_agendamento` **antes** da confirmação de envio do ManyChat. Se o envio real falhar no n8n/ManyChat, o card fica em AGUARDANDO sem mensagem entregue.

## 3. Princípios da arquitetura-alvo

- **Entrada única (IN):** ManyChat → n8n → `registrar-mensagem-in-n8n` (já existe, preservar).
- **Decisão (sem envio):** `assistente-pre-agendamento` **apenas** classifica intenção, escolhe slot/ação e devolve um payload estruturado ao n8n (`decisao`, `slots`, `mensagem_sugerida`, `variaveis`, `flow_ns_sugerido`). Nenhum `sendWhatsappTextMessage` aqui. Não muda estado de funil ainda.
- **Saída única (OUT):** ManyChat envia. n8n confirma para o Supabase via **novo endpoint** `registrar-envio-out-n8n` (nome de trabalho) — evolução do atual `n8n-registrar-envio`, endurecido para ser a **única** porta de OUT. Só esse endpoint escreve `mensagens_whatsapp` direção `OUT`, `status_envio` real e avança estado do agendamento via RPC `transicionar_estado_agendamento`.
- **Idempotência forte:** OUT indexado por `(provedor='manychat', provider_message_id)` em UNIQUE parcial.
- **Supabase = estado, não canal.** Templates de conteúdo migram para ManyChat; código guarda apenas variáveis (nome, data, hora, local, link status).
- **Painéis autenticados:** não presumimos nós/flows. Documentamos o **contrato esperado** e listamos as ações manuais no n8n/ManyChat que o dono do produto precisa validar.

## 4. Plano de migração (faseado, reversível, sem publicar nada agora)

### Fase 0 — Congelamento e observabilidade (sem quebrar nada)

1. Marcar `_shared/evolutionApiClient.ts` como **deprecated** em comentário (sem remover) e criar `_shared/whatsappOutbound.ts` como novo ponto de entrada semântico ("solicita ao n8n; não envia").
2. Adicionar métrica em `system_logs` com `category='outbound_request'` sempre que uma Edge disparar payload ao n8n, incluindo `source_function`, `agendamento_id`, `motivo`, `dedupe_key`.
3. Painel `/admin/saude-integracoes`: adicionar contadores de "requisições OUT emitidas por função nas últimas 24h" e "OUTs confirmados pelo ManyChat" — a diferença expõe duplicidade/atraso.

### Fase 1 — Endpoint canônico de OUT confirmado

1. Renomear/evoluir `n8n-registrar-envio` para `registrar-envio-out-n8n` (manter a antiga apontando para a nova por 1 sprint):
   - Aceita `provider='manychat'`, `provider_message_id`, `subscriber_id`, `flow_ns` (quando aplicável), `template_key`, `status` (`enviado|entregue|lido|erro`), `motivo`, `agendamento_id?`, `mensagem_externa_id?`, `conteudo?`.
   - Índice UNIQUE parcial em `mensagens_whatsapp(provider, provider_message_id)`.
   - Só esse endpoint pode chamar `transicionar_estado_agendamento` por causa de envio (ex.: `AGUARDANDO`, `confirmacao_enviada`).
2. Documentar em `docs/CONTRATO-OUTBOUND-MANYCHAT-N8N.md` o payload e a ordem esperada. Sem afirmar que o nó existe no n8n — listar como **ação pendente do owner** validar o nó.

### Fase 2 — Assistente vira decisor puro

1. Remover `sendWhatsappTextMessage` de `assistente-pre-agendamento`.
2. Resposta passa a ser JSON:
   ```
   { decisao: "sugerir_horarios" | "escalar_humano" | "nao_agir",
     slots: [...], variaveis: {...}, flow_ns_sugerido?: string,
     mensagem_sugerida?: string, motivo: string }
   ```
3. Transição de estado só quando `registrar-envio-out-n8n` confirmar o envio associado à mensagem sugerida. Enquanto isso, gravamos `intent` em `conversation_intents` (já idempotente por `mensagem_id`).
4. Fallback de erro: se a classificação falhar → chama `transicionar_estado_agendamento` para `PRECISA_DE_HUMANO`, `bot_ativo=false`, e devolve `decisao='escalar_humano'`.

### Fase 3 — Desligar disparos duplicados

Para cada uma das funções abaixo, converter em **"solicitação"** (fila leve na base para o n8n consumir, ou webhook direto ao n8n) e depois **desativar o cron do Supabase**:

- `enviar-boas-vindas-lead` → n8n dispara flow "boas_vindas" quando `message.received` for de lead novo. Cron Supabase desativado.
- `retentar-boas-vindas-pendentes` → n8n cuida do retry com base em `provider_message_id` sem ACK. Cron desativado.
- `enviar-confirmacao-whatsapp` → flow ManyChat agendado (ou n8n cron), variáveis passadas via API. Cron Supabase desativado.
- `lembrete-consulta-whatsapp` → idem.
- `enviar-whatsapp` / `enviar-whatsapp-imagem` / `enviar-whatsapp-queue` → viram `request-outbound` (uma única função) que grava a intenção e chama o webhook do n8n. UI do admin passa a chamar essa função; ela **não escreve** `mensagens_whatsapp` OUT — quem escreve é `registrar-envio-out-n8n` após ACK.

Cada desligamento é feito em migração pequena, um cron por vez, com janela de observação de 24-48h.

### Fase 4 — Consolidar canal ManyChat

Decidir (com o owner) entre:
- **A. Manychat via n8n apenas** (nossa preferência pela homogeneidade): `lembretes-runner` para de usar `manychat.ts` e passa a pedir ao n8n via `request-outbound` com `campanha='lembrete_anual'`. `_shared/manychat.ts` é removido.
- **B. Manter `lembretes-runner` chamando ManyChat direto**: documentar que campanhas anuais não passam pelo n8n; o `registrar-envio-out-n8n` precisa aceitar ACK também vindo de um webhook do próprio ManyChat.

Sem input do owner, deixo a decisão marcada como **aberta** no plano, com A recomendada.

### Fase 5 — Limpeza e prevenção de regressão

1. Renomear `_shared/evolutionApiClient.ts` → `_shared/whatsappOutbound.ts`; remover `mapEvolutionStatusToDelivery` (não se aplica ao ManyChat) e `SendMessageResult.evolutionStatus`.
2. Remover `supabase/functions/zapi-status/` (vestígio).
3. Ajustar `whatsapp-status` para refletir "ManyChat via n8n" e checar tanto `N8N_WHATSAPP_WEBHOOK_URL` quanto `MANYCHAT_API_TOKEN` (se Fase 4-B).
4. Lint/CI: regra `no-restricted-imports` proibindo qualquer novo import de `evolutionApiClient` fora de `whatsappOutbound.ts`.
5. Testes: contrato de `registrar-envio-out-n8n` (idempotência por `provider_message_id`), decisor `assistente-pre-agendamento` (não envia), e simulação de duplicidade (mesmo `provider_message_id` chega duas vezes → um único OUT persistido).

## 5. Pendências externas (fora do repositório, do owner)

Não presumimos que existam. Precisam ser confirmadas nos painéis autenticados:

- **n8n**: nó HTTP para `assistente-pre-agendamento` (com `x-n8n-secret`) e nó HTTP para `registrar-envio-out-n8n` disparado após o ManyChat confirmar envio (webhook de status do ManyChat encaminhado ao n8n).
- **ManyChat**: flows equivalentes a boas-vindas, confirmação 24h, lembrete véspera e resposta de sugestão de horário; opt-in e janela de 24h por flow.
- **Contrato de `provider_message_id`**: definir com o owner qual campo do ManyChat será a chave estável (ex.: `subscriber_id + last_input_text_id`, ou id retornado por `sendFlow`).

## 6. Não-objetivos deste plano

- Não altera front público, tracking, SEO, Meta CAPI, GA4/GTM, agendamento web.
- Não mexe em RLS, roles ou 2FA.
- Não publica nem envia mensagens reais.
- Não presume o conteúdo dos painéis ManyChat/n8n.

## 7. Entregáveis por fase

- Fase 0: 1 doc (`docs/AUDITORIA-MENSAGERIA-2026-07-12.md`) + observabilidade nova em `SaudeIntegracoes`.
- Fase 1: nova migration corretiva (índice UNIQUE parcial em `mensagens_whatsapp`), nova Edge `registrar-envio-out-n8n`, doc de contrato.
- Fase 2: refactor `assistente-pre-agendamento` (sem envio), atualização de `conversation_intents` fluxo.
- Fase 3: nova Edge `request-outbound`, migrations que removem 4 crons, atualização das telas admin.
- Fase 4: decisão A/B com o owner, refactor `lembretes-runner`.
- Fase 5: renomeações, remoção de `zapi-status`, regras de lint, testes.

Nada disso será implementado sem aprovação. Este plano é o entregável.
