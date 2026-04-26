## Objetivo

Garantir que o trigger GTM **"Evento - Meta Lead"** (event name: `meta_lead`) receba o payload completo esperado em **todas as páginas de agendamento** (`/agendamento`, `/agendar`, `/agendar-consulta` e o modal `SchedulingModal`), preservando o `content_name` descritivo por contexto.

## Estado atual

`src/hooks/useMetaPixel.ts` → `trackLead()` já dispara:

```js
window.dataLayer.push({
  event: 'meta_lead',
  content_name: <dinâmico>,
  content_category: 'Consulta Oftalmológica',
  value: 300,
  currency: 'BRL',
});
```

Esse helper é chamado ao avançar da Step 1 (nome + telefone + e-mail) em:
- `src/pages/Agendamento.tsx` (linha 112)
- `src/pages/Agendar.tsx`
- `src/pages/AgendarConsulta.tsx`
- `src/components/scheduling/SchedulingModal.tsx`

**Faltam no payload:** `form_name`.

## Mudança

Editar **apenas `src/hooks/useMetaPixel.ts`**, função `trackLead`, para incluir `form_name: 'agendamento'`. Como todas as páginas usam esse helper, a correção se propaga automaticamente.

Payload final que será enviado ao dataLayer:

```js
{
  event: 'meta_lead',
  form_name: 'agendamento',
  content_name: <descritivo do contexto, ex.: 'Dados Pessoais Preenchidos - Landing'>,
  content_category: 'Consulta Oftalmológica',
  value: 300,
  currency: 'BRL',
}
```

Isso atende:
- ✅ Trigger GTM `meta_lead` continua disparando exatamente nos mesmos pontos (Step 1 do form).
- ✅ Adiciona `form_name='agendamento'` (novo) para a tag GTM filtrar/ler.
- ✅ Mantém `content_category`, `value` conforme solicitado.
- ✅ Preserva `content_name` dinâmico (útil para distinguir landing vs modal vs página) e mantém `currency: 'BRL'` (extra inofensivo).

## Arquivos afetados

- `src/hooks/useMetaPixel.ts` — adicionar `form_name: 'agendamento'` no objeto pushado por `trackLead()`.

Nenhum outro arquivo precisa ser tocado.

## Validação pós-deploy

1. Abrir `/agendamento` em modo Preview do GTM.
2. Preencher Step 1 e clicar em avançar.
3. Confirmar no Tag Assistant que:
   - Evento `meta_lead` aparece no dataLayer com `form_name: 'agendamento'`.
   - Trigger "Evento - Meta Lead" dispara a tag Meta Pixel `Lead`.
4. Repetir em `/agendar`, `/agendar-consulta` e no modal de agendamento (homepage).