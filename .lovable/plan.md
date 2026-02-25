

## Fix: MCP retornando horarios bloqueados como disponiveis

### Causa raiz

O MCP server chama funcoes RPC do banco (`listar_horarios_disponiveis`, `validar_horario`, `criar_agendamento`) que consultam a tabela estatica `horarios_disponiveis`. Essa tabela nao e usada pelo sistema real de disponibilidade, que usa `disponibilidade_semanal` + `bloqueios_agenda` + `agendamentos`.

Resultado: o MCP ignora completamente bloqueios, agendamentos existentes e regras de disponibilidade semanal.

### Solucao

Alterar o MCP para chamar as **Edge Functions** existentes (`listar-horarios-disponiveis`, `validar-agendamento`, `criar-agendamento`) via HTTP, em vez das funcoes RPC quebradas. Essas edge functions ja implementam toda a logica correta de disponibilidade.

### Mudancas

**Arquivo: `supabase/functions/mcp-agendamento/index.ts`**

1. Substituir `supabaseRPC()` por uma funcao `callEdgeFunction(name, body)` que faz POST para as edge functions existentes no mesmo projeto Supabase.

2. Atualizar os 3 handlers de tools:

- **listar_horarios_disponiveis**: Chamar edge function `listar-horarios-disponiveis` com body `{ data, local_atendimento }` em vez de RPC
- **validar_horario**: Chamar edge function `validar-agendamento` com body `{ data_agendamento, hora_agendamento, local_atendimento }` em vez de RPC
- **criar_agendamento**: Chamar edge function `criar-agendamento` com body completo em vez de RPC

### Detalhe tecnico

```text
// Nova funcao helper
async function callEdgeFunction(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.text();
  try { return JSON.parse(data); } catch { return data; }
}

// Tool 1 handler: chama listar-horarios-disponiveis
handler: async (args) => {
  const result = await callEdgeFunction("listar-horarios-disponiveis", {
    data: args.data,
    local_atendimento: args.local ?? null,
  });
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}

// Tool 2 handler: chama validar-agendamento
handler: async (args) => {
  const result = await callEdgeFunction("validar-agendamento", {
    data_agendamento: args.data_agendamento,
    hora_agendamento: args.hora_agendamento,
    local_atendimento: args.local_atendimento,
  });
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}

// Tool 3 handler: chama criar-agendamento
handler: async (args) => {
  const result = await callEdgeFunction("criar-agendamento", {
    nome_completo: args.nome_completo,
    telefone_whatsapp: args.telefone_whatsapp,
    tipo_atendimento: args.tipo_atendimento,
    local_atendimento: args.local_atendimento,
    convenio: args.convenio,
    data_agendamento: args.data_agendamento,
    hora_agendamento: args.hora_agendamento,
    origem: "mcp",
  });
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
```

### Impacto

- Corrige o problema: MCP passara a respeitar bloqueios, disponibilidade semanal e agendamentos existentes
- Reutiliza toda a logica ja validada das edge functions existentes
- Apenas 1 arquivo modificado: `supabase/functions/mcp-agendamento/index.ts`

