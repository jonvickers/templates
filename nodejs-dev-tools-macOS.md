# Node.js Development Station Setup Guide (macOS)

Complete guide for setting up a macOS development environment for Node.js and Next.js development.

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

### 1. Terminal (optional upgrade)

The built-in Terminal.app works fine. Popular upgrades:

- **iTerm2**: `brew install --cask iterm2`
- **Warp**: `brew install --cask warp`

### 2. Git

```bash
brew install git
```

**Configure:**
```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

**Verify:**
```bash
git --version
```

### 3. VS Code

The standard editor for Node.js and Next.js development:

```bash
brew install --cask visual-studio-code
```

**Recommended extensions** (install from VS Code or CLI):
```bash
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

```bash
brew install fnm
```

**Configure your shell** so fnm activates in every terminal session. Add this line to `~/.zshrc` (or `~/.bashrc` if using bash):

```bash
# Add to ~/.zshrc:
eval "$(fnm env --use-on-cd --shell zsh)"
```

**Reload shell:**
```bash
source ~/.zshrc
```

**Verify:**
```bash
fnm --version
```

### 5. Node.js

```bash
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

```bash
npm install -g pnpm yarn
```

> **Note:** pnpm can also be installed standalone via `brew install pnpm` if you prefer not to use npm for it.

> **corepack** is bundled with Node.js and can manage pnpm/yarn versions per-project via `packageManager` in `package.json`. Enable it with:
> ```bash
> corepack enable
> ```
> Projects using corepack will automatically use the correct package manager version without global installs.

**Verify:**
```bash
pnpm --version
yarn --version
```

### 7. Code Quality & TypeScript

```bash
npm install -g prettier eslint typescript
```

**Verify:**
```bash
prettier --version
eslint --version
tsc --version
```

### 8. GitHub CLI

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

### 9. SSH Keys (optional)

> **Skip this if** you're happy using HTTPS for Git. SSH is an alternative authentication method -- useful if you work with multiple Git hosts, need deploy keys, or prefer key-based auth.

Set up SSH for GitHub, Azure DevOps, and remote server access. macOS includes `ssh-agent` and integrates with Keychain automatically.

**Generate a key and add it:**
```bash
ssh-keygen -t ed25519 -C "you@example.com"
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

**Persist across reboots** by adding to `~/.ssh/config`:
```
Host *
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519
```

**Add your public key to GitHub:**
```bash
# Copy public key to clipboard
pbcopy < ~/.ssh/id_ed25519.pub

# Or use GitHub CLI to add it directly
gh ssh-key add ~/.ssh/id_ed25519.pub --title "Mac Dev Machine"
```

**Verify:**
```bash
ssh -T git@github.com
```

### 10. CLI Utilities

```bash
brew install ripgrep jq fd tree wget htop watchman
```

| Tool | What it does |
|------|-------------|
| **ripgrep** (`rg`) | Blazing-fast code search (replaces grep) |
| **jq** | JSON processor for the command line |
| **fd** | Fast, user-friendly file finder (replaces find) |
| **tree** | Directory structure visualization |
| **wget** | File downloader |
| **htop** | Interactive system monitor |
| **watchman** | File watching for Jest, Metro, etc. |

**Verify:**
```bash
rg --version
jq --version
fd --version
watchman --version
```

### 11. Docker Desktop

```bash
brew install --cask docker
```

**Setup:**
- Launch Docker Desktop from Applications folder
- Wait for Docker daemon to start (Docker icon appears in menu bar)
- Docker will not work until you manually launch the app

> **Note:** `brew install --cask docker` may prompt for your administrator password. This is normal -- Docker needs to create CLI plugin directories.

**Verify:**
```bash
docker --version
docker ps  # Fails if Docker Desktop isn't running
```

### 12. Cloud CLIs

**Azure CLI:**
```bash
brew install azure-cli
```

**Setup:**
```bash
az login
az account show
```

**Google Cloud SDK:**
```bash
brew install --cask google-cloud-sdk
```

**Setup:**
```bash
gcloud init
gcloud auth list
gcloud components update
```

> **Note:** gcloud may prompt to install Python 3.13 during updates. If you already have Python 3.11+ installed, you can skip this -- gcloud works fine with newer Python versions.

**Verify both:**
```bash
az --version
gcloud --version
```

### 13. Claude Code (AI-assisted development)

```bash
npm install -g @anthropic-ai/claude-code
```

Requires an Anthropic API key or Claude subscription. Run `claude` in any project directory to start.

## Complete Tool Reference

