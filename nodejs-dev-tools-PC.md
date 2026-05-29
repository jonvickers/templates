# Node.js Development Station Setup Guide (Windows)

Complete guide for setting up a Windows development environment for Node.js and Next.js development.

## Prerequisites

Before starting, ensure you have:

1. **Windows 10/11**
2. **Windows PowerShell 5.1** (built in) — use it for the initial setup; install **PowerShell 7** (below) and switch your terminals to it once it's set up. Several steps need an **elevated** ("Run as Administrator") session — they're marked.
3. **winget** (Windows Package Manager, included with Windows 10 1709+ and Windows 11)
   ```powershell
   winget --version
   ```

### Install PowerShell 7 (recommended)

Windows ships with **Windows PowerShell 5.1** — frozen, security fixes only. **PowerShell 7** (`pwsh`) is the actively-developed successor: faster, supports `&&`/`||` chaining and ternary/null-coalescing operators, handles quoted arguments to native programs (e.g. `git.exe`) far more reliably, and is the same shell on macOS/Linux.

**Option A — MSI, machine-wide (recommended for a dev workstation).** Installs `pwsh.exe` to `C:\Program Files\PowerShell\7\` and adds that to the system `PATH`. No MSIX sandboxing, and it plays nicely with tooling that hard-codes that path. Needs admin — one UAC prompt:

```powershell
$v = '7.6.1'   # check latest at https://github.com/PowerShell/PowerShell/releases
curl.exe -L -o "$env:TEMP\pwsh.msi" "https://github.com/PowerShell/PowerShell/releases/download/v$v/PowerShell-$v-win-x64.msi"
Start-Process msiexec.exe -ArgumentList '/i', "$env:TEMP\pwsh.msi", '/quiet', 'ADD_PATH=1', 'REGISTER_MANIFEST=1', 'USE_MU=1', 'ENABLE_MU=1' -Verb RunAs -Wait
```

> **`winget install Microsoft.PowerShell` does NOT give you this.** As of 7.6.x the `Microsoft.PowerShell` winget package ships only the **Microsoft Store / MSIX bundle** — installs per-user under `C:\Program Files\WindowsApps\…`, with `pwsh.exe` reached via an app-execution-alias stub (so `(Get-Command pwsh).Source` points at a 0-byte stub, not `C:\Program Files\PowerShell\7\`). No admin needed and it's officially supported, but it has MSIX-runtime quirks and a couple of tools choke on the alias stub — prefer the MSI on a dev box. (Also: `winget install Microsoft.PowerShell --scope machine` just errors with "no applicable installer", because there's no MSI in that manifest.) To move from the Store build to the MSI: `winget uninstall Microsoft.PowerShell`, then run the MSI commands above — and afterwards **restart Windows Terminal and VS Code** so they re-discover `pwsh`. (They cache the path of whichever pwsh existed when they first detected it; uninstalling the Store build leaves the old `…\WindowsApps\…\pwsh.exe` path dangling and you'll get `0x80070002 — the system cannot find the file specified` until they re-scan. If a restart doesn't fix it, pin the Windows Terminal PowerShell profile to an explicit `"commandline": "\"C:\\Program Files\\PowerShell\\7\\pwsh.exe\""`.)

**Option B — Microsoft Store / winget (no admin, accepts the MSIX quirks):**

```powershell
winget install Microsoft.PowerShell
```

Either way, the install is **side-by-side** with Windows PowerShell 5.1. **Open a fresh terminal afterward** so `pwsh` is on `PATH`. Don't try to remove 5.1 — it's a built-in Windows component, and a few legacy modules still need it (load them from `pwsh` with `Import-Module <name> -UseWindowsPowerShell` if you ever hit one).

**Make PowerShell 7 your default shell:**

- **Windows Terminal:** Ctrl+, → **Startup → Default profile → PowerShell** (the black `>_` icon — *not* the navy "Windows PowerShell", which is 5.1). If "PowerShell" isn't in the list yet, restart Windows Terminal — it auto-discovers `pwsh` on launch.
- **VS Code:** Settings → `terminal.integrated.defaultProfile.windows` → **PowerShell** (VS Code labels pwsh 7 "PowerShell" and 5.1 "Windows PowerShell").
- Things that explicitly launch `powershell.exe` — scheduled tasks, some installers, Claude Code's PowerShell tooling — keep using 5.1. That's fine; call `pwsh.exe` explicitly wherever you want 7.

**Nothing migrates automatically — PowerShell 7 keeps everything in its own locations:**

| Thing | Windows PowerShell 5.1 | PowerShell 7 | How to bring it over |
|-------|------------------------|--------------|----------------------|
| `$PROFILE` script | `…\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1` | `…\Documents\PowerShell\Microsoft.PowerShell_profile.ps1` | Copy the contents, or keep one canonical copy and dot-source it (shim below) |
| Modules (`Install-Module -Scope CurrentUser`) | `…\Documents\WindowsPowerShell\Modules` | `…\Documents\PowerShell\Modules` | **Re-run the `Install-Module` commands from inside `pwsh`** — don't copy module folders between the two |
| PSReadLine history | `%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt` | `%APPDATA%\Microsoft\PowerShell\PSReadLine\ConsoleHost_history.txt` (note: no `Windows\`) | Optional — copy the file across once |
| Execution policy | per-shell | per-shell (pwsh defaults to `RemoteSigned` on Windows, not `Restricted`) | Re-run the `Set-ExecutionPolicy` step below from `pwsh` |

> If your Documents folder is OneDrive-redirected, *both* shells' profile and module paths live under `…\OneDrive\Documents\…`. `[Environment]::GetFolderPath('MyDocuments')` resolves the correct base for either shell — never hard-code the path.

**Keep one profile (recommended).** Put the real profile in the pwsh location and make the 5.1 profile a thin shim that loads it:

```powershell
# In pwsh — create the PowerShell 7 profile file if it doesn't exist yet:
if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force | Out-Null }

# In the Windows PowerShell 5.1 profile (run `notepad $PROFILE` from powershell.exe), put ONLY:
$pwsh7Profile = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'PowerShell\Microsoft.PowerShell_profile.ps1'
if (Test-Path $pwsh7Profile) { . $pwsh7Profile }
```

> **Migrating a machine that already has a 5.1 profile?** Back it up first (`Copy-Item $PROFILE "$PROFILE.bak-pre-pwsh7"` from `powershell.exe`), move its contents into the pwsh 7 profile, *then* overwrite the 5.1 one with the shim above.

Then everything in **section 11** (fnm, Starship, PSReadLine, Terminal-Icons) goes in the **pwsh** profile, and you maintain it in one place. The `fnm env --shell powershell` line and the Starship/zoxide init lines run unchanged in both 5.1 and 7. One behavior change to know: **pwsh 7 on Windows drops the `curl` and `wget` aliases** that 5.1 has — `curl` runs the real `curl.exe` (which this guide installs), which is what you want for dev work, but fix any profile script that assumed `curl` meant `Invoke-WebRequest`.

> **Claude Code note:** Claude Code's built-in PowerShell tooling may still invoke `powershell.exe` (5.1) even with `pwsh` installed, and 5.1 mangles quoted/multi-line arguments handed to native programs — so a multi-line `git commit -m` can still fail there. Use `git commit -F <file>` as the workaround.

### Set PowerShell Execution Policy

Developer workstations should allow script execution. Run PowerShell **as Administrator**:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope CurrentUser
```

