# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é isto

Site público + CRM administrativo do Dr. Juliano Machado (oftalmologista, Paragominas/Belém, PA). O frontend é uma SPA Vite/React pré-renderizada estaticamente no build; o backend é Supabase (Postgres + ~55 edge functions em Deno), que também atende um bot de agendamento por WhatsApp via n8n/ManyChat/Evolution API. Tudo (identificadores, comentários, commits, docs) é escrito em **pt-BR**. Mantenha assim.

## Comandos

O lockfile é o `bun.lock`. Use bun; se usar npm, nunca commite `package-lock.json`.

```sh
bun install --frozen-lockfile
bun run dev                 # Vite na porta 8080
bun run typecheck           # tsc --noEmit -p tsconfig.app.json  (strict DESLIGADO; ainda pega TS2304 etc.)
bun run test                # vitest run (jsdom por padrão)
bun run test:watch
bunx vitest run src/lib/__tests__/telefoneCanonico.test.ts   # um arquivo
bunx vitest run -t "nome do teste"                            # por nome
bun run lint                # eslint; supabase/functions é ignorado (código Deno)
bun run build               # pipeline completo: lastmod -> vite build -> bundle SSR -> SSG (ver abaixo)
bun run build:sem-prerender # só o vite build, sem SSG
bun run hooks:instalar      # instala scripts/hooks/pre-push (roda typecheck + test). Pular: git push --no-verify
bun run monitorar:seo       # bate em PRODUÇÃO pela rede; só sob demanda, nunca no CI
bun run indexnow            # ping no IndexNow; rode DEPOIS que o deploy estiver no ar
```

O `bun.lock` resolve todos os tarballs a partir do espelho npm privado da Lovable (`europe-west1-npm.pkg.dev/lovable-core-prod/...`). Num ambiente em que esse host não é alcançável, `bun install --frozen-lockfile` falha no meio. Alternativa só para verificação local: `rm -rf node_modules && npm install --legacy-peer-deps` (o `npm install` puro quebra no resolvedor de peers do npm com esta árvore) e depois `npm install --no-save --legacy-peer-deps @testing-library/dom@<versão do bun.lock> @supabase/supabase-js@<versão do bun.lock>`. O npm ignora o `bun.lock`, então puxa minors mais novos que os do CI; uma diferença de typecheck sob npm é suspeita até ser reproduzida com as versões fixadas. Não commite `package-lock.json` e não regenere o `bun.lock` por efeito colateral.

`bun run lint` não faz parte do CI nem do gate de pre-push; rode-o você mesmo. Ele passa com zero erros e ~360 avisos `no-explicit-any` (dívida de tipagem gerada pela Lovable, mantida como aviso de propósito). Não introduza erro novo.

As edge functions são Deno e não são construídas, lintadas nem checadas pelo toolchain deste repo. Deploy pela CLI do Supabase (`supabase functions deploy <nome>`) ou pela Lovable Cloud. Os testes SQL em `src/lib/__tests__/*.sql.test.ts` se auto-pulam a menos que `PGHOST`/`SUPABASE_DB_URL` e `psql` estejam disponíveis.

## Modelo de deploy (leia antes de fazer push na main)

- Este é um projeto **Lovable**. Push na `main` **é deploy em produção** de drjulianomachado.com. Não há etapa de revisão, e o build da Lovable roda `npm run build` (Node 22) mas **não roda tsc**. Erro de tipo chega a produção em silêncio. É por isso que existem o hook de pre-push e o `.github/workflows/verificar.yml`; o workflow avisa (X vermelho) mas não consegue bloquear o deploy.
- O editor da Lovable também commita direto na `main` (commits "Lovable update", "Work in progress"). Espere encontrá-los no histórico.
- `.env.production` é commitado de propósito: contém só a URL e a anon key públicas do Supabase que o Vite embute. Segredos de verdade vivem nos secrets do Supabase/Lovable Cloud, nunca no repo. `.env`/`.env.local` são overrides gitignored.
- O repositório é público. Não commite dado de paciente (veja as entradas `scripts/backfill-avaliacoes-google.*` no gitignore).

## Arquitetura do frontend

