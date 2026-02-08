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

## Recommended Installation Order

Follow this sequence to avoid dependency issues:

### 1. Core System Tools

```powershell
# Version control
winget install Git.Git

# Essential utilities
winget install BurntSushi.ripgrep.MSVC
winget install jqlang.jq
winget install sharkdp.fd

# Restart your terminal after installing Git to pick up PATH changes
```

**Verify:**
```powershell
git --version
rg --version
jq --version
```

### 2. Node.js Version Manager

We use **nvm-windows** (the Windows equivalent of nvm):

```powershell
winget install CoreyButler.NVMforWindows
```

**Restart your terminal** after installation.

**Verify:**
```powershell
nvm version
```

### 3. Node.js

```powershell
# Install latest LTS version
nvm install lts

# Use the installed version
nvm use lts

# Verify
node --version
npm --version
npx --version
```

### 4. Alternative Package Managers

```powershell
npm install -g yarn pnpm
```

**Verify:**
```powershell
yarn --version
pnpm --version
```

### 5. Code Quality Tools

```powershell
npm install -g prettier eslint typescript
```

**Verify:**
```powershell
prettier --version
eslint --version
tsc --version
```

### 6. GitHub CLI

```powershell
winget install GitHub.cli

# Authenticate (interactive)
gh auth login
```

**Verify:**
```powershell
gh --version
gh auth status
```

### 7. Cloud & Container Tools

```powershell
# Docker Desktop
winget install Docker.DockerDesktop

# Google Cloud SDK
winget install Google.CloudSDK
```

**Docker setup:**
- Launch Docker Desktop from the Start Menu
- Wait for Docker to finish starting (system tray icon turns solid)
- You may need to enable WSL 2 backend if prompted
- **Important:** Docker will not work until you manually launch the app

**Verify:**
```powershell
docker --version
docker ps  # This will fail if Docker Desktop isn't running
```

**gcloud setup:**
```powershell
# Initialize and authenticate
gcloud init

# Verify
gcloud --version
gcloud auth list

# Update components (recommended)
gcloud components update
```

### 8. Additional Utilities

```powershell
# Windows Terminal (if not already installed)
winget install Microsoft.WindowsTerminal

# File watching for Jest, Metro, etc.
# watchman is available via npm on Windows
npm install -g watchman
```

## Complete Tool Reference

### Core Node.js
| Tool | Install Command | Notes |
|------|-----------------|-------|
| node | `nvm install lts` | Use nvm-windows for version management |
| npm | Included with Node.js | - |
| npx | Included with npm | - |
| nvm-windows | `winget install CoreyButler.NVMforWindows` | Restart terminal after install |

### Package Managers
| Tool | Install Command |
|------|-----------------|
| yarn | `npm install -g yarn` |
| pnpm | `npm install -g pnpm` |

### Version Control & GitHub
| Tool | Install Command | Post-Install |
|------|-----------------|--------------|
| git | `winget install Git.Git` | Configure: `git config --global user.name "Your Name"` |
| gh (GitHub CLI) | `winget install GitHub.cli` | Run: `gh auth login` |

### Cloud & Containers
| Tool | Install Command | Post-Install |
|------|-----------------|--------------|
| docker | `winget install Docker.DockerDesktop` | Launch Docker Desktop, enable WSL 2 if prompted |
| gcloud | `winget install Google.CloudSDK` | Run: `gcloud init` |

### Code Quality & TypeScript
| Tool | Install Command |
|------|-----------------|
| prettier | `npm install -g prettier` |
| eslint | `npm install -g eslint` |
| typescript (tsc) | `npm install -g typescript` |

### Utilities
| Tool | Description | Install Command |
|------|-------------|-----------------|
| ripgrep (rg) | Fast code search | `winget install BurntSushi.ripgrep.MSVC` |
| jq | JSON processor | `winget install jqlang.jq` |
| fd | Fast file finder | `winget install sharkdp.fd` |
| curl | HTTP client | Included with Windows 10/11 |

## Quick Batch Install

If you prefer to install everything at once (run PowerShell as Administrator):

```powershell
# winget packages
winget install Git.Git
winget install CoreyButler.NVMforWindows
winget install GitHub.cli
winget install Docker.DockerDesktop
winget install Google.CloudSDK
winget install BurntSushi.ripgrep.MSVC
winget install jqlang.jq
winget install sharkdp.fd
winget install Microsoft.WindowsTerminal

# RESTART YOUR TERMINAL after the above installs

# Install Node.js via nvm
nvm install lts
nvm use lts

# Global npm packages
npm install -g yarn pnpm prettier eslint typescript
```

## Verified Versions (as of February 2026)

These versions are known to work well together:

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22.22.0 | Latest LTS |
| npm | 10.9.4 | Included with Node.js |
| nvm-windows | 1.2.2 | - |
| Yarn | 1.22.22 | - |
| pnpm | 10.28.2 | - |
| Prettier | 3.8.1 | - |
| ESLint | 9.39.2 | - |
| TypeScript | 5.9.3 | - |
| GitHub CLI | 2.86.0+ | - |
| Google Cloud SDK | 555.0.0+ | - |
| Docker | 29.2.0+ | - |

