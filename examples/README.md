# Example configuration — what a healthy developer machine looks like

Every file in this directory is a **reference copy**, not a live one. They carry
the `.example` suffix so no CLI ever loads them by accident. Copy them to the
paths named below, replace the placeholders, and you have a conforming machine.

The audit in [`../ai-setup-audit.md`](../ai-setup-audit.md) checks a real machine
against these. When the two disagree, one of them is wrong — fix whichever is
actually wrong rather than assuming it's the machine.

---

## The one idea behind all of it

**Every rule lives in exactly one place, at the lowest layer that still covers
everyone who needs it.**

A rule in two files is worse than a rule in one, because the copies drift and
then contradict each other — and nothing tells you which one won. Most of what
goes wrong with an agent setup over time is not a missing rule. It is the same
rule, said three times, three slightly different ways.

---

## The four layers

```
┌─ MACHINE ─────────────────────────────────────────────────────────────┐
│                                                                       │
│  global-prompt.md ────────────────────┐  every repo, every CLI        │
│    (public, synced from templates)    │  ALWAYS LOADED                │
│                                       │                               │
│  global-machine.md ───────────────────┤  every repo, every CLI,       │
│    (private, mastered in ~/.claude)   │  but only THIS computer       │
│                                       │  ALWAYS LOADED                │
│                                       ▼                               │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐              │
│   │ ~/.claude/   │   │ ~/.codex/    │   │ ~/.gemini/   │              │
│   │  CLAUDE.md   │   │  AGENTS.md   │   │  GEMINI.md   │  one CLI     │
│   │  imports ────┘   │  inlines ────┘   │  imports ────┘  only        │
│   └──────────────┘   └──────────────┘   └──────────────┘  ALWAYS      │
│                                                            LOADED     │
│   ~/.claude/settings.json    ~/.codex/config.toml                     │
│     hooks, permissions, model — CONFIG, never prose                   │
│                                                                       │
│   gsd-settings.md  ai-setup-audit.md    READ ON DEMAND — free         │
│     (synced everywhere, imported nowhere)                             │
└───────────────────────────────────────────────────────────────────────┘
                                  │
┌─ REPO ───────────────────────────▼────────────────────────────────────┐
│                                                                       │
│   AGENTS.md ◄──── CLAUDE.md (pointer only: `@AGENTS.md`)              │
│     what an agent cannot infer from this codebase                     │
│     ALWAYS LOADED in this repo                                        │
│                                                                       │
│   .claude/settings.json     committed — worktree fix, repo perms      │
│   .planning/config.json     committed — all GSD behavior              │
│   .claude/settings.local.json   gitignored — THIS MACHINE only        │
│     CONFIG, never prose                                               │
└───────────────────────────────────────────────────────────────────────┘
```

---

## The placement test

Before writing a rule anywhere, answer three questions in order. The first
"no" decides where it goes.

1. **Can this be expressed as a config value instead of a sentence?**
   → Then it *must* be config, and must not also appear as prose.
   `subagent_timeout`, `use_worktrees`, `branching_strategy`, permission grants,
   hook wiring. Prose that restates config is drift with a delay fuse: the
   config changes, the sentence doesn't, and now the file lies.

2. **Does it apply to every repo?**
   → No: the repo's `AGENTS.md`.
   → Yes: continue.

3. **Does it apply to every CLI?**
   → No: that CLI's global instruction file.
   → Yes: `global-prompt.md` — unless it names a host, IP, account, or absolute
     personal path, in which case `global-machine.md`.

And one standing exception: **if it is long and rarely needed, make it
read-on-demand** instead of always-loaded. See the budget below.

### Worked examples

| Rule | Lands in | Why |
|---|---|---|
| "Subagents get 15 minutes" | `.planning/config.json` | Q1 — it's a number, not a sentence |
| "Deploy with `npm run deploy:prod`" | repo `AGENTS.md` | Q2 — one repo only |
| "The Bash tool is Git Bash, not PowerShell" | `~/.claude/CLAUDE.md` | Q3 — Claude only |
| "Never kill a process you didn't spawn" | `global-prompt.md` | all repos, all CLIs |
| "The build server is at 10.x.x.x" | `global-machine.md` | names a host |
| "How to close a milestone, in 8 gates" | `gsd-settings.md` | long, needed occasionally |

---

## Context budget

Everything in an always-loaded file is paid on **every session, forever**. This
is the one place where being concise is worth real money and real latency.

| File | Target | Notes |
|---|---|---|
| `global-prompt.md` | ~16 KB | ×3 CLIs, every session — the most expensive file here |
| `global-machine.md` | ≤ 2 KB | facts only, no guidance |
| `~/.claude/CLAUDE.md` | ≤ 4 KB | Claude-only deltas |
| `~/.codex/AGENTS.md` preamble | ≤ 4 KB | Codex-only deltas; the rest is generated |
| repo `AGENTS.md` | ≤ 6 KB | over 10 KB, go looking |
| read-on-demand files | no limit | free until opened |

