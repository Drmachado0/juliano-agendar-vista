
# Corrigir movimentacao automatica de leads para "Aguardando"

## Problema
Na funcao `listarAgendamentosPorStatus` em `src/services/agendamentos.ts` (linha 304), ha uma regra que forca **todos** os registros com `status_funil = 'lead'` para a coluna "NOVO LEAD", independentemente do valor de `status_crm`. Isso impede que leads movidos para "AGUARDANDO" pela edge function aparecam na coluna correta.

## Solucao
Alterar a logica de agrupamento para respeitar o `status_crm` do lead quando ele ja foi atualizado para "AGUARDANDO". A regra passa a ser:
- Se `status_funil = 'lead'` **e** `status_crm = 'NOVO LEAD'` (ou vazio) --> coluna "NOVO LEAD"
- Se `status_funil = 'lead'` **e** `status_crm = 'AGUARDANDO'` --> coluna "AGUARDANDO"
- Demais registros seguem o `status_crm` normalmente

## Arquivo afetado
- **`src/services/agendamentos.ts`** (linhas 303-308): Ajustar a condicional para que leads com `status_crm = 'AGUARDANDO'` sejam agrupados na coluna correta em vez de serem forcados para "NOVO LEAD".

## Codigo atual (problema)
```typescript
if (statusFunil === 'lead') {
  grouped['NOVO LEAD'].push(agendamento as Agendamento);
} else if (grouped[status]) {
  grouped[status].push(agendamento as Agendamento);
}
```

## Codigo corrigido
```typescript
if (statusFunil === 'lead' && status === 'NOVO LEAD') {
  grouped['NOVO LEAD'].push(agendamento as Agendamento);
} else if (statusFunil === 'lead' && status === 'AGUARDANDO') {
  grouped['AGUARDANDO'].push(agendamento as Agendamento);
} else if (grouped[status]) {
  grouped[status].push(agendamento as Agendamento);
}
```

Isso permite que a automacao de boas-vindas mova o card corretamente para "Aguardando" quando a mensagem e enviada.
