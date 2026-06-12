# GSD Settings & Branching Convention

> **Purpose.** A single source of truth for how we set up GSD (Get Shit Done) on
> every repo, so configuration is consistent across projects and across the team.
> When you stand up GSD on a new repo, work through the **[New-Repo Checklist](#new-repo-checklist)**
> at the bottom, copy the config block for your repo's archetype, and apply the
> **[required worktree fix](#3-the-worktree-head-fix-required-on-every-repo)**.
>
> Distilled from the alpine-manager GSD setup, 2026-06-11. alpine-manager is the
> canonical **main-only** reference repo.

---

## Operating context — share by default

We run **many repos**, with **multiple engineers**, and **the same engineer often
works from more than one computer**. Configuration has to stay **identical across
every engineer and every machine**, or agents behave differently depending on who
cloned where. So the standing rule is:

- **Share by default.** Settings, GSD config, and env files are **committed** so
  they travel to every clone. `.planning/config.json` and `.claude/settings.json`
  are shared. Even `.env` is shared, via the `.env` + `.env.local.<hostname>`
  convention (a committed breadcrumb plus per-machine, localhost-only values).
- **Local-only files are the rare exception.** `.claude/settings.local.json`
  (gitignored) and other machine-state files should hold *only* values that are
  genuinely different per machine. If a setting is the same for everyone, it does
  **not** belong in a local file — promote it to the shared file.
- **The one hard exception: cloud / production secrets** (API keys, OAuth tokens,
  anything reaching beyond localhost) live in a secret manager — **never** in a
  committed file.

Concretely for GSD: the **worktree HEAD fix** and the **config baseline** must live
in **committed, shared** files (`.claude/settings.json`, `.planning/config.json`),
so a fresh clone on any machine is correctly and identically set up with zero
manual steps.

## If you are an agent reading this file: audit and fix this repo

Treat this file as a **work order**. If you are an agent (Claude / Codex / etc.)
and you have read this file in a repo, bring that repo into conformance now, then
report. **Do not commit unless the user asks.**

1. **Determine the archetype** ([§1](#1-the-two-repo-archetypes)). Inspect the
   default branch: `main`-only → Archetype A; a `dev`/`test`/`prod` scheme (with
   `dev` as default) → Archetype B. If genuinely ambiguous, ask the user.
2. **Reconcile `.planning/config.json`** against the
   [baseline](#4-the-common-gsd-config-baseline) using
   `gsd-tools query config-set <key> <value>` (never hand-overwrite the whole file —
   that clobbers sibling keys). Apply the common core **plus** the archetype's
   `git` block.
3. **Apply the worktree HEAD fix as a SHARED setting**
   ([§3](#3-the-worktree-head-fix-required-on-every-repo)). Ensure the **committed**
   `.claude/settings.json` (NOT `settings.local.json`) contains
   `"worktree": { "baseRef": "head" }`; create the file if missing, and confirm it
   is not gitignored. Verify: `gsd-tools worktree base-check` →
   `shouldDegrade:false, reason:"baseref-head"`.
4. **Check the landmines** ([§5](#5-settings-that-need-special-attention)):
   `subagent_timeout` must be **milliseconds** (e.g. `900000`, never `900`);
   `context_window` stays `200000` unless spawned agents truly have ≥500k context;
   `mode` should be `interactive` unless this is a trusted autonomous repo.
5. **Parallel milestones?** Do **not** change branching for it — set up a
   **workstream** per milestone instead ([§2.2](#22-parallel-work-workstreams-vs-workspaces)).
6. **Set up Graphify sanely** ([§4.1](#41-graphify-setup-required-for-gsd-graph-context)).
   Confirm the Graphify CLI is installed on this machine, GSD graphify is enabled,
   generated graph caches are gitignored, repo Graphify hooks are not installed,
   and `.graphifyignore` excludes planning/generated/tool-state noise.
7. **Promote any shared-but-local settings.** If `.claude/settings.local.json`
   holds values that are identical for everyone (e.g. workflow permission allows),
   move them to the shared `.claude/settings.json` per the operating context above.
8. **Report** what changed and what still needs a human decision. Leave committing
   to the user.

---

## TL;DR

1. **Two repo archetypes.** *Main-only* (everything integrates to `main`) and
   *dev/test/prod* (where **`dev` is the default branch**, `test`/`prod` are
   environment branches managed by CI/release — **not** by GSD).
2. **Branching strategy and parallel work are different layers.**
   `git.branching_strategy` only decides *who cuts feature branches and how often*.
   Running two milestones in parallel is solved by **workstreams**, not branching.
   When we branch at all, we branch per **phase**, never per milestone
   (see [§2.1](#21-branching-strategy--pick-by-integration-cadence-not-by-vocabulary)).
3. **The worktree HEAD fix is mandatory on every repo** that wants parallel agent
   execution — otherwise GSD silently drops to sequential whenever the local
   default branch is ahead of origin.
4. **A few settings are landmines** — read [§5](#5-settings-that-need-special-attention)
   before changing anything. The worst one: `subagent_timeout` is in
   **milliseconds**, not seconds.
5. **Graphify is local generated context, not repo source.** Keep the Graphify
   CLI installed on every engineer machine, but do not commit graph caches or
   install repo hooks. Refresh GSD context with `$gsd-graphify build`.

---

## The standard in four rules (plain English)

If you remember nothing else from this file, remember these:

1. **Count the branches, not the people.** Developer count never changes the
   branching setup — only the repo's branch layout does.
2. **Main-only repo → GSD works directly on `main`.** No feature branches, no
   merging: `branching_strategy = "none"`, `base_branch = "main"`.
3. **Dev/test/prod repo → GSD works off `dev`, and only `dev`.** GSD cuts a
   short-lived branch per phase and merges it back into `dev`:
   `branching_strategy = "phase"`, `base_branch = "dev"`. Promoting
   `dev → test → prod` is a human/CI job — GSD never touches it.
4. **Multiple people or milestones at once → add a workstream, don't change
   branching.** Workstreams give each parallel effort its own planning folder
   so state files never collide; the `git` block from rules 2–3 stays exactly
   the same.

| Repo | Branching config | Extra step |
|---|---|---|
| Single dev, main only | Rule 2 (`none` + `main`) | none |
| Multi dev, main only | Rule 2 (`none` + `main`) | one workstream per person/milestone |
| Single dev, dev/test/prod | Rule 3 (`phase` + `dev`) | none |
| Multi dev, dev/test/prod | Rule 3 (`phase` + `dev`) | one workstream per person/milestone |

Plus the one mandatory extra on every repo regardless of row: the
[worktree HEAD fix](#3-the-worktree-head-fix-required-on-every-repo) in the
committed `.claude/settings.json`, or parallel agent execution silently
degrades to sequential.

---

## 1. The two repo archetypes

### Archetype A — single-branch (`main` only)

Everything integrates straight to `main` (trunk-based). No long-lived environment
branches. This is the right default for solo / internal / small tools where deploy
is manual or from a SHA, and code review happens via cross-AI CLIs rather than a
GitHub PR gate. *Example: alpine-manager.*

- `git.base_branch = "main"`
- `git.branching_strategy = "none"` — GSD commits to whatever branch is checked
  out (i.e. `main`). You branch by hand only if you ever want to.
- Parallel milestones, if they ever happen → **workstreams** (see [§2.2](#22-parallel-work-workstreams-vs-workspaces)),
  *not* a branching-strategy change.

### Archetype B — `dev` / `test` / `prod`

Larger repos with an environment pipeline. **`dev` is the default/integration
branch**; `test` is staging; `prod` is production. Work flows
`feature → dev → test → prod`.

**Key boundary:** GSD only ever produces **short-lived feature branches that fork
from and merge back into ONE base branch.** GSD does **not** promote
`dev → test → prod` — that is your CI/release process and lives entirely outside
GSD.

- `git.base_branch = "dev"` ← point GSD at the integration branch, never `prod`.
- `git.branching_strategy = "phase"` — **the house standard**: GSD auto-creates a
  feature branch per phase off `dev` and merges it back (hands-off branching).
  - `"none"` is the documented exception, for teams that insist on cutting
    feature branches by hand off `dev` and letting GSD commit to the current
    branch.
  - `"milestone"` is **not** used — see the house decision in
    [§2.1](#21-branching-strategy--pick-by-integration-cadence-not-by-vocabulary).
- `dev → test → prod` promotion: your normal Git/CI flow. GSD never touches it.

> **"Auto-create vs manual" = who runs `git checkout -b`.**
> `phase`/`milestone` → *GSD* runs `git checkout -b` for you and offers to merge.
> `none` → *you* run `git checkout -b` (or stay on the base branch); GSD only
> commits to the current branch.

---

## 2. Branching & parallel work

### 2.1 Branching strategy — pick by integration cadence, not by vocabulary

| Strategy | Branch created | Merges back | Use when |
|---|---|---|---|
| `none` | never (GSD uses current branch) | n/a | **Our standard for main-only repos (Archetype A).** Also for teams that manage branches by hand. (GSD's shipped default.) |
| `phase` | per phase, at execute-phase start | after each phase (frequent, small) | **Our standard for dev/test/prod repos (Archetype B).** GSD-managed feature branches; works even with high code overlap between parallel work. |
| `milestone` | once per milestone | once at `complete-milestone` (one big merge) | **Not used — see house decision below.** Only theoretically defensible when parallel lines of work barely overlap in code. |

**House decision — phase, not milestone.** For repos that branch at all
(Archetype B), we branch per **phase**. The difference is how long a branch
lives before it merges back: a phase branch lives hours-to-days and merges
while the changes are fresh; a milestone branch lives for *weeks* while `dev`
keeps moving, then lands as one giant merge where all the accumulated drift
collides at once. `milestone` is defensible only when you want one clean
"PR per release" **and** parallel work barely touches the same files — and that
second condition almost never holds, least of all in multi-developer repos.
If you want a clean milestone-wide review PR anyway, you don't need milestone
branching for it: `/gsd-pr-branch` assembles one after the fact while the
day-to-day work still integrates per phase.

**Rule of thumb:** branch granularity should match how often you can integrate.
**High file overlap → integrate often → `none` (trunk) or `phase`. Avoid
long-lived `milestone` branches when work overlaps** — they maximize divergence
and produce one brutal merge.

**The truth no setting can change:** two agents editing the same file at the same
time = a Git merge conflict at integration. Branching, workstreams, and workspaces
do **not** prevent this; they only change *when* you pay it (many tiny conflicts
vs one huge one). Mitigate organizationally: partition work so streams touch
different code, pull from the base branch before each session, and give
unavoidable hot shared files (schema, shared types, config) a single owner at a
time.

### 2.2 Parallel work: workstreams vs workspaces

These are GSD's actual mechanisms for two engineers / two milestones at once.
They are **orthogonal to branching** and can be combined with it.

**Workstreams** (`/gsd-workstreams`, `--ws <name>`) — **planning isolation in one
repo.** Each milestone gets its own `.planning/workstreams/<name>/`
(STATE, ROADMAP, REQUIREMENTS, phases). Shared files (PROJECT.md, config.json,
codebase map) stay shared. Because each stream's state lives at a *different file
path*, two milestones **never collide on `STATE.md`/`ROADMAP.md`** — the conflict
plain branching cannot avoid. Session-scoped pointers keep concurrent
Claude/Codex sessions from repointing each other's state.
*Limitation:* they share one code working tree, so this is right when streams
touch different code (or run on separate clones — see below).

**Workspaces** (`/gsd-workspace --new`) — **full physical isolation.** A separate
directory with its own Git worktree/clone on its own branch
(`workspace/<name>`) **and** an independent `.planning/`. This is the
"multiple isolated checkouts on **one machine**" answer.

**How to choose:**

| Situation | Use |
|---|---|
| Two engineers on **separate machines** (= separate clones already) | **Workstreams** (one per milestone). Each clone is already its own working tree, so no workspaces needed. Each engineer's branch merges to the base branch independently. |
| Two agent/Claude sessions on **one machine**, possibly overlapping code | **Workspaces** (separate worktrees). On Windows prefer `--strategy clone` over the default worktree, given Windows worktree friction. |
| Single line of work | Neither — plain GSD. |

**Workstreams are the necessary piece for parallel committed milestones**
(they stop STATE/ROADMAP conflicts). A branching-strategy choice is *optional* on
top and does not substitute for them.

Set up when a second engineer/milestone actually starts:

```bash
gsd-tools query workstream.create <milestone-name>
# then: /gsd-new-milestone --ws <milestone-name>
```

---

## 3. The worktree HEAD fix (REQUIRED on every repo)

Parallel executor agents run in Git worktrees (`workflow.use_worktrees: true`).
By default the harness forks each worktree from **`origin/HEAD`**. The moment your
local default branch is **ahead of origin** (unpushed commits — extremely common),
the fork base mismatches and GSD **silently degrades to sequential execution**
(the "⚠ Worktree base mismatch" / exit-42 symptom). You lose all parallelism.

**Fix:** tell the harness to fork from local **HEAD** by setting
`worktree.baseRef: "head"` in `.claude/` settings. (Valid values are only
`"head"` or `"fresh"`; `"fresh"` = the default origin/HEAD behavior.)

**Resolution order (important):** GSD reads `.claude/settings.local.json` **first**,
then `.claude/settings.json`; the first file with a non-null `worktree.baseRef`
wins. `settings.local.json` is normally gitignored (machine-local), so it does
**not** travel to other clones.

**Apply it the shared way (this is the default — see
[Operating context](#operating-context--share-by-default)):**

- **Commit it to the shared `.claude/settings.json`.** This value is identical for
  everyone, so it belongs in the shared, committed file — **not** in
  `settings.local.json`, which is gitignored and never travels. Ensure the file
  contains:
  ```jsonc
  { "worktree": { "baseRef": "head" } }
  ```
  Every fresh clone, on every engineer's machine, then inherits parallel execution
  with zero manual steps. (Confirm `.claude/settings.json` is not gitignored; the
  usual ignore is only `settings.local.json`.)

- **Fallback only (stopgap on one machine):** `gsd-tools worktree set-baseref`
  writes the same key into the *local* `.claude/settings.local.json` (no-clobber,
  idempotent). Use this only if you can't edit the shared file yet — it does not
  travel to other clones, so always migrate it to the shared file. A local
  `settings.local.json` overrides the shared file when both are present.

**Verify on any clone:**

```bash
gsd-tools worktree base-check
# Want: { "shouldDegrade": false, "reason": "baseref-head", ... }
```

If you genuinely don't want worktrees at all, set `workflow.use_worktrees: false`
instead (agents run sequentially on the main tree).

---

## 4. The common GSD config baseline

Apply via `gsd-tools query config-set <key> <value>` (preserves unrelated keys),
or hand-edit `.planning/config.json`. Everything below is our house standard
unless a repo-specific note says otherwise.

### Common core (both archetypes)

```jsonc
{
  "model_profile": "quality",        // Opus everywhere except verification. Our quality-over-cost default.
  "mode": "interactive",             // "yolo" only for trusted autonomous repos (see note).
  "granularity": "standard",
  "commit_docs": true,               // planning docs tracked in git; reach the default branch on merge.

  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "code_review": true,
    "code_review_depth": "standard",
    "ui_phase": true,
    "ui_safety_gate": true,
    "ai_integration_phase": true,
    "ui_review": true,
    "plan_review_convergence": true,
    "use_worktrees": true,           // parallel executors — pair with the §3 HEAD fix.
    "node_repair": true,
    "node_repair_budget": 3,         // bumped from default 2 for self-heal robustness.
    "subagent_timeout": 900000,      // MILLISECONDS. 15 min. See §5 — do NOT write 900.
    "tdd_mode": false,
    "auto_advance": false,
    "skip_discuss": false,
    "discuss_mode": "discuss",
    "text_mode": false
  },

  "hooks": { "context_warnings": true },
  "intel":   { "enabled": true },
  "graphify":{ "enabled": true }
}
```

### Archetype A — main-only (e.g. alpine-manager)

```jsonc
"git": {
  "branching_strategy": "none",
  "base_branch": "main"
}
```

### Archetype B — dev/test/prod

```jsonc
"git": {
  "branching_strategy": "phase",   // house standard. "none" only if engineers branch by hand; never "milestone".
  "base_branch": "dev"             // the DEFAULT/integration branch — never prod
}
```

> `search_gitignored` is **repo-specific** — `true` only if you deliberately want
> broad searches to include gitignored paths (e.g. a repo that commits `.planning/`
> and wants it searchable). Default is `false`. Leave it off unless you have a
> reason.

### 4.1 Graphify setup — required for GSD graph context

GSD's `$gsd-graphify` command is a wrapper around the **Graphify CLI**. GSD does
not build graphs by itself; it shells out to `graphify update .`, then copies the
useful artifacts into `.planning/graphs/` where GSD planners/researchers look for
them. Therefore every engineer computer that should use GSD graph context needs
the Graphify CLI installed and available on `PATH`.

**Install / verify per machine:**

```bash
uv tool install graphifyy
graphify --version
# expected: graphify 0.x
```

Install the Graphify CLI for each machine before expecting `$gsd-graphify build`
to work. The official Graphify package is the PyPI package `graphifyy`
(double-y), and the installed CLI command is still `graphify`. Prefer
`uv tool install graphifyy` so the CLI lands on `PATH`; `pipx install graphifyy`
is the fallback. Do not use the unrelated `graphify` package name.

**Shared repo config:**

```jsonc
"graphify": { "enabled": true }
```

**Generated graph data stays local and ignored:**

```gitignore
graphify-out/
.planning/graphs/
```

- `graphify-out/` is Graphify's local working cache/output.
- `.planning/graphs/` is GSD's local consumable copy plus snapshot metadata.
- Neither should be committed by default. They are large generated artifacts,
  branch-specific, and easy to make stale or conflicted across machines.
- A fresh clone or second computer should run `$gsd-graphify build` locally after
  pulling the repo, switching a major branch, or before graph-heavy planning.

**Important behavior learned from production cleanup:**

- `$gsd-graphify build` uses `graphify update .` — a no-LLM AST/code update path —
  then copies `graphify-out/graph.json` and `GRAPH_REPORT.md` into
  `.planning/graphs/` and writes GSD's `.last-build-snapshot.json`.
- `graphify update .` is cheap relative to a full semantic study. It can reuse
  local caches when present. On a brand-new machine without prior `graphify-out/`,
  it still produces a useful code/AST graph for GSD, but it will not recreate any
  older rich semantic/document graph unless someone intentionally runs the
  LLM-backed Graphify extraction workflow.
- You do **not** need a shared rich graph for GSD to work better. Start with the
  local no-LLM code graph. Only consider external cache sync (OneDrive/Dropbox/
  rsync/shared drive) if a repo deliberately depends on a costly semantic graph.
  Do not put that graph cache in git by default.
- Do **not** install Graphify git hooks (`graphify hook install`) for our GSD
  baseline. They rebuild in the background after commits/checkouts, duplicate the
  manual GSD refresh path, and can create confusing local state. If a clone already
  has them, remove them:
  ```bash
  graphify hook uninstall
  graphify hook status
  # want: post-commit: not installed; post-checkout: not installed
  ```

**Recommended `.graphifyignore` baseline:**

```gitignore
# graphify output — never ingest the graph into itself.
graphify-out/

# GSD planning scaffolding — process meta, not product code.
.planning/

# Generated dependency/build artifacts — useful to rebuild, noisy in graph context.
**/generated/prisma/
**/.prisma/
package-lock.json
pnpm-lock.yaml
yarn.lock

# Local agent/tool state.
**/.claude/
.gemini/
.cursor/

# Repo-specific scratch/sandbox paths; customize per project.
Projects/JV_Ph_Play/

# Image assets are usually low-signal for code graph context.
*.png
*.jpg
*.jpeg
*.gif
*.svg
```

Adjust scratch/sandbox paths per repo. The goal is to keep graph context focused
on product code and stable architecture docs, not planning transcripts, generated
clients, lockfiles, tool settings, or experiments.

**Verification on any machine:**

Run inside the agent/GSD command space:

```text
$gsd-graphify build
$gsd-graphify status
```

Or from a shell when `gsd-tools` is on `PATH`:

```bash
gsd-tools graphify status
```

Expected status: `exists: true`, `stale: false`, `commit_stale: false`, and
`current_commit` matching `built_at_commit`.

---

## 5. Settings that need special attention

These are the ones that bite. Read before touching.

| Setting | Watch out for |
|---|---|
| **`workflow.subagent_timeout`** | **In MILLISECONDS.** The `/gsd-config --advanced` prompt mislabels it as "seconds (default 600)" — that's wrong; the runtime default is `300000` (5 min). We use `900000` (15 min) for Opus deep-reasoning headroom. **Typing `900` sets 0.9s and times out every subagent instantly.** |
| **`context_window`** | Keep `200000` unless the agents GSD *spawns* truly run a 1M-context model. Your interactive session being on a 1M model does **not** mean spawned agents are — they use the standard Opus tier (200k). Values `≥ 500000` enable adaptive context enrichment, which would overflow 200k agents → truncation → worse output. |
| **`commit_docs` + `/gsd-pr-branch`** | `commit_docs: true` keeps planning in git, and (because it's `true`) GSD does **not** strip `.planning/` at merge. But `/gsd-pr-branch` *deliberately* strips `.planning/` to make a clean review PR. If you merge **only** that stripped branch, planning never reaches the default branch. Always merge the real branch (squash/full) to land planning; use pr-branch only as a review artifact. |
| **`worktree.baseRef`** | Lives in `.claude/settings*.json`, **not** `.planning/config.json`. Required for parallel execution (see §3). Doesn't travel via git unless committed in shared `settings.json`. |
| **`workflow.use_worktrees` on Windows** | Windows has known worktree/merge friction (merge-rollback, base mismatch). The §3 HEAD fix resolves the common mismatch. If worktree merges still misbehave, set `use_worktrees: false` (sequential) as the escape hatch. |
| **`mode: "yolo"`** | Runs phases autonomously with no approval gates. Fine for a trusted single-owner repo (alpine-manager uses it). New/shared repos should usually start `"interactive"`. |
| **`git.branching_strategy: "milestone"`** | **Not our standard — don't use it.** Long-lived milestone branches maximize merge pain; prefer `none`/`phase` and integrate often. For a clean milestone-wide review PR, use `/gsd-pr-branch` instead (see §2.1). |
| **Graphify caches** | Keep `graphify-out/` and `.planning/graphs/` local/ignored. Commit `.graphifyignore`, not generated graph JSON. Install the Graphify CLI per computer; refresh with `$gsd-graphify build`; do not rely on repo hooks. |
| **`max_discuss_passes`** | Leave at `3`. Raising it increases how many rounds of questions discuss-phase asks you — more interruption, not more quality, in interactive use. |

### Deliberately left at default (don't enable without a reason)

- `workflow.plan_bounce` — off; requires an external validator script to be useful.
- `workflow.cross_ai_execution` — off; offloads execution to an external AI CLI.
- `workflow.auto_prune_state` — off; prompt-before-prune is safer.
- `model_policy.*` — unset; redundant with `model_profile: "quality"` and would
  create a second, conflicting model-selection system.
- **Runtime model tiers** — on the Claude runtime the built-in tier IDs are already
  current (`claude-opus-4-8` / `claude-sonnet-4-6` / `claude-haiku-4-5`); no
  override needed.

---

## New-Repo Checklist

Run for every new repo so GSD is set up consistently:

1. **Install / confirm GSD** is present (`gsd-tools` on PATH, or
   `node <repo>/gsd-core/bin/gsd-tools.cjs`).
2. **Pick the archetype** — main-only (A) or dev/test/prod (B).
3. **Apply the common core** config from [§4](#4-the-common-gsd-config-baseline)
   (`model_profile`, `workflow.*`, `commit_docs`, etc.).
4. **Set the `git` block** for your archetype:
   - A: `branching_strategy=none`, `base_branch=main`
   - B: `base_branch=dev`, `branching_strategy=phase` (house standard; `none`
     only for hand-managed branches — never `milestone`)
5. **Apply the worktree HEAD fix as a shared setting**
   ([§3](#3-the-worktree-head-fix-required-on-every-repo)) — put
   `worktree.baseRef: "head"` in the **committed** `.claude/settings.json` so every
   clone/machine inherits it (the `gsd-tools worktree set-baseref` command is a
   local-only fallback). Then `gsd-tools worktree base-check` → expect
   `shouldDegrade: false`.
6. **Double-check the landmines** in [§5](#5-settings-that-need-special-attention):
   `subagent_timeout` is ms (use `900000`), `context_window` stays `200000`,
   `mode` is `interactive` unless this is a trusted autonomous repo.
7. **Set up Graphify for GSD graph context** ([§4.1](#41-graphify-setup-required-for-gsd-graph-context)):
   install/verify the Graphify CLI on this machine, commit `.graphifyignore`,
   ignore `graphify-out/` and `.planning/graphs/`, uninstall Graphify git hooks,
   then run `$gsd-graphify build` locally.
8. **Parallel milestones?** Don't change branching for it — create a **workstream**
   per milestone (`gsd-tools query workstream.create <name>`) when a second
   engineer actually starts.
9. **Commit `.planning/config.json`** (and shared `.claude/settings.json`) so the
   setup travels with the repo.