**A file over budget is a prompt to look, not a defect.** The question is always
"does this belong here," never "is this too long." Going over is fine *once you
have looked* — and the finding you report is the specific misplaced content, not
the byte count.

Raising a number without doing that check is how a budget dies. When you do raise
one, say what you checked and why the content earned its place.

`global-prompt.md` was set at 10 KB by guess and is now ~16 KB. Each raise was
checked: every section is a standing behavioural rule that applies to every repo
and every CLI, so nothing is misplaced by the placement test, and the two most
verbose sections were tightened rather than the number simply moved again.

**Before adding a section here, ask whether it is a rule or a procedure.** A rule
governs behaviour continuously and has to be always-loaded. A procedure is only
needed when a specific trigger fires — closing a milestone, auditing a machine,
debugging a review lane — and belongs in a read-on-demand file behind a
three-line pointer. That distinction, not a byte count, is what keeps this file
from becoming a manual.

---

## What is in this directory

### Machine files

| Example | Copy to | Layer |
|---|---|---|
| `machine/claude/CLAUDE.md.example` | `~/.claude/CLAUDE.md` | Claude-only, always loaded |
| `machine/claude/settings.json.example` | `~/.claude/settings.json` | machine config |
| `machine/claude/global-machine.md.example` | `~/.claude/global-machine.md` | private machine facts |
| `machine/codex/AGENTS.md.example` | `~/.codex/AGENTS.md` (preamble only) | Codex-only, always loaded |
| `machine/codex/config.toml.example` | `~/.codex/config.toml` | machine config |
| `machine/gemini/GEMINI.md.example` | `~/.gemini/GEMINI.md` | Gemini-only, always loaded |

`global-prompt.md`, `gsd-settings.md`, and `ai-setup-audit.md` have no examples
here because the real files in this repo's root *are* the reference — they are
synced verbatim to every config directory by `../sync-global-prompt.ps1`. Never
hand-edit a synced copy.

### Repo files

| Example | Copy to | Layer |
|---|---|---|
| `repo/CLAUDE.md.example` | `<repo>/CLAUDE.md` | pointer only |
| `repo/AGENTS.md.example` | `<repo>/AGENTS.md` | repo instructions |
| `repo/claude-settings.json.example` | `<repo>/.claude/settings.json` | committed repo config |
| `repo/planning-config.json.example` | `<repo>/.planning/config.json` | committed GSD config |

---

## How the files reach each other

Two mechanisms, and it matters which is which:

**Import** — the file's text is pulled into context automatically, every session.
Claude (`@global-prompt.md`) and Gemini (`@./global-prompt.md`) support it. Codex
does not, so `sync-global-prompt.ps1` **inlines** the same text into
`~/.codex/AGENTS.md` below a generated marker, preserving anything above it.

**Pointer** — the file merely names another file, which an agent opens when a
trigger fires. `global-prompt.md` points at `gsd-settings.md` (milestone close,
review lanes) and `ai-setup-audit.md` (setup health). Costs nothing until used.

The rule that follows: **never import a read-on-demand file.** An `@import` of
`gsd-settings.md` would add 40 KB to every session for content needed a few times
a month. If you find one, it is a defect.

```
templates/global-prompt.md ──sync──┬──► ~/.claude/global-prompt.md ──@import──► ~/.claude/CLAUDE.md
                                   ├──► ~/.gemini/global-prompt.md ──@import──► ~/.gemini/GEMINI.md
                                   └──inline─────────────────────────────────► ~/.codex/AGENTS.md

~/.claude/global-machine.md ─sync──┬──► ~/.gemini/global-machine.md   (master lives in ~/.claude,
                                   └──inline──► ~/.codex/AGENTS.md     never in this public repo)

templates/gsd-settings.md ───sync──┬──► ~/.claude/  ┐
templates/ai-setup-audit.md ─sync──┴──► ~/.codex/   ├─ imported by NOTHING,
                                        ~/.gemini/  ┘  opened on trigger only

<repo>/CLAUDE.md ──@import──► <repo>/AGENTS.md      (every other CLI reads AGENTS.md directly)
```

---

## The three failure modes these examples exist to prevent

**1. Duplication.** The same rule in the global prompt and a repo `AGENTS.md`.
Both were right when written; one gets updated. Now an agent has two answers and
picks unpredictably. *Fix:* delete the copy at the higher layer's expense — the
more specific file wins only when it is a genuine local exception, and it should
say so explicitly.

**2. Prose restating config.** `AGENTS.md` saying "keep `security_enforcement`
set to false" while `.planning/config.json` actually holds the value. The
sentence is unenforceable and eventually false. *Fix:* delete the sentence. If
the *reason* matters, keep one line of rationale and point at the config key —
never repeat the value.

**3. Clobbering.** An installer or an agent rewrites a file and destroys
hand-written content, or writes a second copy of a managed block. Generated
regions are marked; anything inside a marker is disposable and anything outside
it is yours. *Fix:* never hand-edit inside a generated region, and never let a
file end up with two of the same marker.
