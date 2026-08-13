# Global Agent Configuration Templates

This repo holds the shared, machine-neutral instruction sources that every AI CLI
loads, plus older per-platform templates.

## Synced by `sync-global-prompt.ps1`

- `global-prompt.md` — the cross-agent, cross-repo rules. Fanned out to
  `~/.claude`, `~/.gemini` (imported as a side-car) and inlined into
  `~/.codex/AGENTS.md`.
- `gsd-settings.md` — canonical GSD config, branching, the worktree HEAD fix,
  cross-AI review lanes (§7), and the milestone close ritual (§6). Audits a
  **repo**.
- `ai-setup-audit.md` — the work order any engineer hands an AI CLI to check that
  their machine's AI setup is healthy: instruction files, hooks, permissions, GSD
  install integrity, local patches, parallel-execution readiness, autonomy
  posture, cross-CLI alignment. Audits a **machine**.

The last two are copied to all three config directories but imported by none:
they are read on demand, so they cost no context until needed. Keep the split
clean — machine-scope checks belong in `ai-setup-audit.md`, repo-scope rules in
`gsd-settings.md`, and neither should restate the other.

## `examples/` — what a healthy machine looks like

One reference copy of every file a developer should have, machine-level and
repo-level, each with an `.example` suffix so no CLI ever loads it by accident.
`examples/README.md` is the important one: it defines the **layering model**
(which rule belongs in which file), the placement test, the context budget, and
the cross-link map showing what imports what.

`ai-setup-audit.md` §9 audits a real machine against these, so the two move
together — **change an example and re-read §9**, and vice versa. When a machine
disagrees with an example, the example is not automatically right; it can go
stale too.

Nothing in `examples/` is synced anywhere. They are read, copied, and diffed by
hand or by the audit.

Run `./sync-global-prompt.ps1` after editing any of them. The script preserves any
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
