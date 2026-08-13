# Global Agent Configuration Templates

This repo holds the shared, machine-neutral instruction sources that every AI CLI
loads, plus older per-platform templates.

## Synced by `sync-global-prompt.ps1`

- `global-prompt.md` — the cross-agent, cross-repo rules. Fanned out to
  `~/.claude`, `~/.gemini` (imported as a side-car) and inlined into
  `~/.codex/AGENTS.md`.
- `gsd-settings.md` — canonical GSD config, branching, the worktree HEAD fix, and
  the milestone close ritual (§6). Copied to all three config directories but
  imported by none: it is read on demand, so it costs no context until needed.

Run `./sync-global-prompt.ps1` after editing either one. The script preserves any
CLI-specific text above the generated marker in `~/.codex/AGENTS.md`, so put
Codex-only guidance there.

`global-machine.md` — host names, LAN IPs, account and project ids — is **not**
in this repo and must never be added to it; this repo is public. Its master copy
lives in `~/.claude` and the sync script fans it out from there.

## Per-platform starter templates

- `CLAUDE-windows.md` — Windows 11, fnm, pnpm, and PowerShell
- `CLAUDE-macos.md` — macOS, nvm, Homebrew, and zsh

These predate the sync script and are starting points for a new machine, not
live sources. Copy one to the tool's global instruction location and customize
machine-local details there.

## Rules

Keep reusable guidance vendor-neutral where practical. Do not add
machine-specific credentials, absolute personal paths, or secrets to anything in
this repo.
