param(
  [string]$BaseUrl = "http://localhost:3000"
)

$projectPath = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectPath ".env"
if (-not (Test-Path -LiteralPath $envPath)) { throw "Arquivo .env não encontrado em $projectPath" }

$secretLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^CRON_SECRET=' } | Select-Object -First 1
if (-not $secretLine) { throw "CRON_SECRET não foi definido no arquivo .env" }
$secret = ($secretLine -replace '^CRON_SECRET=', '').Trim().Trim('"').Trim("'")
if (-not $secret) { throw "CRON_SECRET está vazio no arquivo .env" }

Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/reminders/run" -Headers @{ Authorization = "Bearer $secret" } | ConvertTo-Json -Depth 5
