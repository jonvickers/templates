# Global Development Environment

Windows 11 workstation with Node.js/Next.js full-stack development tooling.

## Installed Tools

Runtime: Node.js LTS via fnm, npm, pnpm (preferred), yarn, corepack enabled
Languages: tsc (TypeScript), python
Code quality: eslint (flat config only), prettier
Version control: git, gh (authenticated), credential.helper=manager, ssh
CLI utilities: rg (ripgrep), fd, jq, bat, delta, tree, fzf, eza, tlrc (tldr), curl
Shell: pwsh (PowerShell 7), Starship prompt, PSReadLine (predictive IntelliSense), Terminal-Icons
Cloud: az (Azure CLI), gcloud (Google Cloud SDK)
Editors: code (VS Code), Windows Terminal
AI assistants: claude, codex, gemini
Build tools: VS 2022 Build Tools (node-gyp), .npmrc: msvs_version=2022
Containers: Docker Desktop (optional, not installed -- install when needed)

## Windows-Specific Config

- PowerShell: **7 (`pwsh`)** installed via the **MSI** (machine-wide, `C:\Program Files\PowerShell\7\` — *not* the winget/Store MSIX, which `winget install Microsoft.PowerShell` gives instead), side-by-side with built-in Windows PowerShell 5.1. `pwsh` is the default profile in Windows Terminal and VS Code. Canonical `$PROFILE` is the pwsh one (`…\OneDrive\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`); the 5.1 `$PROFILE` is a one-line shim that dot-sources it. Modules (PSReadLine, Terminal-Icons) under the pwsh user module path. Don't remove 5.1 — it's a Windows component.
- PowerShell execution policy: Unrestricted (CurrentUser) — set on **both** shells (execution policy is per-shell)
- Long paths enabled (registry + git core.longpaths)
- Windows Defender exclusions configured for code directories, fnm, and the Claude Code install dir (`~/.local` — the native build embeds CLI tools incl. `rg.exe`, a Defender false-positive target)
- Line endings: core.autocrlf true (CRLF on checkout, LF on commit)
- Claude Code: `CLAUDE_CODE_USE_POWERSHELL=1` set in `~/.claude/settings.json` so the Bash tool emits PowerShell-native commands (no `&&`, use `$env:VAR`, etc.). Beta flag. Note: this tooling may still invoke `powershell.exe` (5.1) even though `pwsh` is installed — 5.1 mangles quoted/multi-line args to native exes like `git.exe`, so pass multi-line commit messages via `git commit -F <file>`.
- Claude Code uses ripgrep (`rg`) for file search — its own bundled copy first, falling back to `rg` on `PATH`; if neither works it prints `Ripgrep is not available` and uses a slow built-in scanner. Mitigations in place: a stable `rg.exe` copy at `~/.local/bin\rg.exe` (next to `claude.exe`, so it's on `PATH` wherever `claude` runs and survives ripgrep version bumps), plus the `~/.local` Defender exclusion above (keeps the bundled copy from being quarantined). If a session still warns, that `claude` process was launched with a stale/stripped `PATH` — relaunch from a fresh Windows Terminal and run `/doctor`. WSL/Git-Bash don't inherit the Windows user `PATH` — install ripgrep there too if you run Claude Code from one.

## Conventions

- Use **pnpm** for new projects unless the project already uses npm or yarn
- Use **fnm** to switch Node versions — never install Node directly
- Prefer project-local tool installs (`pnpm add -D`) over global installs
- ESLint uses flat config (`eslint.config.js`) — do not generate `.eslintrc` files
- Run `npm audit` / `pnpm audit` as part of dependency management
