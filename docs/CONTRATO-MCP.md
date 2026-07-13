# Contrato MCP — mcp-agendamento (rev-3, 2026-07-13)

Endpoint: `POST /functions/v1/mcp-agendamento` (JSON-RPC 2.0). Autenticação
por segredo compartilhado em `x-n8n-secret` (aliases: `x-mcp-secret`,
`x-api-key`, `apikey`, `Authorization: Bearer <segredo>`).

`GET` responde apenas health check: `{ "success": true, "service": "mcp-agendamento" }`.
Não expõe tools, headers aceitos, origem do segredo ou configuração.

## Tools expostas

| Nome                          | Descrição resumida                                        |
| ----------------------------- | --------------------------------------------------------- |
| `listar_horarios_disponiveis` | Horários de uma data/local.                               |
| `validar_horario`             | Verifica se um `(data, hora, local)` está livre.          |
| `listar_datas_disponiveis`    | Datas do mês com horários disponíveis.                    |
| `criar_agendamento`           | Confirma um card EXISTENTE (fail-closed, ver abaixo).     |
| `cancelar_agendamento`        | Cancela agendamento por `agendamento_id` ou `telefone`.   |

> ⚠️ O nome real da validação individual é **`validar_horario`**
> (não `validar_agendamento`).

## Regras fail-closed de `criar_agendamento`

Input obrigatório:

```json
{
  "agendamento_id":    "<UUID do card do lead>",
  "nome_completo":     "…",
  "telefone_whatsapp": "…",
  "local_atendimento": "Clinicor | HGP | IOB | Vitria",
  "convenio":          "…",
  "data_agendamento":  "YYYY-MM-DD",
  "hora_agendamento":  "HH:MM"
}
```

Motivos possíveis quando `sucesso: false`:

- `agendamento_id_obrigatorio` — sem UUID, tool NUNCA cria card novo.
- `nome_paciente_invalido`.
- `dados_incompletos`.
- `clinica_desconhecida` — `local_atendimento` fora da lista canônica.
- `telefone_invalido`.
- `agendamento_nao_encontrado`.
- `card_sandbox` — `is_sandbox=true`.
- `card_terminal` — status_crm/status_funil já é terminal.
- `risco_paciente_errado` — `telefone_canonico` do card ≠ do input.
- `horario_indisponivel`.
- `erro_interno`.

Garantias:

1. Carga do card **exclusivamente por `.eq("id", agendamento_id)`**. Sem
   fallback por telefone, sem scan por `last8`, sem `limit(200)`.
2. Match de telefone via `telefone_canonico` **exato** (função compartilhada).
3. `clinica_id` sempre resolvido em `_shared/validarDisponibilidade.ts`
   (`resolverClinica`) e persistido no patch junto com o `local_atendimento`
   canônico.
4. Update via `.eq("id", agendamento_id)` — o índice único parcial
   `uniq_agendamento_slot_ativo` é a última defesa contra corrida.
5. Notificações (`confirmar-agendamento-whatsapp`, `notificar-n8n`) são
   aguardadas em `Promise.allSettled`. Falhas ficam sanitizadas em log e o
   response inclui `notificacoes_ok: boolean`.
