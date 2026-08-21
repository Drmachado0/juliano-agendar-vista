#!/bin/bash
# SessionStart hook — prepara o ambiente do Claude Code na web.
#
# 1. Instala as dependências do projeto (node_modules).
# 2. Instala o dev-browser (https://github.com/SawyerHood/dev-browser), que é a
#    ferramenta PADRÃO de browser deste repo.
# 3. Aponta o dev-browser para o Chromium que já vem pré-instalado no container
#    (o CDN da Playwright é bloqueado pela política de egress, então
#    `dev-browser install` não consegue baixar o browser sozinho).
#
# Idempotente: pode rodar quantas vezes for preciso.
set -uo pipefail

# Só roda no ambiente remoto (Claude Code na web). Localmente cada dev cuida do
# seu setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

# ---------------------------------------------------------------------------
# 1. Dependências do projeto
# ---------------------------------------------------------------------------
if [ ! -d node_modules ]; then
  echo "[session-start] instalando dependências do projeto..."
  if command -v bun >/dev/null 2>&1; then
    bun install || echo "[session-start] AVISO: bun install falhou"
  else
    npm install --no-audit --no-fund || echo "[session-start] AVISO: npm install falhou"
  fi
fi

# ---------------------------------------------------------------------------
# 2. dev-browser CLI
# ---------------------------------------------------------------------------
if ! command -v dev-browser >/dev/null 2>&1; then
  echo "[session-start] instalando dev-browser..."
  npm install -g dev-browser --no-audit --no-fund || echo "[session-start] AVISO: falha ao instalar dev-browser"
fi

# Dependências do daemon (playwright-core etc.) ficam em ~/.dev-browser.
# `dev-browser install` também tenta baixar o Chromium e falha atrás do proxy —
# o `|| true` é intencional: o que importa é o node_modules do daemon.
if command -v dev-browser >/dev/null 2>&1 && [ ! -d "$HOME/.dev-browser/node_modules/playwright-core" ]; then
  echo "[session-start] instalando dependências do daemon do dev-browser..."
  dev-browser install >/dev/null 2>&1 || true
fi

# ---------------------------------------------------------------------------
# 3. Chromium: reaproveita o build pré-instalado do container
# ---------------------------------------------------------------------------
link_chromium() {
  local browsers_json="$HOME/.dev-browser/node_modules/playwright-core/browsers.json"
  local bp="${PLAYWRIGHT_BROWSERS_PATH:-}"
  [ -f "$browsers_json" ] || return 0
  [ -n "$bp" ] && [ -d "$bp" ] || return 0

  # Revisões que a Playwright embutida no dev-browser espera encontrar.
  local want_chromium want_shell
  want_chromium=$(node -e "const b=require('$browsers_json');const e=b.browsers.find(x=>x.name==='chromium');process.stdout.write(e?e.revision:'')" 2>/dev/null)
  want_shell=$(node -e "const b=require('$browsers_json');const e=b.browsers.find(x=>x.name==='chromium-headless-shell');process.stdout.write(e?e.revision:'')" 2>/dev/null)

  # Chromium completo: <bp>/chromium-<rev>/chrome-linux64/chrome
  if [ -n "$want_chromium" ] && [ ! -e "$bp/chromium-$want_chromium/chrome-linux64/chrome" ]; then
    local src
    src=$(ls -d "$bp"/chromium-*/chrome-linux 2>/dev/null | head -1)
    if [ -n "$src" ]; then
      mkdir -p "$bp/chromium-$want_chromium"
      ln -sfn "$src" "$bp/chromium-$want_chromium/chrome-linux64"
      touch "$bp/chromium-$want_chromium/INSTALLATION_COMPLETE" \
            "$bp/chromium-$want_chromium/DEPENDENCIES_VALIDATED"
      echo "[session-start] chromium-$want_chromium -> $src"
    fi
  fi

  # Headless shell: <bp>/chromium_headless_shell-<rev>/chrome-headless-shell-linux64/chrome-headless-shell
  if [ -n "$want_shell" ] && [ ! -e "$bp/chromium_headless_shell-$want_shell/chrome-headless-shell-linux64/chrome-headless-shell" ]; then
    local ssrc
    ssrc=$(ls -d "$bp"/chromium_headless_shell-*/chrome-linux 2>/dev/null | head -1)
    if [ -n "$ssrc" ]; then
      local dest="$bp/chromium_headless_shell-$want_shell/chrome-headless-shell-linux64"
      mkdir -p "$dest"
      local f base target
      for f in "$ssrc"/*; do
        base=$(basename "$f")
        target="$base"
        [ "$base" = "headless_shell" ] && target="chrome-headless-shell"
        ln -sfn "$f" "$dest/$target"
      done
      touch "$bp/chromium_headless_shell-$want_shell/INSTALLATION_COMPLETE" \
            "$bp/chromium_headless_shell-$want_shell/DEPENDENCIES_VALIDATED"
      echo "[session-start] chromium_headless_shell-$want_shell -> $ssrc"
    fi
  fi
}
link_chromium

# Fecha browsers ociosos depois de 5 min (preserva perfil e sessão logada).
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export DEV_BROWSER_IDLE_TIMEOUT_MS=300000' >> "$CLAUDE_ENV_FILE"
fi

echo "[session-start] pronto."
exit 0
