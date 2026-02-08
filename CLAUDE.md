# Global Development Environment

Windows 11 workstation with Node.js/Next.js full-stack development tooling.

## Installed Tools

Runtime: Node.js LTS via fnm, npm, pnpm (preferred), yarn, corepack enabled
Languages: tsc (TypeScript), python
Code quality: eslint (flat config only), prettier
Version control: git, gh (authenticated), credential.helper=manager, ssh
CLI utilities: rg (ripgrep), fd, jq, bat, delta, tree, fzf, eza, tlrc (tldr), curl
Shell: Starship prompt, PSReadLine (predictive IntelliSense), Terminal-Icons
Cloud: az (Azure CLI), gcloud (Google Cloud SDK)
Editors: code (VS Code), Windows Terminal
AI assistants: claude, codex, gemini
Build tools: VS 2022 Build Tools (node-gyp), .npmrc: msvs_version=2022
Containers: Docker Desktop (optional, not installed -- install when needed)

## Windows-Specific Config

- PowerShell execution policy: Unrestricted (CurrentUser)
- Long paths enabled (registry + git core.longpaths)
- Windows Defender exclusions configured for code directories and fnm
- Line endings: core.autocrlf true (CRLF on checkout, LF on commit)

## Conventions

- Use **pnpm** for new projects unless the project already uses npm or yarn
- Use **fnm** to switch Node versions -- never install Node directly
- Prefer project-local tool installs (`pnpm add -D`) over global installs
- ESLint uses flat config (`eslint.config.js`) -- do not generate `.eslintrc` files
