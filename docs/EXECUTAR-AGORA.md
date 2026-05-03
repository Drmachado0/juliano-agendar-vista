# Plano de execução — Dr. Juliano CAPI + Audit Cleanup

**Data:** 2026-05-02
**Tempo total estimado:** 1h05min (15 min CAPI close + 50 min audit cleanup)

> Cada seção é independente. Você pode pausar entre elas e continuar depois.

---

# ⚡ FASE 1 — Fechar ciclo CAPI (15 min)

## 🔹 Etapa 1.1 — Validação UTMs no banco (2 min)

### O que fazer
Cola este prompt no chat do Lovable AI:

````
Por favor rode esta SQL e me mostre o resultado:

SELECT
  id,
  nome_completo,
  email,
  telefone_whatsapp,
  status_funil,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_content,
  utm_term,
  gclid,
  fbclid,
  fbc,
  fbp,
  landing_page,
  referrer,
  created_at
FROM agendamentos
ORDER BY created_at DESC
LIMIT 5;

Quero confirmar que utm_source, utm_campaign, fbc, fbp e landing_page estão
preenchidos no agendamento mais recente (que acabei de criar com utm_source=soak_test).
Se algum desses estiver NULL, me alerta porque indica bug de captura.
````

### O que esperar
Resposta com o agendamento mais recente mostrando:
- `utm_source = soak_test`
- `utm_campaign = meta_capi_validation`
- `fbclid = test_e2e_001`
- `fbc` = string `fb.1.<timestamp>.<click_id>` (vem do cookie `_fbc`)
- `fbp` = string `fb.1.<timestamp>.<random>` (vem do cookie `_fbp`)
- `landing_page` = URL completa que você abriu

### Se algum NULL
Me manda o resultado da SQL aqui que diagnostico (provavelmente algum campo do RouteChangeTracker não persistiu).

---

## 🔹 Etapa 1.2 — Confirmação visual em Test Events (3 min)

### O que fazer
1. Abre: https://eventsmanager.facebook.com/events_manager2/list/dataset/1003792428067622/test_events
2. Procura na lista pelo evento mais recente — deve ter chegado à 1h atrás
3. Tira **1 screenshot** mostrando os 4 eventos:
   - `Lead`
   - `Schedule`
   - `CompleteRegistration`
   - `Contact` (se você clicou WhatsApp)

### O que validar no print
Pra cada evento, deve aparecer:
- Browser ✅ + Server ✅
- **Deduplicated** label
- event_id idêntico nos dois lados (UUID Supabase tipo `afcce2ce-...`)
- Match Quality (EMQ) inicial: 6-8

### Manda o print aqui
Eu valido o que está bom e o que pode subir EMQ na próxima rodada.

---

# 🛠️ FASE 2 — Cleanup achados do audit (50 min)

## 🔹 Achado C — Declarar vertical "Saúde" (2 min — **comece por aqui, é o mais fácil**)

### Por que importa
Sem vertical declarada, Meta não te compara contra benchmarks de "Saúde / Médico". Você perde:
- Industry Benchmark insights
- Otimização Andromeda calibrada para healthcare
- Recommendations específicas do Vertical

### Onde clicar

Para **cada** conta de anúncio do Dr. Juliano:

1. **Business Manager** → https://business.facebook.com/settings/ad-accounts
2. Seleciona conta `1003792428067622` (e cada uma das outras 10 contas se quiser ser completo)
3. **Ad Account Settings** → **Account Information** → **Industry**
4. Escolhe **"Health & Pharmaceutical"** ou no português equivalente **"Saúde e Farmacêutica"**
5. **Save**

### Atenção compliance Brasil
A Meta **NÃO** força Special Ad Category automaticamente para Saúde no Brasil (ao contrário dos EUA). Mas declarar a vertical é higiene de compliance CFM.

---

## 🔹 Achado B — Mover página Milestotalpro pra BM separada (5 min)

