
# Diagnóstico do CRM Kanban

Após inspecionar banco, código e edge functions, identifiquei **3 problemas reais** + a melhoria solicitada:

## 🔍 O que encontrei

### 1. ✅ Automação de boas-vindas **está funcionando** (mas com 1 lead "preso")
Verifiquei o banco: **9 dos 10 leads** receberam mensagem de boas-vindas e migraram corretamente de **NOVO LEAD → AGUARDANDO**. 

**Porém**, o lead `Eliosvaldo de Melo Lima` (13/03) ficou em **NOVO LEAD com 0 mensagens** — provavelmente foi um lead duplicado (existe outro do mesmo paciente 1 minuto antes que recebeu). A função de boas-vindas tem o filtro correto por telefone, mas leads antigos travados nunca serão reprocessados porque o cron só pega últimos 20.

### 2. ❌ **Cards NÃO atualizam automaticamente no Kanban**
O `CRM.tsx` faz `fetchAgendamentos()` apenas no `useEffect` inicial. Quando o cron de boas-vindas roda em background e move o lead para AGUARDANDO, **a tela não reflete** — o admin precisa clicar manualmente em "Atualizar". Isso dá a falsa impressão de que a automação não funciona.

### 3. ❌ **Não existe coluna/campo "Data de Contato"** no card
Hoje os cards mostram só telefone, data do agendamento (se houver) e badges. Você quer ver claramente **quando o lead chegou** (created_at) para monitorar há quanto tempo está parado em cada fase.

### 4. ⚠️ Migração para ATENDIDO depende de cron manual
Função `migrar-atendidos` existe mas não vi confirmação de que está agendada. Leads em CLINICOR/HGP só viram ATENDIDO se o cron rodar.

---

# 📋 Plano de Correção

## A. Adicionar "Data de Contato" no Kanban Card (`KanbanCard.tsx`)
- Mostrar **sempre** no topo do card: `📞 Contato em DD/MM/YY · há X dias` (usa `created_at`)
- Adicionar **indicador visual de urgência**: 
  - Verde: ≤ 1 dia
  - Amarelo: 2-7 dias  
  - Vermelho: > 7 dias parado na mesma fase (compara `updated_at` da última mudança)
- Tooltip ao passar o mouse: data/hora exata de criação

## B. Atualização automática do Kanban (`CRM.tsx`)
- **Realtime Supabase**: subscrever mudanças na tabela `agendamentos` para refletir instantaneamente quando:
  - Cron de boas-vindas move NOVO LEAD → AGUARDANDO
  - Cron `migrar-atendidos` move HGP/CLINICOR → ATENDIDO
  - Outro admin arrasta um card
- **Polling de fallback**: refresh silencioso a cada 60s
- **Indicador visual** de "Atualizado agora" no header

## C. Botão "Reprocessar boas-vindas" (admin manual)
- No header do CRM, novo botão "🔄 Forçar envio de boas-vindas pendentes"
- Invoca a edge function `enviar-boas-vindas-lead` manualmente (sem esperar cron)
- Útil para destravar leads antigos como o caso do Eliosvaldo

## D. Garantir crons ativos (migration)
Verificar e (re)criar via SQL os cron jobs:
- `enviar-boas-vindas-lead` — a cada 5 min
- `migrar-atendidos` — diário às 03h
- `enviar-confirmacao-whatsapp` — a cada 15 min

## E. Indicador de "tempo na fase" + alertas
- Card mostra "Parado há X dias nesta fase" quando `updated_at` > 3 dias e status ainda não é ATENDIDO
- Filtro no header: "Mostrar apenas leads parados há +3 dias"

## F. Melhorar a função `enviar-boas-vindas-lead`
- Aumentar limite de busca de 20 para 50 leads
- Adicionar log estruturado de quantos leads pulou (já enviado) vs processou
- Retentar leads sem mensagem mesmo se forem antigos (>24h)

---

# 📁 Arquivos afetados

1. `src/components/admin/KanbanCard.tsx` — adicionar "Data de Contato" + alertas de tempo
2. `src/pages/admin/CRM.tsx` — Realtime subscription + botão reprocessar + filtro
3. `src/services/agendamentos.ts` — função `reprocessarBoasVindas()` 
4. `supabase/functions/enviar-boas-vindas-lead/index.ts` — limite maior + logs melhores
5. **SQL/Insert tool** — verificar/recriar cron jobs ativos

# ⚙️ O que NÃO vou mexer (já funciona)
- Fluxo de criação de lead (`criar-lead` edge function) ✅
- Conversão lead → agendamento (`converter-lead-agendamento`) ✅
- Determinação de coluna por local (CLINICOR/HGP/BELÉM) ✅
- Drag-and-drop entre colunas ✅

Aprovar para eu implementar tudo de uma vez.
