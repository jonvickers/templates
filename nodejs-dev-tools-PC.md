# Node.js Development Station Setup Guide (Windows)

Complete guide for setting up a Windows development environment for Node.js and Next.js development.

## Prerequisites

Before starting, ensure you have:

1. **Windows 10/11**
2. **PowerShell** (run as Administrator for installations)
3. **winget** (Windows Package Manager, included with Windows 10 1709+ and Windows 11)
   ```powershell
   winget --version
   ```

### Set PowerShell Execution Policy

Developer workstations should allow script execution. Run PowerShell **as Administrator**:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope CurrentUser
```

### Windows Defender Exclusions

Real-time antivirus scanning significantly slows npm installs, builds, and dev servers. Exclude your coding directory and Node.js tooling. Run PowerShell **as Administrator**:

```powershell
# Exclude your main coding directory (adjust path to match yours)
Add-MpPreference -ExclusionPath "C:\Users\<YourUser>\Code"

# Exclude fnm's Node.js installations
Add-MpPreference -ExclusionPath "$env:APPDATA\fnm"
```

> **Why?** `node_modules` folders contain thousands of small files. Defender scanning each one on every read adds substantial overhead to installs and builds.

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

Follow this sequence to avoid dependency issues:

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

Download from [nerdfonts.com](https://www.nerdfonts.com/font-downloads), install the font, then set it in Windows Terminal: **Settings > Profiles > Defaults > Appearance > Font face**.

> **Tip:** You can install Nerd Fonts via `oh-my-posh font install` if you have oh-my-posh, or manually from the website. The font only needs to be set in your terminal emulator, not system-wide.

**Install Starship and PowerShell modules:**

```powershell
winget install Starship.Starship

# PSReadLine (update to latest for predictive IntelliSense)
Install-Module PSReadLine -Force

# Terminal-Icons (file/folder icons in directory listings)
Install-Module Terminal-Icons -Repository PSGallery -Force
```

**Configure your PowerShell profile** (`notepad $PROFILE`):

```powershell
# Initialize fnm (Node.js version manager)
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression

# Shell modules
Import-Module Terminal-Icons

# PSReadLine enhancements
Set-PSReadLineOption -PredictionSource History
Set-PSReadLineOption -Colors @{ InlinePrediction = '#717171' }
Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete

# Initialize zoxide (if installed -- optional)
# Invoke-Expression (& { (zoxide init powershell | Out-String) })

# Initialize Starship prompt (must be last)
Invoke-Expression (&starship init powershell)
```

> **Why last?** Starship replaces the prompt function, so it must be initialized after other tools that modify the prompt.

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

After installing Build Tools, configure node-gyp to use them by adding to your `~/.npmrc`:
```powershell
# Create or edit ~/.npmrc
Add-Content -Path "$env:USERPROFILE\.npmrc" -Value "msvs_version=2022"
```

> **Note:** `npm config set msvs_version 2022` no longer works in npm 11+. Setting it directly in `.npmrc` is the correct approach.

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

# ── winget packages ──
winget install Microsoft.WindowsTerminal
winget install Git.Git
winget install Microsoft.VisualStudioCode
winget install Schniz.fnm
winget install GitHub.cli
# winget install Docker.DockerDesktop  # Optional -- uncomment if needed
winget install Python.Python.3.12
winget install Microsoft.VisualStudio.2022.BuildTools
winget install Microsoft.AzureCLI
winget install Google.CloudSDK
winget install BurntSushi.ripgrep.MSVC
winget install jqlang.jq
winget install sharkdp.fd
winget install sharkdp.bat
winget install dandavison.delta
winget install gnuwin32.tree
winget install junegunn.fzf
winget install eza-community.eza
winget install tldr-pages.tlrc
winget install Starship.Starship
# winget install ajeetdsouza.zoxide  # Optional -- smarter cd

# RESTART YOUR TERMINAL after the above installs

# ── Git configuration ──
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global core.autocrlf true
git config --global core.longpaths true
git config --global credential.helper manager

# ── PowerShell modules ──
Install-Module PSReadLine -Force
Install-Module Terminal-Icons -Repository PSGallery -Force

# ── Configure PowerShell profile ──
# Add to $PROFILE (see section 11 for full profile):

# ── Install Node.js via fnm ──
fnm install --lts
fnm default lts-latest

# ── Global npm packages ──
corepack enable
npm install -g pnpm yarn prettier eslint typescript @anthropic-ai/claude-code @openai/codex @google/gemini-cli
Add-Content -Path "$env:USERPROFILE\.npmrc" -Value "msvs_version=2022"

# ── SSH key (interactive) ──
# ssh-keygen -t ed25519 -C "you@example.com"
# ssh-add $env:USERPROFILE\.ssh\id_ed25519
# gh ssh-key add $env:USERPROFILE\.ssh\id_ed25519.pub --title "Windows Dev Machine"
```

## Verified Versions (as of February 2026)

These versions are known to work well together:

| Tool | Version | Notes |
|------|---------|-------|
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

$commands = @(
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
- Add `msvs_version=2022` to `~/.npmrc` (`npm config set` no longer works in npm 11+)

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