> If you installed PowerShell 7, run this from `pwsh` as well — execution policy is **per-shell**. (pwsh 7 on Windows already defaults to `RemoteSigned`, which is enough to run your own profile; `Unrestricted` just matches the 5.1 setting above.)

### Windows Defender Exclusions

Real-time antivirus scanning significantly slows npm installs, builds, and dev servers. Exclude your coding directory and Node.js tooling. Run PowerShell **as Administrator**:

```powershell
# Exclude your main coding directory (adjust path to match yours)
Add-MpPreference -ExclusionPath "C:\Users\<YourUser>\Code"

# Exclude fnm's Node.js installations
Add-MpPreference -ExclusionPath "$env:APPDATA\fnm"

# Exclude the Claude Code install dir — the native build embeds CLI tools (including ripgrep,
# a known Defender false-positive) and extracts them at runtime; quarantining one silently
# breaks features like file search.  (Installed Claude Code via npm instead? Exclude
# "$env:APPDATA\npm\node_modules\@anthropic-ai" as well.)
Add-MpPreference -ExclusionPath "$env:USERPROFILE\.local"
```

> **Why?** `node_modules` folders contain thousands of small files — Defender scanning each one on every read adds substantial overhead to installs and builds. And large bundled binaries (ripgrep especially) periodically trip false positives, so excluding the dirs that hold them avoids mysterious "tool not available" breakage.

**Verify:**
```powershell
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
```

### Enable Long Paths

Windows has a 260-character path limit by default. Deep `node_modules` nesting can exceed this. Run PowerShell **as Administrator**:

```powershell
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1
```

Also configure Git to handle long paths:
```powershell
git config --global core.longpaths true
```

## Recommended Installation Order

Follow this sequence to avoid dependency issues.

> **Two friction tips before you start:**
>
> 1. **Use silent flags for winget.** Add `--silent --accept-source-agreements --accept-package-agreements` to every `winget install` to skip first-run prompts and license-agreement hangs. The single-tool examples below omit them for readability, but the **Quick Batch Install** section uses them throughout.
> 2. **PATH only updates in *new* terminal sessions.** After a winget install, `Get-Command rg` or `rg --version` will report "not found" in the same shell — even though the tool installed correctly. Either open a new terminal, or refresh PATH in the current session:
>    ```powershell
>    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
>    ```

### 1. Windows Terminal

Modern terminal with tabs, panes, and GPU-accelerated text rendering. Ships with Windows 11; install on Windows 10:

```powershell
winget install Microsoft.WindowsTerminal
```

Use Windows Terminal for all remaining steps.

### 2. Git

```powershell
winget install Git.Git
```

**Restart your terminal** after installing to pick up PATH changes.

**Configure:**
```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global core.autocrlf true
git config --global core.longpaths true
git config --global credential.helper manager
```

> **Why `core.autocrlf true`?** Windows uses `CRLF` line endings, but Git repos should store `LF`. This setting auto-converts on checkout/commit so cross-platform teams don't get line-ending diffs.

> **Git Credential Manager** ships with Git for Windows and securely stores credentials for GitHub, Azure DevOps, etc. Setting `credential.helper manager` enables it.

**Verify:**
```powershell
git --version
```

### 3. VS Code

The standard editor for Node.js and Next.js development:

```powershell
winget install Microsoft.VisualStudioCode
```

**Recommended extensions** (install from VS Code or CLI):
```powershell
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension Prisma.prisma
code --install-extension eamodio.gitlens
code --install-extension ms-azuretools.vscode-docker
code --install-extension humao.rest-client
```

### 4. Node.js Version Manager (fnm)

We use **fnm** (Fast Node Manager) -- a cross-platform, Rust-based version manager that is fast, simple, and works with `.nvmrc` and `.node-version` files:

```powershell
winget install Schniz.fnm
```

**Configure your PowerShell profile** so fnm activates in every terminal session. Add this line to your profile:

```powershell
# Open your PowerShell profile for editing:
notepad $PROFILE

# Add this line and save:
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
```

> **Tip:** If `$PROFILE` doesn't exist yet, create it first:
> ```powershell
> New-Item -Path $PROFILE -ItemType File -Force
> ```
>
> See **section 11** for the full recommended PowerShell profile (includes Starship, PSReadLine, Terminal-Icons, and more).

> **OneDrive note:** If your Documents folder is OneDrive-synced, `$PROFILE` will resolve to something like `C:\Users\<you>\OneDrive\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`. This is fine — your profile will sync across machines automatically. Just keep using `$PROFILE`; never hard-code the path.

**Restart your terminal**, then verify:
```powershell
fnm --version
```

### 5. Node.js

```powershell
# Install latest LTS version
fnm install --lts

# Use it (fnm auto-switches if --use-on-cd is configured)
fnm use lts-latest

# Set as your default
fnm default lts-latest

# Verify
node --version
npm --version
npx --version
```

### 6. Package Managers

**pnpm** is the recommended package manager for Next.js projects (fast, disk-efficient, strict). Install it alongside yarn for compatibility with other projects:

```powershell
npm install -g pnpm yarn
```

> **Note:** pnpm can also be installed standalone via `winget install pnpm.pnpm` if you prefer not to use npm for it.

> **corepack** is bundled with Node.js and can manage pnpm/yarn versions per-project via `packageManager` in `package.json`. Enable it with:
> ```powershell
> corepack enable
> ```
> Projects using corepack will automatically use the correct package manager version without global installs.

**Verify:**
```powershell
pnpm --version
yarn --version
```

### 7. Code Quality & TypeScript

```powershell
npm install -g prettier eslint typescript
```

**Verify:**
```powershell
prettier --version
eslint --version
tsc --version
```

### 8. GitHub CLI

```powershell
winget install GitHub.cli
```

**Authenticate:**
```powershell
gh auth login
```

**Verify:**
```powershell
gh --version
gh auth status
```

### 9. SSH Keys (optional)

> **Skip this if** you're happy using HTTPS with Git Credential Manager (configured in step 2). SSH is an alternative authentication method -- useful if you work with multiple Git hosts, need deploy keys, or prefer key-based auth.

Set up SSH for GitHub, Azure DevOps, and remote server access.

**Enable the SSH agent** (run PowerShell **as Administrator**):
```powershell
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent
```

