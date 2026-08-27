$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"
$backendUrl = "http://127.0.0.1:3333/health"
$frontendUrl = "http://127.0.0.1:5173"

function Wait-ForUrl {
  param(
    [string]$Name,
    [string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
      Write-Host "$Name pronto: $Url"
      return $true
    } catch {
      Start-Sleep -Milliseconds 700
    }
  }

  Write-Host "$Name ainda nao respondeu em $Url"
  return $false
}

Write-Host "LICITA AI - inicializando ambiente local..."
Write-Host "Preparando banco SQLite..."

Push-Location $backendDir
try {
  npm.cmd run db:init
} finally {
  Pop-Location
}

$jobs = @()

$jobs += Start-Job -Name "licita-ai-backend" -ScriptBlock {
  param($dir)
  Set-Location $dir
  npm.cmd run dev
} -ArgumentList $backendDir

$jobs += Start-Job -Name "licita-ai-frontend" -ScriptBlock {
  param($dir)
  Set-Location $dir
  npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
} -ArgumentList $frontendDir

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:3333"
Write-Host "Frontend: $frontendUrl"
Write-Host "Pressione Ctrl+C para encerrar os dois servicos."
Write-Host ""

$backendReady = Wait-ForUrl -Name "Backend" -Url $backendUrl
$frontendReady = Wait-ForUrl -Name "Frontend" -Url $frontendUrl

if ($frontendReady) {
  Write-Host "Abrindo LICITA AI no navegador..."
  Start-Process $frontendUrl
}

if (-not $backendReady) {
  Write-Host "Aviso: o frontend pode abrir em modo local se o backend nao responder."
}

Write-Host ""

try {
  while ($true) {
    foreach ($job in $jobs) {
      Receive-Job -Job $job
    }

    $finished = $jobs | Where-Object { $_.State -ne "Running" }
    if ($finished.Count -gt 0) {
      foreach ($job in $finished) {
        Receive-Job -Job $job
        Write-Host "Servico encerrado: $($job.Name) ($($job.State))"
      }
      throw "Um dos servicos foi encerrado."
    }

    Start-Sleep -Seconds 1
  }
} finally {
  foreach ($job in $jobs) {
    Stop-Job -Job $job -ErrorAction SilentlyContinue
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
  }
}
