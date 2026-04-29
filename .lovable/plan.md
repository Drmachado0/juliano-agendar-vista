# Atualizar Evolution API para Hermes2 + Card de Configuração visível

## Objetivo
1. Trocar a instância Evolution de `Hermes` para **`Hermes2`** e a API key para **`82E7794B1DCA-4ACF-B6A7-EB80FFD70C70`**.
2. Criar um novo card **"Configuração da Instância"** dentro de `/admin/configuracoes/evolution` que exibe (e permite atualizar) os valores atuais — facilitando criar/conferir credenciais sem precisar abrir o painel de secrets.

## Arquitetura — leitura importante

Hoje a integração usa **3 secrets** das Edge Functions (Supabase Secrets), consumidas por 11 edge functions via `Deno.env.get(...)`:

- `EVOLUTION_API_BASE_URL` (ex.: `https://secretaria-evolution.cloudfy.live`)
- `EVOLUTION_API_INSTANCE` (atual: `Hermes` → novo: `Hermes2`)
- `EVOLUTION_API_TOKEN` (atual: oculto → novo: `82E7794B1DCA-4ACF-B6A7-EB80FFD70C70`)

Esses valores são **somente backend** (server-side) e não podem ser lidos diretamente pelo frontend. Para o card "ver e editar" funcionar com segurança, vamos criar uma **edge function nova** que age como ponte de leitura/escrita.

## Passo 1 — Atualizar os secrets

Vou atualizar via tool de secrets:
- `EVOLUTION_API_INSTANCE` = `Hermes2`
- `EVOLUTION_API_TOKEN` = `82E7794B1DCA-4ACF-B6A7-EB80FFD70C70`

(O `EVOLUTION_API_BASE_URL` permanece igual ao atual.)

Isso já faz com que **todas as 11 edge functions** passem a usar a nova instância Hermes2 imediatamente, sem precisar alterar código.

## Passo 2 — Edge function nova: `evolution-config`

`supabase/functions/evolution-config/index.ts` — protegida por JWT admin (verifica `has_role(uid, 'admin')`).

- `GET` (action `read`): retorna `{ baseUrl, instance, tokenMasked }` onde `tokenMasked` mostra apenas os 4 primeiros e 4 últimos caracteres (ex.: `82E7…70C70`). Nunca expõe o token completo.
- `POST` (action `update`): recebe `{ baseUrl?, instance?, token? }`, valida formato e faz teste rápido de `connectionState` na Evolution API com os novos valores antes de aceitar. Se válido, atualiza os secrets via `Deno.env`/Supabase Management API.

> Observação importante: o Supabase **não permite** atualizar secrets em runtime via SDK por design de segurança. Portanto a função `update` apresentará as instruções e um botão direto para a UI de secrets do Lovable Cloud, mas a **leitura mascarada funciona normalmente** — o que já cobre seu pedido de "conferir com maior facilidade".

## Passo 3 — Novo card no `/admin/configuracoes/evolution`

Adicionar acima do card "Status da Conexão" um card **"Configuração da Instância"** com:

- **Base URL**: campo readonly + botão copiar
- **Instância**: campo readonly mostrando `Hermes2` + botão copiar
- **API Key**: campo readonly mascarado (`82E7••••••••70C70`) + botão "mostrar/ocultar" (revela por 10s) + botão copiar
- Botão **"Atualizar credenciais"** que abre dialog explicando como editar via Lovable Cloud → Backend → Secrets, com link direto.
- Botão **"Testar credenciais"** que chama `verificar-status-evolution` e mostra resultado (verde se conectou, vermelho se 401/404).

Layout no estilo do card de Status atual (mesmo padrão visual dark/gold).

## Passo 4 — Atualizar memória do projeto

Atualizar `mem://infrastructure/whatsapp-evolution-api-architecture` registrando:
- Instância atual = `Hermes2`
- Existência do card de configuração visível em `/admin/configuracoes/evolution`

## Arquivos afetados

- **Secrets atualizados**: `EVOLUTION_API_INSTANCE`, `EVOLUTION_API_TOKEN`
- **Criados**:
  - `supabase/functions/evolution-config/index.ts`
- **Editados**:
  - `src/pages/admin/ConfiguracoesEvolution.tsx` (novo card)
  - `src/hooks/useEvolutionStatus.ts` (adicionar método `getConfig()` opcional)
  - `mem://infrastructure/whatsapp-evolution-api-architecture`

## Resultado final

- Toda comunicação WhatsApp passa a usar `Hermes2` com a nova key automaticamente.
- Você terá um painel visível em `/admin/configuracoes/evolution` mostrando qual instância e qual key (mascarada) estão em uso, com botão de teste — sem precisar nunca mais abrir a UI de secrets só para conferir.