**Generate a key and add it:**
```powershell
ssh-keygen -t ed25519 -C "you@example.com"
ssh-add $env:USERPROFILE\.ssh\id_ed25519
```

**Add your public key to GitHub:**
```powershell
# Copy public key to clipboard
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | Set-Clipboard

# Or use GitHub CLI to add it directly
gh ssh-key add $env:USERPROFILE\.ssh\id_ed25519.pub --title "Windows Dev Machine"
```

**Verify:**
```powershell
ssh -T git@github.com
```

### 10. CLI Utilities

```powershell
winget install BurntSushi.ripgrep.MSVC
winget install jqlang.jq
winget install sharkdp.fd
winget install sharkdp.bat
winget install dandavison.delta
winget install gnuwin32.tree
winget install junegunn.fzf
winget install eza-community.eza
winget install tldr-pages.tlrc
# winget install ajeetdsouza.zoxide  # Optional -- smarter cd that learns your habits
```

| Tool | What it does |
|------|-------------|
| **ripgrep** (`rg`) | Blazing-fast code search (replaces grep) |
| **jq** | JSON processor for the command line |
| **fd** | Fast, user-friendly file finder (replaces find) |
| **bat** | `cat` replacement with syntax highlighting and line numbers |
| **delta** | Syntax-highlighting pager for git diffs and blame |
| **tree** | Directory structure visualization |
| **fzf** | Fuzzy finder for files, command history, and more |
| **eza** | Modern `ls` replacement with colors, icons, and git status |
| **tlrc** (`tldr`) | Fast tldr client -- simplified, example-based command help |
| **zoxide** (`z`) (optional) | Smarter `cd` that learns your most-used directories |

> **Note — ripgrep powers Claude Code's file search.** Claude Code tries its own bundled ripgrep first, then falls back to `rg` on `PATH`; if neither works it prints `Ripgrep is not available` and uses a slower built-in scanner. To make this stick for good:
> - **Keep `rg` on `PATH` in a *stable* spot.** WinGet installs `rg.exe` into a *versioned* folder (`…\WinGet\Packages\…ripgrep-<version>-…`) that moves on every update. Drop a copy somewhere that's always on `PATH` and doesn't move — e.g. `%USERPROFILE%\.local\bin`, where `claude.exe` already lives: `Copy-Item (Get-Command rg).Source "$env:USERPROFILE\.local\bin\rg.exe"`.
> - **Exclude the Claude Code install dir from Defender** (see the Defender Exclusions section above) — Defender occasionally quarantines `rg.exe` as a false positive, including the copy Claude bundles.
> - **Still warning in some session?** That session's `claude` process was launched with a stale or stripped `PATH` (a terminal opened before `rg` was on `PATH`, or something that starts `claude` with a minimal environment) — a process keeps the `PATH` it started with. Quit it, open a **fresh Windows Terminal**, and start `claude` there; run `/doctor` inside Claude Code to see what it found, or `claude update` to refresh the bundled tools. WSL/Git-Bash shells don't inherit the Windows user `PATH`, so install ripgrep inside that environment too if you run Claude Code from one.

> **Tip:** To make delta your default git diff pager, add to your git config:
> ```powershell
> git config --global core.pager delta
> git config --global interactive.diffFilter "delta --color-only"
> git config --global delta.navigate true
> git config --global merge.conflictStyle zdiff3
> ```

**Verify:**
```powershell
rg --version
jq --version
fd --version
bat --version
delta --version
tree --version
fzf --version
eza --version
tldr --version
# zoxide --version  # If installed
```

### 11. Shell Experience (Starship & PowerShell Enhancements)

A modern shell prompt and quality-of-life PowerShell modules make the terminal significantly more productive.

**Install a Nerd Font** for icon support in Starship and eza. Recommended: **CaskaydiaCove Nerd Font**.

