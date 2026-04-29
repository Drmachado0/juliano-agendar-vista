## Avaliação

**Monitor de Envios → MANTER.** Ele nunca dependeu do Hermes — monitora a fila `mensagens_whatsapp` (direção OUT) de TODOS os envios: confirmações, lembretes, boas-vindas, manuais, lembretes anuais, avaliações, lote, etc. Continua sendo a principal ferramenta para detectar:
- Falhas de envio (Evolution offline, número inválido, SEND_FAILED)
- Throughput de mensagens nas últimas 24h
- Botão de reenvio para falhas

Sem o Hermes ele segue 100% relevante. Só precisa de pequenos ajustes cosméticos.

**Relatórios → LIMPAR.** Tem 3 referências mortas ao Hermes:
1. RPC `relatorio_diario_serie` ainda faz `SELECT FROM hermes_drafts` (tabela já dropada → vai dar erro 500 ao abrir Relatórios).
2. UI mostra linha "Drafts" no gráfico de série diária.
3. Card "Top intenções (bot)" — vinha do `bot_assistente_log` do Hermes, hoje não é mais alimentado, fica zerado.

Também há um StatCard vazio (grid 4 colunas com só 3 cards) sobrando do layout antigo do Hermes.

---

## Mudanças

### 1. Migração SQL — corrigir RPC `relatorio_diario_serie`
Remove a coluna `drafts_gerados` (que consultava `hermes_drafts`). Nova assinatura retorna apenas: `dia, msg_in, msg_out, leads_novos`.

### 2. `src/pages/admin/Relatorios.tsx`
- Remover `drafts_gerados` da interface `SerieDia` e da `<Line>` do gráfico.
- Remover bloco "Top intenções (bot)" e a interface `bot.top_intencoes` correspondente (deixar grid de gráficos com só "Mensagens por tipo" em largura total).
- Remover StatCard "Ações do bot" (referência ao bot_assistente_log do Hermes que não é mais alimentado).
- Reorganizar grid de stats para 3 colunas: Mensagens, Novos leads, Conversões.
- Atualizar legenda do gráfico de série: "Mensagens IN/OUT e novos leads por dia".

### 3. `src/pages/admin/MonitorEnvios.tsx` — pequenos ajustes
- Subtítulo atualizado: "Monitora envios automáticos (confirmações, lembretes, boas-vindas, lote) e manuais — últimas 24h".
- Sem mudanças funcionais (a tela continua útil exatamente como está).

### 4. Memória
Atualizar `mem://index.md` com nota de que `relatorio_diario_serie` foi corrigida pós-remoção do Hermes (não recriar coluna drafts_gerados).

---

## Detalhes técnicos

**SQL da migração:**
```sql
DROP FUNCTION IF EXISTS public.relatorio_diario_serie(date, date);

CREATE OR REPLACE FUNCTION public.relatorio_diario_serie(
  p_data_inicio date DEFAULT (CURRENT_DATE - interval '13 days')::date,
  p_data_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE(dia date, msg_in bigint, msg_out bigint, leads_novos bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  RETURN QUERY
  WITH dias AS (SELECT generate_series(p_data_inicio, p_data_fim, interval '1 day')::date AS d)
  SELECT dias.d,
    COALESCE((SELECT COUNT(*) FROM public.mensagens_whatsapp m WHERE m.created_at::date = dias.d AND m.direcao='IN'),0),
    COALESCE((SELECT COUNT(*) FROM public.mensagens_whatsapp m WHERE m.created_at::date = dias.d AND m.direcao='OUT'),0),
    COALESCE((SELECT COUNT(*) FROM public.agendamentos a WHERE a.created_at::date = dias.d),0)
  FROM dias ORDER BY dias.d ASC;
END; $$;
```

**Riscos:** baixo. `relatorio_diario` (a outra RPC) já foi corrigida na migração anterior do Hermes. `bot_assistente_log` é mantido (ainda existe a tabela, só não há mais escritor) — então remover só a UI.