## Development Environment

### Recommended Text Editors/IDEs

- **VS Code**: `winget install Microsoft.VisualStudioCode`
- **WebStorm**: `winget install JetBrains.WebStorm`
- **Sublime Text**: `winget install SublimeHQ.SublimeText.4`

### Recommended Terminal

- **Windows Terminal**: `winget install Microsoft.WindowsTerminal` (may already be installed)

## Per-Project Tools (Install Locally)

These should typically be installed as dev dependencies in each project:

```powershell
npm install --save-dev <tool>
```

**Common per-project tools:**
- `ts-node` - TypeScript execution
- `tsx` - Enhanced TypeScript execution
- `jest` - Testing framework
- `vitest` - Fast testing framework
- `nodemon` - Auto-restart on file changes
- `pm2` - Process manager
- `concurrently` - Run multiple commands
- `cross-env` - Cross-platform environment variables

## Verification Script

Save this as `verify-setup.ps1` and run to check all installations:

```powershell
Write-Host "Checking development environment..." -ForegroundColor Cyan
Write-Host ""

$commands = @(
    @{cmd="git"; name="Git"},
    @{cmd="node"; name="Node.js"},
    @{cmd="npm"; name="npm"},
    @{cmd="npx"; name="npx"},
    @{cmd="nvm"; name="nvm-windows"},
    @{cmd="yarn"; name="Yarn"},
    @{cmd="pnpm"; name="pnpm"},
    @{cmd="prettier"; name="Prettier"},
    @{cmd="eslint"; name="ESLint"},
    @{cmd="tsc"; name="TypeScript"},
    @{cmd="gh"; name="GitHub CLI"},
    @{cmd="docker"; name="Docker"},
    @{cmd="gcloud"; name="Google Cloud SDK"},
    @{cmd="rg"; name="ripgrep"},
    @{cmd="jq"; name="jq"},
    @{cmd="fd"; name="fd"}
)

foreach ($item in $commands) {
    try {
        $version = & $item.cmd --version 2>&1 | Select-Object -First 1
        Write-Host "  $($item.name): $version" -ForegroundColor Green
    } catch {
        Write-Host "  $($item.name): NOT INSTALLED" -ForegroundColor Red
    }
}
```

## Post-Installation Checklist

After installing all tools, verify these key items:

- [ ] **Node.js**: `node --version` shows v22.x or later
- [ ] **nvm-windows configured**: `nvm version` works after terminal restart
- [ ] **GitHub authenticated**: `gh auth status` shows logged in
- [ ] **gcloud authenticated**: `gcloud auth list` shows your account
- [ ] **Docker running**: `docker ps` works without errors (requires Docker Desktop to be launched)
- [ ] **Global packages available**: `prettier --version`, `eslint --version`, `tsc --version` all work
- [ ] **Git configured**: Set `git config --global user.name` and `git config --global user.email`

**Optional but recommended:**
- [ ] Configure Git: `git config --global init.defaultBranch main`
- [ ] Test Node: Create a simple script and run with `node script.js`
- [ ] Test package managers: `npm --version`, `yarn --version`, `pnpm --version`

## Troubleshooting

### nvm command not found
- Make sure you restarted your terminal after installing nvm-windows
- Check that `C:\Users\<your-user>\AppData\Roaming\nvm` is in your PATH

### Docker requires WSL 2
- Docker Desktop on Windows requires WSL 2 backend
- If prompted, install WSL 2: `wsl --install` (run as Administrator, restart required)
- After restart, launch Docker Desktop again

### Docker daemon not running
- Docker CLI is installed but daemon must be started manually
- Launch Docker Desktop from the Start Menu
- Wait for the Docker icon in the system tray to show "running"
- Verify with `docker ps` - if it fails, Docker Desktop isn't running

### Permission errors with npm global install
- Run your terminal as Administrator, or
- Configure npm to use a different directory:
  ```powershell
  npm config set prefix "$env:APPDATA\npm"
  ```

### PATH not updated after installation
- Many winget installations require a terminal restart to update PATH
- If a command isn't found after install, close and reopen your terminal
- For persistent issues, check System Environment Variables

### Execution policy blocks PowerShell scripts
- If scripts won't run, set the execution policy:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

## Additional Resources

- [nvm-windows documentation](https://github.com/coreybutler/nvm-windows)
- [winget documentation](https://learn.microsoft.com/en-us/windows/package-manager/winget/)
- [Node.js best practices](https://github.com/goldbergyoni/nodebestpractices)

## Maintenance

**Keep tools updated:**

```powershell
# Update winget packages
winget upgrade --all

# Update global npm packages
npm update -g

# Update Node.js to latest LTS
nvm install lts
nvm use lts

# Update Google Cloud SDK components
gcloud components update
```

**Recommended maintenance schedule:**
- Weekly: `winget upgrade --all`
- Monthly: Check for Node.js LTS updates with `nvm install lts`
- As needed: `npm update -g` for global packages
- As needed: `gcloud components update` when prompted
