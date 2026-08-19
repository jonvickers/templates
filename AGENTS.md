# Global Agent Configuration Templates

This repo holds the shared, machine-neutral instruction sources that every AI CLI
loads, plus older per-platform reference material.

**Entry points.** `ONBOARD.md` bootstraps a new machine (read once);
`ai-setup-audit.md` keeps an existing one clean (run on a cadence). `ReadMe.md`
is the human front page and points at both. If you change how a machine gets set
up, all three need to agree.

**Naming trap.** `CLAUDE-windows.md` and `CLAUDE-macos.md` are workstation
*inventories*, not `CLAUDE.md` templates — neither imports the shared rules, so
copying one into a config directory silently produces a machine with none of
them. The real template is `examples/machine/claude/CLAUDE.md.example`. Don't
"helpfully" restore the old framing.

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

## `tools/` — the checks that turn a prose rule into an exit code

Not synced anywhere; run them from this clone or copy one into a repo.

- `review-lane-check.js` — probes all four cross-AI review lanes (claude, codex,
  gemini, opencode) with a one-token prompt and fails if any doesn't reply, then
  checks that the opencode lane is pinned to the newest Grok. Presence on `PATH`
  is not the check: a logged-out CLI, or a repo `.env` shadowing
  `~/.gemini/.env`, silently costs a reviewer on a review that still reports
  success — and a stale Grok pin still replies, so it looks like a pass. "Newest"
  is derived from the release dates in opencode's cached models.dev catalog, not
  hard-coded, so it survives the next xAI release; `--fix` rewrites the one file
  that holds it. **Run it inside a repo** — the gemini failure is repo-scoped.
- `gsd-patch-check.js` — checks every GSD install on the machine for the local
  runtime patches we carry, and reapplies them with `--fix`. Today that is the
  Windows shim fix (`open-gsd/gsd-core` #3086): without it GSD's own runner
  cannot start an npm `.cmd` shim, so every reviewer lane but `claude` dies with
  `ENOENT` — and `claude` is the lane the host skips. **Every `/gsd-update`
  reverts it**, in all repos at once, which is the whole reason this file exists.
  It reads the fix by shape rather than by our marker, so an upstream fix is left
  alone. Static half only — pair it with `review-lane-check.js`.
- `wave-width-check.js` — turns the wave-topology targets in `gsd-settings.md`
  §2.3 into an exit code. Run before dispatching a phase.

Each backs rules written elsewhere, so changing one needs the prose changed with
it: `gsd-settings.md` §7.2 (lanes and the post-update patch check) and §2.3
(wave width), plus `ai-setup-audit.md` §7 for the lane check and §4.1 for the
patch.

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
