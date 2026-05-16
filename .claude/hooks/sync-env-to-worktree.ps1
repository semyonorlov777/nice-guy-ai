# Подтягивает .env.local (и .env.sentry-build-plugin, если есть)
# из основного репо в текущий git worktree через NTFS hard link.
# Запускается SessionStart-хуком Claude Code. В основном репо — no-op.

$ErrorActionPreference = 'Continue'

$commonDir = (git rev-parse --git-common-dir 2>$null)
$gitDir    = (git rev-parse --git-dir 2>$null)
if (-not $commonDir -or -not $gitDir) { return }

$commonFull = (Resolve-Path -LiteralPath $commonDir -ErrorAction SilentlyContinue).Path
$gitFull    = (Resolve-Path -LiteralPath $gitDir    -ErrorAction SilentlyContinue).Path
if (-not $commonFull -or -not $gitFull) { return }

# В основном репо общий и локальный .git совпадают — синхронизировать не нужно
if ($commonFull -eq $gitFull) { return }

$mainRoot = Split-Path -Parent $commonFull
$workRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $mainRoot -or -not $workRoot) { return }
$workRoot = $workRoot.Trim()

$mainDrive = (Split-Path -Qualifier $mainRoot)
$workDrive = (Split-Path -Qualifier $workRoot)
$sameDrive = ($mainDrive -eq $workDrive)

$files = @('.env.local', '.env.sentry-build-plugin')

foreach ($name in $files) {
  $src = Join-Path $mainRoot $name
  $dst = Join-Path $workRoot $name

  if (-not (Test-Path -LiteralPath $src)) { continue }

  if (Test-Path -LiteralPath $dst) {
    try {
      $sh = (Get-FileHash -LiteralPath $src -Algorithm MD5).Hash
      $dh = (Get-FileHash -LiteralPath $dst -Algorithm MD5).Hash
      if ($sh -eq $dh) { continue }
    } catch { }
    Remove-Item -LiteralPath $dst -Force -ErrorAction SilentlyContinue
  }

  try {
    if ($sameDrive) {
      New-Item -ItemType HardLink -Path $dst -Target $src -Force | Out-Null
      Write-Host "[env-sync] hard link: $name"
    } else {
      Copy-Item -LiteralPath $src -Destination $dst -Force
      Write-Host "[env-sync] copy (different drives): $name"
    }
  } catch {
    Write-Host "[env-sync] failed for ${name}: $_"
  }
}
