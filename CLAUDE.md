# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Public website + admin CRM for Dr. Juliano Machado (ophthalmologist, Paragominas/Belém, PA). Frontend is a Vite/React SPA that is statically pre-rendered at build time; backend is Supabase (Postgres + ~55 Deno edge functions) that also serves a WhatsApp booking bot via n8n/ManyChat/Evolution API. Everything (identifiers, comments, commits, docs) is written in **pt-BR**. Keep it that way.

## Commands

Lockfile is `bun.lock`. Use bun; if you use npm, never commit `package-lock.json`.

```sh
bun install --frozen-lockfile
bun run dev                 # Vite on port 8080
bun run typecheck           # tsc --noEmit -p tsconfig.app.json  (strict is OFF; still catches TS2304 etc.)
bun run test                # vitest run (jsdom by default)
bun run test:watch
bunx vitest run src/lib/__tests__/telefoneCanonico.test.ts   # single file
bunx vitest run -t "nome do teste"                            # by name
bun run lint                # eslint; supabase/functions is ignored (Deno code)
bun run build               # full pipeline: lastmod -> vite build -> SSR bundle -> SSG (see below)
bun run build:sem-prerender # plain vite build, no SSG
bun run hooks:instalar      # installs scripts/hooks/pre-push (runs typecheck + test). Skip with git push --no-verify
bun run monitorar:seo       # hits PRODUCTION over the network; on demand only, never in CI
bun run indexnow            # ping IndexNow; run AFTER a deploy is live
```

`bun.lock` resolves every tarball from Lovable's private npm mirror (`europe-west1-npm.pkg.dev/lovable-core-prod/...`). In an environment where that host is unreachable, `bun install --frozen-lockfile` fails part-way. Fallback for local verification only: `rm -rf node_modules && npm install --legacy-peer-deps` (plain `npm install` crashes in npm's peer resolver on this tree), then `npm install --no-save --legacy-peer-deps @testing-library/dom@<version in bun.lock> @supabase/supabase-js@<version in bun.lock>`. npm ignores `bun.lock`, so it pulls newer minors than CI uses; a typecheck difference under npm is suspect until reproduced with the pinned versions. Don't commit `package-lock.json` and don't regenerate `bun.lock` as a side effect.

`bun run lint` is not part of CI or the pre-push gate. It currently reports one `prefer-const` error in `src/integrations/supabase/previewAuthStorage.ts` and ~360 `no-explicit-any` warnings (known Lovable-generated typing debt, kept as warnings on purpose).

Edge functions are Deno and are not built, linted, or type-checked by this repo's toolchain. Deploy with the Supabase CLI (`supabase functions deploy <name>`) or Lovable Cloud. The SQL tests in `src/lib/__tests__/*.sql.test.ts` self-skip unless `PGHOST`/`SUPABASE_DB_URL` and `psql` are available.

## Deployment model (read before pushing to main)

- This is a **Lovable** project. A push to `main` **is a production deploy** of drjulianomachado.com. There is no review step, and Lovable's build runs `npm run build` (Node 22) but **does not run tsc**. A type error reaches production silently. That is why the pre-push hook and `.github/workflows/verificar.yml` exist; the workflow warns (red X) but cannot block the deploy.
- Lovable's editor also commits straight to `main` ("Lovable update", "Work in progress" commits). Expect them in history.
- `.env.production` is committed on purpose: it holds only the public Supabase URL/anon key that Vite inlines. Real secrets live in Supabase/Lovable Cloud secrets, never in the repo. `.env`/`.env.local` are gitignored overrides.
- The repo is public. Don't commit patient data (see the `scripts/backfill-avaliacoes-google.*` gitignore entries).

## Frontend architecture

**Stack**: Vite 5, React 18, TypeScript (non-strict), react-router-dom 7, TanStack Query, react-helmet-async, shadcn/ui + Tailwind (tokens in `src/index.css`, dark navy/gold theme), zod. Alias `@/` -> `src/`.

**`src/App.tsx` is split in two exports and the SSG depends on that split**:
- `AppProvedores` — router-independent providers (Helmet, QueryClient, Tooltip, toasters). Accepts a `helmetContext` so the server can collect head tags.
- `AppConteudo` — everything inside the router (tracker, scroll, consent banner, `<Routes>`).
- `main.tsx` wraps them in `BrowserRouter`; `src/entry-server.tsx` wraps them in `StaticRouter` (imported from `react-router-dom`, not `react-router`, or vitest gets two module instances). Don't merge them back.

