# Test Meta CAPI endpoint after deploy
# Sends a synthetic PageView with test event_id and shows the response.
#
# Usage:
#   .\scripts\test-meta-capi.ps1                  # Auto-detect project URL from supabase
#   .\scripts\test-meta-capi.ps1 -Url "https://<ref>.supabase.co"

param(
    [string]$Url
)

$ErrorActionPreference = 'Continue'

function Write-OK($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "  [ERROR] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  $msg" -ForegroundColor Gray }

# Auto-detect URL via supabase status, fallback to .env, fallback to known project ref
if (-not $Url) {
    $apiLine = & supabase status 2>$null | Select-String 'API URL'
    if ($apiLine) {
        $Url = ($apiLine -replace '.*API URL:\s*','').Trim()
    }
}
if (-not $Url) {
    $envFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.env'
    if (Test-Path $envFile) {
        $envContent = Get-Content $envFile -Raw
        if ($envContent -match 'VITE_SUPABASE_URL\s*=\s*"?([^"\r\n]+)"?') {
            $Url = $matches[1].Trim()
        }
    }
}
if (-not $Url) {
    $Url = "https://cnpifhaszbonwlqruwnn.supabase.co"
    Write-Info "Usando URL conhecida: $Url"
}

# Pega anon key do supabase status
$anonKey = $null
$anonLine = & supabase status 2>$null | Select-String 'anon key'
if ($anonLine) {
    $anonKey = ($anonLine -replace '.*anon key:\s*','').Trim()
}

$endpoint = "$Url/functions/v1/meta-capi"
$eventId = "test-$(Get-Date -UFormat %s)-$([guid]::NewGuid().ToString().Substring(0,8))"

$body = @{
    event_name        = "PageView"
    event_id          = $eventId
    event_source_url  = "https://drjulianomachado.com/?utm_source=deploy-test"
    user_data         = @{
        country = "BR"
    }
    custom_data       = @{
        content_name  = "DeployTest"
        utm_source    = "deploy-test"
    }
} | ConvertTo-Json -Depth 5

Write-Info "POST $endpoint"
Write-Info "event_id=$eventId"

try {
    $headers = @{ "Content-Type" = "application/json" }
    if ($anonKey) { $headers["Authorization"] = "Bearer $anonKey" }

    $response = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $body
    $json = $response | ConvertTo-Json -Depth 5
    Write-Host $json -ForegroundColor White

    if ($response.success -eq $true) {
        Write-OK "CAPI respondeu OK"
        Write-OK "events_received: $($response.events_received)"
        Write-OK "fbtrace_id: $($response.fbtrace_id)"
        Write-Info "Confirme em Events Manager > Pixel > Test Events (procure event_id: $eventId)"
        exit 0
    }
    else {
        Write-Err "Resposta sem success=true"
        exit 1
    }
}
catch {
    Write-Err "Falhou: $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit 1
}
