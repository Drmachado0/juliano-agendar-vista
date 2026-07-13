# Contrato — Handoff automático de EXAMES e Respostas imediatas

**Revisado:** 2026-07-13 (rev-3: preço de exames tabelados + handoff HGP renomeado + guard_decision v3)

## Objetivo

Impedir que o bot (LLM) responda ou avance o funil em quatro situações reais:

- **A)** Assunto de **exames** SEM preço tabelado (OCT, tomografia, campo visual, topografia, microscopia, ultrassom, cobertura, autorização, resultado, laudo, preparo, agendar, retorno, local etc.) → handoff obrigatório para a secretaria do HGP.
- **B)** Pergunta sobre **preço de exame TABELADO** (retinografia, mapeamento de retina, biometria, paquimetria) → resposta imediata "R$ 300,00", **sem** handoff, sem pausar bot.
- **C)** Pergunta sobre **valor da consulta** → resposta fixa imediata (R$ 300,00), sem desviar a coleta.
- **D)** Pedido de disponibilidade **relativa** (amanhã, à tarde, esta semana) sem agenda → oferecer somente próximas datas reais; **nunca** oferecer horários antes da escolha explícita da data.

### Precedência obrigatória (rev-3)

1. urgência ocular (camadas superiores);
2. **preço de exame tabelado** (retinografia | mapeamento de retina | biometria | paquimetria);
3. **pergunta genérica de preço de exame sem nome** → pergunta qual exame;
4. demais assuntos de exame → **handoff HGP** (`exame_avaliacao_hgp`);
5. valor da consulta;
6. agente normal.

`valor da retinografia` **nunca** cai primeiro no handoff genérico.

Todas as decisões acontecem **antes** do classificador de intenção / qualquer LLM.

Arquitetura oficial: **ManyChat → n8n → Supabase Edge Functions**.
O envio ao paciente e a notificação interna são responsabilidade do n8n. As Edge Functions só decidem e retornam os campos para o n8n executar.

---

## Endpoint principal: `POST /functions/v1/registrar-mensagem-in-n8n`

Além da resposta canônica (`mensagem_id`, `agendamento_id`, `duplicada`, `ambiguo`, …), agora sempre inclui:

| Campo                  | Tipo    | Descrição                                                                 |
| ---------------------- | ------- | ------------------------------------------------------------------------- |
| `handoff_required`     | boolean | `true` quando o guard de exames dispara (agora só para HGP).              |
| `handoff_reason`       | string  | Só populado quando `handoff_required=true`. Rev-3: `"exame_avaliacao_hgp"`. |
| `notify_required`      | boolean | `true` quando o handoff exige notificar equipe.                           |
| `notification_phone`   | string  | Telefone-destino (E.164) para a equipe interna. Fixo: `5591991300174`.   |
| `notification_summary` | string  | Resumo curto para a equipe (nome se conhecido, telefone mascarado, última mensagem, contexto do agendamento). |
| `immediate_reply`      | boolean | `true` quando há uma resposta fixa a enviar antes do agente.              |
| `immediate_reason`     | string  | Ex.: `"valor_consulta"`.                                                  |
| `patient_reply`        | string  | Texto exato a enviar ao paciente pelo ManyChat.                           |
| `resume_agent`         | boolean | `true` = após enviar `patient_reply`, o agente deve retomar o próximo dado pendente. `false` = o texto já resolve o turno (caso de handoff).  |

### Regra para o n8n
1. Se `handoff_required=true`: envia `patient_reply` ao paciente e envia `notification_summary` para `notification_phone`. **Não invoca `assistente-pre-agendamento`.**
2. Se `immediate_reply=true`: envia `patient_reply` primeiro e, se `resume_agent=true`, dispara o agente normal em seguida.
3. Caso contrário: fluxo normal.

---

## Endpoint secundário: `POST /functions/v1/assistente-pre-agendamento`

Repete os mesmos guards antes do classificador (defesa em profundidade).
Se o guard disparar, retorna os mesmos campos acima e **não classifica intenção**.

Também garante a regra C:
- Se a mensagem atual não trouxer uma data explícita (formato `DD/MM` ou `DD-MM`), o assistente **só oferece datas** (nunca horários).
- Só oferece horários quando `podeOferecerHorarios(estado)` for `true`, isto é, quando `data_escolhida != null` e a fase for `data_escolhida | oferecendo_horarios`.
- Se a janela pedida (`amanhã`, `à tarde`, `esta semana`) não tiver slot, a mensagem explicita "Não localizei agenda para X" e lista próximas datas.

---

## Exemplos

### A) Exames
Entrada:
```json
{"telefone":"5591991300174","conteudo":"meu convênio cobre exame de OCT?"}
```
Resposta relevante:
```json
{
  "handoff_required": true,
  "handoff_reason": "assunto_exames",
  "notify_required": true,
  "notification_phone": "5591991300174",
  "patient_reply": "Entendi. Como sua mensagem envolve exames, encaminhei o atendimento para nossa equipe responsável. Eles vão analisar seu caso e continuar por aqui.",
  "notification_summary": "Handoff automático — assunto: EXAMES\nPaciente: … (****0174)\n…"
}
```

