# Cria um backup PostgreSQL em uma pasta local ou sincronizada por OneDrive/Google Drive.
# Configure BACKUP_DESTINATION e, se necessário, PG_DUMP_PATH no arquivo .env.

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env"
if (-not (Test-Path -LiteralPath $envFile)) { throw "Arquivo .env não encontrado." }

Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$' -and -not $_.Trim().StartsWith('#')) {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}

if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) { throw "DATABASE_URL não configurada." }
if ([string]::IsNullOrWhiteSpace($env:BACKUP_DESTINATION)) { throw "Configure BACKUP_DESTINATION no arquivo .env." }

$destination = $env:BACKUP_DESTINATION
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$pgDump = if ($env:PG_DUMP_PATH) { $env:PG_DUMP_PATH } else { "pg_dump.exe" }

try { $databaseUri = [Uri]$env:DATABASE_URL } catch { throw "DATABASE_URL inválida." }
$credentials = $databaseUri.UserInfo.Split(':', 2)
$env:PGPASSWORD = if ($credentials.Count -gt 1) { [Uri]::UnescapeDataString($credentials[1]) } else { "" }
$database = $databaseUri.AbsolutePath.TrimStart('/')
$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = Join-Path $destination "painel-renovacoes_$stamp.backup"

& $pgDump --host $databaseUri.Host --port $databaseUri.Port --username ([Uri]::UnescapeDataString($credentials[0])) --format custom --file $backupFile $database
if ($LASTEXITCODE -ne 0) { throw "O pg_dump não conseguiu gerar o backup." }

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
Write-Host "Backup criado em: $backupFile"