**Stack**: Vite 5, React 18, TypeScript (não estrito), react-router-dom 7, TanStack Query, react-helmet-async, shadcn/ui + Tailwind (tokens em `src/index.css`, tema escuro azul-marinho/dourado), zod. Alias `@/` -> `src/`.

**`src/App.tsx` é dividido em dois exports e o SSG depende dessa divisão**:
- `AppProvedores` — provedores independentes de roteador (Helmet, QueryClient, Tooltip, toasters). Aceita um `helmetContext` para o servidor coletar as tags do head.
- `AppConteudo` — tudo que vive dentro do roteador (tracker, scroll, banner de consentimento, `<Routes>`).
- `main.tsx` os envolve em `BrowserRouter`; `src/entry-server.tsx` os envolve em `StaticRouter` (importado de `react-router-dom`, não de `react-router`, senão o vitest cria duas instâncias de módulo). Não junte os dois de volta.

**Carregamento preguiçoso e o chunk do Supabase** são um contrato de performance deliberado:
- Toda página exceto `Index`, `PoliticaPrivacidade` e `NotFound` é `React.lazy`.
- `AuthProvider` envolve só `/auth` e `/admin/*` pela rota de layout `RotasAutenticadas`. Nenhum componente público pode chamar `useAuth()`.
- `@supabase/supabase-js` não pode entrar no bundle inicial. Tudo que é alcançável a partir da raiz ou das páginas públicas (`AuthContext`, `WhatsAppButton`, `useGoogleReviews`, `siteConfig`, `avaliacoesGoogle`) usa `getSupabase()` de `src/integrations/supabase/lazy.ts`. Páginas lazy, componentes de admin, hooks e `src/services/*` importam `supabase` de `client.ts` direto, o que é aceitável porque já estão fora do caminho crítico. Não adicione o supabase ao `manualChunks` do `vite.config.ts`; até um `import type` de `client.ts` num módulo da raiz devolve o modulepreload.
- `client.ts` lança erro (e pinta uma tela de fallback com WhatsApp) se `VITE_SUPABASE_*` estiver ausente; o `vitest.config.ts` injeta placeholders para os testes não caírem nisso.
- `src/integrations/supabase/types.ts` é gerado pelo Supabase. Não edite à mão.
- Objeto passado a `insert`/`upsert`/`update` deve conter só colunas da tabela alvo. Versões do supabase-js mais novas que a fixada (2.86) rejeitam propriedade excedente em tempo de compilação; a fixada aceita e o erro só apareceria em runtime, com o PostgREST recusando a escrita inteira. Ao espalhar um objeto de estado num upsert, o tipo dele precisa espelhar a tabela (ver `GoogleCalendarSettings` em `src/services/googleCalendar.ts`); patch montado dinamicamente se tipa como `TablesUpdate<"tabela">` de `src/integrations/supabase/types.ts`, nunca como `Record<string, unknown>`.

**Camadas**: `src/services/*.ts` são wrappers finos sobre tabelas e `supabase.functions.invoke(...)`; `src/hooks/*` os envolvem com react-query e realtime do Supabase para as telas; `src/features/agendamento/useAgendamentoFlow.ts` é a máquina de estado do agendamento compartilhada por `/agendamento` e `/paragominas/agendamento` (mesmo payload e mesmos eventos de tracking, só o `experienceVariant` muda).

**Fontes únicas de verdade para SEO/NAP** (o Google reconcilia entidades por `@id`, então duplicata é bug, não estilo):
- `src/lib/locations.ts` — as quatro clínicas (endereço, CEP, coordenadas), `BASE_URL`, `PHYSICIAN_ID`.
- `src/lib/constants.ts` — `DOCTOR` (CRM, anos de experiência), formação, perfis sociais.
- `src/lib/schema.ts` — o grafo JSON-LD inteiro (Physician, MedicalClinic, MedicalWebPage, FAQPage, Breadcrumb). As páginas chamam os construtores dele; não escrevem JSON-LD à mão.
- Páginas de procedimento são objetos de dados renderizados por `src/components/procedimentos/ProcedurePageLayout.tsx`.

