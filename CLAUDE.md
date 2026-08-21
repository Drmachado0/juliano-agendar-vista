# CLAUDE.md

Instruções para agentes trabalhando neste repositório.

## Stack

Vite + React 18 + TypeScript + Tailwind + shadcn/ui, backend Supabase.
Lockfile canônico: `bun.lock` (`package-lock.json` é ignorado pelo git).

## Comandos

```bash
npm install                       # ou bun install
npm run dev -- --host 127.0.0.1   # http://127.0.0.1:8080/
npm run lint
npm test                          # vitest run
npm run build
```

O `vite.config.ts` usa `host: "::"`. Em containers sem IPv6 (Claude Code na web)
isso falha com `EAFNOSUPPORT` — por isso o `-- --host 127.0.0.1`.

## Browser: use sempre o dev-browser

[dev-browser](https://github.com/SawyerHood/dev-browser) é a ferramenta **padrão**
para qualquer coisa que envolva navegador: abrir o app, clicar, preencher
formulário, tirar screenshot, validar UI, extrair dados de página.

Não use Playwright/Puppeteer direto nem outro MCP de browser sem pedido explícito.

```bash
dev-browser --help                # guia de uso + API completa

dev-browser --headless --timeout 60 <<'EOF'
const page = await browser.getPage("app");
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
console.log(await page.title());
const p = await saveScreenshot(await page.screenshot(), "home.png");
console.log(p);   // leia o arquivo com a tool Read
EOF
```

Detalhes e receitas: `.claude/skills/dev-browser/SKILL.md`.
Instalação automática: `.claude/hooks/session-start.sh` (SessionStart hook).

## Dados sensíveis

O projeto lida com agendamentos e CRM de pacientes reais. Nunca criar, alterar ou
cancelar registros em produção sem pedido explícito do usuário.
