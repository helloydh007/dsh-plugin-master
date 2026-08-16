# dsh-plugin-master installer (Windows PowerShell).
#
# Default behavior: link the current checkout's directory directly into
# the profile's node_modules. Pass -Source to fetch from a remote URL
# or use a different local checkout.
#
# What it does:
#   1. resolve a plugin source directory (current dir by default, or git
#      clone / zip / local path when -Source is supplied)
#   2. create a junction-like symlink in the profile's node_modules
#   3. register plugin-master in cordis.patch.yml (idempotent)

[CmdletBinding()]
param(
    [string]$Source = '',
    [string]$Version = 'latest',
    [string]$DshHome = $env:DSH_HOME,
    [string]$Profile = 'web',
    [string]$Repo = 'helloydh007/dsh-plugin-master'
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
if (-not (Test-Path $DshHome)) { throw "DSH home not found: $DshHome (override with -DshHome)" }

$plugin      = 'dsh-plugin-master'
$nodeModules = Join-Path $DshHome "profiles\$Profile\node_modules"
$linkPath    = Join-Path $nodeModules $plugin
$patchFile   = Join-Path $DshHome "profiles\$Profile\cordis.patch.yml"
$pluginsDir  = Join-Path $DshHome 'plugins'
$cloneDir    = Join-Path $pluginsDir $plugin

# ---------- 1. source ----------
if ($Source -eq '') {
    # Default to the directory this script lives in. The script is meant
    # to run from inside a clone, so this is the natural choice.
    $Source = (Resolve-Path (Join-Path $PSScriptRoot '')).Path
    Write-Host "[1/3] Using local source $Source" -ForegroundColor Cyan
} elseif ($Source -match '^https?://') {
    Write-Host "[1/3] Resolving $Source @ $Version ..." -ForegroundColor Cyan
    $ref = $Version
    $isTag = $ref -match '^v\d+\.\d+'
    if ($ref -eq 'latest') {
        $slug = $Source -replace '^https?://github\.com/', '' -replace '\.git$', ''
        try {
            $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$slug/releases/latest" -Headers @{ 'User-Agent' = 'dsh-plugin-master-installer' } -TimeoutSec 15
            if ($latest.tag_name) { $ref = $latest.tag_name; $isTag = $true; Write-Host "  latest: $ref" -ForegroundColor Cyan }
        } catch {
            Write-Host '  (latest lookup failed; falling back to main)' -ForegroundColor Yellow
            $ref = 'main'; $isTag = $false
        }
    }

    $refKind  = if ($isTag) { 'tags' } else { 'heads' }
    $zipUrl   = "$Source/archive/refs/$refKind/$ref.zip"
    $zipFile  = Join-Path $pluginsDir 'plugin-master.zip'
    $extract  = Join-Path $pluginsDir 'plugin-master-extract'
    New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null

    Write-Host "  downloading $zipUrl"
    Invoke-WebRequest $zipUrl -OutFile $zipFile -UseBasicParsing
    if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
    Expand-Archive $zipFile -DestinationPath $extract -Force
    $inner = Get-ChildItem $extract -Directory | Select-Object -First 1
    if (-not $inner) { throw "zip contains no package directory: $zipUrl" }
    if (Test-Path $cloneDir) { Remove-Item $cloneDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path (Split-Path $cloneDir -Parent) | Out-Null
    Move-Item $inner.FullName $cloneDir
    Remove-Item $zipFile -Force
    $Source = $cloneDir
} else {
    $Source = (Resolve-Path $Source).Path
    Write-Host "[1/3] Using local source $Source" -ForegroundColor Cyan
}

if (-not (Test-Path (Join-Path $Source 'lib\client.cjs'))) {
    throw "lib\client.cjs not found in $Source - build the plugin first (cd $Source && pnpm install && pnpm build)."
}

# ---------- 2. link ----------
Write-Host "[2/3] Linking -> $linkPath" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $nodeModules | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $linkPath -Parent) | Out-Null
if (Test-Path $linkPath) {
    $item = Get-Item $linkPath -Force
    if ($item.LinkType) {
        [System.IO.Directory]::Delete($linkPath)
    } else {
        Remove-Item $linkPath -Force -Recurse
    }
}
New-Item -Junction -Path $linkPath -Target $Source | Out-Null

# ---------- 3. register ----------
Write-Host "[3/3] Registering in $patchFile" -ForegroundColor Cyan
$entryText = @'
- id: ui-settings-plugin-inventory
  disabled: true

- insert:
    - id: plugin-master
      name: dsh-plugin-master
'@
if (-not (Test-Path $patchFile)) {
    Set-Content -Path $patchFile -Value ($entryText + "`n") -Encoding UTF8
} else {
    $content = Get-Content $patchFile -Raw
    if ($content -match '(?m)^\s*-\s+id:\s*plugin-master\s*$') {
        Write-Host '  already registered, skip.' -ForegroundColor DarkGray
    } else {
        $base = ($content -replace '(?s)\[\s*\]\s*$', '').TrimEnd()
        if ($base -eq '') { $new = $entryText + "`n" } else { $new = $base + "`n`n" + $entryText + "`n" }
        Set-Content -Path $patchFile -Value $new -Encoding UTF8
    }
}

Write-Host ''
Write-Host 'Done. Reload the Web UI (Settings -> Plugins -> Plugin Manager).' -ForegroundColor Green
Write-Host 'If the tab does not appear after reload, restart the dsh web process.' -ForegroundColor Yellow