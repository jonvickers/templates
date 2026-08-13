<#
.SYNOPSIS
  Fan global-prompt.md out to the per-tool global instruction locations.

.DESCRIPTION
  Windows without Developer Mode refuses non-admin symlinks, so the shared
  prompt is copied rather than linked. Re-run this after editing
  global-prompt.md to re-sync every tool.

  Claude and Gemini support @-imports, so they get the file alongside their
  instruction file and import it. Codex has no import mechanism, so its
  AGENTS.md carries the content inline behind a generated-file header.
#>
[CmdletBinding()]
param(
    [string]$Source = (Join-Path $PSScriptRoot 'global-prompt.md')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Source)) { throw "Source not found: $Source" }
$body = Get-Content $Source -Raw
$home_ = $env:USERPROFILE

# --- Claude + Gemini: side-car file, imported by the instruction file ---
foreach ($dir in @("$home_\.claude", "$home_\.gemini")) {
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    Set-Content -Path (Join-Path $dir 'global-prompt.md') -Value $body -NoNewline
    Write-Host "synced -> $dir\global-prompt.md"
}

# --- Codex: no imports, inline the content ---
$codexDir = "$home_\.codex"
if (-not (Test-Path $codexDir)) { New-Item -ItemType Directory -Path $codexDir | Out-Null }
$header = @"
<!-- GENERATED: synced from jonvickers/templates/global-prompt.md by
     sync-global-prompt.ps1. Codex has no @-import mechanism, so the shared
     prompt is inlined here. Edit the template, not this file, then re-run the
     script. Codex-specific instructions go ABOVE this marker. -->

"@
Set-Content -Path (Join-Path $codexDir 'AGENTS.md') -Value ($header + $body) -NoNewline
Write-Host "synced -> $codexDir\AGENTS.md (inlined)"
