# Templates

Shared AI/agent configuration for the team, plus older per-platform setup guides.

## Start here

**New machine?** → **[ONBOARD.md](ONBOARD.md)**. Fifteen minutes, once.

**Existing machine, want it clean?** Paste this into any CLI:

```
Read ~/.claude/ai-setup-audit.md and execute it.
```

That is the single entry point. It audits instruction files, hooks, permissions,
GSD install integrity, parallel-execution readiness, autonomy posture, cross-CLI
alignment, stored memories, and git hygiene — and hands each repo off to the
per-repo work order. Add `in quick mode` for the weekly version.

## The live system

These four files are the system. Everything else in this repo predates it.

| File | What it is |
|---|---|
| **[ONBOARD.md](ONBOARD.md)** | Bootstrap for a new machine. Read once. |
| **[global-prompt.md](global-prompt.md)** | The cross-agent, cross-repo rules. Loaded on every session in every CLI. Public — no host names, IPs, or account ids. |
| **[gsd-settings.md](gsd-settings.md)** | Canonical GSD config, branching, the worktree fix, review lanes (§7), the milestone close ritual (§6). Also a work order: run it inside a repo to bring that repo into line. |
| **[ai-setup-audit.md](ai-setup-audit.md)** | The machine audit. Run it on a cadence. |
| **[examples/](examples/README.md)** | One reference copy of every file a machine should have, plus the layering model — which rule belongs in which file. Read `examples/README.md` before editing any instruction file. |

`global-machine.md` — host names, LAN IPs, account and project ids — is
deliberately **not** in this repo and must never be added to it; this repo is
public. Its master copy lives in `~/.claude` on each machine, and
[`examples/machine/claude/global-machine.md.example`](examples/machine/claude/global-machine.md.example)
is the starting point.

## Syncing

`./sync-global-prompt.ps1` fans `global-prompt.md`, `gsd-settings.md`, and
`ai-setup-audit.md` out to `~/.claude`, `~/.gemini`, and `~/.codex`, and inlines
the shared rules into `~/.codex/AGENTS.md` (Codex has no import mechanism). It
preserves any Codex-specific text above the generated marker.

Run it after **every** edit to those files, and after every `git pull`. Requires
`pwsh`; works on Windows and macOS.

**Edit the sources here, never a synced copy.** A copy edited in place is
overwritten on the next sync, and the audit reports it as drift.

## Rules

Keep reusable guidance vendor-neutral where practical. Never add
machine-specific credentials, absolute personal paths, or secrets to anything in
this repo.

---

## Older per-platform templates

These predate the system above. They are starting points for a new machine, not
live sources — copy and customise rather than syncing.

- [CLAUDE-windows.md](CLAUDE-windows.md) — Windows 11, fnm, pnpm, PowerShell
- [CLAUDE-macos.md](CLAUDE-macos.md) — macOS, nvm, Homebrew, zsh
- [Node.js Dev Tools — macOS](nodejs-dev-tools-macOS.md)
- [Node.js Dev Tools — Windows](nodejs-dev-tools-PC.md)
- [Hardening Azure + GitHub](Hardening-AzureGitHub.md)

### Windows PowerShell (roaming, self-healing)

A PowerShell setup that roams across machines via OneDrive and installs its own
dependencies. See the [folder README](windows-powershell/README.md).

- [Self-healing PowerShell 7 profile](windows-powershell/Microsoft.PowerShell_profile.ps1)
- [Windows PowerShell 5.1 shim profile](windows-powershell/WindowsPowerShell_5.1_shim_profile.ps1)
- [Roam Windows Terminal settings](windows-powershell/Link-WindowsTerminalSettings.ps1)
- [Windows Terminal settings example](windows-powershell/windows-terminal-settings.example.json)

### Other

- [.gitignore](.gitignore) · [.env.example](.env.example)
- [Codex AGENTS.md — Asana example](AGENTS-asana-example.md)
- [Agent prompt: fix a recurring Windows emulator memory leak](fix-emulator-memory-leak-agent-prompt.md)
