# Validação automática contra conflitos de agendamento

## Diagnóstico

Hoje a validação existe **parcialmente**, mas com brechas:

| Fluxo | Valida hoje? | Problema |
|---|---|---|
| `criar-agendamento` (site público) | ✅ Sim, via `validarDisponibilidade` | Race condition: entre validar e inserir, outra requisição pode pegar o mesmo slot |
| `converter-lead-agendamento` (Step 4) | ✅ Sim | Mesma race condition |
| `NovoAgendamentoAdminModal` (admin) | ❌ **Não valida disponibilidade** — insere direto via `criarAgendamento` do service | Admin pode criar duplicado no mesmo horário |
| `AgendamentoDetailsModal` (edição) | ❌ Não revalida ao mudar data/hora | Edição pode gerar conflito |
| `TimeSlotPicker` (UI) | Mostra subset aleatório como "disponível" | Slot pode já ter sido pego entre a listagem e o submit |

Não há **constraint no banco** garantindo unicidade de `(clinica_id, data_agendamento, hora_agendamento)` — é a única defesa real contra race condition.

---

## Plano

### 1. Migração SQL — Constraint anti-duplicidade (defesa final)

Criar índice único parcial em `agendamentos` para impedir dois registros ativos no mesmo slot/clínica:

```sql
CREATE UNIQUE INDEX uniq_agendamento_slot_ativo
ON public.agendamentos (clinica_id, data_agendamento, hora_agendamento)
WHERE status_crm <> 'cancelado'
  AND data_agendamento IS NOT NULL
  AND hora_agendamento IS NOT NULL
  AND clinica_id IS NOT NULL;
```

- Cancelados não bloqueiam (permite reagendar no mesmo slot depois).
- Antes de aplicar, a migração faz `SELECT` para detectar duplicatas pré-existentes e loga (não falha) — se houver, listo no console e oriento o usuário a unificar via Drawer de Duplicados.

### 2. Edge Functions — Tratar erro `23505` (violação de unique) com mensagem amigável

Em `criar-agendamento` e `converter-lead-agendamento`:
- Após o `.insert()`, se `error.code === '23505'` (unique_violation no índice acima), retornar **HTTP 409** com `{ error: 'Este horário acabou de ser reservado por outra pessoa. Escolha outro horário.', code: 'SLOT_TAKEN' }`.
- Garante que mesmo numa race condition o segundo INSERT falha com mensagem clara em vez de criar duplicata.

### 3. Admin — Validar antes de salvar

**`NovoAgendamentoAdminModal.tsx`**: antes de chamar `criarAgendamento`, invocar a edge function `validar-agendamento` (já existe) e bloquear o submit se `disponivel === false`, mostrando o motivo + alternativas no toast.

**`AgendamentoDetailsModal.tsx`**: ao salvar mudança de `data_agendamento` ou `hora_agendamento`, idem — validar contra o novo slot, ignorando o próprio agendamento (passar `excluir_id` para a função).

Para suportar isso, atualizar `validar-agendamento` (edge function) e `validarDisponibilidade` (shared) para aceitar parâmetro opcional `excluir_agendamento_id` que é descontado dos `ocupados`.

### 4. Frontend público — Revalidar imediatamente antes do submit final

No `DateTimeStep.handleNext` já existe validação. Adicionar mesma revalidação no `ConfirmationStep` (Step 4) **um instante antes** do submit final, porque entre Step 3 e Step 4 podem se passar minutos. Se voltar 409/indisponível, abrir um banner com botão "Escolher outro horário" que volta para Step 3 com `reloadKey` incrementado (força refetch dos slots).

### 5. UI — Feedback claro de slot tomado

Quando qualquer fluxo receber 409 SLOT_TAKEN:
- Toast destrutivo com mensagem
- Em fluxos com calendário aberto: chamar refresh dos slots imediatamente para o paciente ver o slot sumir

---

## Arquivos afetados

- **Nova migration**: `supabase/migrations/<timestamp>_uniq_agendamento_slot.sql`
- `supabase/functions/_shared/validarDisponibilidade.ts` — aceitar `excluir_agendamento_id`
- `supabase/functions/validar-agendamento/index.ts` — repassar parâmetro
- `supabase/functions/criar-agendamento/index.ts` — tratar 23505
- `supabase/functions/converter-lead-agendamento/index.ts` — tratar 23505
- `src/services/agendamentos.ts` — tratar erro SLOT_TAKEN no `atualizarAgendamento`
- `src/components/admin/NovoAgendamentoAdminModal.tsx` — validar antes de salvar
- `src/components/admin/AgendamentoDetailsModal.tsx` — revalidar ao mudar data/hora
- `src/components/scheduling/ConfirmationStep.tsx` — revalidar antes do submit final
- `src/components/scheduling/SchedulingModal.tsx` e `src/pages/Agendar.tsx` — handler do erro SLOT_TAKEN

---

## Resultado esperado

- ❌ Impossível existirem dois agendamentos ativos no mesmo `(clinica, data, hora)` — garantido pelo banco.
- ✅ Admin não consegue mais salvar conflito sem aviso.
- ✅ Paciente em race condition recebe mensagem clara e é redirecionado a escolher outro horário.
- ✅ Edição de agendamento existente também é validada.