**Tracking/consentimento**: `index.html` define o Google Consent Mode v2 como negado por padrão (LGPD); `ConsentBanner` + `src/lib/consent.ts` liberam. `main.tsx` captura UTMs/click-ids na entrada (`lib/tracking.ts`), decora links de WhatsApp para atribuição no CRM e instala web-vitals. O Meta Pixel dispara no navegador e no servidor (edge function `meta-capi`), deduplicado por `event_id`. Detalhes em `docs/GTM-EVENTOS-DATALAYER.md` e `docs/META-CAPI-SETUP.md`.

## Pipeline de build e SSG

`bun run build` roda, nesta ordem:
1. `scripts/atualizar-lastmod.mjs` — grava a data do último commit de cada rota no `<lastmod>` do `public/sitemap.xml`.
2. `vite build` — bundle do cliente em `dist/`.
3. `scripts/build-ssr.mjs` — `vite build --ssr src/entry-server.tsx` em `dist-ssr/`. **Nunca derruba o build**; em erro grava `dist/ssr-build-status.json` e sai com 0.
4. `scripts/ssg.mjs` — importa o bundle SSR e renderiza toda rota do `public/sitemap.xml` mais as de `scripts/rotas-extra.mjs` com `renderToPipeableStream`, gravando `dist/<rota>/index.html` com o head do Helmet da rota (title, meta, canonical, JSON-LD) e o body. Rota que lança erro é pulada e segue servindo a casca. Resumo em `dist/ssg-status.json`.

**Não há hidratação, de propósito**: o cliente chama `createRoot().render()`, que substitui o markup do SSG. Não troque por `hydrateRoot`.

`scripts/prerender.mjs` (Playwright/Chromium) é legado: não roda no container de build da Lovable (faltam bibliotecas de sistema) e foi substituído pelo SSG em 28/08/2026. Leia `.claude/skills/prerender-na-lovable/SKILL.md` antes de mexer em qualquer coisa deste pipeline.

## Criar ou alterar uma rota pública

Vários testes-guarda do vitest leem os arquivos-fonte como texto e derrubam o commit se as peças discordarem. Ao criar uma rota:

1. Adicione o `<Route>` no `App.tsx` (import lazy).
2. Indexável? Adicione a URL ao `public/sitemap.xml`. Não indexável (funil, redirect, auth)? Adicione a `scripts/rotas-extra.mjs` e emita `<meta name="robots" content="noindex">` via Helmet. Nunca os dois. (`src/test/rotasComHtml.test.ts`)
3. Adicione ao `public/llms.txt`. (`src/test/llmsTxt.test.ts`)
4. Página de procedimento? Adicione o card em `src/pages/procedimentos/Index.tsx`. (`src/test/procedimentosIndex.test.ts`)
5. A página precisa emitir seu próprio `<title>`, description e canonical pelo Helmet. Não devolva canonical/description ao `index.html`. (`src/test/indexHtmlMetaTags.test.ts`)
6. Se a página monta `MobileStickyCTA`, passe `apenasDesktop` ao `WhatsAppButton`. (`src/test/whatsappDuplicado.test.ts`)
7. O componente precisa renderizar em Node sem acessar `window`/`document` durante o render; `src/test/ssg.test.tsx` renderiza rotas de amostra e exige texto de verdade na saída. Proteja código só de navegador com `typeof window !== "undefined"` ou `useEffect`.

As rotas de redirecionamento (`/agendar`, `/agendar-consulta`) são redirects do React Router com noindex + canonical, porque o host não oferece como configurar um 301. Não presuma que existam regras de servidor.

## Backend: edge functions do Supabase

Ref do projeto: `cnpifhaszbonwlqruwnn`. As funções vivem em `supabase/functions/<nome>/index.ts`; `supabase/config.toml` define `verify_jwt` por função (adicione um bloco para toda função nova).

