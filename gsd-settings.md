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
   `subagent_timeout` must be **milliseconds** (`1800000`, never `1800`);
   `test_gate_timeout` is **seconds** (`900`); `context_window` stays `200000`
   unless spawned agents truly have ≥500k context; `mode` is `yolo` (§5).
5. **Parallel milestones?** Each developer needs **both** a workstream and their
   own milestone branch ([§2.2](#22-parallel-work-workstreams-vs-workspaces)) —
   the branching strategy stays `milestone` either way.
6. **Set up Graphify sanely** ([§4.1](#41-graphify-setup--required-for-gsd-graph-context)).
   Confirm the Graphify CLI is installed on this machine, GSD graphify is enabled,
   generated graph caches are gitignored, repo Graphify hooks are not installed,
   and `.graphifyignore` excludes planning/generated/tool-state noise.
7. **Promote any shared-but-local settings.** If `.claude/settings.local.json`
   holds values that are identical for everyone (e.g. workflow permission allows),
   move them to the shared `.claude/settings.json` per the operating context above.
8. **Check the reviewer set** ([§7.2](#72-the-reviewer-set--three-lanes-picked-automatically)).
   `review.default_reviewers` should be **absent** — GSD skips the host tool and
   reviews with the other three on its own, so any list hard-codes which tool is
   the host. Remove one you find, keep the per-lane pins in `review.models`, and
   confirm all four CLIs are installed on this machine.
9. **Report** what changed and what still needs a human decision. Leave committing
   to the user.

---

## TL;DR

1. **Two repo archetypes.** *Main-only* (everything integrates to `main`) and
   *dev/test/prod* (where **`dev` is the default branch**, `test`/`prod` are
   environment branches managed by CI/release — **not** by GSD).
2. **One branch per milestone, everywhere** (`branching_strategy: "milestone"`),
   paired with **one workstream per developer**. The branch keeps their code
   apart, the workstream keeps their planning files apart — you need both
   (see [§2.1](#21-branching-strategy--milestone-is-the-house-standard) and
   [§2.2](#22-parallel-work-workstreams-vs-workspaces)).
3. **The worktree HEAD fix is mandatory on every repo** that wants parallel agent
   execution — without it, worktree spawns mismatch whenever `HEAD` differs from
   `origin/HEAD`, which with milestone branching is **always**, for the whole life
   of the milestone, even fully pushed. GSD then drops to sequential or the
   executor halts with exit 42.
4. **A few settings are landmines** — read [§5](#5-settings-that-need-special-attention)
   before changing anything. The worst one: `subagent_timeout` is in
   **milliseconds**, not seconds.
5. **Graphify is local generated context, not repo source.** Keep the Graphify
   CLI installed on every engineer machine, but do not commit graph caches or
   install repo hooks. Refresh GSD context with `$gsd-graphify build`.

---

## The standard in four rules (plain English)

If you remember nothing else from this file, remember these:

1. **One branch per milestone, on every repo.** `branching_strategy =
   "milestone"`. The milestone is what we version, review, tag, and deploy, so it
   is what gets a branch.
2. **The archetype only decides where that branch starts and ends.** Main-only →
   `base_branch = "main"`. Dev/test/prod → `base_branch = "dev"`, and only `dev`;
   promoting `dev → test → prod` is a human/CI job GSD never touches.
3. **One developer per open milestone, each in their own workstream.** The
   workstream keeps their planning files apart; the milestone branch keeps their
   commits apart. You need both.
4. **Two people on the *same* milestone is the one exception.** Drop that repo to
   `branching_strategy = "phase"` — a single long-lived branch shared by two
   people is the case milestone branching handles badly.

| Repo | Branching config | Extra step |
|---|---|---|
| Single dev, main only | `milestone` + `main` | none |
| Multi dev, main only | `milestone` + `main` | one workstream per person |
| Single dev, dev/test/prod | `milestone` + `dev` | none |
| Multi dev, dev/test/prod | `milestone` + `dev` | one workstream per person |
| Several people, one milestone | `phase` + archetype's base | one workstream per person |

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
- `git.branching_strategy = "milestone"` — GSD cuts one branch per milestone off
  `main` and merges it back at `complete-milestone`. Same rule as Archetype B;
  only the base branch differs.
- Parallel milestones → **one workstream per developer** as well
  ([§2.2](#22-parallel-work-workstreams-vs-workspaces)). The branch and the
  workstream are both needed, not either/or.

### Archetype B — `dev` / `test` / `prod`

Larger repos with an environment pipeline. **`dev` is the default/integration
branch**; `test` is staging; `prod` is production. Work flows
`feature → dev → test → prod`.

**Key boundary:** GSD only ever produces **branches that fork from and merge back
into ONE base branch.** GSD does **not** promote `dev → test → prod` — that is
your CI/release process and lives entirely outside GSD.

- `git.base_branch = "dev"` ← point GSD at the integration branch, never `prod`.
- `git.branching_strategy = "milestone"` — **the house standard**: GSD
  auto-creates one branch per milestone off `dev` and merges it back at
  `complete-milestone` (hands-off branching).
  - `"phase"` is the documented exception, for a repo where several people work
    the same milestone at once ([§2.1](#21-branching-strategy--milestone-is-the-house-standard)).
  - `"none"` only for throwaway repos and spikes.
- `dev → test → prod` promotion: your normal Git/CI flow. GSD never touches it.

> **"Auto-create vs manual" = who runs `git checkout -b`.**
> `phase`/`milestone` → *GSD* runs `git checkout -b` for you and offers to merge.
> `none` → *you* run `git checkout -b` (or stay on the base branch); GSD only
> commits to the current branch.

---

## 2. Branching & parallel work

### 2.1 Branching strategy — milestone is the house standard

| Strategy | Branch created | Merges back | Use when |
|---|---|---|---|
| `milestone` | once per milestone, at its first execute-phase | once at `complete-milestone` | **Our standard, on every repo and every archetype.** One developer owns one milestone; the milestone is the unit of review and release. |
| `phase` | per phase, at execute-phase start | after each phase | Fallback when one milestone is genuinely worked by several people at once, so a single shared milestone branch would collide. |
| `none` | never (GSD uses current branch) | n/a | Throwaway repos, spikes, and sandboxes where no review gate exists. GSD's shipped default — not ours. |

**House decision — milestone.** It matches how we actually work: one developer
takes a milestone (`v1.1`, `v1.2`, …) in their own workstream, works it to
completion, and lands it as one reviewable unit. GSD names the branch from
`milestone_branch_template`, so every phase in that milestone reuses one branch
(`gsd/v2.6-milestone`) and `complete-milestone` merges it.

Why this beats per-phase branching for us: the milestone is the thing we version,
tag, review, and deploy. Branching per phase splits one deliverable across a
half-dozen short branches that each land separately, so there is no single place
to review `v2.6` before it reaches `dev`, and the version tag ends up describing
commits that arrived piecemeal.

**One developer per milestone is what makes this safe.** Milestone branches are
long-lived, so the cost is drift: `dev` keeps moving while the branch is open, and
everything that diverged collides at the merge. That cost stays small only when
each open milestone is owned by one person and touches a distinct area. If two
people must work the *same* milestone at once, drop that repo to `phase` — a
shared long-lived branch is the one case milestone branching handles badly.

**Pull from the base branch regularly while a milestone is open.** This is the
whole mitigation for drift, and it is a habit, not a setting.

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

**Workstreams and milestone branching are both required, and they solve different
halves of the same problem.** A workstream isolates *planning* — each developer's
`STATE.md` / `ROADMAP.md` lives at its own path, so two open milestones never
collide on a planning file. The milestone branch isolates *code* — each
developer's commits land on their own branch until the milestone is merged.

Use them together, one of each per developer:

| Developer | Workstream | Milestone branch |
|---|---|---|
| first | `.planning/workstreams/jv/` | `gsd/v2.6-milestone` |
| second | `.planning/workstreams/jw/` | `gsd/v2.7-milestone` |

Neither substitutes for the other. Workstreams alone leave both developers
committing to the same branch; a milestone branch alone leaves them fighting over
`STATE.md`.

Set up when a second engineer actually starts:

```bash
gsd-tools query workstream.create <name>
# then: /gsd-new-milestone --ws <name>
```

### 2.2.1 Name workstreams after people, not topics

A lane exists to keep two concurrent efforts from colliding on one `STATE.md`,
and that maps to **who** is working, not what they are working on. Use lowercase
initials — `jv`, `ym`, `jm`, `jw`.

A person's lane carries milestone after milestone: the same `jv` lane runs v2.1,
then v2.4, then v2.6, with each closed milestone archived under
`.planning/workstreams/jv/milestones/`. A lane named after a topic hosts exactly
one milestone and is a dead directory ever after — don't create one by default.

**The single exception:** `STATE.md` holds one `milestone:` field, so one person
cannot run two milestones concurrently in one lane. That overflow case — and only
that case — justifies a topic-suffixed lane like `jv-db-scaling`. Retire it when
its milestone ships rather than leaving a permanent extra lane standing.

In a repo with workstreams, pass `--ws <name>` on **every** GSD command. There is
no root-level `.planning/STATE.md`, so omitting the flag makes `gsd-tools` fail
with `STATE.md not found` rather than silently reading the wrong lane.

### 2.3 Planning for parallel execution — wave width

**This is the single biggest cause of `/gsd-autonomous` stopping constantly, and
it is fixed at planning time. No runtime setting compensates for it.**

GSD runs plans concurrently only **within a wave**. `parallelization: true` and
`use_worktrees: true` give you the capability; the plan topology decides whether
there is anything to parallelize. A phase planned as a near-serial chain executes
serially no matter how many agents are available — measured across five
consecutive phases in one repo, every one had been planned as mostly one-plan
waves while `parallelization: true` had been set the entire time.

**Targets when planning a phase:**

- **Median wave width ≥ 3.** A phase whose waves are mostly one plan will execute
  single-file regardless of available agents.
- **At most a third of waves may hold a single plan.** Those should be genuine
  serialization points — a migration, a contract freeze — not the default.
- **Every plan declares accurate `files_modified`.** Two plans in one wave sharing
  any file silently drops that wave to sequential, and an **empty** list defeats
  the overlap check entirely.
- **Hoist decisions to the front.** Human approvals, paid-call gates, and
  production effects belong at the start of a phase or in their own phase — never
  mid-chain. A gate buried at wave 12 of 36 blocks 24 waves of work behind it.
  Checkpoints, not agent count, are the real serializer.

Read the topology before dispatching:

```bash
gsd-tools phase-plan-index <phase> --json     # plan count, waves, widths
```

**Run the gate, not your judgement.** Prose targets have a poor track record —
these exact ones sat in that repo's `AGENTS.md` for months while every phase
shipped one-plan waves. `templates/tools/wave-width-check.js` turns them into an
exit code:

```bash
node <templates>/tools/wave-width-check.js .planning/phases/<phase-dir>
node <templates>/tools/wave-width-check.js --all --json     # sweep every phase
```

It reports plan count, wave widths, median width, single-plan-wave fraction,
plans missing `files_modified`, and intra-wave file overlaps, and exits non-zero
when the phase will not run wide. Phases under 5 plans are exempt from the width
targets — a 2-plan phase cannot reach median 3 — but are still checked for the
other two defects. It is repo-agnostic: point it at any `.planning` phase
directory, workstream layouts included.

Copy it into a repo (`scripts/gsd-checks/`) and name it in that repo's
`AGENTS.md` if you want it local, or run it from the templates clone. Either way,
**run it before dispatching a phase.**

**If the topology is bad, replan before executing.** Group work into bounded
ownership lanes with disjoint file sets. Splitting the roadmap phase is a last
resort, for when the plans genuinely cannot run as lanes.

**When a phase is honestly serial** — each step consumes the previous step's
output — say so in the plan and keep it short. A genuinely serial 6-plan phase is
fine; a 55-plan serial phase is a planning failure, not a hard problem.

**Before starting an autonomous run**, confirm there is enough parallel work to be
worth it. A milestone with one phase left, or one blocked phase, gives autonomous
nothing to do — it will start, hit the wall, and stop. That is not a tooling
fault, and re-running will not help.

Finally, don't let gap-closure replanning grow a phase without bound. If executing
a phase keeps appending new plans instead of retiring incomplete ones, stop and
re-scope the phase rather than continuing to plan.

### 2.4 Picking the next milestone version

With milestone branching, the version is also a branch name, so two people
choosing the same number collide on a shared branch. Resolve it from the remote,
not from memory, and never make the user do it:

1. `git fetch origin --prune`.
2. Inspect `.planning/MILESTONES.md` **and** remote `origin/gsd/v*` branches.
3. **Also check local worktrees.** `git worktree list`, then for each one read
   `git log --oneline <base>..HEAD` and its `ROADMAP.md`. Remote branches alone
   are not sufficient evidence — see the hole below.
4. Treat every remote *and* locally-claimed version as **reserved**, even before
   merge.
5. Select the next unused version after the highest reserved one.
6. Re-check immediately before the first push, and renumber on collision.
7. **Push the milestone branch the moment it is initialized** — before research,
   requirements, or roadmap. That is what closes the hole for everyone else.

If the remote cannot be fetched, **stop before assigning a version** rather than
risk two active milestones with the same number.

> **The hole this closes.** A remote-only check cannot see a version claimed in a
> concurrent agent's *unpushed* worktree. Hit for real on dental-payz,
> 2026-08-11: another agent had already built v2.5 — research, requirements,
> roadmap, five commits — inside a local worktree. `git branch -r` showed v2.4 as
> the highest, so v2.5 was claimed twice and had to be renumbered to v2.6. Phase
> numbers are consumed globally across workstreams, so a collision costs both the
> version and the phase range.
>
> **Related shared-file hazard.** `.planning/research/` is shared, *not*
> per-workstream. Two concurrent milestones will overwrite each other there.
> Scope research into a subdirectory per milestone
> (`research/v2.6-payment-portal/`). `STATE.md`, `ROADMAP.md`, and
> `REQUIREMENTS.md` under each workstream are also touched by both — expect a
> hand-merge, and merge the earlier milestone first.

---

## 3. The worktree HEAD fix (REQUIRED on every repo)

Parallel executor agents run in Git worktrees (`workflow.use_worktrees: true`).
By default the harness forks each worktree from **`origin/HEAD`** — *not* from the
branch you are working on. Any time `HEAD ≠ origin/HEAD`, the fork base mismatches.
That happens whenever the default branch has unpushed commits — and with our
`branching_strategy: "milestone"` standard it is **guaranteed for the entire life
of every milestone**, because the milestone branch is by construction ahead of
`origin/HEAD` (phase commits, pre-dispatch PLAN.md commits). Pushing doesn't help:
a milestone branch is never `origin/HEAD`. This is why the fix is mandatory on
every repo rather than a tuning option. (Verified live on dental-payz,
2026-06-12: a worktree spawned from a working branch came up on the `dev` tip,
not the branch HEAD.)

Same root cause, two symptoms depending on the workflow:

- **execute-phase** detects it up front (`worktree base-check`) and **silently
  degrades to sequential execution** ("⚠ Worktree base mismatch"). You lose all
  parallelism.
- **quick tasks** detect it inside the spawned worktree: the executor **halts
  fail-closed with exit 42** ("FATAL: worktree base mismatch") and the
  orchestrator must recover or rerun on the main tree. Nothing is lost, but the
  run stalls.

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
  usual ignore is only `settings.local.json`.) The setting takes effect
  **immediately** for new worktree spawns — no Claude session restart needed.

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

Note `base-check` short-circuits the moment the *setting* reads `"head"` — it
verifies configuration, not harness behavior. For a definitive end-to-end check,
spawn a worktree-isolated agent that runs `git rev-parse HEAD` and compare its
output to the main repo's `git rev-parse HEAD` — they must match exactly.

**Don't rely on user-level settings.** Putting `worktree.baseRef` only in the
user-level `~/.claude/settings.json` is not enough: GSD's `base-check` reads only
the *repo's* `.claude/settings.local.json` and `.claude/settings.json`, so a
user-level value is invisible to GSD and execute-phase will still degrade to
sequential even if the harness forks correctly. Set it per-repo in the committed
shared file.

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
  "mode": "yolo",                    // house default — no approval gates between phases (§5).
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
    "subagent_timeout": 1800000,     // MILLISECONDS. 30 min. See §5 — do NOT write 1800.
    "test_gate_timeout": 900,        // SECONDS. 15 min. Yes, different unit from above. §5.
    "tdd_mode": false,

    // Leave false. Whether phases chain is decided by the COMMAND the engineer
    // runs, not by config — /gsd-autonomous chains, /gsd-execute-phase does one
    // phase. Setting this true takes that choice away from whoever starts the
    // work and applies it to everyone in the repo.
    "auto_advance": false,
    "skip_discuss": false,
    "discuss_mode": "discuss",
    "text_mode": false
  },

  "hooks": { "context_warnings": true },
  "intel":   { "enabled": true },

  // Pin a model per lane; never list default_reviewers (§7.2 — GSD already
  // skips the host tool and reviews with the other three).
  "review":  { "models": { "codex": null, "gemini": null,
                           "claude": "sonnet", "opencode": "xai/grok-4.6" } },

  // build_timeout lives HERE, not under workflow. GSD reads
  // config.graphify.build_timeout straight off the repo's config.json
  // (gsd-core/bin/lib/graphify.cjs). A copy under `workflow` is never read,
  // so the build silently stays at the 300 s default.
  "graphify":{ "enabled": true, "build_timeout": 900 }   // SECONDS. 15 min.
}
```

### Archetype A — main-only (e.g. alpine-manager)

```jsonc
"git": {
  "branching_strategy": "milestone",   // house standard, every repo (§2.1)
  "base_branch": "main",
  "milestone_branch_template": "gsd/{milestone}-milestone",
  "create_tag": true                   // tag the version at complete-milestone (§6.6)
}
```

### Archetype B — dev/test/prod

```jsonc
"git": {
  "branching_strategy": "milestone",   // house standard, every repo (§2.1)
  "base_branch": "dev",                // the DEFAULT/integration branch — never prod
  "milestone_branch_template": "gsd/{milestone}-milestone",
  "create_tag": true
}
```

The archetype changes **only** `base_branch`. Branching strategy is the same
everywhere; use `phase` solely for the exception in [§2.1](#21-branching-strategy--milestone-is-the-house-standard)
(several people working one milestone at once).

Keep `milestone_branch_template` identical across repos so branch names are
predictable — `gsd/v2.6-milestone`, not a per-repo variant. A repo carrying two
naming patterns at once (`gsd/v2.5-milestone` alongside
`gsd/v2.5-some-slug`) has had the template changed mid-flight; pick one and let
the old branches age out.

> `search_gitignored` is **repo-specific** — `true` only if you deliberately want
> broad searches to include gitignored paths (e.g. a repo that commits `.planning/`
> and wants it searchable). Default is `false`. Leave it off unless you have a
> reason.

#### The machine-level defaults file — and what it cannot do

`~/.gsd/defaults.json` looks like a machine-wide override. It is not, and
assuming otherwise is why repos keep coming up wrong. Two limits, both verified
against `gsd-core/bin/lib/config-loader.cjs`:

**1. It is only read when a directory has no `.planning/` at all.** The
global-defaults branch sits *after* the checks for a project config, so the file
seeds a project at init and is never consulted again. Editing it does **nothing**
for any repo that already exists. Those are fixed one repo at a time.

**2. It forwards a fixed allow-list of keys, and most nested blocks are not on
it.** `git` is the headline case — the whole block, `branching_strategy`
included, is silently dropped, so **milestone branching cannot be defaulted
machine-wide**. But `workflow`, `intel`, `graphify`, `hooks`, and `plan_review`
are dropped the same way, which is the trap: the file *looks* like a config
baseline and a `workflow` block written there does nothing at all.

The forwarding reads **top-level** keys. `subagent_timeout` works because it sits
at the top level; the identically-named `workflow.subagent_timeout` does not.
Same for `research`, `verifier`, `plan_checker`, and `nyquist_validation` — top
level forwards, nested under `workflow` does not. (`post_planning_gaps` is the
lone key checked in both places.) `test_gate_timeout` is not forwarded at all.

To see what a given machine actually seeds, list the file's keys against the
forwarded set rather than assuming:

```bash
node -e "
const d=require(process.env.HOME+'/.gsd/defaults.json');
const fwd=['model_profile','commit_docs','research','plan_checker','verifier',
 'nyquist_validation','post_planning_gaps','parallelization','text_mode',
 'resolve_model_ids','context_window','subagent_timeout','model_overrides','models',
 'granularity','granularities','planning','dynamic_routing','effort','fast_mode',
 'agent_skills','response_language','runtime','model_profile_overrides','model_policy'];
const k=Object.keys(d);
console.log('seeds :', k.filter(x=>fwd.includes(x)).join(', '));
console.log('inert :', k.filter(x=>!fwd.includes(x)).join(', '));
"
```

**Do keep `model_profile: "quality"` and `runtime` correct there**, since those
two *are* forwarded and a wrong value quietly starts every new repo off-baseline
— exactly how one repo here spent months on `adaptive`.

The practical consequence: **every new repo starts from GSD's shipped defaults**
— `branching_strategy: "none"` and `milestone_branch_template:
"gsd/{milestone}-{slug}"`, neither of which is ours. Setting the `git` block per
the archetype above is a required step of the [New-Repo Checklist](#new-repo-checklist),
not a nicety, and no machine-level configuration can do it for you.

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
| **The two timeouts use different units** | `subagent_timeout` is **milliseconds**, `test_gate_timeout` is **seconds**. Ours are 30 minutes and 15 minutes, written `1800000` and `900`. Reading one and copying the number into the other gives you 1.8 s or 250 hours. Check the unit every time. |
| **`workflow.test_gate_timeout`** | **Seconds**, default 600. We use `900` (15 min), matching the subagent timeout and the wall-clock rule. Note what it is *for*: it detects a suite stuck in watch mode (vitest without `--run`), not a test budget. Raising it trades slower hang detection for not killing a legitimately long suite — worth it, but don't push it far past the point where a real suite finishes. |
| **A slow subagent is not a stalled one** | `subagent_timeout` bounds a subagent that is *doing work*, and deep planning legitimately runs long — a dental-payz Phase 30 planner finished a 23 KB plan at 14:59 of what was then a 15-minute ceiling — which is why it is now 30. **Before treating a quiet agent as failed, check the phase directory for the artifact.** A completion message can be lost while the file is already on disk; recover it rather than re-planning. Never restart work that finished. |
| **`workflow.subagent_timeout`** | **In MILLISECONDS.** The `/gsd-config --advanced` prompt mislabels it as "seconds (default 600)" — that's wrong; the runtime default is `300000` (5 min). We use `1800000` (30 min) for Opus deep-reasoning headroom. **Typing `900` sets 0.9s and times out every subagent instantly.** |
| **`context_window`** | Keep `200000` unless the agents GSD *spawns* truly run a 1M-context model. Your interactive session being on a 1M model does **not** mean spawned agents are — they use the standard Opus tier (200k). Values `≥ 500000` enable adaptive context enrichment, which would overflow 200k agents → truncation → worse output. |
| **`commit_docs` + `/gsd-pr-branch`** | `commit_docs: true` keeps planning in git, and (because it's `true`) GSD does **not** strip `.planning/` at merge. But `/gsd-pr-branch` *deliberately* strips `.planning/` to make a clean review PR. If you merge **only** that stripped branch, planning never reaches the default branch. Always merge the real branch (squash/full) to land planning; use pr-branch only as a review artifact. |
| **`worktree.baseRef`** | Lives in `.claude/settings*.json`, **not** `.planning/config.json`. Required for parallel execution (see §3). With `branching_strategy: "milestone"` (or `"phase"`) the mismatch is otherwise *guaranteed* — a milestone branch is never `origin/HEAD`. **Resolution is a 3-layer cascade, first non-null wins:** repo `.claude/settings.local.json` → repo `.claude/settings.json` → user `~/.claude/settings.json`. Note what is *absent*: `~/.claude/settings.local.json` is never read. Layers 1 and 3 both work on your machine, which is exactly the trap — the repo looks configured to you and silently degrades on a teammate's fresh clone. Put it in layer 2, the committed repo file, so it travels. |
| **`workflow.use_worktrees` on Windows** | Windows has known worktree/merge friction (merge-rollback, base mismatch). The §3 HEAD fix resolves the common mismatch. If worktree merges still misbehave, set `use_worktrees: false` (sequential) as the escape hatch. |
| **`mode: "yolo"`** | Runs phases with no approval gates. **This is our default**, on shared multi-engineer repos included — the approval prompt was never the thing keeping us safe. What keeps us safe is the not-reversible stop list in `global-prompt.md`, which applies regardless of mode. Use `"interactive"` only for a repo whose deploy path you have not verified yet, and treat that as temporary. |
| **`git.branching_strategy: "milestone"`** | Our standard (§2.1), and it carries one real cost: the branch is long-lived, so `dev` drifts underneath it. Pull from the base branch regularly while the milestone is open, and keep one developer per open milestone. Two people on one milestone → use `phase` for that repo. |
| **`git.milestone_branch_template`** | Changing it mid-project orphans the branch GSD was already using — the next execute-phase creates a *second* branch for the same milestone under the new name and the earlier work sits on the old one. Change it only between milestones. |
| **Graphify caches** | Keep `graphify-out/` and `.planning/graphs/` local/ignored. Commit `.graphifyignore`, not generated graph JSON. Install the Graphify CLI per computer; refresh with `$gsd-graphify build`; do not rely on repo hooks. |
| **`max_discuss_passes`** | Leave at `3`. Raising it increases how many rounds of questions discuss-phase asks you — more interruption, not more quality, in interactive use. |

### Deliberately left at default (don't enable without a reason)

- `workflow.plan_bounce` — off; requires an external validator script to be useful.
- `workflow.cross_ai_execution` — **off, and keep it off** (see §7.1 for why).
  Pipes a plan to an external AI CLI to implement instead of GSD's own executor.
- `workflow.auto_prune_state` — off; prompt-before-prune is safer.
- `model_policy.*` — unset; redundant with `model_profile: "quality"` and would
  create a second, conflicting model-selection system.
- **`effort.*` — leave the whole block out.** With no block, GSD uses its shipped
  per-tier defaults: `light: low`, `standard: high`, `heavy: xhigh`, default
  `high`. Every repo-level block we have found was a blanket *downgrade* of
  those, usually written once and never revisited, then partly undone again by
  `agent_overrides` pushing individual agents back up. Resolution order is
  `agent_overrides` → `routing_tier_defaults` → `default` → manifest, so a block
  that sets `routing_tier_defaults` replaces the shipped tiers wholesale rather
  than adjusting them.

  **It is worse than "wholesale" — the block's mere presence flattens the
  manifest.** Measured on 2026-08-19 against a `model_profile: quality` repo,
  changing nothing but the `effort` key:

  | config | `gsd-planner` | `gsd-plan-checker` |
  |---|---|---|
  | no `effort` key | `xhigh` | `low` |
  | `"effort": {}` | **`high`** | `high` |
  | `"effort": {"agent_overrides": {"gsd-plan-checker": "high"}}` | **`high`** | `high` |
  | `"effort": {"default": "xhigh", …}` | `xhigh` | `high` |

  An empty object is enough. Once the key exists every agent without an explicit
  override resolves to `effort.default` (itself defaulting to `high`), so the
  per-agent tiers GSD shipped stop being consulted at all. There is no surgical
  `agent_overrides`-only edit: raising one agent silently drops the planner a
  tier, and restoring the planner with `default: "xhigh"` raises the executor,
  the verifier, and the code reviewer to `xhigh` along with it.

  This is the reason §7.3 tells you to run a high-effort Grok review by hand
  rather than configure one — the review lanes take their effort from
  `gsd-plan-checker`, and there is no way to raise that alone.

  **Absent does not mean "inherits your session."** GSD never reads the host
  CLI's effort setting — `effortLevel` appears nowhere in `gsd-core`. Spawned
  agents run at the manifest tier for their role no matter what you set your own
  session to, so dialling your session down to save tokens does not make a
  planner cheaper. Check what a repo actually resolves rather than assuming:

  ```bash
  gsd-tools resolve-model gsd-planner     # want: opus / xhigh
  ```
- **Runtime model tiers** — no override needed on Claude, but not for the reason
  this file used to give. GSD hands the Claude runtime an **alias**, not a pinned
  ID: `gsd-tools resolve-model gsd-planner` returns `opus`, and Claude Code maps
  that to whatever the current Opus is. The pinned IDs in GSD's shipped
  `model-catalog.json` do go stale — it still lists `claude-opus-4-8` as top-tier
  Opus — but on this runtime they are never reached. Confirm with `resolve-model`
  rather than reading the catalog; a runtime *without* native aliases would use
  those IDs and the staleness would be real there.

---

## 6. Milestone close ritual

**Trigger:** a GSD milestone is being closed — `/gsd-complete-milestone`, "close
the milestone", or the last phase of a milestone passing verification.

**Rule:** run gates §6.1 through §6.8 in order. Do not report the milestone closed
until the last gate passes clean.

**Run the whole ritual autonomously.** It is housekeeping with a known-good end
state, not a series of decisions. Do not stop between gates to ask permission to
continue, and do not ask me to authorize routine deploy spend
(see *Spend authorization* in `global-prompt.md`). Stop only for the three things
this file says to stop for: unmerged or unpushed work you did not create, a
public-repo secret, or the same failure surviving two fix attempts.

**Repo-specific inputs** — the deploy command, the test command, the environment
URLs, and the tag scheme — live in that repo's `AGENTS.md`. If they aren't
written down, ask once, then write them there so the next close doesn't ask
again.

### 6.1 Worktrees

`git worktree list` and `git worktree prune --dry-run` first — look before removing.

- Remove only worktrees whose branch is merged and whose tree is clean, via
  `git worktree remove`. `--force` only after inspecting for uncommitted work.
- **Escalate to debugging** (don't just clean) if: `.git/worktrees/` has entries
  with no directory on disk; a worktree HEAD is detached or points at a deleted
  branch; `git status` inside a worktree errors; worktree count exceeds active
  workstreams; or the baseref-head degrade check fails. Fix the root cause per
  [§3](#3-the-worktree-head-fix-required-on-every-repo), then resume cleanup.

### 6.2 Branches

- `git fetch --prune`, then delete local branches that are fully merged into the
  base branch **and** have no worktree attached **and** are pushed or `[gone]`.
- Unmerged or unpushed branch: show its name and last commit and ask. Never
  guess.
- Remote branches: only delete ones this milestone created.

### 6.3 Tracking gaps — sweep twice

- `git status --porcelain -uall` and `git ls-files --others --exclude-standard`.
  Classify every hit: real source, config, or planning artifact → `git add`;
  build output or cache → gitignore.
- Also catch the reverse — files wrongly ignored. Scan `git status --ignored
  --porcelain` for source-looking paths and confirm with `git check-ignore -v`.

**Sweep again immediately before the final commit in §6.6, not just here.** The
close ritual itself creates files after this gate runs — review write-ups,
verification reports, audit output, summaries. A single sweep at the start
cannot see them, and anything still untracked when the milestone archives is
gone: `complete-milestone` moves phase directories under
`.planning/milestones/`, and an untracked file does not move with them.

This is not hypothetical. A dental-payz Phase 30 cross-AI review — the
reviewers' full reasoning about that plan — was written after §6.3 had already
passed, never tracked, and did not survive the archive. The plans and summaries
were committed and fine; what was lost was the record of *why* the plan looked
the way it did, which is exactly what you want six months later.

So the second sweep is a gate, not a courtesy:

```bash
git status --porcelain -uall          # must be empty, or every entry justified
```

Anything left must be a deliberate gitignore, decided out loud — never an
oversight. `commit_docs: true` means planning artifacts are tracked; a review or
report you are about to discard is a decision, and it needs saying.

### 6.4 Env files

- Determine visibility: `gh repo view --json isPrivate -q .isPrivate`.
- **Private repo:** the `.env` + `.env.local.<hostname>` files described in
  *Operating context* above are *meant* to be committed. Add them if untracked,
  and remove blanket `.env*` gitignore rules that shadow them.
- **Public repo:** the opposite. Stop and flag before anything is pushed.

### 6.5 GSD settings coherence

Audit the repo's `.planning/config.json` plus the global GSD defaults against this
file. Assert:

- Parallel work is coherent end to end: `parallelization` and
  `workflow.use_worktrees` are on, `git.branching_strategy` is `milestone`
  (or `phase` for the documented exception), and `git.base_branch` matches the
  archetype ([§1](#1-the-two-repo-archetypes), [§2](#2-branching--parallel-work)).
- Every open milestone has exactly one owner, and every owner has their own
  workstream ([§2.2](#22-parallel-work-workstreams-vs-workspaces)). Two people on
  one milestone branch is the drift case §2.1 warns about.
- The worktree HEAD fix is present
  ([§3](#3-the-worktree-head-fix-required-on-every-repo)).
- `claude_md_path` points at a file that actually exists.
- Review lanes and model pins are sane ([§7](#7-cross-ai-review-lanes)) — no
  stale or garbage entries.
- No duplicated or contradicting guidance across `.planning/config.json`, the
  repo's `AGENTS.md`, and the global instruction file. Most specific wins;
  delete the redundant copy rather than keeping both.

Commit any drift fixes separately as `chore(planning):`.

### 6.6 Commit → push → merge → tag → deploy → watch → test

Work these in order, one environment at a time. A failing environment blocks
promotion to the next.

1. **Re-sweep, then commit.** Run the §6.3 second sweep first — the gates above
   this one produce files, and `git status --porcelain -uall` must come back
   empty or every remaining entry must be a decision you state out loud. Then
   commit everything outstanding, atomic, conventional messages.
2. **Push** the milestone branch.
3. **Merge** into the base branch per archetype, then promote all the way to
   production — Archetype A: into `main`; Archetype B: `dev` → `test` → `prod`.
   Use a PR where the repo expects one. Never force-push a shared branch.
4. **Tag** the milestone on the base branch once the merge has landed, and push
   the tag. With `git.create_tag: true` (our baseline, §4) `complete-milestone`
   creates it for you — confirm it exists and is pushed rather than making a
   second one. If you are tagging by hand, read the repo's existing scheme with
   `git tag --list` and match it exactly rather than inventing one; annotated
   (`git tag -a`) naming the milestone is the default. If the repo has never been
   tagged, ask once and record the answer in its `AGENTS.md`.
5. **Check for a freeze, then deploy.** Look at the repo's memory, `.planning/`
   notes, and `STATE.md` for an active production freeze *before* deploying —
   they are temporary, so they are never in `AGENTS.md`. If one is active, stop
   and report it; the close ends there.

   Otherwise deploy each environment you promoted into, using the repo's
   documented command, and **promote all the way to production without asking**
   where the repo has a staging/test slot and a swap: deploy, test the slot,
   swap, test prod. See *Deploying to production* in `global-prompt.md` for the
   reversibility test and the short list of things that still stop.
6. **Watch the deploy to completion.** Firing the command is not deploying.
   Follow the build/release until it reports a terminal state — stream the
   provider's logs, poll the deployment status, or watch the CI run. A deploy
   that is still building is not a deploy that succeeded, and a green command
   exit is not a green deploy.
7. **Test for real**, against the milestone's UAT criteria:
   - **Web UI → drive the browser yourself.** Load the deployed URL, look at the
     rendered page, click the paths this milestone touched, and read the console
     for errors. A 200 from `curl` is not evidence the interface works.
   - **API** → curl the endpoint. **Data** → query it.
   - Keep the screenshot, response, or log as evidence.
8. **Re-run the same checks against production** after the prod deploy. A green
   `test` environment is not evidence that prod is up.
9. If production is broken and the fix isn't immediate, **roll prod back** to the
   last good deploy first, then fix forward on a lower environment.

### 6.7 Fix deployment failures yourself, then repeat

Any failure in gate 6.6 — including a failed build, a failed deploy, and a broken
page after a successful deploy — is yours to fix. Read the deploy logs, find the
root cause, fix it, commit, and re-run from the earliest affected gate. Loop until
one clean pass, and re-drive the browser after every fix rather than assuming the
last failure was the only one.

Do not hand me a deploy error and wait. Do not report the milestone closed with a
deploy still red. Stop and report only when the **same** failure survives two
distinct fix attempts — then give the exact error, both attempts, and what you
think is blocking it.

### 6.8 Reporting

Five lines max: what merged, what deployed where, what was tested, what was
fixed, what's left.

---

## 7. Cross-AI: review yes, execution no

### 7.1 Other AIs review our work. They never write it.

**Cross-AI is for critique, not implementation.** Independent models catch what
one model misses, so a review lane is worth its runtime. Handing the same model
an implementation lane is not — you trade a more capable, fully-guarded executor
for a less capable, unguarded one.

Concretely: **Claude Code is the implementation runtime. Codex, Gemini, and
opencode/grok are convergence reviewers only. Never give them an implementation
lane.**

`workflow.cross_ai_execution` is the setting that would break this. It pipes a
plan's objective and tasks to an external CLI over stdin and lets that tool write
the code. It stays **off**, on every repo, and turning it on is not a tuning
decision — it costs four things at once:

- **Parallelism.** Cross-AI plans run *sequentially*, discarding the wave
  topology §2.3 exists to protect.
- **Isolation.** GSD's executors run in harness worktrees with the typed persona
  and the branch, write, and path guards. An external CLI runs in the main
  working tree — the workflow literally warns about a dirty tree before invoking
  it — so it can collide with anything else in flight.
- **Time.** It is bounded by `cross_ai_timeout`, default **300 s**. That is the
  one place that setting applies. Five minutes for a real implementation task,
  then killed.
- **Model quality.** `model_profile: quality` pins Opus for implementation.
  Offloading hands the work to whatever the other CLI defaults to.

None of that applies to review lanes, which is why those are on and generously
bounded. Keep the two straight: **`review.*` is the good kind of cross-AI;
`cross_ai_execution` is the bad kind.**

### 7.2 The reviewer set — three lanes, picked automatically

**There are four tools, and the reviewers are always the three that are not the
one you are driving.** GSD already does this: `gsd-core/workflows/review.md`
reads the runtime from the environment and sets `SELF_CLI` — inside Claude Code
it skips `claude`, inside Cursor it skips `cursor` — so the host never reviews
its own work. Selection precedence is `explicit flags > --all >
review.default_reviewers > all detected`, and **"all detected" is the branch you
want**, because it is the only one that adapts to the host.

That makes three-lane convergence a **machine** standard, not a repo setting:

- **Keep all four working on every machine** — `claude`, `codex`, `gemini`, and
  `opencode` (the OpenCode/Grok lane). Convergence is only real if all four
  answer; one broken CLI quietly leaves you with two reviewers and a review that
  still reports success. Installed is not working — prove it:

  ```bash
  node <templates>/tools/review-lane-check.js     # from inside the repo, exit 1 if a lane is down
  ```

  Run it in the repo, not just at `~`: the gemini failure below is repo-scoped.
- **Leave `review.default_reviewers` unset.** A hard-coded list bakes in *which
  tool is the host*: `["codex","gemini","opencode"]` is correct only when you
  launch from Claude Code, and silently wrong from Codex, where the right three
  include `claude`. Unset adapts; a list cannot.
- **Pin a model per lane in `review.models` instead.** That is host-independent,
  and it is the knob that genuinely needs a decision.

`review.reviewer_instances` stays the one exception — use it only to run a single
model-capable adapter as several distinct reviewer identities. Instance names are
selectable *only* through `default_reviewers`, so a repo that needs instances is
also a repo that accepts the host-baking cost above; do it deliberately.

**A configured reviewer that is not installed drops silently.** In the
`config_default` branch a missing CLI is logged as an `info`, not an error, and
the review reports success with a thinner set — it errors only when *every*
configured reviewer is unavailable. That is the second reason not to keep a list:
the failure looks exactly like success.

### 7.3 Running the review lanes

All four lanes (codex, gemini, claude, opencode/grok) work here. "No output /
timed out" is a **timeout race, not a crash** — at each CLI's default effort a
grounded review runs ~9–10 min and blows any ≤600 s bound.

- **Codex:** `codex exec --ephemeral --dangerously-bypass-approvals-and-sandbox
  --skip-git-repo-check -c model_reasoning_effort="medium" -` with the prompt on
  stdin. Always pass the effort override — the config default is tuned for my
  interactive sessions and makes a grounded review take ~10 min.
- **Claude:** pin `review.models.claude` to a fast mid-tier model (`sonnet` today),
  or pass `--model sonnet`. Claude is skipped automatically whenever Claude Code
  is the host (§7.2), so this pin is what governs the lane on the runs where you
  are driving something else. Do **not** try to achieve the same thing by leaving
  `claude` out of a `default_reviewers` list — that suppresses it on every host,
  not just its own.
- **Gemini:** dies with `ProjectIdRequiredError` in any repo that commits its own
  root `.env` — Gemini resolves env files first-match-wins and never merges, so
  the repo `.env` shadows the home config and the lane silently drops out of every
  review. Per-repo fix and the project id are in `global-machine.md`.
- **OpenCode / Grok:** `opencode` is a **built-in reviewer slug**, so it is picked
  up by `--all`, by a bare `--opencode` flag, and by "all detected" like any other
  lane — `reviewer_instances` is only needed to run it as *several* identities.
  Install it with `npm i -g opencode-ai`. It needs no credentials to work: with an
  empty `auth.json` it falls back to OpenCode's own free hosted models, which is a
  real reviewer but not a strong one. **This is our Grok seat, so give it a Grok.**

  - **Sign in to xAI** (`opencode auth login`), then pin the newest Grok in both
    places: `"model": "xai/grok-4.6"` in `~/.config/opencode/opencode.json` (what
    an interactive run and any unpinned lane uses) and
    `review.models.opencode: "xai/grok-4.6"` in the repo (host-independent, so a
    teammate's review uses the same model).
  - **"Newest" is a lookup, not a memory.** Grok ships a new version every few
    weeks and a pin written once is a silent downgrade a month later — the lane
    still replies, just from an older model. OpenCode caches the models.dev
    catalog at `~/.cache/opencode/models.json` with a `release_date` per model;
    the newest plain `grok-<version>` with `reasoning: true` is the answer. As of
    2026-08-19 that is `grok-4.6` (released 2026-08-12), ahead of `grok-4.5`
    (2026-07-08). Ignore the dated snapshots (`grok-4.20-0309-*`, released
    2026-03-09 despite the higher-looking number), the `grok-imagine-*` image
    models, and `grok-build-*`. `tools/review-lane-check.js` in the templates repo
    does this derivation and fails when either pin has drifted.
  - **The automatic lane runs Grok at LOW reasoning, and that is not fixable in
    config.** GSD builds the lane as
    `opencode run --model <pin> --variant <effort> --format json -`, and resolves
    `<effort>` from one agent — `gsd-plan-checker` — which sits on the light tier
    at `low`. The only lever is an `effort` block, and adding one costs the
    planner a tier (§5 has the measurements). Take the low-effort lane as the
    automatic third opinion, and when you want Grok at full strength, run it
    yourself against the same prompt:

    ```bash
    opencode run --model xai/grok-4.6 --variant high --format json - < .planning/.../gsd-review-prompt.md
    ```

    `--variant` is OpenCode's provider-neutral reasoning-effort flag
    (`high`, `max`, `minimal`). Verified end to end on 2026-08-19: signed in to
    xAI, `--model xai/grok-4.6 --variant high` answered with reasoning tokens
    spent.
- **Time bounds:** give every lane **≥ 1800 s (30 min)** and run it in the background.
  Capture stderr to a `.err` file — never `2>/dev/null`.

  There is **no config knob for this** — no GSD setting bounds a review lane, so
  the bound is whatever the invoking agent applies. That makes this rule the only
  thing standing between a grounded review and a premature kill. `cross_ai_timeout`
  is unrelated: it belongs to `workflow.cross_ai_execution` (execution offload,
  deliberately off) and never touches a review.

  **This does not conflict with the 15-minute wall-clock rule.** That rule forbids
  *sitting idle* waiting; it does not cap how long a background job may run. Launch
  the lane, go do other work, collect it when it finishes. Killing a review at 15
  minutes to satisfy that rule is a misreading — and it produces exactly the
  "no output, must have crashed" false diagnosis called out below. If a review
  needs 20 minutes, give it 20 minutes and spend them on something else.
- **Don't declare a lane dead on 0-byte interim output.** `claude -p` buffers
  stdout and stderr until its final message, so 0 bytes for 8 minutes is normal.
  Codex streams tool activity to stderr, so silence there IS meaningful.
- `hook: PostToolUse Failed` in codex stderr is a context-monitor hook hitting
  its timeout under load — noise, not a review failure.

---

## 8. Autonomous execution — decide and keep going

**The default is to continue.** Do not stop to ask when you can decide, record,
and proceed. This governs how a phase runs; `global-prompt.md` governs what is
never autonomous regardless.

### 8.1 Approved scope is standing authorization

Authorization is granted **once** — when a milestone's requirements and roadmap
are approved and a phase's CONTEXT decisions are settled — not again per
operation. If an operation is described in `REQUIREMENTS.md`, `ROADMAP.md`, or an
approved phase `CONTEXT.md`, it is authorized. That includes live changes to
shared infrastructure and to production **when the phase exists to make exactly
that change**.

This supersedes any general "obtain explicit authorization" line in a repo's
`AGENTS.md` for work already inside an approved phase. It does **not** supersede
the not-reversible list or an active freeze — those hold regardless of scope.

### 8.2 Don't plan blocking checkpoints for in-scope work

A `checkpoint:decision` is for a choice that is genuinely the user's *and*
genuinely unresolvable from the approved artifacts. It is not for re-confirming
something already approved, and not for a risk the plan already mitigates.

**Prefer a machine-checked gate over a human prompt** — measured load, capacity
headroom, no conflicting job running, a verified rollback recorded. A gate that
can fail protects production; a prompt only delays it.

### 8.3 When a choice appears mid-run, take it and record it

Take the recommended option and write the decision into the phase artifacts: the
rationale, what was rejected and why, and what would have to be true to revisit
it. Auditable after the fact beats blocking during. Then continue.

### 8.4 Stop only for these

Anything else is a decision to make, not a question to ask:

1. **Anything on the not-reversible list** in `global-prompt.md`, or an active
   production freeze. Read it there; it is not repeated here.
2. **Work genuinely outside the approved milestone scope**, where proceeding
   would mean inventing scope the user never agreed to.
3. **A concrete active incident**, where continuing would make a live
   customer-facing problem worse.
4. **Spend materially above the phase's recorded estimate** (the standing
   pre-authorization in `global-prompt.md` still applies below that).

### 8.5 Wall clocks must never block a phase

A phase must not stall waiting on the calendar. **The 15-minute limit and the
mandatory logged follow-up are in *Never stop work waiting on a clock*
(`global-prompt.md`) and apply everywhere, not just inside a phase.** Below is
what that means for GSD specifically.

- **Never plan a wait longer than 15 minutes.** A shorter wait can be held inline
  inside a plan. Anything longer must not be planned as a wait at all — a plan
  whose step is "wait six hours" is a mis-planned phase, and the plan-checker
  should reject it.
- **Split it and file the remainder as a todo.** Do everything not depending on
  the elapsed time now, then file the rest under `.planning/todos/pending/` with
  what must be true before it runs and the exact command to resume it. Filing the
  todo is required, not a courtesy. Then let the phase continue to its next plan.
- **Never gate a later phase on an earlier phase's wall clock.** If Phase N+1
  doesn't consume the delayed measurement, it starts immediately. Only the plan
  that reads the result waits.
- **Verification treats a filed, time-blocked todo as advanced, not stalled.**
  Record it as deferred with its resume command rather than leaving the phase
  open and idle.
- **Off-hours windows are a planning preference, not a constraint,** unless the
  user set them. Say which it is, and prefer a machine-checked safety gate over a
  clock reading — the gate is what actually protects production.

---

## New-Repo Checklist

Run for every new repo so GSD is set up consistently:

1. **Install / confirm GSD** is present (`gsd-tools` on PATH, or
   `node <repo>/gsd-core/bin/gsd-tools.cjs`).
2. **Pick the archetype** — main-only (A) or dev/test/prod (B).
3. **Apply the common core** config from [§4](#4-the-common-gsd-config-baseline)
   (`model_profile`, `workflow.*`, `commit_docs`, etc.).
4. **Set the `git` block.** `branching_strategy=milestone` and `create_tag=true`
   on every repo; the archetype only sets `base_branch` — A: `main`, B: `dev`.
   Use `phase` only when several people work one milestone at once ([§2.1](#21-branching-strategy--milestone-is-the-house-standard)).
5. **Apply the worktree HEAD fix as a shared setting**
   ([§3](#3-the-worktree-head-fix-required-on-every-repo)) — put
   `worktree.baseRef: "head"` in the **committed** `.claude/settings.json` so every
   clone/machine inherits it (the `gsd-tools worktree set-baseref` command is a
   local-only fallback). Then `gsd-tools worktree base-check` → expect
   `shouldDegrade: false`.
6. **Double-check the landmines** in [§5](#5-settings-that-need-special-attention):
   `subagent_timeout` is ms (use `1800000`), `test_gate_timeout` is seconds
   (use `900`), `context_window` stays `200000`, and `mode` is `yolo` (§5).
7. **Set up Graphify for GSD graph context** ([§4.1](#41-graphify-setup--required-for-gsd-graph-context)):
   install/verify the Graphify CLI on this machine, commit `.graphifyignore`,
   ignore `graphify-out/` and `.planning/graphs/`, uninstall Graphify git hooks,
   then run `$gsd-graphify build` locally.
8. **Parallel milestones?** Create a **workstream** per developer
   (`gsd-tools query workstream.create <name>`) when a second engineer actually
   starts. They already get their own milestone branch from step 4 — both are
   needed.
9. **Leave the reviewer set alone, and prove the lanes work**
   ([§7.2](#72-the-reviewer-set--three-lanes-picked-automatically)). Do not set
   `review.default_reviewers`; GSD reviews with the three tools that are not
   hosting the session. Pin a model per lane in `review.models` instead, then run
   `node <templates>/tools/review-lane-check.js` **inside the new repo** — all
   four must reply, and the gemini lane can fail in one repo while passing in
   another.
10. **Commit `.planning/config.json`** (and shared `.claude/settings.json`) so the
    setup travels with the repo.
