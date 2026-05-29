# === Canonical PowerShell profile ===
# Drop this in the PowerShell 7 profile location:
#   [Environment]::GetFolderPath('MyDocuments')\PowerShell\Microsoft.PowerShell_profile.ps1
# and make the Windows PowerShell 5.1 profile a one-line shim that dot-sources it
# (see WindowsPowerShell_5.1_shim_profile.ps1). Keep all edits HERE.
#
# Put this profile under a OneDrive-redirected Documents folder and it ROAMS across
# machines. The catch: the TOOLS it depends on (Terminal-Icons, Starship, fnm, a Nerd
# Font) install per-machine and do NOT roam - so on a fresh or newly-roamed machine the
# profile loads before they exist and throws at startup (classic symptom:
# "Import-Module : Terminal-Icons ... no valid module file was found"). Two safeguards:
#   1. Invoke-ProfileBootstrap installs whatever's missing - runs once per machine
#      (sentinel in LocalAppData, which does NOT roam), interactive sessions only.
#      Re-run any time with  Repair-Profile.
#   2. Every external tool below is guarded, so a still-missing tool is skipped instead
#      of erroring.

# ---------------------------------------------------------------------------
# Bootstrap / self-heal  (edit these two to match your chosen Nerd Font)
# ---------------------------------------------------------------------------
$script:NerdFontAsset = 'CascadiaCode'      # Nerd Fonts release zip name (without .zip)
$script:NerdFontGlob  = 'CaskaydiaCove*'    # installed TTF filename pattern / WT font is "CaskaydiaCove NFM"

function Invoke-ProfileBootstrap {
    [CmdletBinding()]
    param([switch]$Force)

    # Sentinel lives in LocalAppData (does NOT roam) -> each machine provisions once.
    $sentinel = Join-Path $env:LOCALAPPDATA 'ps-profile-bootstrap.done'
    if (-not $Force -and (Test-Path $sentinel)) { return }

    Write-Host 'Profile setup: checking dependencies on this machine...' -ForegroundColor Cyan

    # 1. Terminal-Icons (PowerShell module -> installs to this shell's CurrentUser path,
    #    which is under OneDrive when Documents is redirected, so it then roams too)
    if (-not (Get-Module -ListAvailable Terminal-Icons)) {
        Write-Host '  + Terminal-Icons module' -ForegroundColor Yellow
        try {
            if (-not (Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue)) {
                Install-PackageProvider -Name NuGet -Scope CurrentUser -Force -ErrorAction Stop | Out-Null
            }
            Install-Module Terminal-Icons -Repository PSGallery -Scope CurrentUser -Force -ErrorAction Stop
        } catch { Write-Warning "    Terminal-Icons install failed: $($_.Exception.Message)" }
    }

    # 2. winget CLI tools: Starship prompt + fnm Node manager
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        $apps = @(
            @{ Cmd = 'starship'; Id = 'Starship.Starship'; Name = 'Starship prompt' }
            @{ Cmd = 'fnm';      Id = 'Schniz.fnm';        Name = 'fnm (Node manager)' }
        )
        foreach ($a in $apps) {
            if (-not (Get-Command $a.Cmd -ErrorAction SilentlyContinue)) {
                Write-Host "  + $($a.Name)" -ForegroundColor Yellow
                try {
                    winget install --id $a.Id --source winget --silent `
                        --accept-package-agreements --accept-source-agreements | Out-Null
                } catch { Write-Warning "    $($a.Name) install failed: $($_.Exception.Message)" }
            }
        }
    } else {
        Write-Warning '  winget not found - install Starship and fnm manually.'
    }

    # 3. Nerd Font (per-user install, no admin needed)
    $fontDir = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'
    $haveFont = (Test-Path $fontDir) -and (Get-ChildItem $fontDir -Filter $script:NerdFontGlob -ErrorAction SilentlyContinue)
    if (-not $haveFont) {
        Write-Host "  + Nerd Font ($script:NerdFontAsset)" -ForegroundColor Yellow
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12  # needed on 5.1
            $tmp = Join-Path $env:TEMP ('nerdfont_' + [guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory -Path $tmp -Force | Out-Null
            $zip = Join-Path $tmp 'font.zip'
            Invoke-WebRequest -UseBasicParsing -ErrorAction Stop -OutFile $zip `
                -Uri "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/$($script:NerdFontAsset).zip"
            Expand-Archive $zip -DestinationPath $tmp -Force
            New-Item -ItemType Directory -Path $fontDir -Force | Out-Null
            $regKey = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts'
            foreach ($ttf in (Get-ChildItem $tmp -Filter '*.ttf' -Recurse)) {
                $dest = Join-Path $fontDir $ttf.Name
                Copy-Item $ttf.FullName $dest -Force
                Set-ItemProperty -Path $regKey -Name ($ttf.BaseName + ' (TrueType)') -Value $dest
            }
            Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Warning "    Font install failed: $($_.Exception.Message)"
            Write-Warning '    Install your Nerd Font manually from https://www.nerdfonts.com'
        }
    }

    # Refresh PATH so freshly-installed tools work in THIS session (not just next launch)
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')

    New-Item -ItemType File -Path $sentinel -Force | Out-Null
    Write-Host 'Profile setup complete. Restart the terminal if the prompt or icons look off.' -ForegroundColor Green
}

# Re-run the full dependency check on demand (ignores the once-per-machine sentinel).
function Repair-Profile { Invoke-ProfileBootstrap -Force }

# Auto-run once per machine, interactive sessions only (skip scripts / `pwsh -Command`).
if (-not [Console]::IsOutputRedirected) { Invoke-ProfileBootstrap }

# ---------------------------------------------------------------------------
# Environment init (each guarded so a missing tool degrades gracefully)
# ---------------------------------------------------------------------------

# fnm (Node.js version manager). `--shell powershell` works in both 5.1 and pwsh 7.
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
}

# PSReadLine: menu completion + predictive IntelliSense (interactive consoles only).
#  - Skip when output is redirected (e.g. `pwsh -Command ...`) - prediction throws there.
#  - Prediction needs PSReadLine 2.2.0+ (pwsh 7 bundles a recent build; 5.1 ships 2.0.0).
if (-not [Console]::IsOutputRedirected) {
    Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete
    $psrlVersion = (Get-Module PSReadLine).Version
    if (-not $psrlVersion) { $psrlVersion = (Get-Module PSReadLine -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1).Version }
    if ($psrlVersion -ge [version]'2.2.0') {
        Set-PSReadLineOption -PredictionSource History
        Set-PSReadLineOption -Colors @{ InlinePrediction = '#717171' }
    }
}

# File/folder icons in directory listings
if (Get-Module -ListAvailable Terminal-Icons) {
    Import-Module Terminal-Icons
}

# zoxide - smarter cd (optional; uncomment if installed)
# if (Get-Command zoxide -ErrorAction SilentlyContinue) {
#     Invoke-Expression (& { (zoxide init powershell | Out-String) })
# }

# Set the terminal tab/window title for the current session
function Set-Title { $Host.UI.RawUI.WindowTitle = $args[0] }

# Starship prompt (must be LAST - it replaces the prompt function)
if (Get-Command starship -ErrorAction SilentlyContinue) {
    Invoke-Expression (&starship init powershell)
}
