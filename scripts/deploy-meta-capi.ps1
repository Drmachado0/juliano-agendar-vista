# Deploy Meta CAPI integration — Dr. Juliano
# ============================================
# Automates: secrets, migration push, edge function deploys, validation.
#
# Usage:
#   .\scripts\deploy-meta-capi.ps1                 # Full deploy (test mode)
#   .\scripts\deploy-meta-capi.ps1 -Production     # Full deploy (prod, removes test code)
#   .\scripts\deploy-meta-capi.ps1 -ValidateOnly   # Only test the deployed endpoint
#   .\scripts\deploy-meta-capi.ps1 -SkipMigration  # Don't push DB migrations
#   .\scripts\deploy-meta-capi.ps1 -EnableTestMode # Just toggle test event code ON
#   .\scripts\deploy-meta-capi.ps1 -DisableTestMode# Just toggle test event code OFF
#
# Exit codes: 0 = OK, 1 = aborted, 2 = supabase CLI missing, 3 = deploy failed

[CmdletBinding()]
param(
    [switch]$Production,
    [switch]$ValidateOnly,
    [switch]$SkipMigration,
    [switch]$EnableTestMode,
    [switch]$DisableTestMode
)

$ErrorActionPreference = 'Stop'
$PIXEL_ID = '1003792428067622'

function Write-Step($msg)    { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-OK($msg)      { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg)    { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)     { Write-Host "  [ERROR] $msg" -ForegroundColor Red }
function Write-Info($msg)    { Write-Host "  $msg" -ForegroundColor Gray }

# Move to project root (script lives in ./scripts/)
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
Write-Info "Project root: $ProjectRoot"

# ----- 1. Pre-flight: supabase CLI -----
Write-Step "Verificando supabase CLI"
$cli = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $cli) {
    Write-Err "Supabase CLI não encontrado no PATH."
    Write-Info "Instale: https://supabase.com/docs/guides/cli/getting-started"
    Write-Info "  npm i -g supabase   (ou)   scoop install supabase"
    exit 2
}
$cliVersion = (& supabase --version 2>$null) -replace '\r?\n',''
Write-OK "supabase CLI $cliVersion"

# ----- 2. Pre-flight: linked project -----
Write-Step "Verificando link do projeto"
$linkedOutput = & supabase status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Warn "Projeto não está linkado. Rode: supabase link --project-ref <ref>"
    Write-Info "Pega o ref em: Supabase Dashboard → Project Settings → General → Reference ID"
    $continue = Read-Host "Continuar mesmo assim? (s/N)"
    if ($continue -ne 's') { exit 1 }
}
else {
    Write-OK "Projeto linkado"
}

# ----- Modo: só validar -----
if ($ValidateOnly) {
    Write-Step "Modo VALIDATE-ONLY: testando endpoint meta-capi"
    & "$PSScriptRoot\test-meta-capi.ps1"
    exit $LASTEXITCODE
}

# ----- Modo: só toggle test mode -----
if ($EnableTestMode -or $DisableTestMode) {
    if ($EnableTestMode) {
        Write-Step "Habilitando META_TEST_EVENT_CODE"
        $code = Read-Host "Cole o Test Event Code (Events Manager → Test Events)"
        if (-not $code) { Write-Err "Code vazio, abortando."; exit 1 }
        & supabase secrets set "META_TEST_EVENT_CODE=$code"
        if ($LASTEXITCODE -ne 0) { Write-Err "Falha ao setar secret"; exit 3 }
        Write-OK "Test mode HABILITADO"
        Write-Info "Redeployando meta-capi para aplicar..."
        & supabase functions deploy meta-capi --no-verify-jwt
        if ($LASTEXITCODE -eq 0) { Write-OK "Done. Faça uma reserva real e valide em Events Manager → Test Events" }
    }
    if ($DisableTestMode) {
        Write-Step "Removendo META_TEST_EVENT_CODE (modo PRODUÇÃO)"
        & supabase secrets unset META_TEST_EVENT_CODE
        Write-OK "Test mode DESABILITADO"
        Write-Info "Redeployando meta-capi para aplicar..."
        & supabase functions deploy meta-capi --no-verify-jwt
        if ($LASTEXITCODE -eq 0) { Write-OK "Done. Eventos agora vão pro reporting normal." }
    }
    exit 0
}

# ----- 3. Migration push -----
if (-not $SkipMigration) {
    Write-Step "Aplicando migrations pendentes (supabase db push)"
    Write-Warn "Isto pode aplicar a migration 20260502005818 (UTM/fbc/fbp/etc colunas) em produção."
    $confirm = Read-Host "Continuar? (s/N)"
    if ($confirm -eq 's') {
        & supabase db push
        if ($LASTEXITCODE -ne 0) { Write-Err "Falha ao aplicar migrations"; exit 3 }
        Write-OK "Migrations aplicadas"
    }
    else {
        Write-Warn "Migration pulada — confirme manualmente no Supabase Dashboard"
    }
}
else {
    Write-Info "Migration skipped (-SkipMigration)"
}

