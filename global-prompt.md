# Global Prompt

Cross-agent, cross-repo rituals. Vendor-neutral: no machine-specific paths or
credentials here. Link into a tool's global instruction file rather than copying
(Claude: `@global-prompt.md`; Codex/Gemini: symlink or include).

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
- **Private repo:** `.env`, `.env.yaml`, and `.env.local.<lowercased-hostname>`
  are *meant* to be committed so the team shares them via the repo. Add them if
  untracked, and remove blanket `.env*` gitignore rules that shadow them. Do not
  warn about committed secrets in a private repo.
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
5. Test for real, against the milestone's UAT criteria: web UI → drive Chrome
   and actually look at the rendered page; API → curl the endpoint; data → query
   it. Keep the screenshot, response, or log as evidence. Re-run the same checks
   against production after the prod deploy — a green `test` environment is not
   evidence that prod is up.
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

## Guardrails that apply to all of the above

- Never kill a process by bare image name, and never kill one you didn't spawn —
  sibling interactive CLI sessions run in other terminals.
- Destructive git (branch or worktree deletion, `reset --hard`, force-push):
  inspect first; ask whenever safety isn't provable from the command output.
- Test it yourself. Escalating to the human requires naming what was attempted
  and exactly what blocked it.
