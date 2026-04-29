## Problema

A mensagem de boas-vindas está sendo enviada repetidamente porque:

1. O cron `enviar-boas-vindas-lead` roda a cada **2 minutos** (`*/2 * * * *`).
2. A função tenta o RPC `get_leads_sem_boas_vindas` — esse RPC **não existe** no banco, então sempre cai no fallback.
3. O fallback filtra "já recebeu boas-vindas" por **telefone**, mas só conta linhas em `mensagens_whatsapp`. Se a mensagem foi apagada pela retenção LGPD (180 dias) ou se houver qualquer race condition, o lead volta a ser elegível.
4. O filtro **não** descarta leads que já estão em `PRECISA_DE_HUMANO` (filtra só por `status_funil='lead'`), então mesmo um lead escalado para humano pode voltar à fila.

## Mudanças

### 1. Migration: criar RPC `get_leads_sem_boas_vindas`

```sql
CREATE OR REPLACE FUNCTION public.get_leads_sem_boas_vindas(
  p_cutoff_minutes integer DEFAULT 5
)
RETURNS TABLE (
  id uuid, nome_completo text, telefone_whatsapp text,
  tipo_atendimento text, local_atendimento text, convenio text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.nome_completo, a.telefone_whatsapp,
         a.tipo_atendimento, a.local_atendimento, a.convenio, a.created_at
  FROM public.agendamentos a
  WHERE a.status_funil = 'lead'
    AND a.status_crm = 'NOVO LEAD'
    AND a.created_at < (now() - make_interval(mins => GREATEST(0, p_cutoff_minutes)))
    AND NOT EXISTS (
      SELECT 1 FROM public.mensagens_whatsapp m
      WHERE m.agendamento_id = a.id
        AND m.tipo_mensagem = 'boas_vindas'
        AND m.direcao = 'OUT'
    )
  ORDER BY a.created_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_leads_sem_boas_vindas(integer) TO service_role, authenticated;
```

Filtra por `status_crm='NOVO LEAD'` (exclui automaticamente PRECISA_DE_HUMANO/AGUARDANDO) e dedup por `agendamento_id` (não por telefone).

### 2. Reduzir frequência do cron

```sql
SELECT cron.unschedule('enviar-boas-vindas-lead');
SELECT cron.schedule(
  'enviar-boas-vindas-lead',
  '*/10 * * * *',  -- 10 min em vez de 2 min
  $$SELECT net.http_post(
    url := 'https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/enviar-boas-vindas-lead',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer lembrete-drjuliano-2024-xK9mP3nQ7wR2"}'::jsonb,
    body := '{"source":"pg_cron"}'::jsonb
  );$$
);
```

De 720 execuções/dia para 144.

### 3. Corrigir `supabase/functions/enviar-boas-vindas-lead/index.ts`

- Passar `p_cutoff_minutes` ao RPC novo.
- Reescrever o fallback para deduplicar por `agendamento_id` (não por telefone) e considerar **qualquer** `status_envio` (incluindo `erro` e `pendente`) como "já tentou — não reenviar".
- Adicionar filtro `status_crm = 'NOVO LEAD'` no fallback.

### 4. (Opcional) Corrigir o lead atual do Alex

Hoje o lead `2077f466-...` está com `status_crm='PRECISA_DE_HUMANO'`. Após as mudanças acima, ele **não** será mais elegível para o cron — fica para a secretária tratar pelo chat admin. Nada a fazer no banco.

## Resultado esperado

- Cada lead recebe **no máximo 1 boas-vindas automática** (em qualquer status_envio: enviado/pendente/erro).
- Se a Evolution falhar, o lead vai direto para `PRECISA_DE_HUMANO` e o cron **nunca** tenta de novo.
- Se ficar `pendente`, quem cuida é o cron `retentar-boas-vindas-pendentes` (já tem `MAX_TENTATIVAS=4` com backoff).
- Cron principal cai de 720 → 144 execuções/dia.

## Arquivos alterados

- Nova migration: `supabase/migrations/<timestamp>_get_leads_sem_boas_vindas.sql` (RPC + reagenda cron).
- `supabase/functions/enviar-boas-vindas-lead/index.ts` (RPC com parâmetro + fallback dedup por agendamento_id).
