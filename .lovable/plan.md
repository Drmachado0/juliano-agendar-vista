

# Diagnóstico: Erro na confirmação de agendamento

## Problema identificado

O bug esta no fluxo de confirmacao (Step 4). Quando o paciente clica em "Confirmar agendamento", o sistema tenta fazer um **UPDATE direto na tabela `agendamentos`** usando o cliente Supabase do navegador (chave anonima). Porem, a tabela `agendamentos` tem politicas RLS que **so permitem UPDATE para admins autenticados**.

Fluxo atual:
1. Step 2 → edge function `criar-lead` cria o registro (usa service role key, funciona)
2. Step 4 → `converterLeadEmAgendamento()` tenta `supabase.from('agendamentos').update(...)` **direto do navegador** → **FALHA silenciosa por RLS**

O update retorna sem erro explicito do Supabase (retorna `{ data: null, error: null }` quando nenhuma row e afetada por RLS), entao o fluxo pode parecer bem-sucedido mas o agendamento fica sem data/hora — ou em alguns casos retorna erro dependendo da versao do client.

## Solucao

Criar uma nova edge function `converter-lead-agendamento` que recebe o `lead_id` e os dados de agendamento, valida disponibilidade e faz o UPDATE usando a service role key (bypassa RLS). O servico frontend passa a chamar essa edge function em vez de fazer o update direto.

### Alteracoes

1. **Criar `supabase/functions/converter-lead-agendamento/index.ts`**
   - Recebe: `lead_id`, `data_agendamento`, `hora_agendamento`, `local_atendimento`, `aceita_primeiro_horario`, `aceita_contato_whatsapp_email`
   - Valida disponibilidade chamando `validarDisponibilidade`
   - Faz o UPDATE com service role key
   - Retorna sucesso/erro

2. **Atualizar `src/services/leads.ts`**
   - `converterLeadEmAgendamento` passa a chamar `supabase.functions.invoke('converter-lead-agendamento', ...)` em vez de fazer update direto + validacao separada

3. **Atualizar `supabase/config.toml`** (automatico)
   - Desabilitar JWT para a nova function

### Detalhes tecnicos

A nova edge function consolida a logica que hoje esta dividida entre o frontend (validacao + update):
- Chama `validarDisponibilidade` internamente
- Determina `status_crm` pelo local
- Executa o UPDATE com service role key
- Retorna `{ success: true }` ou `{ error: "motivo", disponivel: false }`

