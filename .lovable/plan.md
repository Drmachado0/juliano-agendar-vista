
## Problema

O modal "Histórico de conversa" no card do Kanban aparece vazio mesmo quando o paciente tem mensagens trocadas, porque a busca atual:

1. Busca mensagens com `agendamento_id = id do card atual`
2. Como fallback, busca mensagens com `agendamento_id IS NULL` cujo telefone bate

Resultado: mensagens vinculadas a **outro** `agendamento_id` do mesmo paciente (ex.: agendamento anterior) ficam invisíveis. Para o caso do screenshot (Raimundo, 91985589084) não há de fato nenhuma mensagem registrada — então o modal está correto exibindo "vazio". Mas para outros pacientes recorrentes o histórico está incompleto.

## Solução (1 arquivo, mudança cirúrgica)

### `src/services/mensagens.ts` — função `listarMensagensPorAgendamento`

Trocar a estratégia: **a busca passa a ser feita primariamente por telefone** (últimos 8 dígitos), unindo com a busca por `agendamento_id` para garantir que nada se perca.

Nova lógica:
1. Se `telefone` for fornecido: buscar `mensagens_whatsapp` onde `telefone ILIKE %ultimos8dig%` (sem filtrar `agendamento_id`).
2. Em paralelo (sempre): buscar mensagens onde `agendamento_id = id` (cobre casos raros em que o telefone do agendamento foi alterado depois das mensagens chegarem).
3. Unir resultados, deduplicar por `id`, ordenar `created_at` ASC.
4. Se não houver telefone, manter o comportamento atual (apenas por `agendamento_id`).

Pseudocódigo:
```ts
const last8 = telefone ? normalizePhone(telefone) : null;

const [{data: porAgendamento}, {data: porTelefone}] = await Promise.all([
  supabase.from("mensagens_whatsapp").select("*").eq("agendamento_id", agendamentoId),
  last8
    ? supabase.from("mensagens_whatsapp").select("*").ilike("telefone", `%${last8}%`)
    : Promise.resolve({data: []}),
]);

const todas = [...(porAgendamento||[]), ...(porTelefone||[])];
const unicas = Array.from(new Map(todas.map(m => [m.id, m])).values());
unicas.sort((a,b) => +new Date(a.created_at) - +new Date(b.created_at));
```

## Não muda
- `HistoricoConversaModal.tsx` (continua chamando a mesma função, recebendo todas as mensagens unidas).
- Estrutura de tabelas, RLS, edge functions, n8n, lógica do Kanban.
- Realtime: o canal já reage a qualquer mudança em `mensagens_whatsapp`.

## Observação ao usuário
Para o paciente Raimundo Brito (do print) **não existe nenhuma mensagem registrada** no banco — então mesmo após a correção esse card específico continuará mostrando "Nenhuma mensagem trocada ainda". A correção beneficia todos os outros pacientes que tenham conversa registrada com esse número.