Caso especial (histórico): mensagem atual "já fiz a consulta" após IN anterior "meu convênio cobre exame de OCT?" também dispara.

### B) Valor da consulta no meio da coleta
Entrada: `"quanto é a consulta?"` ou `"qual o valor?"`
Resposta relevante:
```json
{
  "immediate_reply": true,
  "immediate_reason": "valor_consulta",
  "patient_reply": "A consulta particular com o Dr. Juliano Machado custa R$ 300,00.",
  "resume_agent": true
}
```
Não confundir com cirurgia (`"quanto custa a cirurgia de catarata?"` → não dispara) nem com exames (`"valor do exame de OCT?"` → cai no handoff A).

### C) Amanhã à tarde sem agenda
Fluxo do assistente:
- Detecta `janela = { tipo: "amanha", periodoDia: "tarde" }`.
- `podeOferecerHorarios(estado)` é `false` (nenhuma data escolhida ainda).
- Mensagem enviada: `"Não localizei agenda para amanhã (tarde). Estas são as próximas datas disponíveis: 1) sexta 18/07 ..."`.
- **Não** lista horários de 22/07 até que o paciente responda `"22/07"`.

---

## Falsos positivos protegidos

- Guard de exames não dispara em: `"exame de consciência"`, `"exame nacional da OAB"`, perguntas genéricas de convênio (`"meu convênio é Bradesco"`) sem menção a exame.
- Guard de valor não dispara para cirurgia/exame/lente/YAG/refrativa/LASIK/PRK.

## Janela de contexto para EXAMES (rev-2)

- Só considera mensagens IN **anteriores** à atual (exclusão por `id` **e** por `created_at`).
- Janela de **45 minutos** — mensagens fora disso não geram handoff.
- Só herda handoff via histórico se a mensagem atual for uma **continuação contextual** (`isMensagemContinuacao`): respostas curtas (`sim`, `não`, `ok`), retomadas (`já fiz`, `e pelo plano?`, `no HGP`, `como faço?`, `onde faço?`, `prefiro quando estiver pronto`, `fico no aguardo`). Uma mensagem nova e independente (`quero agendar uma consulta`) **não** herda handoff antigo.

## Idempotência da decisão (rev-2)

- Após computar os guards, a decisão completa é persistida em `mensagens_whatsapp.payload.guard_decision` (`version=2`).
- Duplicatas por `mensagem_externa_id` (early return ou race no UNIQUE) **carregam a mesma decisão persistida** e devolvem os mesmos campos (`handoff_required`, `notification_summary`, `patient_reply`, `resume_agent`, …), sempre com `duplicada:true`.
- **Nunca reenviam, re-logam nem re-escalam.** Se um registro legado não tiver `guard_decision`, ele é reavaliado UMA vez de forma segura (sem log, sem transição de status/bot) e a decisão passa a ser persistida.
- Auditoria em `system_logs` (`category="whatsapp"`, `source="registrar-mensagem-in-n8n"`, `message ∈ {"handoff_exames","immediate_reply_valor_consulta"}`) só ocorre no primeiro cálculo.

## VALOR DA CONSULTA — retomada sem 2ª IA (rev-2)

Quando `valor_consulta` casa, `registrar-mensagem-in-n8n` lê `agendamentos.estado_atendimento` do card e devolve `patient_reply = "A consulta particular … R$ 300,00." + próximo campo pendente`, com `resume_agent:false`. O n8n envia UMA mensagem e **não chama LLM neste turno**.

Mapa determinístico (`PROXIMO_DADO_POR_ESTADO`):

| `estado_atendimento`         | Próximo campo pedido               |
| ---------------------------- | ---------------------------------- |
| `coletando_nome`             | Nome completo                      |
| `coletando_data_nascimento`  | Data de nascimento (dd/mm/aaaa)    |
| `coletando_tipo_atendimento` | Particular ou convênio             |
| `coletando_convenio`         | Nome do convênio                   |
| `coletando_local`            | Clinicor ou HGP                    |
| `oferecendo_datas`           | Data de preferência                |
| `oferecendo_horarios`        | Horário de preferência             |
| `aguardando_confirmacao`     | "Posso confirmar seu agendamento?" |

Estado ausente/desconhecido → devolve apenas a frase fixa, `resume_agent:false`.

Handoff (exames) permanece com `resume_agent:false` também: o `patient_reply` já resolve o turno.

## Não faz

- Não invoca Evolution API.
- Não envia mensagem direto pela Edge Function no fluxo do guard: o n8n é quem envia (ManyChat).
- Não altera dados de produção retroativamente.