- **`_shared/` guarda a lógica de negócio; `index.ts` só faz HTTP** (auth, parse, log, serialização). As regras de agenda vivem em `_shared/agenda.ts` (I/O) e `_shared/agendaCore.ts` (puro).
- **Módulos puros com zero imports** (`agendaCore.ts`, `statusTerminais.ts`, `telefoneCanonico.ts`, `dataBelem.ts`, `confirmationStatus.ts`, `classifyNotificationResults.ts`, ...) são importados direto pelos testes do vitest em `src/lib/__tests__/`. Módulos que importam de `https://esm.sh/...` não podem ser, então os testes deles são **estruturais**: leem o fonte da função como texto e afirmam invariantes por regex (ex.: `mcpAgendamentoFailClosed.test.ts`). Mantenha lógica compartilhada nova pura quando quiser testá-la em unidade, e espere que refatorar um `index.ts` quebre um teste estrutural, não um de runtime.
- **Auth**: chamadores servidor-a-servidor (n8n, cron) enviam `x-n8n-secret` (aliases `x-mcp-secret`, `x-api-key`, `Authorization: Bearer`), verificado em tempo constante por `requireN8nSecret` em `_shared/authGuards.ts`; o segredo é lido do Vault pela RPC `ler_secret_integracao` com fallback em env (`_shared/n8nSecret.ts`). Funções só de admin usam `requireAdmin` de `_shared/adminAuth.ts`. Nunca compare segredo com `===`.
- **Fuso horário**: as funções rodam em UTC; a clínica está em America/Belem (UTC-3, sem horário de verão). Use `_shared/dataBelem.ts` e injete o "agora" nas funções puras em vez de chamar `new Date()` dentro delas.

## Regras de domínio que já morderam

- `agendamentos` é ao mesmo tempo o lead e o agendamento (um card do CRM). "Ativo" significa `isRegistroAtivo()` de `_shared/statusTerminais.ts`: não sandbox, `status_crm` não terminal, `status_funil` não terminal. Nunca defina uma lista local de status terminais; uma cópia divergente em `buscar-contexto-paciente` gerou escalações falsas de "paciente ambíguo" (ver `.lovable/plan.md`).
- Casamento de telefone é por `telefone_canonico` exato (`_shared/telefoneCanonico.ts` / RPC `telefone_canonico`), nunca `ilike` nem últimos 8 dígitos.
- Agendamento pelo bot é **fail-closed**: `mcp-agendamento` (JSON-RPC 2.0) só confirma card existente por UUID e rejeita card sandbox/terminal e divergência de telefone. Os contratos de todo endpoint voltado ao n8n estão em `docs/CONTRATO-*.md`; atualize o doc junto com o código.
- `agendamentos.confirmation_status` tem CHECK constraint no banco; use o vocabulário de `_shared/confirmationStatus.ts`, que um teste compara com a migration.
- Fluxo de mensagens: WhatsApp -> Evolution API -> n8n -> `registrar-mensagem-in-n8n` (idempotente por `mensagem_externa_id`) -> `assistente-pre-agendamento`. Saída: n8n/ManyChat -> `registrar-envio-out-n8n`. `supabase.functions.invoke` resolve mesmo em falha; classifique resultados com `_shared/classifyNotificationResults.ts`.
- `scripts/check-lembretes-runner-guardrails.sh` procura no código de runtime um nome de runner/segredo aposentado; não o reintroduza.

## Convenções

- **Comentários explicam o "POR QUE", com data.** Os comentários do código são explicações longas e datadas de por que uma decisão foi tomada e o que quebrou antes. Siga esse estilo ao mudar algo não óbvio, e ao encontrar uma nota "não reabra isto", confira se as premissas dela ainda valem antes de obedecer (o SSG só ficou possível porque dois bloqueios anteriores foram removidos por outros motivos).
- **Commits** em pt-BR, no imperativo, `tipo: descrição` (`feat:`, `fix:`, `perf:`, `docs:`, `a11y:`, `build:`, `chore:`), com o corpo explicando o porquê.
- O texto público segue as normas de publicidade médica do CFM (Resolução CFM 1.974/2011, decisão do médico em 29/08/2026, commit `9170e90`): nenhuma imagem de antes e depois de paciente e nenhum depoimento que identifique paciente. Só a nota agregada do Google mais o link é exibida. Não reintroduza nenhum dos dois, e não busque texto de avaliação com nome de paciente em página pública.
- `docs/` guarda auditorias e contratos de integração; `drjulianomachado.com-audit/` guarda relatórios de auditoria de SEO; `.lovable/plan.md` é uma nota de diagnóstico da Lovable. Nenhum deles é insumo de build.
