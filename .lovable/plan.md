## Diagnóstico

A coluna **"Precisa de humano"** aparece vazia no Kanban porque há um conflito de nomenclatura entre o banco e o código:

- Banco (`agendamentos.status_crm`) tem **6 registros** com o valor `PRECISA_DE_HUMANO` (com underscore).
- O Kanban (`src/pages/admin/CRM.tsx`) declara a coluna como `"AGUARDANDO HUMANO"` (com espaço).
- A edge function `assistente-pre-agendamento` grava em outro valor ainda: `"AGUARDANDO HUMANO"`.
- O agrupador `listarAgendamentosPorStatus` (`src/services/agendamentos.ts`) só conhece `NOVO LEAD / AGUARDANDO / CLINICOR / HGP / BELÉM / ATENDIDO`. Qualquer status fora dessa lista (incluindo `PRECISA_DE_HUMANO`) é silenciosamente descartado.

Resultado: os 6 leads que precisam de atendimento humano somem do CRM.

Auditando as demais colunas:
- `NOVO LEAD`, `CLINICOR`, `HGP`, `BELÉM`, `ATENDIDO` → consistentes entre banco, schema zod, agrupador e UI.
- `AGUARDANDO` → usado pela welcome flow, ok.
- Falta no zod schema (`agendamentoInsertSchema`) e no array `STATUS_CRM_VALIDOS` em `crmAudit.ts` o status de "humano".

## Solução

Padronizar como **`PRECISA_DE_HUMANO`** (valor já presente no banco — evita migration de dados) em todos os pontos do código.

### Arquivos a alterar

1. **`src/pages/admin/CRM.tsx`**
   - Trocar `status: "AGUARDANDO HUMANO"` → `"PRECISA_DE_HUMANO"` no array `columns`.
   - Trocar a chave `"AGUARDANDO HUMANO": []` → `"PRECISA_DE_HUMANO": []` no `useState` inicial.

2. **`src/services/agendamentos.ts`**
   - Adicionar `"PRECISA_DE_HUMANO"` ao enum zod (`agendamentoInsertSchema.status_crm`).
   - Adicionar `'PRECISA_DE_HUMANO': []` aos dois objetos `grouped` retornados (caminho normal e fallback de erro/JWT).

3. **`src/services/crmAudit.ts`**
   - Adicionar `"PRECISA_DE_HUMANO"` ao array `STATUS_CRM_VALIDOS`.

4. **`supabase/functions/assistente-pre-agendamento/index.ts`**
   - Trocar as 2 ocorrências de `status_crm: "AGUARDANDO HUMANO"` → `"PRECISA_DE_HUMANO"`.

5. **`src/components/admin/CRMLegenda.tsx`** (se a coluna estiver listada lá com cor)
   - Verificar e atualizar referência para "Precisa de humano" / `PRECISA_DE_HUMANO`.

### Revisão de consistência das outras colunas

Não há outros mismatches no banco (todos os demais status estão alinhados). Vou apenas:
- Confirmar que a ordem das colunas do Kanban faz sentido para o funil: `NOVO LEAD → AGUARDANDO → PRECISA_DE_HUMANO → CLINICOR / HGP / BELÉM → ATENDIDO`.
- Manter a cor `bg-rose-500` (vermelha = atenção urgente) para "Precisa de humano", o que combina com o sentido da coluna.

### Validação após o fix

- Recarregar `/admin/crm` e confirmar que os 6 cards aparecem na coluna "Precisa de humano".
- Conferir que drag-and-drop para/dessa coluna funciona (passa pela validação `STATUS_CRM_VALIDOS`).
