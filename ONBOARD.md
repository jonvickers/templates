# Onboarding a machine

Start here on a **new computer**, or on one that has never had these files.
Fifteen minutes, once. After that, `ai-setup-audit.md` handles everything.

Works on Windows and macOS. Where they differ, both are shown.

---

## Why this file exists

The audit tells you to run `Read ~/.claude/ai-setup-audit.md and execute it` —
but that file only appears *after* the sync script runs, and the sync script
lives in a repo you have to clone first. This is the bootstrap that closes that
loop. You only need it once per machine.

---

## 1. Install all four CLIs

**All four, not a subset.** Cross-AI review works by GSD skipping whichever tool
is hosting your session and reviewing with the other three, so a missing CLI
does not disable a feature — it quietly drops you to two reviewers on a review
that still reports success. Claude Code and Codex are what we drive day to day;
Gemini and OpenCode exist so the other two always have company
(`gsd-settings.md` §7.2).

```bash
claude   --version
codex    --version
gemini   --version
opencode --version   # npm i -g opencode-ai — needs no API key; it falls back
                     # to its own free hosted models
node     --version   # required by GSD's hooks
git      --version
gh       --version   # needed for PRs
```

If `node` is missing, install it before GSD — GSD's hooks are Node scripts and a
missing runtime disables them silently.

Being on `PATH` is not the same as working: a CLI can be installed and logged
out. Once you've cloned this repo (step 2), prove all four actually answer:

```bash
node tools/review-lane-check.js
```

## 2. Clone this repo

Anywhere you like. Most of us use `~/Code/templates`; the audit asks where if it
can't find it.

```bash
git clone <this-repo-url> ~/Code/templates
```

**Keep it current.** Everything below is generated from this clone, so a stale
clone means a stale machine. `git pull` here before any audit run.

## 3. Install GSD for Claude and Codex

```bash
npx -y @opengsd/gsd-core@latest --claude --codex
```

Confirm both landed, and at the same version:

```bash
cat ~/.claude/gsd-core/VERSION
cat ~/.codex/gsd-core/VERSION
```

A version skew between the two is a real problem — they share config files, and
the older one will hit keys it doesn't understand.

> On Codex, `~/.codex/skills/` being empty is **normal**. GSD installs Codex
> skills to `~/.agents/skills/` instead. Don't reinstall chasing that.

## 4. Create your machine file

This is the only file you write by hand, and the only one that never leaves your
machine. It holds host names, LAN IPs, account identifiers, and project ids —
the things that must stay out of this public repo.

```bash
mkdir -p ~/.claude
cp examples/machine/claude/global-machine.md.example ~/.claude/global-machine.md
```

Now open `~/.claude/global-machine.md` and replace every `<placeholder>`. Keep it
to **facts an agent cannot discover on its own**. If you skip this step the sync
still runs, but it warns and syncs the neutral prompt only — your agents will
have no idea what machines or accounts exist.

## 5. Run the sync

```bash
pwsh ./sync-global-prompt.ps1          # macOS/Linux
./sync-global-prompt.ps1               # Windows
```

(macOS: `brew install --cask powershell` if `pwsh` is missing.)

This fans `global-prompt.md`, `gsd-settings.md`, and `ai-setup-audit.md` into
`~/.claude`, `~/.codex`, and `~/.gemini`, and inlines the shared rules into
`~/.codex/AGENTS.md`. **Re-run it after every `git pull`.**

## 6. Point your CLI's instruction file at the shared rules

The sync writes the side-car files but does **not** create the instruction files
that import them — those are yours to own, because each carries CLI-specific
guidance below the imports.

```bash
cp examples/machine/claude/CLAUDE.md.example  ~/.claude/CLAUDE.md
cp examples/machine/gemini/GEMINI.md.example  ~/.gemini/GEMINI.md    # if using Gemini
```

Codex needs no copy — the sync already wrote `~/.codex/AGENTS.md`. Add any
Codex-only guidance **above** the generated marker; everything above it is
preserved on future runs, everything below is overwritten.

Read `examples/README.md` before editing any of these. It explains which layer a
rule belongs in, which is the difference between a setup that stays clean and one
that rots.

## 7. Verify, then hand over to the audit

```
Read ~/.claude/ai-setup-audit.md and execute it.
```

On a fresh machine expect findings — repos without the worktree fix, missing
per-repo config. That's the point. Work its Tier 1 and Tier 2 items and you're
current.

---

## Per repo, once

For each repo you work in, from inside it:

```
Read ~/.claude/gsd-settings.md and bring this repo into conformance.
```

That file is a work order. It sets branching, the worktree fix, and the config
baseline. Commit what it changes so the setup travels to everyone else.

---

## Keeping it current

| When | Do |
|---|---|
| Weekly | `Read ~/.claude/ai-setup-audit.md and execute it in quick mode.` |
| Weekly, from inside a repo you actually work in | `node <templates>/tools/review-lane-check.js` — all four lanes must reply. A logged-out CLI or a repo `.env` shadowing Gemini's config costs you a reviewer without any error. |
| Monthly, and after any CLI or GSD upgrade | `git pull` in this repo, re-run the sync, then run the audit in full. |
| Quarterly | Same, in deep mode. |
| After editing `global-prompt.md`, `gsd-settings.md`, or `ai-setup-audit.md` | Re-run the sync. Editing a synced copy instead of the source is the single most common mistake; the audit flags it. |

---

## If something looks wrong

- **Agents ignore a rule you added.** You edited a synced copy instead of the
  source. Edit the file in this repo and re-run the sync.
- **Codex lost your custom guidance.** It was below the generated marker. Move it
  above and re-run.
- **Parallel work is slow.** The repo is missing the worktree fix. From inside it:
  `gsd-tools worktree base-check` — anything other than `shouldDegrade: false`
  means §3 of `gsd-settings.md`.
- **Gemini drops out of reviews.** A repo that commits its own `.env` shadows the
  home config. The fix and the project id are in your `global-machine.md`.
  `tools/review-lane-check.js`, run inside that repo, is what catches it — the
  lane fails per-repo, so a pass at `~` proves nothing.
- **A review came back thinner than you expected.** A configured-but-broken
  reviewer is logged as an `info` and the review still reports success. Run the
  lane check; do not assume three lanes ran because three were available.
- **Anything else.** Run the audit in full mode and read what it says. It exists
  so nobody has to hold this in their head.