### Core Node.js
| Tool | Install Command | Notes |
|------|-----------------|-------|
| node | `fnm install --lts` | Use fnm for version management |
| npm | Included with Node.js | - |
| npx | Included with npm | - |
| fnm | `brew install fnm` | Add `eval` line to `~/.zshrc` after install |

### Package Managers
| Tool | Install Command | Notes |
|------|-----------------|-------|
| pnpm | `npm install -g pnpm` | Recommended for Next.js projects |
| yarn | `npm install -g yarn` | Widely used in existing projects |

### Version Control & GitHub
| Tool | Install Command | Post-Install |
|------|-----------------|--------------|
| git | `brew install git` | `git config --global user.name "Your Name"` |
| gh (GitHub CLI) | `brew install gh` | `gh auth login` |

### Editor & Terminal
| Tool | Install Command |
|------|-----------------|
| VS Code | `brew install --cask visual-studio-code` |
| iTerm2 | `brew install --cask iterm2` |
| Warp | `brew install --cask warp` |

### Code Quality & TypeScript
| Tool | Install Command |
|------|-----------------|
| prettier | `npm install -g prettier` |
| eslint | `npm install -g eslint` |
| typescript (tsc) | `npm install -g typescript` |

### Containers & Cloud
| Tool | Install Command | Post-Install |
|------|-----------------|--------------|
| docker | `brew install --cask docker` | Launch Docker Desktop app |
| az (Azure CLI) | `brew install azure-cli` | `az login` |
| gcloud | `brew install --cask google-cloud-sdk` | `gcloud init` |

### CLI Utilities
| Tool | Description | Install Command |
|------|-------------|-----------------|
| ripgrep (`rg`) | Fast code search | `brew install ripgrep` |
| jq | JSON processor | `brew install jq` |
| fd | Fast file finder | `brew install fd` |
| tree | Directory structure | `brew install tree` |
| wget | File downloader | `brew install wget` |
| htop | System monitor | `brew install htop` |
| watchman | File watching (Jest, Metro) | `brew install watchman` |
| curl | HTTP client | Included with macOS |
| make | Build automation | Included with Xcode CLI tools |

## Quick Batch Install

After prerequisites (Xcode CLI tools + Homebrew), install everything at once:

```bash
# ── Homebrew packages ──
brew install git fnm gh ripgrep jq fd tree wget htop watchman
brew install azure-cli
brew install --cask visual-studio-code docker google-cloud-sdk

# ── Configure fnm in ~/.zshrc ──
# Add this line:
#   eval "$(fnm env --use-on-cd --shell zsh)"
source ~/.zshrc

# ── Install Node.js via fnm ──
fnm install --lts
fnm default lts-latest

# ── Global npm packages ──
corepack enable
npm install -g pnpm yarn prettier eslint typescript @anthropic-ai/claude-code

# ── SSH key (interactive) ──
# ssh-keygen -t ed25519 -C "you@example.com"
# ssh-add --apple-use-keychain ~/.ssh/id_ed25519
# gh ssh-key add ~/.ssh/id_ed25519.pub --title "Mac Dev Machine"
```

## Verified Versions (as of February 2026)

These versions are known to work well together:

| Tool | Version | Notes |
|------|---------|-------|
| Git | 2.53.0 | - |
| Node.js | 24.13.0 | Latest LTS (Krypton) |
| npm | 11.6.2 | Included with Node.js 24 |
| fnm | 1.38.1 | - |
| pnpm | 10.29.1 | - |
| Yarn | 1.22.22 | Classic; Yarn 4.x available via `corepack` |
| Prettier | 3.8.1 | - |
| ESLint | 10.0.0 | Flat config is the default |
| TypeScript | 5.9.3 | - |
| GitHub CLI | 2.86.0 | - |
| Azure CLI | 2.83.0 | - |
| Google Cloud SDK | 555.0.0+ | - |
| Docker | 29.x | - |
| VS Code | 1.108.0 | - |
| ripgrep | 14.1.1 | - |
| jq | 1.8.1 | - |
| fd | 10.3.0 | - |
| Homebrew | 5.0.x | - |

## Optional but Recommended

### API Testing

For testing REST APIs and GraphQL endpoints during development:

- **VS Code REST Client** (already in recommended extensions above) -- lightweight, lives in your editor
- **Postman**: `brew install --cask postman` -- full-featured GUI for teams
- **Bruno**: `brew install --cask bruno` -- open-source, Git-friendly alternative to Postman

### Database GUI

If working with databases (Postgres, MySQL, MongoDB, etc.):

