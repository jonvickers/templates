# Global Development Environment

Windows 11 workstation with Node.js/Next.js full-stack development tooling.

## Installed Tools

### Runtime & Package Managers
- **Node.js** 24.13.0 LTS (Krypton) via fnm
- **npm** 11.6.2 (bundled with Node)
- **pnpm** 10.29.1 (preferred for Next.js projects)
- **yarn** 1.22.22 (classic)
- **corepack** enabled
- **fnm** 1.38.1 (Node version manager; supports .nvmrc and .node-version)

### Languages & Compilers
- **TypeScript** 5.9.3 (`tsc`)
- **Python** 3.12.10

### Code Quality
- **ESLint** 10.0.0 (flat config only)
- **Prettier** 3.8.1

### Version Control
- **Git** 2.52.0 (upgrade to 2.53.0 pending)
- **GitHub CLI** (`gh`) 2.86.0 -- authenticated
- **Git Credential Manager** enabled (`credential.helper manager`)

### CLI Utilities
- **ripgrep** (`rg`) 15.1.0 -- fast code search
- **fd** 10.3.0 -- fast file finder
- **jq** 1.8.1 -- JSON processor
- **bat** 0.26.1 -- syntax-highlighted file viewer
- **delta** 0.18.2 -- syntax-highlighted git diffs
- **tree** 1.5.2.2 -- directory structure
- **curl** -- included with Windows
- **OpenSSH** 10.2p1

### Cloud CLIs
- **Azure CLI** (`az`) 2.83.0
- **Google Cloud SDK** (`gcloud`) 552.0.0

### Containers
- **Docker Desktop** -- not installed (optional; install when needed)

### Editors
- **VS Code** 1.109.0 (accessible via `code` command)

### AI Coding Assistants
- **Claude Code** (`claude`) 2.1.37
- **Codex CLI** (`codex`) 0.89.0
- **Gemini CLI** (`gemini`) 0.25.2

### Build Tools (native modules)
- **Visual Studio 2022 Build Tools** (for node-gyp)
- `.npmrc` has `msvs_version=2022`

## Windows-Specific Config
- PowerShell execution policy: Unrestricted (CurrentUser)
- Long paths enabled (registry + `git config --global core.longpaths true`)
- Windows Defender exclusions configured for code directories and fnm
- Line endings: `core.autocrlf true` (CRLF on checkout, LF on commit)

## Conventions
- Use **pnpm** for new projects unless the project already uses npm or yarn
- Use **fnm** to switch Node versions -- never install Node directly
- Prefer project-local tool installs (`pnpm add -D`) over global installs
- ESLint 10 uses flat config (`eslint.config.js`) -- do not generate `.eslintrc` files
