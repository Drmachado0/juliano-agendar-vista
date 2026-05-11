## Objetivo

Fazer o agente Letícia (n8n) começar cada turno **já sabendo quem é o paciente**, sem precisar chamar tools para descobrir. Para isso:

1. Adicionar um modo "snapshot compacto" na edge function `buscar-contexto-paciente` (otimizado para caber no system prompt).
2. Documentar o fluxo n8n que chama essa function antes do agente AI e injeta o JSON no system message.

Nada disso muda comportamento do site — é só backend (edge function) + orientação de configuração do n8n.

---

## Parte 1 — Ajustes em `buscar-contexto-paciente`

### 1.1 Aceitar parâmetro `formato`

Body novo:
```json
{
  "telefone_whatsapp": "5591999999999",
  "formato": "completo" | "compacto"   // default: "completo" (mantém compat)
}
```

### 1.2 Quando `formato = "compacto"`

Retornar payload otimizado para prompt (campos curtos, sem nulls, sem ruído):

```json
{
  "conhecido": true,
  "paciente": {
    "primeiro_nome": "Maria",
    "nome_completo": "Maria Silva",
    "convenio": "Unimed",
    "tipo_atendimento": "Consulta",
    "local": "Belém (IOB / Vitria)",
    "idade": 42
  },
  "agendamento_ativo": {
    "id": "uuid",
    "data": "2026-05-20",
    "hora": "14:30",
    "status": "agendado",
    "dias_ate": 9
  },
  "estado_atendimento": "novo",
  "status_crm": "NOVO LEAD",
  "ultimas_mensagens_resumo": [
    { "de": "paciente", "quando": "2026-05-11T14:02:00Z", "texto": "Boa tarde..." },
    { "de": "leticia",  "quando": "2026-05-11T14:03:00Z", "texto": "Olá! ..." }
  ],
  "telefone_normalizado": "5591999999999",
  "gerado_em": "2026-05-11T22:00:00Z"
}
```

Regras do compacto:
- Remove qualquer chave com valor `null` / vazio.
- `idade` calculada a partir de `data_nascimento` (se houver).
- `dias_ate` calculado a partir de `data_agendamento` em `America/Belem`.
- Últimas mensagens limitadas a 6 (não 10), texto truncado em 200 chars.
- Quando paciente não existe: `{ "conhecido": false, "telefone_normalizado": "...", "gerado_em": "..." }`.

### 1.3 Manter `formato = "completo"` exatamente como está hoje (não quebra n8n existente nem outras integrações).

---

## Parte 2 — Configuração do n8n (documentação para o usuário)

Fluxo recomendado por mensagem recebida:

```text
[Webhook WhatsApp]
       │
       ▼
[HTTP Request: buscar-contexto-paciente  formato=compacto]
       │  → salva resposta em {{$json.contexto_paciente}}
       ▼
[AI Agent (Letícia)]
   system prompt =
     <prompt base da Letícia>
     ---
     CONTEXTO DO PACIENTE (snapshot atual, gerado pelo backend):
     ```json
     {{ JSON.stringify($json.contexto_paciente) }}
     ```
     Use esse contexto como verdade. Só chame tools se precisar
     ALTERAR algo (atualizar agendamento, mudar status CRM, etc).
   user message = mensagem recebida do paciente
       │
       ▼
[resto do fluxo: registrar-mensagem-in-n8n, enviar-whatsapp, etc.]
```

Pontos importantes a destacar na doc:
- O snapshot é **por turno**: chama de novo a cada mensagem nova (estado pode ter mudado).
- Se `conhecido = false`, a Letícia deve se apresentar e pedir nome/contexto.
- Tools de **leitura** (ex.: `buscar-contexto-paciente`, `mcp-agendamento` listar horários) continuam disponíveis caso o agente precise de algo fora do snapshot.
- Tools de **escrita** (`atualizar-agendamento-por-telefone`, `atualizar-status-crm`) continuam exatamente iguais.

---

## Parte 3 — Detalhes técnicos

- Arquivo a editar: `supabase/functions/buscar-contexto-paciente/index.ts`
  - Adicionar `formato: z.enum(["completo","compacto"]).optional().default("completo")` no `BodySchema`.
  - Extrair montagem de resposta atual em `buildCompleto(...)`.
  - Criar `buildCompacto(...)` com as regras da seção 1.2 + helper `stripNulls`.
  - Calcular `idade` e `dias_ate` em `America/Belem`.
  - Truncar texto de mensagens (200 chars) e limitar a 6.
- Sem mudanças de schema no banco.
- Sem mudanças no frontend.
- `verify_jwt = false` já está no `config.toml` para essa função.
- Auth segue por header `x-n8n-secret`.

---

## Parte 4 — Como validar (sem n8n)

`curl` direto para conferir o snapshot compacto:

```bash
curl -X POST \
  https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/buscar-contexto-paciente \
  -H "Content-Type: application/json" \
  -H "x-n8n-secret: $N8N_SHARED_SECRET" \
  -d '{"telefone_whatsapp":"5591XXXXXXXX","formato":"compacto"}'
```

Esperado:
- Paciente conhecido → JSON enxuto pronto para colar em system prompt.
- Paciente desconhecido → `{ "conhecido": false, ... }`.
- `formato` ausente ou `"completo"` → resposta antiga, idêntica à de hoje.

---

## Fora do escopo

- Não vou mexer no n8n (não tenho acesso ao workflow); entrego a edge function pronta + instruções de configuração.
- Não vou criar página de admin para isso.
- Não vou alterar tools de escrita existentes.