### Por que importa
**Risco crítico de banimento generalizado.** Hoje você tem na BM `493850516412413` (DrJulianomachado):
- 4 páginas oftalmo (3 duplicadas + 1 oficial)
- 1 página `Milestotalpro` (negócio paralelo de milhas)

Se a Meta penalizar Milestotalpro por qualquer motivo (política de finanças, etc.), **TODAS as contas oftalmo na mesma BM podem ser afetadas**. Isso já aconteceu com clientes nossos.

### Onde clicar

1. **Business Manager** → https://business.facebook.com/settings/pages
2. Seleciona BM `493850516412413` (DrJulianomachado)
3. Encontra **`Milestotalpro`** (page_id: `889494240923025`)
4. **Click ⋮ (3 pontos)** → **Remove from Business**
5. Cria nova BM dedicada (se ainda não tiver):
   - Business Manager → **Settings** → **Business Info** → **Add Business**
   - Nome: `Milestotalpro` (ou outro nome separado)
6. Adiciona a página `Milestotalpro` à nova BM

### Cuidado
Confirma antes de remover que a página **NÃO está conectada a campanhas pagas ativas**. Se estiver, primeiro pausa as campanhas.

---

## 🔹 Achado A — Mesclar 3 páginas duplicadas `dr.julianomachado_` (15 min)

### Por que importa
**3 páginas com o mesmo nome** fragmentam:
- Audiência (engajamento dividido em 3)
- Page Insights
- Page-linked Custom Audiences (não consolidam)
- Reviews (avaliações divididas)

IDs duplicados:
- `111630064087696` — dr.julianomachado_
- `106458758020491` — dr.julianomachado_
- `102950325048710` — dr.julianomachado_

### Como resolver

#### Passo 1 — Identificar a página oficial
A página oficial é a que está conectada ao Instagram `@drjuliano.oftalmo`. Para descobrir:

1. Abre cada uma das 3 páginas no Facebook
2. Vai em **Settings** → **Linked Accounts** → confere qual tem o Instagram `@drjuliano.oftalmo` linkado
3. Essa é a **MAIN** — vai manter

#### Passo 2 — Solicitar mesclagem das outras 2

Para cada página duplicada (NÃO oficial):

1. **Business Manager** → **Pages** → seleciona a página duplicada
2. **Settings** → **General** → role até o final
3. Procura **"Merge Duplicate Pages"** (Mesclar páginas duplicadas)
4. Seleciona a página **OFICIAL** como destino
5. Confirma

⚠️ **IMPORTANTE:** A mesclagem é **irreversível**. Tem que escolher CERTO qual é a oficial. Em caso de dúvida:
- Pega a que tem mais seguidores
- Pega a que tem reviews/avaliações
- Pega a que está conectada ao Instagram oficial

Meta processa mesclagem em ~24-48h. Os seguidores, reviews e engagement das 2 duplicadas vão pra oficial.

#### Alternativa se Meta não permitir merge

Se a opção não aparecer (Meta às vezes bloqueia merge se as páginas têm conteúdo muito diferente):

1. **Despublica** as 2 duplicadas:
   - Settings → General → **Page Visibility** → **Page unpublished**
2. Em 30 dias, **delete** elas:
   - Settings → General → **Remove Page** → confirma com senha

---

## 🔹 Achado D — Renomear 8 campanhas com nome default (20 min)

### Por que importa
8 campanhas todas chamadas `Traffic Campaign` ou `Sales Campaign`:
- Impossível diferenciar no Ads Manager
- 4 "Traffic Campaign" idênticas → **alto risco de audience overlap**
- Andromeda penaliza overlap (suprime delivery)

### Padrão de naming sugerido (clínica oftalmo)

