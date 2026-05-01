
# Tornar Configuração Evolution Editável pela UI

## Objetivo
Editar BASE URL, INSTÂNCIA e API KEY direto em `/admin/configuracoes/evolution`, sem precisar abrir Lovable Cloud → Secrets.

## Como funciona hoje
As 3 credenciais vêm de secrets (`EVOLUTION_API_BASE_URL`, `EVOLUTION_API_INSTANCE`, `EVOLUTION_API_TOKEN`) lidas via `Deno.env.get(...)` em **11 edge functions**. A UI atual só lê (mascarada) e testa.

## Solução — Migrar fonte da verdade para tabela no banco

### 1. Banco (migration)
- **Tabela `integracoes_evolution`** (singleton, 1 linha — `id boolean PK CHECK (id=true)`):
  - `base_url text`, `instance text`, `api_token_encrypted bytea`, `updated_at`, `updated_by uuid`
- **RLS:** apenas `admin` (via `has_role`) pode SELECT/UPDATE/INSERT. Token criptografado com `pgp_sym_encrypt` reusando funções existentes (`encrypt_sensitive_data` / `decrypt_sensitive_data` + vault `ENCRYPTION_KEY`).
- **Seed** inicial: linha vazia (será preenchida via UI ou pode receber valores atuais dos secrets manualmente depois).
- **RPCs:**
  - `obter_evolution_config_mascarada()` → admin only, retorna base_url + instance + token mascarado (4 primeiros + bullets + 4 últimos) + length + configured.
  - `atualizar_evolution_config(p_base_url, p_instance, p_api_token)` → admin only, valida (URL http(s), instance não vazia, token min 10 chars), criptografa token só se fornecido, atualiza `updated_by`.
  - `obter_evolution_config_interna()` → SECURITY DEFINER, **GRANT só para `service_role`**, retorna config descriptografada (usada pelas edge functions).

### 2. Helper compartilhado — `supabase/functions/_shared/evolutionApiClient.ts`
- Adicionar `getEvolutionConfigAsync()`:
  - Cache em memória (TTL 30s).
  - Lê via RPC `obter_evolution_config_interna` usando `SUPABASE_SERVICE_ROLE_KEY`.
  - **Fallback** para env vars se a tabela estiver vazia ou RPC falhar (zero downtime na migração).
- Manter `getEvolutionConfig()` síncrona como legada (só env vars).
- Exportar `invalidateEvolutionConfigCache()` para forçar refresh após update.

### 3. Refatorar 11 edge functions
Trocar `Deno.env.get("EVOLUTION_API_*")` ou `getEvolutionConfig()` por `await getEvolutionConfigAsync()` em:
`gerenciar-conexao-evolution`, `enviar-whatsapp-imagem`, `confirmar-agendamento-whatsapp`, `enviar-whatsapp-queue`, `enviar-whatsapp`, `verificar-status-evolution`, `evolution-config`, `configurar-webhook-evolution`, `receber-whatsapp`, `verificar-numeros-whatsapp`, `assistente-pre-agendamento`.

### 4. Edge function `evolution-config` — nova action `update`
- Admin only (já valida JWT + role).
- Body: `{ action: "update", base_url?, instance?, api_token? }`.
- Chama RPC `atualizar_evolution_config`.
- Após sucesso: invalida cache local + retorna config mascarada.
- Action `read` passa a chamar a RPC mascarada (em vez de só ler env).
- Action `test` continua, agora usando o helper async.

### 5. UI — `src/pages/admin/ConfiguracoesEvolution.tsx`
- Trocar 3 inputs read-only por **editáveis**:
  - BASE URL: input texto, validação http(s).
  - INSTÂNCIA: input texto.
  - API KEY: input password com toggle visibility. Placeholder mostra `tokenMasked` atual; só envia se usuário digitou algo novo.
- Botão **"Salvar alterações"** (habilita quando há diff):
  - Chama `evolution-config` com `action: "update"`.
  - Toast de sucesso + auto-executa "Testar credenciais".
- Substituir o card "Como atualizar instância ou API key" por aviso curto: *"Alterações são aplicadas imediatamente em todas as edge functions (cache de 30s)."*
- Manter botões existentes (Recarregar, Testar credenciais).

### 6. Memory
Atualizar `mem://infrastructure/whatsapp-evolution-api-architecture` registrando que credenciais agora vêm da tabela `integracoes_evolution` com fallback env, e que edge functions devem usar `getEvolutionConfigAsync()`.

## Segurança
- Token criptografado em repouso (pgcrypto + vault key).
- RLS bloqueia leitura para não-admins.
- Token nunca é exposto cru pela UI — só mascarado.
- RPC interna grant restrito a `service_role`.
- `updated_by` registrado em cada mudança (audit trail leve).
- Edge function `evolution-config` valida JWT + admin (já faz).

## Trade-offs
- ✅ Edição 100% pela UI.
- ✅ Audit (`updated_by` + `updated_at`).
- ✅ Caminho aberto para múltiplas instâncias futuras (basta remover singleton constraint).
- ⚠️ 11 edge functions refatoradas (mecânico, baixo risco — fallback env mantém compatibilidade durante deploy).
- ⚠️ Cache de 30s: mudança não é instantânea, mas aceitável.
