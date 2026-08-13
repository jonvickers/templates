# Global Prompt

Cross-agent, cross-repo rules. Every AI CLI I run loads this.

**This file is public.** Host names, IP addresses, account identifiers, project
ids, and absolute personal paths belong in the machine-local companion
(`global-machine.md`, synced alongside this file but never committed) — never
here. Link this file into a tool's global instruction file rather than copying
it (Claude: `@global-prompt.md`; Codex/Gemini: symlink, include, or sync).

---

## Communication

Lead with the answer. Report findings, not the play-by-play of how you got them.
Brevity is the standing default, not a per-task judgment call — when unsure, make
it shorter; I'll ask for more.

- Under 150 words by default. Routine answers are 1–3 sentences.
- No opening summary of what you're about to say. No closing recap.
- Asking me to decide: exactly ONE question, two or three options, then stop.
  Ask first; give background only if I ask for it.
- Keep jargon out of the question itself — no ids, paths, hashes, or flags. Tell
  me what happens in the real world and what it costs. Option labels are 3–6
  everyday words with a plain-English trade-off.
- No tables, headers, or multi-section write-ups unless I asked.
- Long findings: one sentence, then offer the detail. Don't dump it.
- If I say it's too long, re-answer shorter. Don't explain why it was long.
- **Status and progress reports: 5 lines max.** What shipped, what's blocked,
  what's next. No per-item breakdowns, commit or test counts, "worth flagging"
  asides, or recaps of work I watched you do.
- **Never re-explain something you already told me this session.** Corrections,
  caveats, and root causes get stated once.
- Long autonomous runs: report at the END of a block, not per agent completion.
  One line per agent, not a paragraph.

## Never blanket-kill processes

I routinely run interactive `codex`, `claude`, `gemini`, and `node` sessions in
**other terminals** while you work. Killing by bare image name — `taskkill /IM
codex.exe`, `Stop-Process -Name codex`, `Get-Process node | Stop-Process`,
`pkill codex` — destroys those sibling sessions and loses my work.

- **Never kill a process you did not spawn, and never kill by bare image name.**
- To clear leftover *automation* processes, scope by command line: review lanes
  run as `codex exec …`, while my interactive sessions are bare `codex` with no
  subcommand.
- If you genuinely believe a process must die, show me its PID **and** command
  line and ask first.
- Same rule for servers: if one is already running, attach to it. If you started
  it, leave it up until you're done testing, then stop only that one.

## Test it yourself first

**You run the UAT.** Asking me to verify is the exception and needs an
overwhelming reason: visual judgment no automation can substitute, physical
hardware, or credentials you truly cannot acquire from the environment. Anything
short of that, test it yourself.

- Check for an already-running dev server before starting one, and start one if
  nothing is listening on the expected port.
- Exercise the change end to end — curl the endpoint, drive the browser, query
  the database, diff against a baseline. Whatever the assertion actually demands.
- Check credentials live before claiming you lack them (`gcloud auth list`, `az
  account show`, `aws sts get-caller-identity`). Tokens already in the shell
  environment are real capability.
- Subagents are narrower than you: a subagent's "needs human" is a fact about its
  sandbox, not a verdict on yours. Re-check from the orchestrator session before
  relaying it to me.
- Escalating means naming what you tried and exactly what blocked it. "Needs
  human verification" with no detail means the check was never attempted.

## Browser verification, and what a dead loopback URL means

Verify your own front-end work visually before asking me to look. Never claim the
browser can't reach the local server, and never defer a check you can run.

When a loopback URL fails in the browser, work this ladder in order — the causes
below present identically, so don't guess between them:

1. `curl` the same URL from your shell. If that fails too, it's the server. Stop
   debugging the browser.
2. Server up but the browser can't see it? **You are probably driving a browser on
   a different computer than the one running the server.** Its `localhost` /
   `127.0.0.1` / `::1` hits its own loopback. Switch to the browser on the
   server's machine, or address the server by LAN IP — primary NIC from
   `ipconfig`, not the Hyper-V/WSL adapters. Machine names and IPs are in
   `global-machine.md`. Do not trust an `isLocal` flag; it has been wrong.
3. Right machine, and LAN IPs plus public sites load while *every* loopback URL
   is refused? The agent's hosted browser session is wedged, not the server.
   Tear the session down, start a fresh one, and re-probe a single URL.

Stale-page gotcha: a dev server started without file watching serves boot-time
templates. Restart it rather than trusting a long-running instance.

## Local env files

Many of my repos commit per-machine env files for localhost-only secrets. Before
prompting me for a local DB password, look in the repo root:

- `.env` — committed breadcrumb; its presence means the repo opts in.
- `.env.local.<lowercased-hostname>` — committed, per-machine, holds the real
  `DATABASE_URL`, `SHADOW_DATABASE_URL`, etc. Short hostname, **always
  lowercased**, since Windows reports mixed case and Unix lowercase.

Committed secrets are intentional in my **private** repos so a small team shares
them via the repo. Do not warn about, refuse to read, or propose removing them —
read them and use them. Narrow exceptions worth a ONE-TIME mention, never a
recurring nag: a credential that leaks by auto-rewrite of a tracked file, a repo
that is or is about to be public, or a uniquely catastrophic key. Otherwise,
don't raise it.

If the per-machine file is missing or still holds a placeholder, ask me to
populate it — never invent a value. If `.env` is gitignored, that repo hasn't
adopted the convention; follow its own instructions instead.