- **DBeaver**: `brew install --cask dbeaver-community` -- universal database client, works with all major databases
- **Prisma Studio**: `npx prisma studio` -- built into Prisma, no extra install needed

## Per-Project Tools (Install Locally)

These should typically be installed as dev dependencies in each project:

```bash
npm install --save-dev <tool>
# or with pnpm:
pnpm add -D <tool>
```

**Common per-project tools:**
- `typescript` / `tsx` - TypeScript compiler and fast execution
- `vitest` or `jest` - Testing frameworks
- `nodemon` - Auto-restart on file changes during development
- `concurrently` - Run multiple commands in parallel
- `cross-env` - Cross-platform environment variables
- `dotenv` - Load environment variables from `.env` files
- `husky` - Git hooks (pre-commit linting, etc.)
- `lint-staged` - Run linters only on staged files (pairs with husky)
- `prisma` - Database ORM (common in Next.js projects)
- `tailwindcss` - Utility-first CSS framework

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
    "fnm:fnm"
    "pnpm:pnpm"
    "yarn:Yarn"
    "prettier:Prettier"
    "eslint:ESLint"
    "tsc:TypeScript"
    "gh:GitHub CLI"
    "docker:Docker"
    "az:Azure CLI"
    "gcloud:Google Cloud SDK"
    "rg:ripgrep"
    "jq:jq"
    "fd:fd"
    "tree:tree"
    "watchman:watchman"
    "ssh:OpenSSH"
    "code:VS Code"
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

- [ ] **Node.js**: `node --version` shows v24.x or later
- [ ] **fnm configured**: New terminal sessions auto-detect `.nvmrc` / `.node-version` files
- [ ] **VS Code**: Opens from terminal with `code .`
- [ ] **Git configured**: `git config --global user.name` and `git config --global user.email` are set
- [ ] **SSH key added** (if using SSH): `ssh -T git@github.com` authenticates successfully
- [ ] **GitHub authenticated**: `gh auth status` shows logged in
- [ ] **Docker running**: `docker ps` works without errors (requires Docker Desktop to be launched)
- [ ] **Global packages available**: `prettier --version`, `eslint --version`, `tsc --version` all work
- [ ] **Azure authenticated**: `az account show` shows your subscription
- [ ] **gcloud authenticated**: `gcloud auth list` shows your account

## Troubleshooting

### fnm command not found
- Ensure you added `eval "$(fnm env --use-on-cd --shell zsh)"` to `~/.zshrc`
- Run `source ~/.zshrc` or restart your terminal

### node command not found (after fnm install)
- Make sure your shell profile sources fnm (see step 4)
- Run `fnm use lts-latest` to activate a version in the current session
- Run `fnm default lts-latest` so it persists across sessions

### Docker installation requires password
- `brew install --cask docker` may prompt for your administrator password
- This is normal -- Docker needs to create CLI plugin directories
- Enter your password when prompted to complete installation

### Docker daemon not running
- Docker CLI is installed but daemon must be started manually
- Launch Docker Desktop from Applications folder
- Wait for Docker icon to appear in menu bar
- Verify with `docker ps` -- if it fails, Docker Desktop isn't running

### gcloud prompts to install Python
- gcloud may suggest installing Python 3.13 during updates
- If you already have Python 3.11+ (check with `python3 --version`), you can skip this
- gcloud works fine with newer Python versions already on your system

### Permission errors with npm global install
- Don't use `sudo` with npm
- If issues persist, consider using fnm (recommended) or reconfigure npm prefix

### Homebrew installation path issues
- Apple Silicon (M1/M2/M3/M4): Homebrew installs to `/opt/homebrew`
- Intel Macs: Homebrew installs to `/usr/local`
- Ensure correct path in shell configuration

## Additional Resources

- [fnm documentation](https://github.com/Schniz/fnm)
- [Homebrew documentation](https://docs.brew.sh/)
- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [Next.js documentation](https://nextjs.org/docs)
- [pnpm documentation](https://pnpm.io)
- [Azure CLI documentation](https://learn.microsoft.com/en-us/cli/azure/)
- [Google Cloud CLI documentation](https://cloud.google.com/sdk/docs)
- [VS Code documentation](https://code.visualstudio.com/docs)

## Maintenance

**Keep tools updated:**

```bash
# Update Homebrew and packages
brew update && brew upgrade

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
- Weekly: `brew update && brew upgrade`
- Monthly: Check for Node.js LTS updates with `fnm install --lts`
- As needed: `npm update -g` for global packages
