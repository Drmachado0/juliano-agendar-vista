# Contrato — buscar-contexto-paciente (n8n → CRM)

> Revisado 2026-07-13. Endpoint autenticado por `x-n8n-secret` (timing-safe).

## Endpoint

`POST /functions/v1/buscar-contexto-paciente`

Headers:
- `x-n8n-secret: <segredo>` (obrigatório)
- `x-request-id: <uuid>` (opcional; correlaciona logs)
- `Content-Type: application/json`

Body:
```json
{ "telefone_whatsapp": "+55 91 99130-0174", "formato": "completo" }
```
`formato` aceita `completo` (default) ou `compacto`.

## Regras operacionais

1. Telefone é normalizado para `telefone_canonico` (11 dígitos, DDI removido) via RPC `telefone_canonico` (fallback local determinístico).
2. Toda busca ignora `is_sandbox = true`.
3. Lead ativo = `status_crm` NÃO terminal (case-insensitive). Terminais: `ATENDIDO`, `CANCELADO`, `COMPARECEU`.
   - `0 ativos` → `conhecido=false`.
   - `1 ativo` → contexto do lead.
   - `>1 ativos` → `ambiguo=true`, `paciente=null`, `agendamento_ativo=null`.
4. `agendamento_ativo` **só existe** quando `data_agendamento >= hoje (America/Belem)` E status não terminal. Data passada nunca aparece como ativa.
5. Lead ativo sem data → `paciente/status/estado` presentes, `agendamento_ativo=null`.
6. Histórico é retornado separadamente em `ultimo_atendimento_historico` (data passada ou status terminal). Nunca dentro de `agendamento_ativo`. Nunca sandbox.
7. Mensagens buscadas por `telefone_canonico` exato (sem `ilike`, sem match por últimos 8 dígitos).

## Erros

| Status | error                        | Semântica |
|--------|------------------------------|-----------|
| 400    | `invalid_json` / `invalid_body` | payload inválido |
| 401    | `Unauthorized`               | segredo ausente/errado |
| 500    | `agendamentos_lookup_failed` | erro Postgres — n8n pode retry |
| 500    | `mensagens_lookup_failed`    | erro Postgres — n8n pode retry |
| 500    | `server_misconfigured`       | env ausente |

Respostas de erro NUNCA vazam PII ou texto bruto do banco. Logs internos em `system_logs` usam telefone mascarado (últimos 4).

## Resposta — formato `completo`

```json
{
  "conhecido": true,
  "ambiguo": false,
  "paciente": { "nome_completo": "...", "convenio": "...", "tipo_atendimento": "...", "local_atendimento": "..." },
  "agendamento_ativo": { "id": "...", "data": "2026-07-20", "hora": "14:00", "status": "confirmado", "local": "...", "dias_ate": 7 },
  "ultimo_atendimento_historico": { "data": "2026-06-19", "hora": "14:00", "local": "HGP", "status": "COMPARECEU" },
  "status_crm": "NOVO LEAD",
  "estado_atendimento": "novo",
  "ultimas_mensagens": [...],
  "telefone_canonico": "91991300174",
  "agendamento_id": "...",
  "request_id": "..."
}
```

## Correção 2026-07-13

Bug em produção: telefone `91991300174` retornava agendamento de `19/06/2026` (data passada, `is_sandbox=true`) como ativo. Causa: scan dos últimos 200 agendamentos + match por últimos 8 dígitos + falta de filtro por data e sandbox. Reescrita completa aplica regras 1–7 acima.
