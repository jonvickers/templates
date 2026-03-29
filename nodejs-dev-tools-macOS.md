# Node.js Development Station Setup Guide

Complete guide for setting up a macOS development environment for Node.js development.

## Prerequisites

Before starting, ensure you have:

1. **macOS** (this guide is macOS-specific)
2. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```
3. **Homebrew** (macOS package manager)
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

**Note on Python:** macOS includes Python 3, which is sufficient for all tools in this guide including gcloud. You don't need to install Python separately.

## Recommended Installation Order

Follow this sequence to avoid dependency issues:

### 1. Core System Tools

```bash
# Version control
brew install git

# Essential utilities
brew install ripgrep jq tree fd wget

# System monitoring
brew install htop
```

**Important — Git PATH priority:** macOS ships its own older Git at `/usr/bin/git`. After `brew install git`, verify you're using Homebrew's version:
```bash
which git    # Should show /opt/homebrew/bin/git (Apple Silicon) or /usr/local/bin/git (Intel)
git --version
```
If `which git` still shows `/usr/bin/git`, ensure Homebrew's bin directory appears before `/usr/bin` in your `$PATH` (Homebrew's default shell setup handles this).

**Verify:**
```bash
git --version
rg --version
jq --version
```

### 2. Node.js Version Manager

```bash
# Install nvm
brew install nvm

# Create nvm directory
mkdir ~/.nvm
```

**Configure nvm** - Add to `~/.zshrc` (or `~/.bashrc` if using bash):
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"
[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"
```

**Reload shell:**
```bash
source ~/.zshrc
```

**Verify:**
```bash
nvm --version
```

### 3. Node.js

```bash
# Install latest LTS version
nvm install --lts

# Set as default (quotes required in zsh to prevent glob expansion of *)
nvm alias default 'lts/*'

# Verify
node --version
npm --version
npx --version
```

**Per-project Node version pinning** - Create a `.nvmrc` file in your project root to ensure consistent Node versions across team members:
```bash
# In your project directory
node --version > .nvmrc

# Then anyone on the team runs:
nvm use
```

### 4. Alternative Package Managers

```bash
npm install -g yarn pnpm
```

**Verify:**
```bash
yarn --version
pnpm --version
```

