## Causa raiz

Os logs mostram que o lead `5591981620082` recebeu várias mensagens "boas-vindas" porque a função `enviar-boas-vindas-lead` está num **loop de reenvio**:

1. A Evolution aceita a mensagem (HTTP 200), mas sem confirmação clara (sem `messageId` ou status `PENDING`).
2. O código tenta gravar em `mensagens_whatsapp` com `status_envio = 'pendente'`.
3. A **check constraint** `mensagens_whatsapp_status_envio_check` só aceita: `enviado | entregue | lido | erro | recebida` — **não aceita `pendente`**.
4. O INSERT falha → não fica registro de envio para esse lead.
5. A dedup (RPC `get_leads_sem_boas_vindas` + query direta) usa `NOT EXISTS` em `mensagens_whatsapp` por `agendamento_id` + `tipo_mensagem='boas_vindas'`.
6. Como não tem registro, o lead é elegível de novo no próximo cron → **mensagem disparada de novo, repetidamente**.

Log que comprova:
```
[Evolution API] Mensagem aceita pelo servidor
[boas-vindas] ⏳ Pendente (sem ack) 5591981620082 ... mantém NOVO LEAD
[boas-vindas] Falha ao persistir mensagem ... violates check constraint "mensagens_whatsapp_status_envio_check"
```

## Correção

### 1. Migration — permitir `pendente` na constraint
Drop + recriar `mensagens_whatsapp_status_envio_check` para aceitar:
`enviado | entregue | lido | erro | recebida | pendente`.

Assim o INSERT em status pendente persiste, a dedup funciona e o lead **não é repescado**.

### 2. Reforço anti-duplicidade em `supabase/functions/enviar-boas-vindas-lead/index.ts`
Mesmo com a constraint corrigida, blindar contra corrida (cron + chamada manual rodando juntos):

- **Antes do `sendWhatsappTextMessage`**, fazer um INSERT "claim" em `mensagens_whatsapp` com `status_envio='pendente'`, `conteudo=''` placeholder, dentro de try/catch — se já existir registro (via segunda checagem ou unique), pular.
- Adicionar **unique index parcial** `mensagens_whatsapp_boas_vindas_unique` em `(agendamento_id)` WHERE `tipo_mensagem='boas_vindas' AND direcao='OUT'`. Isso garante no banco que cada lead só recebe **uma única** boas-vindas, mesmo com concorrência.
- Depois do envio, fazer `UPDATE` do mesmo registro com o status real (`enviado/entregue/erro/pendente`) + `mensagem_externa_id` + `payload`.
- Se o INSERT inicial falhar por conflito do unique → log e `continue` (já existe envio).

### 3. Limpeza de leads afetados
Migration adicional: para leads que estão `NOVO LEAD` + `status_funil='lead'` e que **já têm pelo menos uma mensagem OUT de boas_vindas em `mensagens_whatsapp`** (mesmo que não persistida agora — vamos identificar pelos múltiplos envios recentes via logs/telefone), garantir que o estado fique coerente. Para o lead `5591981620082` especificamente, registrar uma entrada manual em `mensagens_whatsapp` com `status_envio='enviado'` e `tipo_mensagem='boas_vindas'` para travar futuros envios.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — atualizar check constraint + criar unique index parcial + seed manual de dedup para leads que já receberam.
- `supabase/functions/enviar-boas-vindas-lead/index.ts` — padrão "claim → enviar → update", tratamento de conflito do unique.

## Resultado esperado

Cada lead recebe **exatamente uma** mensagem de boas-vindas. Falhas reais vão para `PRECISA_DE_HUMANO`. Status `pendente` é persistido e respeitado pelo dedup, eliminando o loop.