**Lazy loading and the Supabase chunk** are a deliberate performance contract:
- Every page except `Index`, `PoliticaPrivacidade`, `NotFound` is `React.lazy`.
- `AuthProvider` wraps only `/auth` and `/admin/*` via the `RotasAutenticadas` layout route. No public component may call `useAuth()`.
- `@supabase/supabase-js` must not be in the initial bundle. Anything reachable from the root or from public pages (`AuthContext`, `WhatsAppButton`, `useGoogleReviews`, `siteConfig`, `avaliacoesGoogle`) uses `getSupabase()` from `src/integrations/supabase/lazy.ts`. Lazy-loaded pages, admin components, hooks and `src/services/*` import `supabase` from `client.ts` directly, which is fine because they are already off the critical path. Don't add supabase to `manualChunks` in `vite.config.ts`; even an `import type` from `client.ts` in a root module re-adds the modulepreload.
- `client.ts` throws (and paints a WhatsApp fallback screen) if `VITE_SUPABASE_*` is missing; `vitest.config.ts` injects placeholders so tests don't hit that.
- `src/integrations/supabase/types.ts` is generated by Supabase. Don't hand-edit.
- Upgrading `@supabase/supabase-js` past the pinned 2.86.x turns on excess-property checking for `upsert`; today that breaks `updateGoogleCalendarSettings` in `src/services/googleCalendar.ts` (`pull_enabled` is not in the table's Insert type). Fix the type or the payload before bumping.

**Layers**: `src/services/*.ts` are thin wrappers over tables and `supabase.functions.invoke(...)`; `src/hooks/*` wrap them with react-query and Supabase realtime for the screens; `src/features/agendamento/useAgendamentoFlow.ts` is the booking state machine shared by `/agendamento` and `/paragominas/agendamento` (same payload and tracking events, only `experienceVariant` differs).

**Single sources of truth for SEO/NAP** (Google reconciles entities by `@id`, so duplicates are bugs, not style):
- `src/lib/locations.ts` — the four clinics (address, CEP, coordinates), `BASE_URL`, `PHYSICIAN_ID`.
- `src/lib/constants.ts` — `DOCTOR` (CRM, years of experience), formation, social profiles.
- `src/lib/schema.ts` — the whole JSON-LD graph (Physician, MedicalClinic, MedicalWebPage, FAQPage, Breadcrumb). Pages call its builders; they don't write JSON-LD by hand.
- Procedure pages are data objects rendered by `src/components/procedimentos/ProcedurePageLayout.tsx`.

**Tracking/consent**: `index.html` sets Google Consent Mode v2 to denied by default (LGPD); `ConsentBanner` + `src/lib/consent.ts` flip it. `main.tsx` captures UTMs/click-ids on entry (`lib/tracking.ts`), decorates WhatsApp links for CRM attribution, and installs web-vitals. Meta Pixel fires browser-side and server-side (`meta-capi` edge function) deduplicated by `event_id`. Details in `docs/GTM-EVENTOS-DATALAYER.md` and `docs/META-CAPI-SETUP.md`.

## Build pipeline and SSG

`bun run build` runs, in order:
1. `scripts/atualizar-lastmod.mjs` — writes each route's last git commit date into `public/sitemap.xml` `<lastmod>`.
2. `vite build` — client bundle into `dist/`.
3. `scripts/build-ssr.mjs` — `vite build --ssr src/entry-server.tsx` into `dist-ssr/`. **Never fails the build**; on error it writes `dist/ssr-build-status.json` and exits 0.
4. `scripts/ssg.mjs` — imports the SSR bundle and renders every route from `public/sitemap.xml` plus `scripts/rotas-extra.mjs` with `renderToPipeableStream`, writing `dist/<rota>/index.html` with the route's Helmet head (title, meta, canonical, JSON-LD) and body. Routes that throw are skipped and keep serving the shell. Summary in `dist/ssg-status.json`.

There is **no hydration on purpose**: the client calls `createRoot().render()`, which replaces the SSG markup. Don't switch to `hydrateRoot`.

`scripts/prerender.mjs` (Playwright/Chromium) is legacy: it cannot run in Lovable's build container (missing system libs) and was superseded by the SSG on 28/08/2026. Read `.claude/skills/prerender-na-lovable/SKILL.md` before touching anything in this pipeline.

## Adding or changing a public route

Several vitest guard tests read source files as text and fail the commit if the pieces disagree. When you add a route:

1. Add the `<Route>` in `App.tsx` (lazy import).
2. Indexable? Add the URL to `public/sitemap.xml`. Not indexable (funnel, redirect, auth)? Add it to `scripts/rotas-extra.mjs` and emit `<meta name="robots" content="noindex">` via Helmet. Never both. (`src/test/rotasComHtml.test.ts`)
3. Add it to `public/llms.txt`. (`src/test/llmsTxt.test.ts`)
4. Procedure page? Add its card to `src/pages/procedimentos/Index.tsx`. (`src/test/procedimentosIndex.test.ts`)
5. The page must emit its own `<title>`, description and canonical through Helmet. Do not add canonical/description back into `index.html`. (`src/test/indexHtmlMetaTags.test.ts`)
6. If the page mounts `MobileStickyCTA`, pass `apenasDesktop` to `WhatsAppButton`. (`src/test/whatsappDuplicado.test.ts`)
7. The component must render under Node with no `window`/`document` access during render; `src/test/ssg.test.tsx` renders sample routes and asserts real text came out. Gate browser-only code behind `typeof window !== "undefined"` or `useEffect`.

Redirect routes (`/agendar`, `/agendar-consulta`) are React Router redirects with noindex + canonical, because the host offers no way to configure a 301. Don't assume server rules exist.

## Backend: Supabase edge functions

Project ref `cnpifhaszbonwlqruwnn`. Functions live in `supabase/functions/<name>/index.ts`; `supabase/config.toml` sets `verify_jwt` per function (add a block for every new function).

- **`_shared/` holds the business logic; `index.ts` should only do HTTP** (auth, parse, log, serialize). Agenda rules live in `_shared/agenda.ts` (I/O) and `_shared/agendaCore.ts` (pure).
- **Pure modules with zero imports** (`agendaCore.ts`, `statusTerminais.ts`, `telefoneCanonico.ts`, `dataBelem.ts`, `confirmationStatus.ts`, `classifyNotificationResults.ts`, ...) are imported directly by vitest tests in `src/lib/__tests__/`. Modules that import from `https://esm.sh/...` cannot be, so tests for those are **structural**: they read the function's source as text and assert invariants with regexes (e.g. `mcpAgendamentoFailClosed.test.ts`). Keep new shared logic pure when you want it unit-tested, and expect refactors of `index.ts` files to break a structural test rather than a runtime one.
- **Auth**: server-to-server callers (n8n, cron) send `x-n8n-secret` (aliases `x-mcp-secret`, `x-api-key`, `Authorization: Bearer`), verified timing-safe by `requireN8nSecret` in `_shared/authGuards.ts`; the secret is read from Vault via RPC `ler_secret_integracao` with env fallback (`_shared/n8nSecret.ts`). Admin-only functions use `requireAdmin` from `_shared/adminAuth.ts`. Never compare secrets with `===`.
- **Timezone**: functions run in UTC; the clinic is America/Belem (UTC-3, no DST). Use `_shared/dataBelem.ts` and inject "now" into pure functions instead of calling `new Date()` inside them.

## Domain rules that have bitten before

- `agendamentos` is both the lead and the appointment (a CRM card). "Active" means `isRegistroAtivo()` from `_shared/statusTerminais.ts`: not sandbox, `status_crm` not terminal, `status_funil` not terminal. Never define a local terminal-status list; a divergent copy in `buscar-contexto-paciente` produced false "ambiguous patient" escalations (see `.lovable/plan.md`).
- Phone matching is by exact `telefone_canonico` (`_shared/telefoneCanonico.ts` / RPC `telefone_canonico`), never `ilike` or last-8-digits.
- Booking via the bot is **fail-closed**: `mcp-agendamento` (JSON-RPC 2.0) only confirms an existing card by UUID, rejects sandbox/terminal cards and phone mismatches. Contracts for every n8n-facing endpoint are in `docs/CONTRATO-*.md`; update the doc with the code.
- `agendamentos.confirmation_status` has a DB CHECK constraint; use the vocabulary in `_shared/confirmationStatus.ts`, which a test compares against the migration.
- Message flow: WhatsApp -> Evolution API -> n8n -> `registrar-mensagem-in-n8n` (idempotent on `mensagem_externa_id`) -> `assistente-pre-agendamento`. Outbound: n8n/ManyChat -> `registrar-envio-out-n8n`. `supabase.functions.invoke` resolves even on failure; classify results with `_shared/classifyNotificationResults.ts`.
- `scripts/check-lembretes-runner-guardrails.sh` greps runtime code for a retired secret/runner name; don't reintroduce it.

## Conventions

- **Comments explain "POR QUE", with dates.** The codebase's comments are long, dated explanations of why a decision was made and what broke before. Match that style when you change something non-obvious, and when you meet a "não reabra isto" note, check whether its premises still hold before obeying it (the SSG only became possible because two earlier blockers had been removed for other reasons).
- **Commits** are pt-BR, imperative, `tipo: descrição` (`feat:`, `fix:`, `perf:`, `docs:`, `a11y:`, `build:`, `chore:`), body explains the why.
- Public copy follows CFM medical-advertising rules (Resolução CFM 1.974/2011, decided by the doctor on 29/08/2026, commit `9170e90`): no before/after patient images and no testimonials that identify a patient. Only the aggregate Google rating plus link is shown. Don't reintroduce either, and don't fetch review text with patient names on public pages.
- `docs/` holds audits and integration contracts; `drjulianomachado.com-audit/` holds SEO audit reports; `.lovable/plan.md` is a Lovable diagnostic note. None of these are build inputs.
