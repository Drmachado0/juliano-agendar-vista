# Painel para rotacionar N8N_SHARED_SECRET

## Contexto

Hoje o `N8N_SHARED_SECRET` só existe como env var de Edge Function. Não há API em runtime que permita ao app rotacionar env vars do backend — para dar um botão "Rotacionar" no admin, o segredo precisa passar a viver no banco (fonte da verdade), com a env var servindo apenas como fallback inicial.

## O que será construído

### 1. Armazenamento no banco (fonte da verdade)

Nova tabela `integracao_secrets` (admin-only, RLS estrita):

- `nome` (text, PK) — ex.: `N8N_SHARED_SECRET`
- `valor` (text, criptografado com pgcrypto usando `ENCRYPTION_KEY`)
- `rotacionado_em` (timestamptz)
- `rotacionado_por` (uuid → auth.users)
- `versao` (int, incrementa a cada rotação)

Grants + RLS: apenas `service_role` acessa via edge function; nenhum SELECT direto do frontend.

Duas RPCs SECURITY DEFINER:
- `rotacionar_secret_integracao(nome text)` — só admin. Gera valor com `gen_random_bytes(48) → base64url`, grava criptografado, retorna valor em claro **uma única vez**.
- `ler_secret_integracao(nome text)` — chamada só por edge functions via service_role. Retorna valor descriptografado.

### 2. Edge function `rotacionar-n8n-secret`

`POST` protegido por `Authorization: Bearer <jwt>` + checagem `has_role(admin)`. Chama a RPC de rotação e devolve `{ valor, versao, rotacionado_em }`. Loga em `system_logs` (level=warn, sem o valor).

### 3. Consumidores lêem do banco com cache

`supabase/functions/_shared/n8nSecret.ts`: helper `getN8nSharedSecret()` que:
1. Lê da tabela via service role
2. Faz cache em memória por 60s (evita hit por request)
3. Fallback para `Deno.env.get("N8N_SHARED_SECRET")` se DB vazio (compat com estado atual)

Atualizar para usar o helper:
- `mcp-agendamento`
- `registrar-mensagem-in-n8n`
- (qualquer outra que valide `x-n8n-secret`)

### 4. Painel admin

Nova aba/card em `/admin/configuracoes` → "Integrações":

```text
┌─ N8N Shared Secret ─────────────────────────────┐
│ Versão atual: v3                                │
│ Rotacionado em: 01/07/2026 15:42 por juliano@…  │
│                                                 │
│ [ Rotacionar segredo ]                          │
└─────────────────────────────────────────────────┘
```

Ao clicar em "Rotacionar":

1. Modal de confirmação:
   > **Atenção — invalidação imediata.**
   > O valor atual deixará de funcionar assim que confirmado. Toda chamada do n8n com o segredo antigo passará a retornar `Unauthorized` até você colar o novo valor em todas as credenciais do n8n (mcp-agendamento, registrar-mensagem-in-n8n e qualquer outra).
   > 
   > [ Cancelar ]  [ Confirmar rotação ]

2. Após confirmar: dispara `rotacionar-n8n-secret`.

3. Tela do valor (mostrado **uma única vez**):
   - Bloco monospace com o valor + botão "Copiar" (usa `navigator.clipboard`).
   - Toast "Copiado".
   - Aviso destacado: "Este valor não será exibido de novo. Guarde num gerenciador de senhas antes de fechar."
   - Checklist onde colar:
     - [ ] n8n → credencial `mcp-agendamento` (header `x-n8n-secret`)
     - [ ] n8n → credencial `registrar-mensagem-in-n8n`
   - Botão "Fechar" só habilita depois de clicar em "Copiar" ou "Já guardei".

4. Após fechar: o valor some do DOM e do estado React; o card volta a mostrar só versão + timestamp.

### 5. Auditoria

- Cada rotação insere linha em `system_logs`: `category='security'`, `source='n8n-secret-rotation'`, `level='warn'`, com `rotacionado_por` e `versao` (nunca o valor).
- Aparece no `/admin/logs` existente.

## Detalhes técnicos

- Criptografia at-rest: `pgcrypto` (`pgp_sym_encrypt/decrypt`) usando a mesma `ENCRYPTION_KEY` já em uso para notas médicas.
- Cache TTL 60s no helper para não estourar leituras — aceito atraso de até 60s entre rotação e propagação (o painel avisa isso).
- Fallback para env var é somente-leitura: se a env estiver definida e o DB vazio, na primeira rotação o valor da env é substituído. Depois disso o DB manda.
- Não altero a env var `N8N_SHARED_SECRET` no Lovable Cloud — ela vira apenas seed inicial e pode ser removida depois que a rotação for feita ao menos uma vez.

## Fora de escopo

- Rotacionar outros segredos (Manychat, Evolution etc.) — mesma arquitetura pode ser estendida depois, mas este painel foca só no `N8N_SHARED_SECRET`.
- Rotação automática programada.
