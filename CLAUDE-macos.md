# Global Development Environment

macOS workstation with Node.js full-stack development tooling.

## Installed Tools

Runtime: Node.js LTS via nvm (.nvmrc per-project), npm, pnpm, yarn (classic), corepack available
Languages: tsc (TypeScript), python3
Code quality: eslint (flat config only), prettier
Version control: git (Homebrew's, not Apple's bundled), gh (authenticated)
CLI utilities: rg (ripgrep), fd, jq, tree, wget, curl
Shell: zsh
Cloud: gcloud (Google Cloud SDK), docker (Docker Desktop)
Build tools: make (Xcode CLI tools), node/npm/npx
AI assistants: claude
Monitoring: htop, watchman

## macOS-Specific Config

- Package manager: Homebrew
- Git: Use Homebrew's git — verify with `which git` (should be /opt/homebrew/bin/git or /usr/local/bin/git, not /usr/bin/git)
- Homebrew path: /opt/homebrew (Apple Silicon) or /usr/local (Intel)
- Quote `lts/*` in zsh when using nvm alias commands

## Conventions

- Use **nvm** and `.nvmrc` for Node version management
- Prefer project-local devDependencies over global installs when possible
- ESLint uses flat config (`eslint.config.js`) — do not generate `.eslintrc` files
- Run `npm audit` as part of dependency management
