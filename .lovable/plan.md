
# Correcao: Mensagem de boas-vindas nao esta sendo enviada

## Problema identificado
O cron job `enviar-boas-vindas-lead` esta sendo executado a cada 2 minutos, porem **todas as chamadas estao retornando "Unauthorized"** (erro 401).

**Causa raiz:** O cron job foi configurado com um token de autorizacao hardcoded errado (`lembrete-drjuliano-2024-xK9mP3nQ7wR2`), que nao corresponde ao valor real do secret `CRON_SECRET` configurado no backend.

## Evidencia dos logs
```
18:04:00 ERROR [boas-vindas] Unauthorized
18:02:02 ERROR [boas-vindas] Unauthorized
18:00:05 ERROR [boas-vindas] Unauthorized
17:58:00 ERROR [boas-vindas] Unauthorized
(repete a cada 2 minutos...)
```

## Solucao

### Passo 1 - Remover o cron job antigo
Deletar o cron job existente que usa o token errado.

### Passo 2 - Recriar o cron job com o token correto
Recriar usando o secret `CRON_SECRET` real. Como o cron job SQL nao consegue ler secrets dinamicamente, precisamos usar uma abordagem alternativa:

**Opcao A (recomendada):** Atualizar o secret `CRON_SECRET` para o valor que ja esta hardcoded no cron (`lembrete-drjuliano-2024-xK9mP3nQ7wR2`), assim o token bate.

**Opcao B:** Pedir ao usuario o valor atual do `CRON_SECRET` e recriar o cron job com esse valor.

Na pratica, a opcao mais simples e atualizar o `CRON_SECRET` para corresponder ao token usado no cron job, ja que nao ha como ler o valor atual do secret.

## Detalhes tecnicos

### SQL a executar
```sql
-- Remover cron antigo
SELECT cron.unschedule('enviar-boas-vindas-lead');

-- Recriar com token correto
SELECT cron.schedule(
  'enviar-boas-vindas-lead',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/enviar-boas-vindas-lead',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer lembrete-drjuliano-2024-xK9mP3nQ7wR2"}'::jsonb,
    body := '{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### Secret a atualizar
Atualizar `CRON_SECRET` para o valor: `lembrete-drjuliano-2024-xK9mP3nQ7wR2`

### Verificacao pos-correcao
- Aguardar 2 minutos apos a correcao
- Verificar nos logs se o status muda de "Unauthorized" para execucao normal
- Criar um lead de teste e confirmar que apos 5 minutos a mensagem de boas-vindas e enviada
