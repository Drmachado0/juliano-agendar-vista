
# Ordenação por data + filtros nos cards do CRM Kanban

## Objetivo
Tornar a ordem padrão dos cards do CRM por **data da consulta (mais próxima primeiro)** e adicionar uma barra de filtros acima do Kanban.

## Diagnóstico
- `src/services/agendamentos.ts` (`listarAgendamentosPorStatus`) ordena por data **decrescente** (mais distante no topo) e usa `created_at` como fallback, misturando leads sem data no topo.
- `src/pages/admin/CRM.tsx` exibe direto o que vem do service, sem filtros.

## Mudanças

### 1. Nova ordenação padrão — `src/services/agendamentos.ts`
Ajustar o `sort` em `listarAgendamentosPorStatus`:
1. Cards **com `data_agendamento`** primeiro, em ordem **ascendente** (consulta mais próxima no topo).
2. Empate → `hora_agendamento` ascendente.
3. Cards **sem data** vão para o final, por `created_at` descendente.

```ts
grouped[key].sort((a, b) => {
  const aTem = !!a.data_agendamento;
  const bTem = !!b.data_agendamento;
  if (aTem && !bTem) return -1;
  if (!aTem && bTem) return 1;
  if (aTem && bTem) {
    const dt = a.data_agendamento!.localeCompare(b.data_agendamento!);
    if (dt !== 0) return dt;
    return (a.hora_agendamento || '').localeCompare(b.hora_agendamento || '');
  }
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
});
```

### 2. Novo componente `src/components/admin/CRMFilters.tsx`
Barra compacta com:
- **Busca**: nome ou telefone (debounce 300ms).
- **Local**: Todos / Clinicor / HGP / Belém (IOB-Vitria) / Hospital Geral.
- **Tipo**: Todos / Consulta / Retorno / Exame / Cirurgia.
- **Convênio**: Todos / Particular / Bradesco / Unimed / Cassi / Sul América / Outro.
- **Período da consulta**: Todas / Hoje / Próximos 7 dias / Este mês / Atrasados / Sem data.
- **Ordenação**: Data (mais próxima) ▼ / Data (mais distante) / Cadastro mais recente / Cadastro mais antigo.
- Botão **Limpar filtros** + chip "X resultados".

```ts
interface CrmFilters {
  busca: string;
  local?: string;
  tipo?: string;
  convenio?: string;
  periodo: 'todos' | 'hoje' | '7dias' | 'mes' | 'atrasados' | 'sem_data';
  ordenacao: 'data_asc' | 'data_desc' | 'created_desc' | 'created_asc';
}
```

### 3. Integração em `src/pages/admin/CRM.tsx`
- `useState<CrmFilters>` com defaults `{ busca: '', periodo: 'todos', ordenacao: 'data_asc' }`.
- Renderizar `<CRMFilters />` entre as estatísticas e o Kanban.
- Aplicar filtros + ordenação no client via `useMemo` sobre `agendamentosPorStatus`, produzindo `agendamentosFiltrados` para os `KanbanColumn`.
- Contadores do header e da coluna refletem o **resultado filtrado**, com total original no tooltip ("8 de 23").
- Persistir filtros em `localStorage` (`crm:filters:v1`).

### 4. Ajuste opcional em `KanbanCard.tsx`
Badge sutil "Atrasado" quando `data_agendamento < hoje` e status ≠ `ATENDIDO`, dando eco visual ao filtro "Atrasados".

## Arquivos
- `src/services/agendamentos.ts` — ordenação padrão.
- `src/components/admin/CRMFilters.tsx` — **novo**.
- `src/pages/admin/CRM.tsx` — integração + memoização + persistência.
- `src/components/admin/KanbanCard.tsx` — badge "Atrasado" (opcional).

## Fora do escopo
- Filtros por data de cadastro.
- Persistência server-side dos filtros.
- Filtro por coluna de status (o Kanban já é essa visão).