# ----- 4. Secrets -----
Write-Step "Configurando secrets do Meta CAPI"

# Pixel ID — sempre seta (idempotente)
& supabase secrets set "META_PIXEL_ID=$PIXEL_ID" | Out-Null
if ($LASTEXITCODE -eq 0) { Write-OK "META_PIXEL_ID = $PIXEL_ID" }
else { Write-Err "Falha ao setar META_PIXEL_ID"; exit 3 }

# Access Token — só pede se o usuário não tiver setado ainda
$existingToken = & supabase secrets list 2>$null | Select-String 'META_CAPI_ACCESS_TOKEN'
if ($existingToken) {
    Write-OK "META_CAPI_ACCESS_TOKEN já configurado"
    $reset = Read-Host "Quer regerar o token? (s/N)"
    if ($reset -eq 's') {
        $tokenSecure = Read-Host "Cole o novo Access Token (input oculto)" -AsSecureString
        $tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSecure))
        & supabase secrets set "META_CAPI_ACCESS_TOKEN=$tokenPlain" | Out-Null
        if ($LASTEXITCODE -eq 0) { Write-OK "Token atualizado" }
    }
}
else {
    Write-Warn "META_CAPI_ACCESS_TOKEN não configurado. Gere em:"
    Write-Info "  Events Manager → seu pixel → Settings → Conversions API → Generate Access Token"
    $tokenSecure = Read-Host "Cole o Access Token (input oculto)" -AsSecureString
    $tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSecure))
    if (-not $tokenPlain) { Write-Err "Token vazio, abortando."; exit 1 }
    & supabase secrets set "META_CAPI_ACCESS_TOKEN=$tokenPlain" | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Err "Falha ao setar token"; exit 3 }
    Write-OK "Token configurado"
}

# Test event code
if ($Production) {
    Write-Info "Modo PRODUÇÃO: removendo META_TEST_EVENT_CODE"
    & supabase secrets unset META_TEST_EVENT_CODE 2>$null | Out-Null
    Write-OK "Production mode set"
}
else {
    Write-Info "Modo TEST: configure um Test Event Code"
    $testCode = Read-Host "Cole o Test Event Code (deixe vazio para pular)"
    if ($testCode) {
        & supabase secrets set "META_TEST_EVENT_CODE=$testCode" | Out-Null
        Write-OK "Test mode habilitado com code $testCode"
    }
    else {
        Write-Info "Test code não setado — eventos vão pro reporting normal"
    }
}

# ----- 5. Deploy edge functions -----
Write-Step "Deployando Edge Function: meta-capi"
& supabase functions deploy meta-capi --no-verify-jwt
if ($LASTEXITCODE -ne 0) { Write-Err "Falha ao deployar meta-capi"; exit 3 }
Write-OK "meta-capi deployada (--no-verify-jwt)"

Write-Step "Deployando Edge Function: criar-agendamento"
& supabase functions deploy criar-agendamento
if ($LASTEXITCODE -ne 0) { Write-Err "Falha ao deployar criar-agendamento"; exit 3 }
Write-OK "criar-agendamento deployada (com Meta CAPI integrado)"

# ----- 6. Validate -----
Write-Step "Validando endpoint com PageView de teste"
& "$PSScriptRoot\test-meta-capi.ps1"

# ----- 7. Summary -----
Write-Step "Deploy concluído"
Write-OK "Edge Functions: meta-capi + criar-agendamento"
Write-OK "Secrets: META_PIXEL_ID + META_CAPI_ACCESS_TOKEN"
if (-not $Production) {
    Write-Warn "TEST MODE ativo — eventos NÃO vão para reporting até você rodar:"
    Write-Info "  .\scripts\deploy-meta-capi.ps1 -DisableTestMode"
}

Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Importar gtm-meta-pixel-import.json no Tag Manager (GTM-K3C2NNF6)"
Write-Host "  2. Publicar versão do GTM"
Write-Host "  3. Deploy frontend via Lovable (push do git)"
Write-Host "  4. Fazer 1 reserva real no site"
Write-Host "  5. Validar em: Events Manager > Test Events (browser + server + dedup OK)"
Write-Host "  6. Quando estiver OK por 24h, rodar:"
Write-Host "     .\scripts\deploy-meta-capi.ps1 -DisableTestMode" -ForegroundColor Yellow
