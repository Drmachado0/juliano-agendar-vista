## Objetivo
Criar uma página pública `/status/:id` onde o paciente acessa um link único (UUID do agendamento) e visualiza em tempo real o status do seu agendamento, com data/hora, local, tipo e convênio. O link será incluído automaticamente no template de confirmação enviado por WhatsApp.

---

## 1. Backend — Edge Function pública

**Nova edge function**: `supabase/functions/status-agendamento/index.ts`
- **JWT desabilitado** (público) — adicionar bloco em `supabase/config.toml` com `verify_jwt = false`.
- Recebe `id` (UUID) via query string ou body.
- Usa `service_role_key` para fazer SELECT em `agendamentos` somente dos campos não sensíveis:
  - `id`, `nome_completo` (apenas primeiro nome para privacidade), `data_agendamento`, `hora_agendamento`, `local_atendimento`, `tipo_atendimento`, `detalhe_exame_ou_cirurgia`, `convenio`, `status_crm`, `status_funil`, `confirmation_status`, `created_at`.
- **NÃO retorna**: `telefone_whatsapp`, `email`, `data_nascimento`, `observacoes_internas`, IDs internos extras.
- Validação: se `id` inválido ou não encontrado → 404 com mensagem genérica ("Agendamento não encontrado").
- Rate limiting básico por IP (10 req/min) para evitar enumeração.

**Por que edge function e não RLS pública?** A tabela `agendamentos` contém dados sensíveis (telefone, email, observações criptografadas) e a política atual restringe SELECT a admins. Uma edge function com service_role e projeção controlada é a forma segura de expor apenas o necessário — alinhado ao padrão `mem://security/public-availability-data-protection`.

---

## 2. Frontend — Nova página `/status/:id`

**Novo arquivo**: `src/pages/StatusAgendamento.tsx`
- Usa `useParams` para pegar o UUID e chama a edge function `status-agendamento`.
- Estados: loading, erro (link inválido), sucesso.
- Layout dark, alinhado à identidade visual (Navy/Gold + Plus Jakarta Sans / Fraunces).
- Conteúdo:
  - **Badge de status** grande com cor e ícone:
    - `confirmation_status = 'confirmado'` ou `status_crm = 'ATENDIDO'` → verde "Confirmado" ✅
    - `confirmation_status = 'cancelado'` → vermelho "Cancelado" ❌
    - `status_funil = 'lead'` → amarelo "Aguardando contato da equipe" ⏳
    - default → azul "Agendamento recebido" 📋
  - **Card com detalhes**:
    - Saudação: "Olá, {primeiro_nome}!"
    - 📅 Data formatada (dd/MM/yyyy, dia da semana em pt-BR via `date-fns`)
    - ⏰ Horário (HH:mm) — com aviso "Atendimento por ordem de chegada"
    - 📍 Local (label amigável)
    - 🩺 Tipo de atendimento (+ detalhe se exame/cirurgia)
    - 💳 Convênio
  - **CTA WhatsApp**: botão verde "Falar com a clínica" abrindo `https://wa.me/5591936180476`.
  - Rodapé com logo/nome do Dr. Juliano Machado e link para o site.
- SEO: `<Helmet>` com `noindex, nofollow` (página privada por link).

**Registrar rota** em `src/App.tsx`: `<Route path="/status/:id" element={<StatusAgendamento />} />` (acima do catch-all).

---

## 3. Integração com template de confirmação WhatsApp

**Atualizar** `supabase/functions/_shared/templateRenderer.ts`:
- Adicionar variável `{{link_status}}` ao mapeamento de `renderizarTemplate` e à interface `DadosTemplate`.
- Atualizar template padrão `confirmacao_agendamento` para incluir:
  ```
  🔗 Acompanhe seu agendamento: {{link_status}}
  ```
- Idem para `lembrete_24h` e `reagendamento`.

**Atualizar quem chama o renderer** (passar `link_status: \`https://drjulianomachado.com/status/${agendamentoId}\``):
- `supabase/functions/enviar-confirmacao-whatsapp/index.ts`
- `supabase/functions/confirmar-agendamento-whatsapp/index.ts`
- `supabase/functions/lembrete-consulta-whatsapp/index.ts`

**Migration de dados** (insert tool, não migration de schema): atualizar registros em `templates_whatsapp` (tipos `confirmacao_agendamento`, `lembrete_24h`, `reagendamento`) para incluir `{{link_status}}` no conteúdo, e adicionar `link_status` ao array `variaveis_disponiveis`.

---

## 4. Admin — Copiar link do status

**Atualizar** `src/components/admin/AgendamentoDetailsModal.tsx`:
- Adicionar botão "Copiar link de status" que copia `https://drjulianomachado.com/status/{id}` para o clipboard, com toast de confirmação.
- Útil para a equipe enviar manualmente quando necessário.

---

## 5. Segurança e considerações

- **UUID v4 como token**: 122 bits de entropia — inviável de adivinhar por força bruta.
- **Rate limit** na edge function previne enumeração.
- **Projeção mínima** de campos: nada de telefone, email ou observações expostos.
- **Primeiro nome apenas**: reduz exposição do nome completo caso o link vaze.
- **noindex** evita indexação por buscadores.
- **HTTPS obrigatório** (já garantido por Lovable hosting).

---

## Arquivos criados/editados

**Criar:**
- `supabase/functions/status-agendamento/index.ts`
- `src/pages/StatusAgendamento.tsx`

**Editar:**
- `supabase/config.toml` (bloco `verify_jwt = false` para a nova função)
- `supabase/functions/_shared/templateRenderer.ts`
- `supabase/functions/enviar-confirmacao-whatsapp/index.ts`
- `supabase/functions/confirmar-agendamento-whatsapp/index.ts`
- `supabase/functions/lembrete-consulta-whatsapp/index.ts`
- `src/App.tsx` (nova rota)
- `src/components/admin/AgendamentoDetailsModal.tsx` (botão copiar link)
- Dados em `templates_whatsapp` (via insert tool)

---

## Resultado esperado
O paciente recebe a mensagem de confirmação no WhatsApp com um link `https://drjulianomachado.com/status/{uuid}`. Ao clicar, vê uma página limpa, branded, com o status atual do agendamento (confirmado, aguardando, atendido, cancelado), todos os detalhes da consulta e um botão direto para falar com a clínica via WhatsApp. Equipe interna pode copiar o link diretamente do modal de detalhes no admin.
