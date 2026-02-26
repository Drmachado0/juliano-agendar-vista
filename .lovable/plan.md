

# Adicionar tool `listar_datas_disponiveis` ao MCP

## Objetivo
Permitir que o agente do n8n consulte todas as datas com vagas disponíveis em um mês inteiro, para oferecer opções ao paciente sem precisar testar data por data.

## O que será feito

### 1. Criar a Edge Function `listar-datas-disponiveis`
Nova função que recebe `mes`, `ano` e `local_atendimento` (opcional) e retorna um array com as datas que possuem vagas e a quantidade de slots livres em cada uma.

A lógica já existe no frontend (`src/services/disponibilidadePublica.ts` -> `listarDatasComSlotsDisponiveis`), será portada para uma Edge Function Deno com acesso direto ao banco.

**Entrada (POST JSON):**
```json
{
  "mes": 3,
  "ano": 2026,
  "local_atendimento": "Clinicor"
}
```

**Saída:**
```json
{
  "mes": 3,
  "ano": 2026,
  "local_atendimento": "Clinicor",
  "datas_disponiveis": [
    { "data": "2026-03-19", "slots_disponiveis": 7 },
    { "data": "2026-03-20", "slots_disponiveis": 5 },
    { "data": "2026-03-21", "slots_disponiveis": 8 }
  ],
  "total_datas": 3
}
```

### 2. Registrar a tool no MCP server
Adicionar `listar_datas_disponiveis` ao array `TOOLS` e ao `executeTool` em `supabase/functions/mcp-agendamento/index.ts`.

**Definição da tool:**
- name: `listar_datas_disponiveis`
- description: "Lista todas as datas de um mês que possuem horários disponíveis, com a quantidade de vagas em cada data."
- Parâmetros: `mes` (number, 1-12), `ano` (number), `local` (string, opcional)

## Detalhes Técnicos

### Edge Function `listar-datas-disponiveis/index.ts`
- Reutiliza os mesmos helpers já usados em `listar-horarios-disponiveis` (mapeamento de clínica, geração de slots, verificação de bloqueios)
- Itera todos os dias do mês solicitado (ignorando datas passadas)
- Para cada dia: verifica disponibilidade semanal, disponibilidade específica, bloqueios de dia inteiro, bloqueios de intervalo e agendamentos existentes
- Retorna apenas datas com pelo menos 1 slot livre
- JWT desabilitado (público, igual às outras funções de agendamento)

### Alterações no MCP server (`mcp-agendamento/index.ts`)
- Adicionar entrada no array `TOOLS` com o schema da nova tool
- Adicionar handler no `executeTool` que chama `callEdgeFunction("listar-datas-disponiveis", ...)`

### Arquivos modificados/criados
1. **Novo:** `supabase/functions/listar-datas-disponiveis/index.ts`
2. **Editado:** `supabase/functions/mcp-agendamento/index.ts` (adicionar tool)

### Uso no n8n (JSON-RPC)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "listar_datas_disponiveis",
    "arguments": { "mes": 3, "ano": 2026, "local": "Clinicor" }
  }
}
```

