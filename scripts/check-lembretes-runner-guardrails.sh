#!/usr/bin/env bash
# Guardrail: garante que NENHUM código de runtime referencia o antigo Hermes
# no contexto da edge function lembretes-runner.
#
# Falha se encontrar em runtime code:
#   - hermes-runner
#   - x-hermes-secret
#   - x-runner-secret
#   - HERMES_WEBHOOK_SECRET
#
# Ignora: migrations históricas, node_modules, .git, dist, build,
# arquivos de documentação histórica (.lovable/plan.md, docs/).

set -euo pipefail

PATTERNS='hermes-runner|x-hermes-secret|x-runner-secret|HERMES_WEBHOOK_SECRET'

ROOTS=(
  "supabase/functions"
  "src"
)

EXCLUDES=(
  --glob '!node_modules/**'
  --glob '!**/.git/**'
  --glob '!dist/**'
  --glob '!build/**'
  --glob '!supabase/migrations/**'
  --glob '!**/*.test.ts'
)

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) é necessário" >&2
  exit 2
fi

echo "🔎 Auditando runtime code para referências proibidas..."
HITS=$(rg -n -E "$PATTERNS" "${ROOTS[@]}" "${EXCLUDES[@]}" || true)

if [[ -n "$HITS" ]]; then
  echo "❌ Guardrail falhou. Referências proibidas encontradas em runtime code:"
  echo "$HITS"
  exit 1
fi

echo "✅ Guardrail OK: nenhuma referência proibida em runtime code."
echo "   Auth final: header 'x-lembretes-secret' + env 'LEMBRETES_RUNNER_SECRET'."
