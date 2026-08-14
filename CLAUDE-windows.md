# Windows workstation inventory

> **This is not a `CLAUDE.md`.** Despite the filename, do **not** copy it to
> `~/.claude/CLAUDE.md` — it carries no import of the shared rules, so a machine
> set up from this file gets none of them.
>
> It is a **reference inventory** of a working Windows dev box: what to install
> and which Windows-specific settings matter. Use it while standing up a machine,
> and fold anything machine-specific into `~/.claude/global-machine.md`.
>
> For the files that actually belong in a config directory, see
> [`examples/`](examples/README.md), and [`ONBOARD.md`](ONBOARD.md) for the order
> to do things in.

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
- Claude Code: `CLAUDE_CODE_USE_POWERSHELL=1` is set in `~/.claude/settings.json`. **It does not make the Bash tool emit PowerShell** — verified 2026-08-14, the Bash tool still runs Git Bash (`/bin/bash.exe`). Use the dedicated **PowerShell tool** for pwsh syntax and the **Bash tool** for POSIX; match the tool to the syntax rather than trusting the flag. Where PowerShell 5.1 is invoked it mangles quoted/multi-line args to native exes like `git.exe`, so pass multi-line commit messages via `git commit -F -` or a file.
- Claude Code uses ripgrep (`rg`) for file search — its own bundled copy first, falling back to `rg` on `PATH`; if neither works it prints `Ripgrep is not available` and uses a slow built-in scanner. Mitigations in place: a stable `rg.exe` copy at `~/.local/bin\rg.exe` (next to `claude.exe`, so it's on `PATH` wherever `claude` runs and survives ripgrep version bumps), plus the `~/.local` Defender exclusion above (keeps the bundled copy from being quarantined). If a session still warns, that `claude` process was launched with a stale/stripped `PATH` — relaunch from a fresh Windows Terminal and run `/doctor`. WSL/Git-Bash don't inherit the Windows user `PATH` — install ripgrep there too if you run Claude Code from one.

## Conventions

- Use **pnpm** for new projects unless the project already uses npm or yarn
- Use **fnm** to switch Node versions — never install Node directly
- Prefer project-local tool installs (`pnpm add -D`) over global installs
- ESLint uses flat config (`eslint.config.js`) — do not generate `.eslintrc` files
- Run `npm audit` / `pnpm audit` as part of dependency management