**Note on Corepack:** Node.js ships with [Corepack](https://nodejs.org/api/corepack.html), which can manage yarn and pnpm versions per-project via the `packageManager` field in `package.json`. To enable it:
```bash
corepack enable
```
This is useful for teams that need to pin exact package manager versions. When Corepack is enabled and a project specifies `"packageManager": "pnpm@10.33.0"` in `package.json`, running `pnpm` will automatically use that exact version.

### 5. Code Quality Tools

```bash
npm install -g prettier eslint typescript
```

**Note on major version upgrades:** ESLint and TypeScript release major versions that can have breaking config changes (e.g., ESLint 9→10 changed rule defaults, TypeScript 5→6 tightened type checks). When upgrading globally, check release notes and be aware that existing project configs may need updates. You can pin a specific version if needed: `npm install -g typescript@5.9`.

**Verify:**
```bash
prettier --version
eslint --version
tsc --version
```

### 6. GitHub CLI

```bash
brew install gh

# Authenticate (interactive)
gh auth login
```

**Verify:**
```bash
gh --version
gh auth status
```

### 7. Cloud & Container Tools

```bash
# Docker Desktop (includes CLI and GUI)
# Note: This may prompt for your password to set up CLI plugins
brew install --cask docker

# Google Cloud SDK
brew install --cask google-cloud-sdk
```

**Docker setup:**
- Launch Docker Desktop from Applications folder
- Wait for Docker daemon to start (Docker icon appears in menu bar)
- **Important:** Docker will not work until you manually launch the app

**Verify:**
```bash
docker --version
docker ps  # This will fail if Docker Desktop isn't running
```

**gcloud setup:**
```bash
# Initialize and authenticate
gcloud init

# Verify
gcloud --version
gcloud auth list

# Update components (recommended)
gcloud components update
```

**Note:** gcloud may prompt to install Python 3.13 during updates. If you already have Python 3.11+ installed, you can skip this - gcloud works fine with newer Python versions.

### 8. Security

**npm audit** is built into npm and should be part of your regular workflow:
```bash
# Check for known vulnerabilities in dependencies
npm audit

# Auto-fix where possible
npm audit fix
```

Consider adding `npm audit` to your CI pipeline. For more comprehensive scanning, look into [Snyk](https://snyk.io/) or [Socket](https://socket.dev/).

### 9. Additional Utilities

```bash
# File watching for Jest, Metro, etc.
brew install watchman

# Verify
watchman --version
```

## Complete Tool Reference

### Core Node.js
| Tool | Install Command | Notes |
|------|-----------------|-------|
| node | `nvm install --lts` | Use nvm for version management |
| npm | Included with Node.js | - |
| npx | Included with npm | - |
| nvm | `brew install nvm` | Requires shell configuration |
| corepack | Included with Node.js | Enable with `corepack enable` |

### Package Managers
| Tool | Install Command |
|------|-----------------|
| yarn | `npm install -g yarn` |
| pnpm | `npm install -g pnpm` |

### Version Control & GitHub
| Tool | Install Command | Post-Install |
|------|-----------------|--------------|
| git | `brew install git` | Configure: `git config --global user.name "Your Name"` |
| gh (GitHub CLI) | `brew install gh` | Run: `gh auth login` |

### Cloud & Containers
| Tool | Install Command | Post-Install |
|------|-----------------|--------------|
| docker | `brew install --cask docker` | Launch Docker Desktop app |
| gcloud | `brew install --cask google-cloud-sdk` | Run: `gcloud init` |

### Code Quality & TypeScript
| Tool | Install Command |
|------|-----------------|
| prettier | `npm install -g prettier` |
| eslint | `npm install -g eslint` |
| typescript (tsc) | `npm install -g typescript` |

### Utilities
| Tool | Description | Install Command |
|------|-------------|-----------------|
| ripgrep (rg) | Fast code search | `brew install ripgrep` |
| jq | JSON processor | `brew install jq` |
| tree | Directory structure visualization | `brew install tree` |
| fd | Fast file finder | `brew install fd` |
| wget | File downloader | `brew install wget` |
| htop | System monitor | `brew install htop` |
| watchman | File watching (Jest, Metro) | `brew install watchman` |
| curl | HTTP client | Included with macOS |
| make | Build automation | Included with Xcode CLI tools |

## Quick Batch Install

If you prefer to install everything at once (after prerequisites):

```bash
# Homebrew packages
brew install nvm git gh ripgrep jq tree fd wget htop watchman
brew install --cask docker google-cloud-sdk

# Configure nvm (add to ~/.zshrc, then source it)
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"

# Install Node.js
nvm install --lts
nvm alias default 'lts/*'    # Quotes required in zsh

# Global npm packages
npm install -g yarn pnpm prettier eslint typescript
```

## Verified Versions (as of March 2026)

These versions are known to work well together:

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 24.14.1 | Latest LTS (Krypton). v22.x (Jod) also supported. |
| npm | 11.11.0 | Bundled with Node.js 24.14.1 |
| nvm | 0.40.3 | - |
| Corepack | 0.34.6 | Included with Node.js |
| Yarn | 1.22.22 | Classic. Modern Yarn (v4+) is per-project via Corepack. |
| pnpm | 10.33.0 | - |
| Prettier | 3.8.1 | - |
| ESLint | 10.1.0 | Major version — check project config compatibility |
| TypeScript | 6.0.2 | Major version — check project config compatibility |
| Git | 2.53.0 | Use Homebrew's, not Apple's bundled version |
| GitHub CLI | 2.89.0 | - |
| Google Cloud SDK | 555.0.0+ | - |
| Docker | 29.2.0+ | - |
| Homebrew | 5.0.13+ | - |

## Development Environment

### Recommended Text Editors/IDEs

- **VS Code**: `brew install --cask visual-studio-code`
- **WebStorm**: `brew install --cask webstorm`
- **Sublime Text**: `brew install --cask sublime-text`
- **Vim/Neovim**: `brew install neovim`

### Recommended Terminal Emulators

- **iTerm2**: `brew install --cask iterm2`
- **Warp**: `brew install --cask warp`
- **Alacritty**: `brew install --cask alacritty`

## Per-Project Tools (Install Locally)

These should typically be installed as dev dependencies in each project:

```bash
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

Save this as `verify-setup.sh` and run to check all installations:

```bash
#!/bin/bash

echo "Checking development environment..."
echo

commands=(
    "git:Git"
    "node:Node.js"
    "npm:npm"
    "npx:npx"
    "nvm:nvm"
    "yarn:Yarn"
    "pnpm:pnpm"
    "prettier:Prettier"
    "eslint:ESLint"
    "tsc:TypeScript"
    "gh:GitHub CLI"
    "docker:Docker"
    "gcloud:Google Cloud SDK"
    "rg:ripgrep"
    "jq:jq"
    "tree:tree"
    "fd:fd"
)

for cmd in "${commands[@]}"; do
    IFS=':' read -r command name <<< "$cmd"
    if command -v "$command" &> /dev/null; then
        version=$("$command" --version 2>&1 | head -n 1)
        echo "✓ $name: $version"
    else
        echo "✗ $name: NOT INSTALLED"
    fi
done
```

## Post-Installation Checklist

After installing all tools, verify these key items:

- [ ] **Node.js**: `node --version` shows v24.x (current LTS) or v22.x
- [ ] **nvm configured**: Shell restarts without "nvm: command not found"
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
- Ensure you added the nvm configuration to your shell profile
- Run `source ~/.zshrc` or restart your terminal

### `nvm alias default lts/*` fails with "no matches found"
- zsh tries to glob-expand the `*` in `lts/*`
- Fix: quote the argument: `nvm alias default 'lts/*'`

### Global npm packages missing after Node.js upgrade
- nvm installs global packages per Node version — switching versions means starting fresh
- When upgrading, use: `nvm install --lts --reinstall-packages-from=current`
- If you already upgraded without that flag: `npm install -g yarn pnpm prettier eslint typescript`

### `which git` shows /usr/bin/git after brew install
- macOS bundles an older Git at `/usr/bin/git`
- Homebrew's Git is at `/opt/homebrew/bin/git` (Apple Silicon) or `/usr/local/bin/git` (Intel)
- Ensure Homebrew's bin directory appears before `/usr/bin` in your `$PATH`
- Check with: `echo $PATH | tr ':' '\n' | head -5`

### Docker installation requires password
- `brew install --cask docker` may prompt for your administrator password
- This is normal - Docker needs to create CLI plugin directories
- Enter your password when prompted to complete installation

### Docker daemon not running
- Docker CLI is installed but daemon must be started manually
- Launch Docker Desktop from Applications folder
- Wait for Docker icon to appear in menu bar
- Verify with `docker ps` - if it fails, Docker Desktop isn't running

### gcloud prompts to install Python
- gcloud may suggest installing Python 3.13 during updates
- If you already have Python 3.11+ (check with `python3 --version`), you can skip this
- gcloud works fine with newer Python versions already on your system

### Permission errors with npm global install
- Don't use `sudo` with npm
- If issues persist, consider using nvm (recommended) or reconfigure npm prefix

### Homebrew installation path issues
- Apple Silicon (M1/M2/M3): Homebrew installs to `/opt/homebrew`
- Intel Macs: Homebrew installs to `/usr/local`
- Ensure correct path in shell configuration

## Additional Resources

- [nvm documentation](https://github.com/nvm-sh/nvm)
- [Homebrew documentation](https://docs.brew.sh/)
- [Node.js best practices](https://github.com/goldbergyoni/nodebestpractices)

## Maintenance

**Keep tools updated:**

```bash
# Update Homebrew and packages (may upgrade many transitive dependencies — expect 20+ packages)
brew update && brew upgrade

# Update global npm packages
npm update -g

# Update Node.js to latest LTS
# IMPORTANT: Use --reinstall-packages-from to carry over global npm packages from your current version.
# Without this flag, global packages (prettier, eslint, typescript, etc.) won't be available in the new version.
nvm install --lts --reinstall-packages-from=current
nvm alias default 'lts/*'    # Quotes required in zsh

# Update Google Cloud SDK components
gcloud components update
```

**After upgrading Node.js LTS:**
- New terminal windows will use the new version automatically
- Existing terminals stay on the old version — run `nvm use default` or restart them
- If you forgot `--reinstall-packages-from`, reinstall globals: `npm install -g yarn pnpm prettier eslint typescript`
- The old Node.js version remains installed. Remove it with `nvm uninstall <old-version>` or keep it for projects that need it

**Recommended maintenance schedule:**
- Weekly: `brew update && brew upgrade`
- Monthly: Check for Node.js LTS updates with `nvm install --lts`
- As needed: `npm update -g` for global packages
- As needed: `gcloud components update` when prompted

## Claude Code CLI Integration

Claude Code reads `CLAUDE.md` files for context about your environment, tools, and conventions. To ensure Claude Code knows about your installed tools and uses them effectively, maintain a global `CLAUDE.md` at `~/.claude/CLAUDE.md`.

**What it does:** Every Claude Code conversation loads this file automatically, so Claude knows what CLI tools are available, which versions/managers you use, and your preferences — without you having to explain each time.

**After installing or updating tools from this guide**, verify `~/.claude/CLAUDE.md` reflects the current state:

```bash
cat ~/.claude/CLAUDE.md
```

**Key things to keep listed in `~/.claude/CLAUDE.md`:**
- Available CLI tools (rg, fd, jq, gh, docker, gcloud, etc.)
- Node.js version management setup (nvm, .nvmrc, Corepack)
- Conventions (prefer local devDependencies, run npm audit, etc.)
- Any project-wide preferences (default package manager, test runner, etc.)

**Scope levels:**
| File | Scope |
|------|-------|
| `~/.claude/CLAUDE.md` | All projects — global tools and preferences |
| `<project>/CLAUDE.md` | One project — stack, scripts, conventions |
| `<project>/<subdir>/CLAUDE.md` | Subdirectory — scoped overrides |

For project-specific setups (e.g., "this repo uses pnpm and vitest"), add a `CLAUDE.md` in the project root rather than cluttering the global file.
