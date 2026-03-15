

# Bug: Paciente agendado na Clinicor vai para AGUARDANDO

## Causa raiz

Race condition entre duas edge functions:

1. **`criar-lead`** (Step 2) → cria registro com `status_funil='lead'`, `status_crm='NOVO LEAD'`
2. **`enviar-boas-vindas-lead`** (CRON, a cada 5 min) → busca leads com `status_funil='lead'` criados há >5 min, envia WhatsApp e faz UPDATE `status_crm='AGUARDANDO'`
3. **`converter-lead-agendamento`** (Step 4) → converte lead, seta `status_crm='CLINICOR'` e `status_funil='agendado'`

**O problema**: se o paciente demora >5 min entre step 2 e step 4, a automação de boas-vindas dispara primeiro. Mas o UPDATE na linha 103 do `enviar-boas-vindas-lead` usa apenas `.eq('id', lead.id)` **sem verificar se o `status_funil` ainda é 'lead'**. Se a conversão acontecer entre o SELECT e o UPDATE do cron, o cron sobrescreve `status_crm` de volta para `AGUARDANDO`.

Além disso, mesmo que o converter rode primeiro, o cron pode rodar logo depois e sobrescrever porque o SELECT já tinha carregado o lead antes da conversão.

## Correção

### 1. `supabase/functions/enviar-boas-vindas-lead/index.ts` (linha 103)

Adicionar `.eq('status_funil', 'lead')` ao UPDATE para que só mova para AGUARDANDO se o lead ainda não foi convertido:

```typescript
await supabase.from('agendamentos').update({ 
  status_crm: 'AGUARDANDO',
  updated_at: new Date().toISOString()
}).eq('id', lead.id).eq('status_funil', 'lead');  // ← guard clause
```

### 2. `supabase/functions/converter-lead-agendamento/index.ts`

Nenhuma alteração necessária — já seta corretamente `status_funil='agendado'` e `status_crm='CLINICOR'`.

Correção mínima de 1 linha que elimina a race condition.