```
[OBJETIVO]_[CIDADE]_[PROCEDIMENTO]_[PUBLICO]_[DATA]

Exemplos:
SALES_PA_Catarata_Cold_2026-05
LEAD_PA_Pterigio_Look3_2026-05
TRAFFIC_PA_Brand_Retarget_2026-05
SALES_BEL_RetinaCirurgia_LAL_2026-05
LEAD_PA_Glaucoma_Cold_2026-05
```

### IDs das 8 campanhas a renomear

Conta `1930251700856803` (oftalmologista Juliano Machado):
- `120233227073780489` — Traffic Campaign
- `120233227072370489` — Sales Campaign
- `120233227036040489` — Traffic Campaign
- `120233227035980489` — Traffic Campaign
- `120233227034540489` — Sales Campaign
- `120233227034370489` — Sales Campaign

Conta `4478700599033032` (Juliano Machado):
- `120241387707320470` — Traffic Campaign
- `120241387706930470` — Sales Campaign

### Como renomear

Para **cada** campanha:

1. **Ads Manager** → seleciona a conta
2. Filtra a campanha pelo ID (cola na busca)
3. Click no nome → editor inline aparece
4. Renomeia seguindo o padrão acima
5. Salva com Enter

**Dica de eficiência:** abre a aba **Charts** ou ordena por Spend desc — começa renomeando as que têm mais histórico de delivery (essas têm mais valor de aprendizado pro algoritmo).

### O que NÃO mexer

- **NÃO** pause as campanhas durante renomeação (perde aprendizado)
- **NÃO** duplique pra renomear cópia (perde aprendizado)
- Renomeação **não reseta** learning phase

---

## 🔹 Achado E — Encerrar contas de anúncios duplicadas (15 min, **opcional, baixa prioridade**)

### Por que (não tão crítico)
Você tem 11 contas de anúncios:
- 9 estão na BM `310813633246152` (Juliano Machado)
- 2 estão na BM `493850516412413` (DrJulianomachado, **a oficial**)

Muitas contas com nomes duplicados ou ambíguos:
- "Atendimento Dr Juliano" vs "Atendimento D Juliano" (sem `r`)
- 3× "Dr Juliano Machado (Read-Only)"
- 1× "Secretaria Dr Juliano Machado"
- 1× "oftalmologista Juliano Machado"

### Por que **opcional**
- Não está quebrando nada hoje
- Encerrar conta com pixel attribution histórica **pode** afetar Lookalike Audiences derivadas
- Risco > benefício neste momento

### Recomendação alternativa
Em vez de encerrar agora, **só ARQUIVA** as contas que não são a principal. Arquivar é reversível, encerrar não é.

1. **Business Manager** → **Ad Accounts**
2. Para cada conta NÃO principal: **Settings** → **Account Status** → **Archive**

Manter ativas só:
- `309132302252170` — Dr Juliano (BM oficial — usar pra todas as campanhas pagas)
- `1930251700856803` — oftalmologista Juliano Machado (sandbox/teste)

Encerra de vez só depois de **6 meses** de operação estável só com as 2 ativas.

---

# 📋 Checklist de execução

Marca conforme for fazendo:

- [ ] Etapa 1.1 — SQL UTMs no banco (cola Prompt no Lovable AI)
- [ ] Etapa 1.2 — Print do Test Events com 4 eventos Dedup ✅
- [ ] Achado C — Vertical "Saúde" declarada (2 min)
- [ ] Achado B — Milestotalpro movida pra outra BM (5 min)
- [ ] Achado A — 3 páginas duplicadas mescladas (15 min + aguarda 24-48h Meta processar)
- [ ] Achado D — 8 campanhas renomeadas (20 min)
- [ ] Achado E — Contas duplicadas arquivadas (opcional, 15 min)

**Quando concluir 1.1 + 1.2:** me manda os 2 prints/outputs aqui que eu finalizo o `CERTIFICACAO-CAPI.md`.

**Quando concluir A-E:** o score do audit Meta sobe de **27/100 para ~50/100** (sem precisar mexer em creative/audience que estão bloqueados pelo MCP).
