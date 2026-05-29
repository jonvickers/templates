<#
.SYNOPSIS
    Roam Windows Terminal settings across machines by symlinking settings.json into OneDrive.

.DESCRIPTION
    Windows Terminal stores settings.json under %LOCALAPPDATA%, which does NOT roam - so your
    PowerShell $PROFILE can sync via OneDrive while your default profile, fonts, colors, and
    keybindings stay stuck per-machine. This script points the local settings.json at a single
    shared copy in OneDrive\Documents\WindowsTerminal\settings.json.

    FIRST machine: run with -Seed to copy your current settings into OneDrive, then link.
    OTHER machines: run with no arguments (the OneDrive copy must already be synced) to link.

    Run from an ELEVATED PowerShell window - creating a symlink needs admin rights, unless
    Windows Developer Mode is enabled. Safe to re-run: it no-ops if already linked, and backs
    up any existing local settings.json to settings.json.bak first.

.PARAMETER Seed
    Copy this machine's existing local settings.json into OneDrive before linking. Use this
    once, on the machine whose settings you want to become the shared source of truth.

.NOTES
    Caveat: Windows Terminal writes settings.json in place, which preserves the symlink on
    current builds. If a future update ever replaces the link with a real file, just re-run
    this script. The roamed file and this script live together in OneDrive\Documents\WindowsTerminal.
#>
[CmdletBinding()]
param([switch]$Seed)

$ErrorActionPreference = 'Stop'

$roamDir   = Join-Path $env:OneDrive 'Documents\WindowsTerminal'
$roamFile  = Join-Path $roamDir 'settings.json'
$localFile = Join-Path $env:LOCALAPPDATA 'Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json'

if (-not $env:OneDrive) {
    Write-Error 'OneDrive is not configured on this machine ($env:OneDrive is empty).'
    return
}

$localDir = Split-Path $localFile -Parent
if (-not (Test-Path $localDir)) {
    Write-Error "Windows Terminal LocalState folder not found:`n  $localDir`nLaunch Windows Terminal once, then re-run."
    return
}

# --- Seed the OneDrive copy from this machine (first-machine setup) -------
if ($Seed) {
    New-Item -ItemType Directory -Path $roamDir -Force | Out-Null
    if (Test-Path $localFile) {
        $item = Get-Item $localFile -Force
        if ($item.LinkType -eq 'SymbolicLink') {
            Write-Host 'Local settings is already a symlink - nothing to seed.' -ForegroundColor Yellow
        } else {
            Copy-Item $localFile $roamFile -Force
            Write-Host "Seeded OneDrive copy from this machine's settings:" -ForegroundColor Green
            Write-Host "  $roamFile"
        }
    } else {
        Write-Error "No local settings.json to seed from at:`n  $localFile"
        return
    }
}

if (-not (Test-Path $roamFile)) {
    Write-Error "Roaming settings not found at:`n  $roamFile`nRun once with -Seed on your primary machine first (or wait for OneDrive to sync), then re-run."
    return
}

# --- Already linked? -----------------------------------------------------
$existing = Get-Item $localFile -Force -ErrorAction SilentlyContinue
if ($existing -and $existing.LinkType -eq 'SymbolicLink' -and $existing.Target -eq $roamFile) {
    Write-Host 'Already linked - nothing to do.' -ForegroundColor Green
    Write-Host "  $localFile -> $roamFile"
    return
}

# --- Need elevation (unless Developer Mode is on) ------------------------
$isAdmin = (New-Object Security.Principal.WindowsPrincipal(
    [Security.Principal.WindowsIdentity]::GetCurrent())
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

$devMode = [bool](Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' `
    -Name AllowDevelopmentWithoutDevLicense -ErrorAction SilentlyContinue
).AllowDevelopmentWithoutDevLicense

if (-not $isAdmin -and -not $devMode) {
    Write-Error 'Creating a symlink needs admin rights or Developer Mode. Re-run from an elevated PowerShell window.'
    return
}

# --- Back up and replace with the symlink --------------------------------
if ($existing) {
    Copy-Item $localFile "$localFile.bak" -Force
    Write-Host 'Backed up existing local settings to settings.json.bak' -ForegroundColor Yellow
    Remove-Item $localFile -Force
}

New-Item -ItemType SymbolicLink -Path $localFile -Target $roamFile | Out-Null

$link = Get-Item $localFile -Force
Write-Host 'Linked successfully:' -ForegroundColor Green
Write-Host "  $($link.FullName) -> $($link.Target)"
Write-Host 'Restart Windows Terminal to pick up the roamed settings.'