1. Download `CascadiaCode.zip` from [nerdfonts.com](https://www.nerdfonts.com/font-downloads) and extract to `%USERPROFILE%\Downloads\CascadiaCode`.
2. The archive contains 36 TTFs across three variants — pick what to install:

   | Variant | Suffix | Use for |
   |---------|--------|---------|
   | **Nerd Font Mono** | `NFM` | **Terminals** — strict monospace, glyphs forced to one cell width |
   | Nerd Font | `NF` | Editors and docs — some glyphs are double-width |
   | Nerd Font Propo | `NFP` | Proportional — not for terminals |

3. **Install all 36 TTFs per-user** (no admin required, available to every app). Run in PowerShell:

   ```powershell
   $src = "$env:USERPROFILE\Downloads\CascadiaCode"   # adjust if extracted elsewhere
   $dst = "$env:LOCALAPPDATA\Microsoft\Windows\Fonts"
   $regKey = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts'
   New-Item -ItemType Directory -Force -Path $dst | Out-Null
   if (-not (Test-Path $regKey)) { New-Item -Path $regKey -Force | Out-Null }
   $shell = New-Object -ComObject Shell.Application
   foreach ($f in Get-ChildItem -Path $src -Filter *.ttf) {
       $target = Join-Path $dst $f.Name
       if (Test-Path $target) { continue }
       Copy-Item $f.FullName $target -Force
       $folder = $shell.Namespace($f.DirectoryName)
       $item = $folder.ParseName($f.Name)
       $fontName = $folder.GetDetailsOf($item, 21)
       if ([string]::IsNullOrWhiteSpace($fontName)) { $fontName = [IO.Path]::GetFileNameWithoutExtension($f.Name) }
       Set-ItemProperty -Path $regKey -Name "$fontName (TrueType)" -Value $target -Type String
   }
   ```

   > **Manual alternative:** select all `.ttf` files in File Explorer → right-click → **Install for all users** (requires admin). Same result.

4. **Set it in Windows Terminal:** Ctrl+, → **Profiles → Defaults → Appearance → Font face** → `CaskaydiaCove NFM`. Close and reopen Windows Terminal so the new fonts appear in the dropdown.

> **Why per-user install?** Avoids the admin elevation prompt and keeps fonts scoped to your user profile. They work in every app you launch, including Windows Terminal, VS Code, and browsers.

**Install Starship and PowerShell modules:**

> **Run the `Install-Module` lines from inside whichever PowerShell you'll actually use.** `Install-Module` installs into the *running* shell's user module path, and Windows PowerShell 5.1 and PowerShell 7 have separate ones (see [Install PowerShell 7](#install-powershell-7-recommended) above). If `pwsh` is your shell, run them in `pwsh`. pwsh 7 already bundles a modern PSReadLine — so `Install-Module PSReadLine` there is optional, and if it errors with *"version X currently in use, retry after closing applications"* just skip it; Terminal-Icons is the one that actually needs installing.

```powershell
winget install Starship.Starship

# PSReadLine (update to latest for predictive IntelliSense; already current in pwsh 7)
Install-Module PSReadLine -Force -Scope CurrentUser

# Terminal-Icons (file/folder icons in directory listings)
Install-Module Terminal-Icons -Repository PSGallery -Force -Scope CurrentUser
```

> **Why `-Scope CurrentUser`?** Without it, `Install-Module` defaults to the all-users scope and either prompts or fails when not running as Administrator. Per-user is the right scope for dev tools and avoids the elevation round-trip.

**Configure your PowerShell profile** (`notepad $PROFILE`):

> **PowerShell 7?** `$PROFILE` points at a *different* file in `pwsh` (`…\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`) than in Windows PowerShell 5.1 (`…\WindowsPowerShell\…`). Put the config below in the **pwsh** profile and make the 5.1 profile a one-line shim that dot-sources it — recipe in [Install PowerShell 7](#install-powershell-7-recommended) above.

```powershell
# Initialize fnm (Node.js version manager)
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
}

# File/folder icons in directory listings
if (Get-Module -ListAvailable Terminal-Icons) { Import-Module Terminal-Icons }

# PSReadLine: menu completion + predictive IntelliSense (interactive consoles only).
# This file is the canonical profile and gets dot-sourced by the 5.1 profile, so guard the calls:
#  - Skip entirely when output is redirected (e.g. `pwsh -Command ...` with captured output) —
#    enabling prediction throws there ("console output doesn't support virtual terminal processing").
#  - Prediction needs PSReadLine 2.2.0+ (pwsh 7 bundles a recent build; 5.1 ships 2.0.0 —
#    run `Install-Module PSReadLine -Force` to update it). Check the loaded module, then fall
#    back to -ListAvailable.
if (-not [Console]::IsOutputRedirected) {
    Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete
    $psrlVersion = (Get-Module PSReadLine).Version
    if (-not $psrlVersion) { $psrlVersion = (Get-Module PSReadLine -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1).Version }
    if ($psrlVersion -ge [version]'2.2.0') {
        Set-PSReadLineOption -PredictionSource History
        Set-PSReadLineOption -Colors @{ InlinePrediction = '#717171' }
    }
}

# Initialize zoxide (if installed -- optional)
# if (Get-Command zoxide -ErrorAction SilentlyContinue) { Invoke-Expression (& { (zoxide init powershell | Out-String) }) }

# Initialize Starship prompt (must be last)
if (Get-Command starship -ErrorAction SilentlyContinue) { Invoke-Expression (&starship init powershell) }
```

> **Why last?** Starship replaces the prompt function, so it must be initialized after other tools that modify the prompt.

> **Why the `if (Get-Command …)` guards?** This profile roams via OneDrive (see the OneDrive note in step 4), but the tools it calls — fnm, Terminal-Icons, Starship — install **per-machine** and don't. On a fresh or newly-roamed machine the synced profile would otherwise load before those tools exist and **throw at startup** (the classic `Import-Module : Terminal-Icons … no valid module file was found`). Guarding each call makes a missing tool a no-op instead of an error. For a profile that goes one step further and **auto-installs** the missing pieces on first launch, see [Roaming & self-healing across machines](#16-roaming--self-healing-across-machines-optional).

**Customize Starship** (optional): Create `~/.config/starship.toml` to configure which modules appear in your prompt. Starship auto-detects Node.js, Git, Python, Docker, and many more. See [starship.rs/config](https://starship.rs/config/) for all options.

**Verify:**
```powershell
starship --version
```

### 12. Docker Desktop (optional)

> **Skip this if** you don't need containerized development, databases in containers, or Docker-based deployment workflows. Many Node.js/Next.js projects run fine without Docker. Install it when a project requires it.

```powershell
winget install Docker.DockerDesktop
```

**Setup:**
- Launch Docker Desktop from the Start Menu
- Enable **WSL 2 backend** if prompted (recommended)
- Wait for Docker to finish starting (system tray icon turns solid)
- Docker will not work until you manually launch the app

**Verify:**
```powershell
docker --version
docker ps  # Fails if Docker Desktop isn't running
```

> **WSL 2 note:** Docker Desktop requires WSL 2. If prompted, install it:
> ```powershell
> wsl --install
> ```
> This requires a restart.

### 13. Python & Build Tools (for native modules)

Some npm packages with native C/C++ addons (via `node-gyp`) require Python and C++ build tools. Install both to avoid build failures with packages like `bcrypt`, `sharp`, `sqlite3`, etc.:

```powershell
winget install Python.Python.3.12
winget install Microsoft.VisualStudio.2022.BuildTools
```

After installing Build Tools, configure node-gyp to use them via the `GYP_MSVS_VERSION` environment variable (persisted at the user level so it applies in every shell):
```powershell
[Environment]::SetEnvironmentVariable('GYP_MSVS_VERSION','2022','User')
```

> **Note:** Earlier versions of this guide recommended `msvs_version=2022` in `~/.npmrc`, but npm 11.2+ now warns that custom keys in `.npmrc` are unsupported ([npm/cli#8153](https://github.com/npm/cli/issues/8153)) and will stop working in a future major. `GYP_MSVS_VERSION` is node-gyp's own variable and is unaffected.

**Verify:**
```powershell
python --version
```

### 14. Cloud CLIs

**Azure CLI:**
```powershell
winget install Microsoft.AzureCLI
```

**Setup:**
```powershell
az login
az account show
```

**Google Cloud SDK:**
```powershell
winget install Google.CloudSDK
```

**Setup:**
```powershell
gcloud init
gcloud auth list
gcloud components update
```

**Verify both:**
```powershell
az --version
gcloud --version
```

### 15. AI-Assisted Development CLIs

Terminal-based AI coding assistants that run directly in your project directory:

```powershell
npm install -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli
```

| Tool | Command | Auth |
|------|---------|------|
| **Claude Code** | `claude` | Anthropic API key or Claude subscription |
| **Codex CLI** | `codex` | OpenAI API key |
| **Gemini CLI** | `gemini` | Google AI API key or `gcloud auth login` |

**Verify:**
```powershell
claude --version
codex --version
gemini --version
```

> **Note:** Claude Code uses ripgrep (`rg`, installed in step 10) for file search. If you ever see `Ripgrep is not available`, Claude couldn't use its bundled `rg` *and* didn't find one on the `PATH` that the `claude` process started with — make sure `BurntSushi.ripgrep.MSVC` is installed with a copy on a stable `PATH` dir, relaunch `claude` from a fresh terminal, and run `/doctor` to confirm. See **step 10** for the durable fix.

### 16. Roaming & Self-Healing Across Machines (optional)

If you run more than one Windows workstation, OneDrive can keep them identical — with two gotchas worth engineering around. Ready-to-use example files live in **[`windows-powershell/`](windows-powershell/)** (and its [README](windows-powershell/README.md)).

**What roams on its own, and what doesn't:**

| Layer | Roams? | Why |
|-------|--------|-----|
| PowerShell `$PROFILE` | ✅ | Under OneDrive-redirected `…\Documents\PowerShell\` (see step 4) |
| PowerShell modules (`-Scope CurrentUser`) | ✅ | Same OneDrive-redirected Documents path |
| The **tools** the profile calls (fnm, Starship, Nerd Font) | ❌ | winget/font installs are per-machine |
| Windows Terminal `settings.json` | ❌ | Lives in `%LOCALAPPDATA%`, which never roams |

#### Self-healing profile

Because the profile roams but its tools don't, a fresh machine loads the synced profile before the tools exist and errors at startup. Two fixes, both shown in **[`windows-powershell/Microsoft.PowerShell_profile.ps1`](windows-powershell/Microsoft.PowerShell_profile.ps1)**:

- **Guard every external-tool call** (`if (Get-Command … )` / `Get-Module -ListAvailable`) so a missing tool is skipped, not fatal. (The step 11 profile above already does this.)
- **`Invoke-ProfileBootstrap`** — auto-installs anything missing (Terminal-Icons, Starship, fnm, Nerd Font). It runs **once per machine** (sentinel in `%LOCALAPPDATA%`, so it doesn't re-run on every shell and doesn't roam), **interactive sessions only**, and can be re-triggered anytime with **`Repair-Profile`**. The first launch on a new machine installs the missing pieces (may take a minute), then it's instant.

#### Roaming Windows Terminal settings

`settings.json` won't sync on its own. Point it at a single shared copy in OneDrive with a symlink, using **[`windows-powershell/Link-WindowsTerminalSettings.ps1`](windows-powershell/Link-WindowsTerminalSettings.ps1)**:

```powershell
# FIRST machine — seed the shared copy from this machine, then link (run elevated):
.\Link-WindowsTerminalSettings.ps1 -Seed

# EVERY OTHER machine — link to the already-synced copy (run elevated):
.\Link-WindowsTerminalSettings.ps1
```

The symlink is a local filesystem object, so it can't itself roam — run the script **once per machine**, from an **elevated** shell (creating a symlink needs admin or Developer Mode). A clean starting `settings.json` (PowerShell 7 as default, Nerd Font) is in **[`windows-powershell/windows-terminal-settings.example.json`](windows-powershell/windows-terminal-settings.example.json)**.

> **Don't hard-code OneDrive paths.** Use `[Environment]::GetFolderPath('MyDocuments')` (resolves the redirected Documents base for both shells) and `$env:OneDrive` — these adapt whether or not Known Folder redirection is on.

## Complete Tool Reference

### Core Node.js
| Tool | Install Command | Notes |
|------|-----------------|-------|
| node | `fnm install --lts` | Use fnm for version management |
| npm | Included with Node.js | - |
| npx | Included with npm | - |
| fnm | `winget install Schniz.fnm` | Configure PowerShell profile after install |

### Package Managers
| Tool | Install Command | Notes |
|------|-----------------|-------|
| pnpm | `npm install -g pnpm` | Recommended for Next.js projects |
| yarn | `npm install -g yarn` | Widely used in existing projects |

### Version Control & GitHub
| Tool | Install Command | Post-Install |
|------|-----------------|--------------|
| git | `winget install Git.Git` | `git config --global user.name "Your Name"` |
| gh (GitHub CLI) | `winget install GitHub.cli` | `gh auth login` |

### Editor & Terminal
| Tool | Install Command |
|------|-----------------|
| VS Code | `winget install Microsoft.VisualStudioCode` |
| Windows Terminal | `winget install Microsoft.WindowsTerminal` |
| PowerShell 7 (`pwsh`) | `winget install Microsoft.PowerShell` |

### Code Quality & TypeScript
| Tool | Install Command |
|------|-----------------|
| prettier | `npm install -g prettier` |
| eslint | `npm install -g eslint` |
| typescript (tsc) | `npm install -g typescript` |

### Containers & Cloud
| Tool | Install Command | Post-Install |
|------|-----------------|--------------|
| docker (optional) | `winget install Docker.DockerDesktop` | Launch Docker Desktop, enable WSL 2 |
| az (Azure CLI) | `winget install Microsoft.AzureCLI` | `az login` |
| gcloud | `winget install Google.CloudSDK` | `gcloud init` |

### CLI Utilities
| Tool | Description | Install Command |
|------|-------------|-----------------|
| ripgrep (`rg`) | Fast code search | `winget install BurntSushi.ripgrep.MSVC` |
| jq | JSON processor | `winget install jqlang.jq` |
| fd | Fast file finder | `winget install sharkdp.fd` |
| bat | Syntax-highlighting cat | `winget install sharkdp.bat` |
| delta | Better git diffs | `winget install dandavison.delta` |
| tree | Directory structure | `winget install gnuwin32.tree` |
| fzf | Fuzzy finder | `winget install junegunn.fzf` |
| eza | Modern ls replacement | `winget install eza-community.eza` |
| tlrc (`tldr`) | Simplified command help | `winget install tldr-pages.tlrc` |
| curl | HTTP client | Included with Windows 10/11 |

### Shell Experience
| Tool | Install Command | Notes |
|------|-----------------|-------|
| Starship | `winget install Starship.Starship` | Cross-shell prompt; needs Nerd Font |
| PSReadLine | `Install-Module PSReadLine -Force` | Predictive IntelliSense |
| Terminal-Icons | `Install-Module Terminal-Icons -Repository PSGallery -Force` | File icons in listings |

## Quick Batch Install

Run PowerShell **as Administrator** to install everything at once:

```powershell
# ── Windows-specific setup (run as Administrator) ──
Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope CurrentUser
Add-MpPreference -ExclusionPath "$env:USERPROFILE\Code"
Add-MpPreference -ExclusionPath "$env:APPDATA\fnm"
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent

# ── PowerShell 7 (MSI, machine-wide -> C:\Program Files\PowerShell\7\) ──
# Note: `winget install Microsoft.PowerShell` only ships the Store/MSIX bundle (pwsh behind an
# alias stub, MSIX sandboxing). This MSI is the dev-workstation build. We're already elevated.
$pwshVer = '7.6.1'   # check https://github.com/PowerShell/PowerShell/releases
curl.exe -L -o "$env:TEMP\pwsh.msi" "https://github.com/PowerShell/PowerShell/releases/download/v$pwshVer/PowerShell-$pwshVer-win-x64.msi"
Start-Process msiexec.exe -ArgumentList '/i', "$env:TEMP\pwsh.msi", '/quiet', '/norestart', 'ADD_PATH=1', 'REGISTER_MANIFEST=1', 'USE_MU=1', 'ENABLE_MU=1' -Wait
Remove-Item "$env:TEMP\pwsh.msi" -ErrorAction SilentlyContinue

# ── winget packages (silent + auto-accept agreements) ──
$wingetArgs = '--silent --accept-source-agreements --accept-package-agreements'
$packages = @(
    'Microsoft.WindowsTerminal','Git.Git','Microsoft.VisualStudioCode','Schniz.fnm','GitHub.cli',
    # 'Docker.DockerDesktop',          # Optional -- uncomment if needed
    'Python.Python.3.12','Microsoft.VisualStudio.2022.BuildTools',
    'Microsoft.AzureCLI','Google.CloudSDK',
    'BurntSushi.ripgrep.MSVC','jqlang.jq','sharkdp.fd','sharkdp.bat','dandavison.delta',
    'gnuwin32.tree','junegunn.fzf','eza-community.eza','tldr-pages.tlrc','Starship.Starship'
    # 'ajeetdsouza.zoxide'             # Optional -- smarter cd
)
foreach ($p in $packages) { winget install --id $p $wingetArgs.Split(' ') }

# Refresh PATH in the current session so the rest of this script can find new tools
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')

# ── Git configuration ──
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global core.autocrlf true
git config --global core.longpaths true
git config --global credential.helper manager

# ── PowerShell modules into pwsh 7's user module path ──
# Modules install into the *running* shell's module path, and 5.1 and pwsh 7 keep separate
# ones. This script runs in 5.1, so install into pwsh 7 via `pwsh -File` (passing -Command
# from 5.1 mangles args like `-Scope CurrentUser`). Terminal-Icons is required; pwsh 7
# already bundles a modern PSReadLine so its (re)install is best-effort.
$pwsh7 = "$env:ProgramFiles\PowerShell\7\pwsh.exe"
$modScript = "$env:TEMP\pwsh7-modules.ps1"
@(
  'Install-Module Terminal-Icons -Repository PSGallery -Force -Scope CurrentUser'
  'try { Install-Module PSReadLine -Force -Scope CurrentUser -SkipPublisherCheck -AllowClobber } catch {}'
) | Set-Content -Encoding utf8 $modScript
& $pwsh7 -NoProfile -File $modScript
Remove-Item $modScript -ErrorAction SilentlyContinue
# If you keep using PowerShell 5.1 too, also update its old PSReadLine:
#   powershell.exe -Command "Install-Module PSReadLine -Force -Scope CurrentUser -SkipPublisherCheck"

# ── PowerShell profile + each shell's default profile (manual, one-time) ──
# - Put the section-11 profile in pwsh 7's $PROFILE; make 5.1's $PROFILE a one-line shim that
#   dot-sources it (recipe in the "Install PowerShell 7" section).
# - Make pwsh 7 the default profile in Windows Terminal (Ctrl+, -> Startup -> Default profile)
#   and in VS Code (set terminal.integrated.defaultProfile.windows to "PowerShell").

# ── Install Node.js via fnm ──
fnm install --lts
fnm default lts-latest

# ── Global npm packages ──
corepack enable
npm install -g pnpm yarn prettier eslint typescript @anthropic-ai/claude-code @openai/codex @google/gemini-cli
[Environment]::SetEnvironmentVariable('GYP_MSVS_VERSION','2022','User')

# ── SSH key (interactive) ──
# ssh-keygen -t ed25519 -C "you@example.com"
# ssh-add $env:USERPROFILE\.ssh\id_ed25519
# gh ssh-key add $env:USERPROFILE\.ssh\id_ed25519.pub --title "Windows Dev Machine"
```

## Verified Versions (as of February 2026)

These versions are known to work well together:

| Tool | Version | Notes |
|------|---------|-------|
| PowerShell 7 (`pwsh`) | 7.6.x | MSI (machine-wide) recommended; side-by-side with built-in Windows PowerShell 5.1 |
| Git | 2.53.0 | - |
| Node.js | 24.13.0 | Latest LTS (Krypton) |
| npm | 11.7.0 | Included with Node.js 24 |
| fnm | 1.38.1 | - |
| pnpm | 10.29.1 | - |
| Yarn | 1.22.22 | Classic; Yarn 4.x available via `corepack` |
| Prettier | 3.8.1 | - |
| ESLint | 10.0.0 | Flat config is the default |
| TypeScript | 5.9.3 | - |
| GitHub CLI | 2.86.0 | - |
| Azure CLI | 2.83.0 | - |
| Google Cloud SDK | 555.0.0+ | Requires Python on PATH |
| Docker | 29.x | Optional; install when a project requires it |
| Python | 3.12.10 | Required for node-gyp and gcloud |
| VS Code | 1.109.0 | - |
| ripgrep | 15.1.0 | - |
| jq | 1.8.1 | - |
| fd | 10.3.0 | - |
| bat | 0.25.0 | - |
| delta | 0.18.2 | - |
| fzf | 0.60.x | - |
| eza | 0.21.x | Requires Nerd Font for icons |
| tlrc | 1.9.x | - |
| Starship | 1.23.x | Requires Nerd Font |
| zoxide | 0.9.x | Optional |
| Claude Code | 2.1.37 | Anthropic AI coding assistant |
| Codex CLI | 0.89.0 | OpenAI coding assistant |
| Gemini CLI | 0.25.2 | Google AI coding assistant |

## Optional but Recommended

### API Testing

For testing REST APIs and GraphQL endpoints during development:

- **VS Code REST Client** (already in recommended extensions above) -- lightweight, lives in your editor
- **Postman**: `winget install Postman.Postman` -- full-featured GUI for teams
- **Bruno**: `winget install Bruno.Bruno` -- open-source, Git-friendly alternative to Postman

### Database GUI

If working with databases (Postgres, MySQL, MongoDB, etc.):

- **DBeaver**: `winget install dbeaver.dbeaver` -- universal database client, works with all major databases
- **Prisma Studio**: `npx prisma studio` -- built into Prisma, no extra install needed

## Per-Project Tools (Install Locally)

These should typically be installed as dev dependencies in each project:

```powershell
npm install --save-dev <tool>
# or with pnpm:
pnpm add -D <tool>
```

**Common per-project tools:**
- `typescript` / `tsx` - TypeScript compiler and fast execution
- `vitest` or `jest` - Testing frameworks
- `nodemon` - Auto-restart on file changes during development
- `concurrently` - Run multiple commands in parallel
- `cross-env` - Cross-platform environment variables (important on Windows)
- `dotenv` - Load environment variables from `.env` files
- `husky` - Git hooks (pre-commit linting, etc.)
- `lint-staged` - Run linters only on staged files (pairs with husky)
- `prisma` - Database ORM (common in Next.js projects)
- `tailwindcss` - Utility-first CSS framework

## Verification Script

Save this as `verify-setup.ps1` and run to check all installations:

```powershell
Write-Host "Checking development environment..." -ForegroundColor Cyan
Write-Host ""

# Refresh PATH from the registry so tools installed earlier in this session are visible
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')

# Activate fnm so Node and npm-global packages (under fnm's per-version dir) are on PATH.
# Without this, node/npm/pnpm/yarn/prettier/eslint/tsc and any `npm install -g`-installed
# CLIs will falsely report "NOT INSTALLED" when this script runs without the user's profile.
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
    fnm use default 2>&1 | Out-Null
}

$commands = @(
    @{cmd="pwsh"; args="--version"; name="PowerShell 7"},
    @{cmd="git"; args="--version"; name="Git"},
    @{cmd="node"; args="--version"; name="Node.js"},
    @{cmd="npm"; args="--version"; name="npm"},
    @{cmd="npx"; args="--version"; name="npx"},
    @{cmd="fnm"; args="--version"; name="fnm"},
    @{cmd="pnpm"; args="--version"; name="pnpm"},
    @{cmd="yarn"; args="--version"; name="Yarn"},
    @{cmd="prettier"; args="--version"; name="Prettier"},
    @{cmd="eslint"; args="--version"; name="ESLint"},
    @{cmd="tsc"; args="--version"; name="TypeScript"},
    @{cmd="gh"; args="--version"; name="GitHub CLI"},
    @{cmd="python"; args="--version"; name="Python"},
    @{cmd="bat"; args="--version"; name="bat"},
    @{cmd="delta"; args="--version"; name="delta"},
    @{cmd="claude"; args="--version"; name="Claude Code"},
    @{cmd="codex"; args="--version"; name="Codex CLI"},
    @{cmd="gemini"; args="--version"; name="Gemini CLI"},
    @{cmd="docker"; args="--version"; name="Docker"},
    @{cmd="az"; args="--version"; name="Azure CLI"},
    @{cmd="gcloud"; args="--version"; name="Google Cloud SDK"},
    @{cmd="rg"; args="--version"; name="ripgrep"},
    @{cmd="jq"; args="--version"; name="jq"},
    @{cmd="fd"; args="--version"; name="fd"},
    @{cmd="tree"; args="--version"; name="tree"},
    @{cmd="fzf"; args="--version"; name="fzf"},
    @{cmd="eza"; args="--version"; name="eza"},
    @{cmd="tldr"; args="--version"; name="tlrc"},
    @{cmd="starship"; args="--version"; name="Starship"},
    @{cmd="zoxide"; args="--version"; name="zoxide"},
    @{cmd="ssh"; args="-V"; name="OpenSSH"},
    @{cmd="code"; args="--version"; name="VS Code"}
)

Write-Host ""
Write-Host "Checking Windows-specific settings..." -ForegroundColor Cyan
Write-Host ""

# Long paths
$longPaths = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -ErrorAction SilentlyContinue
if ($longPaths.LongPathsEnabled -eq 1) {
    Write-Host "  Long paths: Enabled" -ForegroundColor Green
} else {
    Write-Host "  Long paths: DISABLED (run guide setup)" -ForegroundColor Red
}

# SSH agent
$sshAgent = Get-Service ssh-agent -ErrorAction SilentlyContinue
if ($sshAgent.Status -eq 'Running') {
    Write-Host "  SSH agent: Running" -ForegroundColor Green
} else {
    Write-Host "  SSH agent: NOT RUNNING" -ForegroundColor Red
}

# Defender exclusions
$exclusions = (Get-MpPreference).ExclusionPath
if ($exclusions) {
    Write-Host "  Defender exclusions: $($exclusions -join ', ')" -ForegroundColor Green
} else {
    Write-Host "  Defender exclusions: NONE (add your code directory)" -ForegroundColor Red
}

# Execution policy
$policy = Get-ExecutionPolicy -Scope CurrentUser
Write-Host "  Execution policy: $policy" -ForegroundColor $(if ($policy -eq 'Unrestricted') { 'Green' } else { 'Yellow' })

foreach ($item in $commands) {
    try {
        $version = & $item.cmd $item.args 2>&1 | Select-Object -First 1
        Write-Host "  $($item.name): $version" -ForegroundColor Green
    } catch {
        Write-Host "  $($item.name): NOT INSTALLED" -ForegroundColor Red
    }
}
```

## Post-Installation Checklist

After installing all tools, verify these key items:

- [ ] **Execution policy**: `Get-ExecutionPolicy -Scope CurrentUser` shows `Unrestricted`
- [ ] **Defender exclusions**: Your code directory is excluded (`Get-MpPreference | Select -Expand ExclusionPath`)
- [ ] **Long paths enabled**: Registry value is `1` and `git config --global core.longpaths` returns `true`
- [ ] **Windows Terminal** is your default terminal
- [ ] **Node.js**: `node --version` shows v24.x or later
- [ ] **fnm configured**: New terminal sessions auto-detect `.nvmrc` / `.node-version` files
- [ ] **VS Code**: Opens from terminal with `code .`
- [ ] **Git configured**: `git config --global user.name` and `git config --global user.email` are set
- [ ] **Git Credential Manager**: `git config --global credential.helper` returns `manager`
- [ ] **SSH agent running** (if using SSH): `Get-Service ssh-agent` shows `Running`
- [ ] **SSH key added** (if using SSH): `ssh -T git@github.com` authenticates successfully
- [ ] **GitHub authenticated**: `gh auth status` shows logged in
- [ ] **Docker running** (if installed): `docker ps` works without errors (requires Docker Desktop to be launched)
- [ ] **Global packages available**: `prettier --version`, `eslint --version`, `tsc --version` all work
- [ ] **Azure authenticated**: `az account show` shows your subscription
- [ ] **gcloud authenticated**: `gcloud auth list` shows your account
- [ ] **Starship prompt**: Terminal shows customized prompt with git/node info
- [ ] **Nerd Font configured**: Windows Terminal uses a Nerd Font (e.g., CaskaydiaCove)

## Troubleshooting

### fnm command not found
- Restart your terminal after installing fnm via winget
- Verify fnm is in your PATH: check `$env:PATH` in PowerShell
- Make sure your PowerShell profile contains the `fnm env` line

### node command not found (after fnm install)
- Make sure your PowerShell profile sources fnm (see step 4)
- Run `fnm use lts-latest` to activate a version in the current session
- Run `fnm default lts-latest` so it persists across sessions

### Docker requires WSL 2
- Docker Desktop on Windows requires WSL 2 backend
- If prompted, install WSL 2: `wsl --install` (run as Administrator, restart required)
- After restart, launch Docker Desktop again

### Docker daemon not running
- Docker CLI is installed but the daemon must be started manually
- Launch Docker Desktop from the Start Menu
- Wait for the Docker icon in the system tray to show "running"
- Verify with `docker ps` -- if it fails, Docker Desktop isn't running

### Permission errors with npm global install
- Run your terminal as Administrator, or
- Configure npm to use a different directory:
  ```powershell
  npm config set prefix "$env:APPDATA\npm"
  ```

### PATH not updated after installation
- Many winget installations require a terminal restart to update PATH
- If a command isn't found after install, close and reopen your terminal
- For persistent issues, check System Environment Variables (Win+R > `sysdm.cpl` > Advanced > Environment Variables)

### "Ripgrep is not available" in Claude Code
- Claude Code couldn't use its bundled ripgrep **and** didn't find `rg` on the `PATH` the `claude` process was launched with. It's harmless — a slower built-in file scanner takes over — but to fix it for good:
  - Install ripgrep (`winget install BurntSushi.ripgrep.MSVC`) and put a copy on a stable `PATH` dir: `Copy-Item (Get-Command rg).Source "$env:USERPROFILE\.local\bin\rg.exe"` (`~/.local/bin` is where `claude.exe` already lives, so it's on `PATH` wherever `claude` runs).
  - Exclude the Claude Code install dir (`%USERPROFILE%\.local`) from Defender so it can't quarantine the bundled `rg.exe` (a known false positive).
  - Quit the affected `claude` session and relaunch from a **fresh Windows Terminal** — a process keeps the `PATH` it started with. Run `/doctor` in Claude Code to see what it found, or `claude update` to refresh bundled tools.
  - WSL/Git-Bash shells don't inherit the Windows user `PATH` — install ripgrep inside that environment if you run Claude Code there.
  - See **step 10** for the full note.

### `0x80070002 — the system cannot find the file specified` launching `pwsh.exe` (Windows Terminal / VS Code)
- The terminal cached the path of a PowerShell 7 install that no longer exists. This happens when pwsh 7 was installed via the **Microsoft Store / MSIX bundle** (command line points at `…\WindowsApps\Microsoft.PowerShell_8wekyb3d8bbwe\pwsh.exe`), the terminal auto-detected it, and then it was uninstalled — e.g. when switching to the MSI build.
- **Fix:** fully restart Windows Terminal (close all windows) and VS Code so they re-scan and pick up the current `pwsh`. If that doesn't take, pin the path explicitly — in Windows Terminal's `settings.json`, add `"commandline": "\"C:\\Program Files\\PowerShell\\7\\pwsh.exe\" -NoLogo"` to the profile whose `source` is `Windows.Terminal.PowershellCore`.
- **Avoid it on a new machine** by installing PowerShell 7 from the **MSI** in the first place (see "Install PowerShell 7"), not the Store/MSIX build — then the only `pwsh` path the terminals ever see is the stable `C:\Program Files\PowerShell\7\pwsh.exe`.

### PowerShell profile errors at startup on a new or roamed machine
- Symptom: a new terminal opens with an error like `Import-Module : The specified module 'Terminal-Icons' was not loaded because no valid module file was found`, or `starship`/`fnm` "is not recognized". The slow `Loading personal and system profiles took NNNNms` line often appears too.
- **Cause:** your `$PROFILE` roamed via OneDrive, but the tool it references (the Terminal-Icons module, Starship, fnm, …) isn't installed on *this* machine yet — module/tool installs are per-machine and don't roam.
- **Quick fix:** install the missing piece, into the shell you actually use. For the module: `Install-Module Terminal-Icons -Repository PSGallery -Force -Scope CurrentUser` (run from `pwsh`, not 5.1, if pwsh is your shell — they have separate module paths). For Starship/fnm: `winget install Starship.Starship` / `winget install Schniz.fnm`, then open a new terminal.
- **Permanent fix:** guard every external-tool call in the profile with `if (Get-Command … )` / `Get-Module -ListAvailable` so a missing tool is skipped instead of fatal, and/or adopt the self-healing profile that auto-installs missing tools on first launch. Both are in [Roaming & self-healing across machines](#16-roaming--self-healing-across-machines-optional) and [`windows-powershell/`](windows-powershell/).
- **OneDrive module-path note:** with Documents redirected to OneDrive, `Install-Module -Scope CurrentUser` lands under `…\OneDrive\Documents\…\Modules` (so it roams) — but only in a *normal* interactive session. A tool or process launched with a stripped/non-redirected environment (some automation, or a shell that resolved Documents before redirection) can report a roamed module as missing even though it's installed; verify with `Get-Module -ListAvailable <name>` inside a real `pwsh` session.

### Execution policy blocks PowerShell scripts
- Developer workstations should use `Unrestricted` to avoid friction:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope CurrentUser
  ```

### Python installed but `python` command not found
- Windows has built-in "App Execution Aliases" that intercept `python` and `python3` commands and redirect to the Microsoft Store
- To fix: Open **Settings > Apps > Advanced app settings > App execution aliases** and disable the toggles for `python.exe` and `python3.exe`
- After disabling, restart your terminal and `python --version` should work
- Alternatively, use the `py` launcher: `py --version`
- This also affects **gcloud**, which needs Python on the PATH to run

### Native module build failures (node-gyp)
- Install Python: `winget install Python.Python.3.12`
- Install Visual Studio Build Tools: `winget install Microsoft.VisualStudio.2022.BuildTools`
- Set `GYP_MSVS_VERSION=2022` as a user environment variable:
  ```powershell
  [Environment]::SetEnvironmentVariable('GYP_MSVS_VERSION','2022','User')
  ```
- **Do not** put `msvs_version=2022` in `~/.npmrc` — npm 11.2+ warns that custom keys there are unsupported and they will stop working in a future major version. `npm config set msvs_version` also no longer works.

### SSH agent won't start
- The OpenSSH Authentication Agent service is disabled by default on Windows
- Run PowerShell **as Administrator**:
  ```powershell
  Set-Service ssh-agent -StartupType Automatic
  Start-Service ssh-agent
  ```
- Verify: `Get-Service ssh-agent` should show `Running`

### npm installs or builds are very slow
- Check that Windows Defender exclusions are configured for your code directory and fnm:
  ```powershell
  Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
  ```
- If your code directory isn't listed, add it (as Administrator):
  ```powershell
  Add-MpPreference -ExclusionPath "C:\Users\<YourUser>\Code"
  ```

## Additional Resources

- [fnm documentation](https://github.com/Schniz/fnm)
- [winget documentation](https://learn.microsoft.com/en-us/windows/package-manager/winget/)
- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [Next.js documentation](https://nextjs.org/docs)
- [pnpm documentation](https://pnpm.io)
- [Azure CLI documentation](https://learn.microsoft.com/en-us/cli/azure/)
- [Google Cloud CLI documentation](https://cloud.google.com/sdk/docs)
- [VS Code documentation](https://code.visualstudio.com/docs)

## Maintenance

**Keep tools updated:**

```powershell
# Update all winget packages
winget upgrade --all

# Update global npm packages
npm update -g

# Update Node.js to latest LTS
fnm install --lts
fnm default lts-latest

# Update Azure CLI
az upgrade

# Update Google Cloud SDK components
gcloud components update
```

**Recommended maintenance schedule:**
- Weekly: `winget upgrade --all`
- Monthly: Check for Node.js LTS updates with `fnm install --lts`
- As needed: `npm update -g` for global packages
