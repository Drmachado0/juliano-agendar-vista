

# Criar MCP Server de Agendamento (Edge Function)

## O que sera criado

Um MCP Server hospedado como Edge Function que expoe 3 ferramentas para assistentes de IA consultarem horarios e criarem agendamentos automaticamente.

```text
+--------------------+       MCP Protocol       +---------------------+
|  Cliente MCP       | -----------------------> |  mcp-agendamento    |
|  (n8n, Claude,     |                          |  (Edge Function)    |
|   Cursor, etc.)    | <----------------------- |                     |
+--------------------+   JSON responses         +---------------------+
                                                       |
                                                       v
                                                +---------------------+
                                                |  Banco de Dados     |
                                                |  (disponibilidade,  |
                                                |   agendamentos,     |
                                                |   bloqueios)        |
                                                +---------------------+
```

## Ferramentas MCP expostas

| Ferramenta | Descricao | Parametros obrigatorios |
|---|---|---|
| `listar_horarios_disponiveis` | Lista horarios livres para uma data | `data` (YYYY-MM-DD) |
| `criar_agendamento` | Cria agendamento completo com validacao | `nome_completo`, `telefone_whatsapp`, `tipo_atendimento`, `local_atendimento`, `convenio`, `data_agendamento`, `hora_agendamento` |
| `validar_horario` | Verifica se um horario esta disponivel | `data_agendamento`, `hora_agendamento`, `local_atendimento` |

## Arquivos a criar

### 1. `supabase/functions/mcp-agendamento/deno.json`

Configuracao de imports para mcp-lite (v0.10+) e Hono.

### 2. `supabase/functions/mcp-agendamento/index.ts`

Edge Function principal com:
- **McpServer** configurado como "dr-juliano-agendamento" v1.0.0
- **StreamableHttpTransport** do mcp-lite para comunicacao HTTP
- **Hono** para roteamento
- Reutiliza logica existente de `_shared/validarDisponibilidade.ts` (getClinicaSlugsFromLocal, gerarSlots, horarioDentroBloqueio, validarDisponibilidade)
- Cliente do banco criado com `SUPABASE_SERVICE_ROLE_KEY`
- Tool `listar_horarios_disponiveis`: mesma logica da edge function existente `listar-horarios-disponiveis`
- Tool `criar_agendamento`: valida disponibilidade, insere no banco, dispara notificacoes WhatsApp e e-mail em background, origem marcada como "mcp"
- Tool `validar_horario`: wrapper simples em torno de `validarDisponibilidade()`

### 3. Atualizar `supabase/config.toml`

Adicionar entrada para a nova function com JWT desabilitado (acesso publico para clientes MCP):

```toml
[functions.mcp-agendamento]
verify_jwt = false
```

## Endpoint final

```
https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/mcp-agendamento
```

## Detalhes tecnicos

- Usa `mcp-lite@^0.10.0` (versao minima obrigatoria para compatibilidade com Deno)
- Cada tool retorna `content: [{ type: "text", text: JSON.stringify(...) }]` conforme protocolo MCP
- Agendamentos criados via MCP tem `origem: "mcp"` para rastreabilidade
- Notificacoes (WhatsApp e e-mail) sao disparadas automaticamente apos criacao
- Nenhuma alteracao de codigo no frontend e necessaria

