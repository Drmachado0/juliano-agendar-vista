# Contrato — listar-datas-disponiveis e listar-horarios-disponiveis

_Revisado 2026-07-13 (correção do bug de agenda HGP julho/2026)._

Ambas as edge functions rodam com `verify_jwt=false` e exigem o header
`x-n8n-secret` (validado por `requireN8nSecret`, timing-safe). Toda resposta
inclui `request_id` (echo de `x-request-id` ou UUID gerado) para correlação
ponta-a-ponta.

## Regras compartilhadas

- **Data/hora atuais** sempre em **America/Belem** (UTC-3, sem DST). Nunca
  dependem do timezone do runtime (Deno = UTC).
- **Filtro de clínica** por slug estrito:
  - `HGP` / `Hospital Geral` → `["hgp"]`
  - `Clinicor` → `["clinicor"]`
  - `Belém (IOB / Vitria)` → `["iob", "vitria"]`
  - Local vazio = sem filtro.
- **Falha de query** (clínicas, disponibilidades, bloqueios, agendamentos)
  retorna **500 sanitizado** — nunca é interpretada como lista vazia.
- **Sandbox** (`is_sandbox = true`) é sempre excluído dos ocupados.
- **Agendamentos ocupados** só bloqueiam se pertencerem à clínica alvo
  (`clinica_id` ∈ `clinicaIds`) — uma unidade nunca bloqueia horários da
  outra. Fallback textual usa `local_atendimento` quando `clinica_id` for
  nulo em registros legados.
- **`modelo_id`** é resolvido contra `disponibilidade_semanal` quando
  `hora_inicio`/`hora_fim` chegam nulos (dia aberto via aplicação de
  modelo).

## `POST /listar-datas-disponiveis`

### Request

```json
{
  "mes": 7,
  "ano": 2026,
  "local_atendimento": "Hospital Geral de Paragominas",
  "auto_avancar": true
}
```

- `auto_avancar` é opcional (default `true`).

### Comportamento

1. Se `mes/ano` estiver **inteiramente no passado** (mês solicitado < mês
   atual em Belém), a função **ajusta automaticamente** para o mês atual e
   marca `ajustado_periodo_passado=true`. `periodo_solicitado` preserva a
   entrada original.
2. Se `auto_avancar=true` (default) e o mês consultado não tiver datas,
   avança **até 6 meses** (contando o base) buscando a primeira agenda.
   Nunca devolve "sem datas" enquanto existir agenda no horizonte.
3. Dias passados dentro do mês corrente são pulados.

### Response 200

```json
{
  "periodo_solicitado": { "ano": 2026, "mes": 6 },
  "periodo_consultado": { "ano": 2026, "mes": 7 },
  "ajustado_periodo_passado": true,
  "local_atendimento": "Hospital Geral de Paragominas",
  "local_resolvido": { "slugs": ["hgp"], "ids": ["<uuid>"] },
  "datas_disponiveis": [
    { "data": "2026-07-22", "slots_disponiveis": 6 },
    { "data": "2026-07-23", "slots_disponiveis": 6 },
    { "data": "2026-07-24", "slots_disponiveis": 6 }
  ],
  "total_datas": 3,
  "horizonte_meses": 1,
  "auto_avancar": true,
  "request_id": "…"
}
```

### Erros

| Status | `error`                          | Quando                                        |
| ------ | -------------------------------- | --------------------------------------------- |
| 400    | `Campos ... obrigatórios`        | `mes`/`ano` ausentes ou inválidos             |
| 401    | `Unauthorized`                   | Sem/`x-n8n-secret` inválido                   |
| 500    | `clinicas_lookup_failed`         | Falha ao buscar `clinicas`                    |
| 500    | `disponibilidade_especifica_lookup_failed` | Falha ao buscar disponibilidade      |
| 500    | `disponibilidade_semanal_lookup_failed`    | Falha ao buscar modelos               |
| 500    | `bloqueios_*_lookup_failed`      | Falha ao buscar bloqueios                     |
| 500    | `agendamentos_lookup_failed`     | Falha ao buscar agendamentos                  |
| 500    | `internal_error`                 | Erro inesperado (mensagem original em log)    |

## `POST /listar-horarios-disponiveis`

### Request

```json
{ "data": "2026-07-22", "local_atendimento": "Hospital Geral de Paragominas" }
```

### Comportamento

1. Rejeita `data < hoje` (em Belém) devolvendo `motivo="data_no_passado"`.
2. Se a data não tiver `disponibilidade_especifica`, devolve
   `motivo="data_nao_aberta_para_agendamento"`.
3. Slots são gerados a partir das disponibilidades da data (resolvendo
   `modelo_id` quando necessário), depois filtrados por bloqueios de
   intervalo e por agendamentos ocupados na clínica correta.
4. Para o dia corrente em Belém, remove slots já passados + 30min de
   margem.

### Response 200

```json
{
  "data": "2026-07-22",
  "local_atendimento": "Hospital Geral de Paragominas",
  "local_resolvido": { "slugs": ["hgp"], "ids": ["<uuid>"] },
  "horarios_disponiveis": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30"],
  "total": 6,
  "request_id": "…"
}
```

### Erros

Mesmos códigos sanitizados que `listar-datas-disponiveis`.

## Bug corrigido (2026-07-13)

Cenário: agente consultou HGP em **junho/2026** com hoje = **13/07/2026**.
Resposta vinha vazia mesmo com `disponibilidade_especifica` cadastrada para
HGP em 22/23/24 de julho (modelo 14:00–17:00).

Causas encontradas:

- `hoje` calculado com `new Date()` (UTC do runtime) e `setHours(0,0,0,0)`
  causavam offsets em Belém.
- Filtro de clínica não era estrito — datas de outras unidades podiam
  ocupar slots do HGP.
- Erros de query eram silenciados como lista vazia.
- Não havia auto-avanço quando o período consultado era antigo/vazio.

Todas foram corrigidas com auth timing-safe, base horária em America/Belem,
filtro por slug estrito, tratamento sanitizado de erros de query e auto
avanço de até 6 meses.