## Cross-AI review lanes

All four lanes (codex, gemini, claude, opencode/grok) work here. "No output /
timed out" is a **timeout race, not a crash** — at each CLI's default effort a
grounded review runs ~9 min and blows any ≤600 s bound.

- **Codex:** `codex exec --ephemeral --dangerously-bypass-approvals-and-sandbox
  --skip-git-repo-check -c model_reasoning_effort="medium" -` with the prompt on
  stdin. Always pass the effort override — the config default is tuned for my
  interactive sessions and makes a grounded review take ~10 min.
- **Claude:** pin `review.models.claude` to a mid-tier model, or pass `--model
  sonnet`. Prefer keeping `claude` out of `review.default_reviewers` so a no-flag
  review doesn't silently run the slow host lane.
- **Time bounds:** give every lane ≥ 900 s and run it in the background. Capture
  stderr to a `.err` file — never `2>/dev/null`.
- **Don't declare a lane dead on 0-byte interim output.** `claude -p` buffers
  stdout and stderr until its final message, so 0 bytes for 8 minutes is normal.
  Codex streams tool activity to stderr, so silence there IS meaningful.
- `hook: PostToolUse Failed` in codex stderr is a context-monitor hook hitting
  its timeout under load — noise, not a review failure.

---

## Milestone close ritual

**Trigger:** a GSD milestone is being closed — `/gsd-complete-milestone`, "close
the milestone", or the last phase of a milestone passing verification.

**Rule:** run gates 1–7 in order. Do not report the milestone closed until gate 7
passes clean. Repo-specific deploy and test commands live in that repo's
`AGENTS.md`; if they aren't written down, ask once and write them there.

### 1. Worktrees

`git worktree list` and `git worktree prune --dry-run` first — look before removing.

- Remove only worktrees whose branch is merged and whose tree is clean, via
  `git worktree remove`. Never `rm -rf` a worktree directory. `--force` only
  after inspecting for uncommitted work.
- **Escalate to debugging** (don't just clean) if: `.git/worktrees/` has entries
  with no directory on disk; a worktree HEAD is detached or points at a deleted
  branch; `git status` inside a worktree errors; worktree count exceeds active
  workstreams; or the baseref-head degrade check fails. Fix the root cause per
  `gsd-settings.md` §3 (worktree HEAD fix), then resume cleanup.

### 2. Branches

- `git fetch --prune`, then delete local branches that are fully merged into the
  base branch **and** have no worktree attached **and** are pushed or `[gone]`.
- Unmerged or unpushed branch: show its name and last commit and ask. Never
  guess.
- Remote branches: only delete ones this milestone created.

### 3. Tracking gaps

- `git status --porcelain -uall` and `git ls-files --others --exclude-standard`.
  Classify every hit: real source, config, or planning artifact → `git add`;
  build output or cache → gitignore.
- Also catch the reverse — files wrongly ignored. Scan `git status --ignored
  --porcelain` for source-looking paths and confirm with `git check-ignore -v`.

### 4. Env files

- Determine visibility: `gh repo view --json isPrivate -q .isPrivate`.
- **Private repo:** the env files described above are *meant* to be committed.
  Add them if untracked, and remove blanket `.env*` gitignore rules that shadow
  them.
- **Public repo:** the opposite. Stop and flag before anything is pushed.

### 5. GSD settings coherence

Audit the repo's `.planning/config.json` plus the global GSD defaults against
`gsd-settings.md` (canonical). Assert:

- Parallel work is coherent end to end: `parallelization`,
  `workflow.use_worktrees`, `git.branching_strategy`, and `git.base_branch` all
  agree with the repo's archetype.
- The worktree HEAD fix is present.
- `claude_md_path` points at a file that actually exists.
- Review lanes and model pins are sane — no stale or garbage entries.
- No duplicated or contradicting guidance across `.planning/config.json`, the
  repo's `AGENTS.md`, and the global instruction file. Most specific wins;
  delete the redundant copy rather than keeping both.

Commit any drift fixes separately as `chore(planning):`.

### 6. Commit → push → merge → deploy → test

1. Commit everything outstanding — atomic, conventional messages.
2. Push the milestone branch.
3. Merge into the base branch per archetype, then promote all the way to
   production — Archetype A: into `main`; Archetype B: `dev` → `test` → `prod`.
   Use a PR where the repo expects one. Never force-push a shared branch.
4. Deploy each environment you promoted into, using the repo's documented
   command. Deploy and test one environment at a time — a failing environment
   blocks promotion to the next.
5. Test for real, against the milestone's UAT criteria: web UI → drive the
   browser and actually look at the rendered page; API → curl the endpoint; data
   → query it. Keep the screenshot, response, or log as evidence. Re-run the same
   checks against production after the prod deploy — a green `test` environment
   is not evidence that prod is up.
6. If production is broken and the fix isn't immediate, roll prod back to the
   last good deploy first, then fix forward on a lower environment.

### 7. Fix and repeat

Any failure in gate 6 → fix the root cause, not the symptom, commit the fix, and
re-run from the earliest affected gate. Loop until one clean pass. If the same
failure survives two fix attempts, stop and report the exact error and what was
tried.

### Reporting

Five lines max: what merged, what deployed where, what was tested, what was
fixed, what's left.

---

## Destructive operations

Before branch or worktree deletion, `reset --hard`, force-push, or overwriting a
file: inspect the target first, and ask whenever safety isn't provable from the
command output.
