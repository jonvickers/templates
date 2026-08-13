# AI Setup Audit

> **Purpose.** A single work order that any engineer can hand to any AI CLI to
> check that *this machine's* AI and agent setup is healthy — instruction files,
> hooks, permissions, GSD install, parallel-execution readiness, autonomy
> posture, and cross-CLI alignment.
>
> **Scope.** This file audits the **machine**. It is the sibling of
> `gsd-settings.md`, which audits a **repo**. Where a check is repo-scoped, this
> file does a shallow sweep and hands off to `gsd-settings.md` for depth. Neither
> file duplicates the other.
>
> **The standard being audited against** is the example set in
> `templates/examples/` — one reference copy per file, plus `examples/README.md`,
> which defines the layering model (which rule belongs in which file), the
> placement test, and the context budget. Read `examples/README.md` first: most
> of §9 is meaningless without it, and a finding you cannot trace to either an
> example file or an explicit rule in this document is an opinion, not a finding.
>
> **How to run it.** From any CLI, in any directory:
>
> ```
> Read ~/.claude/ai-setup-audit.md and execute it.
> ```
>
> (`~/.codex/` and `~/.gemini/` carry the same copy — `sync-global-prompt.ps1`
> fans all three out from `jonvickers/templates`.)

---

## If you are an agent reading this file

Treat it as a **work order**, not reference material. Work sections 0–8 in order,
apply the [fix policy](#fix-policy), and end with the
[report](#report-format). Specific rules:

- **Evidence, not inference.** Every finding cites a command you ran and its
  output. "Probably fine" is not a result. If a check cannot run, report it as
  `SKIPPED` with the reason — never as `PASS`.
- **Read before you write.** Inspect any file you are about to change. Diff it
  mentally against what you intend. Never overwrite a whole config file to
  change one key.
- **Never kill processes you did not spawn**, and never by bare image name. The
  engineer is likely running other CLI sessions in other terminals.
- **Do not commit.** Leave staging and committing to the engineer.
- **Windows:** the paths below use `~`. In PowerShell that is `$HOME`; in
  `cmd`-flavored contexts, `%USERPROFILE%`. Prefer a POSIX shell (Git Bash) for
  the shell blocks in this file, and `node` for anything structural.

### Terms used below

| Term | Meaning |
|---|---|
| **Config dir** | A CLI's global directory: `~/.claude`, `~/.codex`, `~/.gemini` |
| **Managed block** | A span in a config file that GSD's installer owns, delimited by markers |
| **Manifest** | `<config dir>/gsd-file-manifest.json` — GSD's own SHA-256 record of every file it installed |
| **Synced file** | A copy fanned out by `sync-global-prompt.ps1`; the source of truth is the `templates` repo |

---

## 0. Inventory

Establish what is actually installed before judging anything.

```bash
for d in ~/.claude ~/.codex ~/.gemini; do
  [ -d "$d" ] && echo "config dir: $d" || echo "config dir: $d  (absent)"
done
for c in claude codex gemini opencode node npm git gh; do
  printf '%-9s %s\n' "$c" "$(command -v $c || echo '— not on PATH')"
done
```

Record which CLIs exist. **Absence is not automatically a failure** — an engineer
may deliberately run only Claude and Codex. Flag absence only when something else
in this audit depends on it (e.g. a review lane configured for a CLI that is not
installed).

---

## 1. Global instruction files

The instruction files are the highest-leverage thing here: everything the agent
does flows through them, and they are the files most likely to have rotted,
because both engineers *and* agents edit them.

### 1.1 The layout that should exist

| CLI | Instruction file | Loads shared rules via |
|---|---|---|
| Claude | `~/.claude/CLAUDE.md` | `@global-prompt.md` + `@global-machine.md` imports |
| Codex | `~/.codex/AGENTS.md` | inlined below a generated marker (Codex has no import) |
| Gemini | `~/.gemini/GEMINI.md` | `@global-prompt.md` side-car import |

`gsd-settings.md` sits in all three config dirs and is imported by **none** — it
is read on demand, so it costs no context until an agent needs it. Same for this
file. **An import line for either one is a finding**, not a nicety: it burns
context in every single session.

### 1.2 Sync drift

The synced copies must be byte-identical to the `templates` repo source.

```bash
REPO=~/Code/templates   # adjust to wherever this engineer cloned it

# Read-on-demand files land in all three config dirs.
for f in gsd-settings.md ai-setup-audit.md; do
  for d in ~/.claude ~/.codex ~/.gemini; do
    [ -f "$d/$f" ] || { echo "MISSING  $d/$f"; continue; }
    cmp -s "$REPO/$f" "$d/$f" && echo "ok       $d/$f" || echo "DRIFTED  $d/$f"
  done
done

# global-prompt.md is a side-car for Claude and Gemini ONLY. Codex has no import
# mechanism, so it gets the same text inlined into AGENTS.md instead — checking
# for ~/.codex/global-prompt.md is a false positive. §1.4 verifies Codex.
for d in ~/.claude ~/.gemini; do
  [ -f "$d/global-prompt.md" ] || { echo "MISSING  $d/global-prompt.md"; continue; }
  cmp -s "$REPO/global-prompt.md" "$d/global-prompt.md" \
    && echo "ok       $d/global-prompt.md" || echo "DRIFTED  $d/global-prompt.md"
done
```

`global-machine.md` is the exception — it is **mastered in `~/.claude`** and
copied out from there, and it must **never** appear in the `templates` repo (that
repo is public). Verify both directions:

```bash
cmp -s ~/.claude/global-machine.md ~/.gemini/global-machine.md \
  && echo "ok  machine file in sync" || echo "DRIFTED  global-machine.md"
git -C "$REPO" ls-files --error-unmatch global-machine.md >/dev/null 2>&1 \
  && echo "CRITICAL  global-machine.md is tracked in the public repo" \
  || echo "ok  machine file absent from public repo"
```

Any drift means someone edited a copy instead of the source. **Fix by re-running
`sync-global-prompt.ps1`** — but first diff the drifted copy against the source
and check whether the local edit was a real improvement worth promoting upstream.
Re-syncing silently discards it otherwise.

### 1.3 Claude — `~/.claude/CLAUDE.md`

```bash
grep -n '^@' ~/.claude/CLAUDE.md
for i in $(grep -h '^@' ~/.claude/CLAUDE.md | tr -d '@'); do
  [ -f ~/.claude/"$i" ] && echo "  ok       $i" || echo "  MISSING  $i"
done
```

- Every `@import` must resolve to a file that exists in `~/.claude/`.
- An import of `gsd-settings.md` or `ai-setup-audit.md` is a finding (§1.1).
- Content below the imports must be **Claude-Code-specific**. Anything that would
  apply equally to Codex or Gemini belongs in `global-prompt.md`, which all three
  load. A rule stated in both places is worse than a rule stated once: they drift
  apart and then contradict each other.

**Removal candidates** — look for and propose deleting:

| Pattern | Why it should go |
|---|---|
| Rules restating the imported files | Duplication; the copies will diverge |
| Guidance for a tool or CLI no longer installed | Dead weight in every session |
| One-off fixes for a bug since fixed upstream | Verify against the current version first |
| Absolute paths, host names, project ids | Belong in `global-machine.md` |
| Anything a hook or setting now enforces | The hook is authoritative; prose just drifts |

Do not propose deleting a rule merely because it is long or you disagree with it.
The test is **redundant, dead, or misplaced** — not "I would have written it
differently."

### 1.4 Codex — `~/.codex/AGENTS.md`

Codex has no import mechanism, so `sync-global-prompt.ps1` inlines the shared
rules below a generated marker and preserves everything above it. That structure
is exactly what rots.

```bash
grep -c 'GENERATED by sync-global-prompt.ps1' ~/.codex/AGENTS.md
```

- Expect **exactly `1`**. `0` means the file was hand-overwritten and the next
  sync will treat the whole thing as a preamble and duplicate the shared rules
  below it. `2` or more means that already happened.
- Text **above** the marker must be Codex-only. If it repeats anything from
  `global-prompt.md`, the sync script will faithfully preserve the duplicate
  forever — delete the copy above the marker.
- Text **below** the marker is generated. Verify it matches the source, and if it
  does not, treat any edit there as lost work about to be overwritten:

```bash
T="${TMPDIR:-/tmp}"
# Everything below the generated header comment is the machine-written body.
awk 'f==2{print} /GENERATED by sync-global-prompt.ps1/{f=1} f==1&&/-->/{f=2}' \
  ~/.codex/AGENTS.md > "$T/gen.txt"
# It should equal global-prompt.md followed by global-machine.md.
{ cat ~/.claude/global-prompt.md; printf -- '\n---\n\n'; cat ~/.claude/global-machine.md; } > "$T/src.txt"
diff -B -w "$T/gen.txt" "$T/src.txt" \
  && echo "ok  generated body matches source" || echo "DRIFTED  generated body edited by hand"
```

`-B -w` ignores blank-line and whitespace noise on purpose. The question is
whether someone hand-edited the generated body, and a stray blank line is not
that — flagging it would train engineers to ignore this check.

### 1.5 Gemini — `~/.gemini/GEMINI.md`

Verify it imports the `global-prompt.md` side-car rather than restating it. Also
confirm the Gemini env shadowing fix, which silently drops Gemini out of every
cross-AI review: Gemini resolves env files first-match-wins and never merges, so
any repo that commits its own root `.env` shadows `~/.gemini/.env`. Per-repo fix
and the project id are in `global-machine.md` — §8 sweeps for it.

---

## 2. Hooks and permissions

Hooks run on every tool call. A duplicate hook doubles the latency on every
single operation; an orphaned one fails silently forever.

### 2.1 Claude — duplicates, orphans, and split groups

```bash
node - "$HOME/.claude/settings.json" <<'EOF'
const fs=require('fs');
const f=process.argv[2];
if(!fs.existsSync(f)){console.log('no '+f);process.exit(0);}
const s=JSON.parse(fs.readFileSync(f,'utf8'));
const seen=new Map(), orphan=[];
for(const [evt,groups] of Object.entries(s.hooks||{}))
  for(const g of groups||[]) for(const h of (g.hooks||[])){
    const key=evt+' | '+(g.matcher||'(all)')+' | '+h.command;
    seen.set(key,(seen.get(key)||0)+1);
    for(const m of h.command.matchAll(/"([^"]+)"/g))
      if(/[\\/]/.test(m[1]) && !fs.existsSync(m[1])) orphan.push(evt+': '+m[1]);
  }
console.log('hook entries: '+seen.size);
[...seen].filter(([,v])=>v>1).forEach(([k,v])=>console.log('  DUPLICATE x'+v+'  '+k));
orphan.forEach(o=>console.log('  ORPHAN PATH  '+o));
const byScript={};
for(const [evt,groups] of Object.entries(s.hooks||{}))
  for(const g of groups||[]) for(const h of (g.hooks||[])){
    const n=(h.command.match(/gsd-[a-z0-9-]+\.(js|cjs|sh)/)||[h.command])[0];
    (byScript[evt+' :: '+n] ||= []).push(g.matcher||'(all)');
  }
Object.entries(byScript).filter(([,v])=>v.length>1)
  .forEach(([k,v])=>console.log('  SPLIT GROUPS  '+k+' -> '+v.join('  /  ')));
const allow=s.permissions?.allow||[], deny=s.permissions?.deny||[];
if(allow.length!==new Set(allow).size) console.log('  DUPLICATE allow entries');
if(deny.length!==new Set(deny).size) console.log('  DUPLICATE deny entries');
console.log('permissions: allow='+allow.length+' deny='+deny.length+
            ' defaultMode='+(s.permissions?.defaultMode||'(unset)'));
EOF
```

Interpreting the output:

| Result | Meaning | Action |
|---|---|---|
| `DUPLICATE` | Same script, same event, same matcher, listed twice | Remove one. Almost always a reinstall that appended instead of replacing. |
| `ORPHAN PATH` | Hook command points at a file that no longer exists | The hook fails on every call. Reinstall GSD (§3) or delete the entry. |
| `SPLIT GROUPS` | One script bound to one event across several matcher groups | Not always wrong, but usually merge-able into a single matcher. Check whether the matchers overlap — overlapping ones double-fire. |

Then check that every `gsd-*` hook referenced is one GSD actually manages:

```bash
node -e "
const r=require(process.env.HOME+'/.claude/hooks/managed-hooks-registry.cjs');
const fs=require('fs');
const s=JSON.parse(fs.readFileSync(process.env.HOME+'/.claude/settings.json','utf8'));
const used=new Set();
for(const gs of Object.values(s.hooks||{})) for(const g of gs) for(const h of (g.hooks||[]))
  { const m=h.command.match(/gsd-[a-z0-9-]+\.(js|cjs|sh)/); if(m) used.add(m[0]); }
const managed=new Set(r.MANAGED_HOOKS);
[...used].filter(x=>!managed.has(x)).forEach(x=>console.log('UNMANAGED  '+x));
console.log('gsd hooks wired: '+used.size+' of '+managed.size+' available');
"
```

An `UNMANAGED` hook is a `gsd-`-named script GSD does not own — either a
hand-written one (fine, but note it, because `/gsd-update` will not maintain it)
or a leftover from a much older GSD version (delete it).

### 2.2 Codex — hooks.json and the trust hashes

Codex records a `trusted_hash` per hook in `config.toml`. If the hash does not
match the hook entry, Codex **silently declines to run it** — no error, no
warning, the hook just never fires.

```bash
node -e "
const fs=require('fs');
const H=process.env.HOME;
const hooks=JSON.parse(fs.readFileSync(H+'/.codex/hooks.json','utf8')).hooks||{};
const toml=fs.readFileSync(H+'/.codex/config.toml','utf8');
const events=Object.keys(hooks);
const state=[...toml.matchAll(/hooks\.state\.'[^']*hooks\.json:([a-z_]+):/g)].map(m=>m[1]);
console.log('hooks.json events: '+events.length+'  ['+events.join(', ')+']');
console.log('trusted entries:   '+state.length+'  ['+state.join(', ')+']');
if(events.length!==state.length)
  console.log('MISMATCH — some Codex hooks are untrusted and will not fire');
"
```

Also confirm each hook command in `hooks.json` resolves on disk. Codex uses
`.cmd` shims on Windows; a `.js`-only install leaves them dangling.

### 2.3 Permission grants

Read the `allow` / `deny` lists in `~/.claude/settings.json`. Flag:

- **Duplicates and subsumed rules** — `Bash(git *)` alongside `Bash(git add *)`;
  the narrow one is dead weight.
- **Over-broad grants** — a bare `Bash(*)` or `Read(**)` in the *global* file
  means every repo on the machine inherits it. Repo-specific grants belong in the
  repo's `.claude/settings.json`.
- **`defaultMode`** — note what it is. `auto` or `acceptEdits` globally is a
  deliberate choice, not a bug, but it should be a *conscious* one; surface it.
- **Deny rules that no longer match anything** — e.g. denying a path pattern for
  a tool that has been removed.

### 2.4 Local vs shared settings

`~/.claude/settings.local.json` should hold **only** values that genuinely differ
per machine. Two specific traps:

- **Shared-worthy values stranded in the local file.** If a value would be
  identical for every engineer, promote it to the shared file.
- **`worktree.baseRef` at the user level is inert.** GSD's `base-check` reads it
  from the **repo's** `.claude/settings.json`. A copy in `~/.claude/settings.json`
  or `settings.local.json` looks right, changes nothing, and hides the fact that
  a repo is missing the fix. If you find one, report it as misleading and check
  §5 for every repo rather than trusting it.

Finally, sweep for stale backups an earlier edit left behind:

```bash
ls -1 ~/.claude/settings*.bak* ~/.claude/settings*.old ~/.codex/config.toml.* 2>/dev/null
```

These are inert but confusing. Propose deleting once the live file is verified
healthy.

---

## 3. GSD install integrity

### 3.1 Installed, and for which CLIs

```bash
for d in ~/.claude ~/.codex ~/.gemini; do
  printf '%-14s ' "$(basename $d)"
  if [ -f "$d/gsd-core/VERSION" ]; then
    printf 'GSD %s  profile=%s\n' "$(cat $d/gsd-core/VERSION)" "$(cat $d/.gsd-profile 2>/dev/null || echo '?')"
  else
    printf 'GSD not installed\n'
  fi
done
```

House expectation: **GSD installed for Claude and Codex, both at `profile=full`,
both at the same version.** Gemini is a review lane only and does not need GSD —
its absence there is not a finding.

A version skew between Claude and Codex is a real problem: the two share
`gsd-settings.md` and repo `.planning/config.json` files, so the older install
will hit config keys it does not understand.

### 3.2 Up to date

```bash
npm view @opengsd/gsd-core version           # latest published
cat ~/.claude/gsd-core/VERSION               # installed
cat ~/.claude/.last-update-result.json 2>/dev/null
```

`.last-update-result.json` records the most recent auto-update. An `outcome`
other than `success` is a finding even when the version looks current — it means
the updater is failing and the install is frozen at whatever it last managed.

Behind by a patch is normal (the session-start hook updates on its own schedule).
Behind by a minor or major, or a failed outcome, warrants running `/gsd-update`.

### 3.3 File-level integrity — the check that finds real breakage

GSD writes a SHA-256 for every file it installs. This catches partial installs,
truncated writes, and files an agent edited in place.

**Read this before you run it.** The manifest records paths relative to the
config dir, but GSD's installer can redirect a whole artifact class to a
different home. Codex is the live example: its skills are recorded as
`skills/gsd-*/SKILL.md` under `~/.codex`, and the installer writes them to
**`~/.agents/skills/`** instead. Checking only `<config dir>/<path>` reports all
71 as missing on a perfectly healthy install. The script below resolves the
alternate homes before declaring anything missing — **do not simplify it back**.

```bash
for d in ~/.claude ~/.codex; do
node - "$d" "$HOME" <<'EOF'
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const [,,dir,home]=process.argv;
const mp=path.join(dir,'gsd-file-manifest.json');
if(!fs.existsSync(mp)){console.log(dir+': no manifest — GSD not installed here');process.exit(0);}
const m=JSON.parse(fs.readFileSync(mp,'utf8'));
// Alternate homes an installer may redirect an artifact class into.
const homes=[dir, path.join(home,'.agents')];
const missing=[],modified=[],elsewhere=[];let ok=0;
for(const [rel,hash] of Object.entries(m.files)){
  const found=homes.find(h=>fs.existsSync(path.join(h,rel)));
  if(!found){missing.push(rel);continue;}
  const h=crypto.createHash('sha256').update(fs.readFileSync(path.join(found,rel))).digest('hex');
  if(h!==hash){modified.push(rel);continue;}
  ok++;
  if(found!==dir) elsewhere.push(found);
}
console.log(dir+'  v'+m.version+' ('+m.mode+')  ok='+ok+
            ' missing='+missing.length+' modified='+modified.length);
[...new Set(elsewhere)].forEach(h=>console.log('  note: '+
  elsewhere.filter(x=>x===h).length+' files verified under '+h+' (redirected home, not a fault)'));
missing.slice(0,15).forEach(f=>console.log('  MISSING  '+f));
modified.slice(0,15).forEach(f=>console.log('  MODIFIED '+f));
EOF
done
```

| Result | Meaning |
|---|---|
| `missing=0 modified=0` | Clean install. |
| `missing>0` | **Partial install.** Reinstall that CLI's GSD. A whole directory missing (e.g. every `skills/*/SKILL.md`) means that install step failed outright and those commands are unavailable in that CLI. |
| `modified>0` | Files edited after install — either intentional local patches (§4) or an agent that "fixed" a GSD file in place. **`/gsd-update` will overwrite them.** Diff each one and decide before updating. |

### 3.4 Migration parity

```bash
node -e "
const fs=require('fs'),H=process.env.HOME;
const ids=d=>{try{return new Set(JSON.parse(fs.readFileSync(H+'/'+d+'/gsd-install-state.json','utf8'))
  .appliedMigrations.map(m=>m.id))}catch{return null}};
const a=ids('.claude'), b=ids('.codex');
if(!a||!b){console.log('one install has no state file');process.exit(0)}
const only=(x,y)=>[...x].filter(i=>!y.has(i));
console.log('claude-only migrations:', only(a,b).join(', ')||'(none)');
console.log('codex-only migrations: ', only(b,a).join(', ')||'(none)');
"
```

Both installs should have converged on the same migration set. A migration
applied to one and not the other means the two installs are structurally
different despite reporting the same version.

---

## 4. GSD local patches

When `/gsd-update` detects that you modified a GSD-owned file, it backs the file
up to `gsd-local-patches/` and reapplies it after the update. Those patches
accumulate: a fix you carried forward for six months may have been adopted
upstream long ago, and reapplying it now silently reverts newer upstream work.

```bash
for d in ~/.claude ~/.codex ~/.gemini; do
  p="$d/gsd-local-patches"
  [ -d "$p" ] || continue
  echo "=== $p ==="
  cat "$p/backup-meta.json" 2>/dev/null | head -20
  find "$p" -type f -not -name 'backup-meta.json' | sed 's|^|  |'
done
```

For **each** patched file, answer three questions and report the answer — do not
leave a patch in place by default:

1. **What does it change?** Diff the backup against the pristine baseline in
   `<config dir>/gsd-pristine/` if present, or against the currently installed
   file.
2. **Is it still needed?** Read the installed upstream version. If upstream now
   does the same thing, the patch is **obsolete** — retiring it is the fix.
   Silently reapplying an obsolete patch is how an upstream improvement gets
   reverted without anyone noticing.
3. **Does it still apply cleanly?** If `backup-meta.json`'s `from_version` is
   several versions behind the installed `VERSION`, the file it patches has
   likely been restructured. Flag for manual review rather than trusting the
   reapply merge.

`gsd-pristine/` at a *different* version than `gsd-core/VERSION` means the
baseline drifted and three-way merges will be unreliable — report it.

**No `gsd-local-patches/` directory at all is the healthy state.** Say so
plainly rather than omitting the section.

---

## 5. Parallel development readiness

This is where a setup most often looks fine and is not. The failure is silent:
GSD drops from parallel worktree execution to sequential, and the only symptom is
that everything takes several times longer.

The controlling setting is **repo-scoped**, so this section sweeps repos.

```bash
GSD=~/.claude/gsd-core/bin/gsd-tools.cjs
for r in ~/Code/*/; do
  [ -d "$r/.git" ] && [ -d "$r/.planning" ] || continue
  printf '\n=== %s ===\n' "$(basename "$r")"
  (
    cd "$r" || exit
    # Read the file relative to cwd. Do NOT interpolate a shell path into
    # node -e: on Windows, Git Bash hands over an MSYS path (/c/Users/...)
    # that Node cannot resolve, and the read fails silently as "(ABSENT)".
    node -e "
      const fs=require('fs'); let s={};
      try{s=JSON.parse(fs.readFileSync('.claude/settings.json','utf8'))}catch{}
      console.log('  committed baseRef:', s.worktree?.baseRef ?? '(ABSENT)');
      try{ if(JSON.parse(fs.readFileSync('.claude/settings.local.json','utf8')).worktree?.baseRef)
        console.log('  NOTE: baseRef also in settings.local.json — does not travel to other clones');
      }catch{}
    "
    node "$GSD" worktree base-check 2>&1 | head -4 | sed 's|^|  |'
    for k in workflow.use_worktrees git.branching_strategy git.base_branch \
             parallelization mode workflow.subagent_timeout \
             workflow.auto_advance context_window; do
      printf '  %-28s %s\n' "$k" "$(node "$GSD" config-get "$k" 2>/dev/null || echo '(unset)')"
    done
  )
done
```

**`base-check` outranks the file read.** If the two disagree, the file read is
wrong — trust `base-check`. A `⚠ may shadow project-local GSD` warning means the
repo has its own `gsd-core` and you invoked the global one; re-run using the
repo's copy before believing any result from that repo.

Assert, per repo:

- `worktree.baseRef: "head"` is present in the repo's **committed**
  `.claude/settings.json` — not `settings.local.json`, not the user-level file.
  Without it, spawns mismatch whenever `HEAD` differs from `origin/HEAD`, which
  on a phase-branching repo is *always*.
- `base-check` returns `shouldDegrade: false, reason: "baseref-head"`. This is
  the authoritative check — trust it over reading the file.
- `workflow.use_worktrees` and `parallelization` are both on.
- `git.branching_strategy` is `milestone` — the house standard on every repo and
  every archetype. `phase` is allowed only where several people work one
  milestone at once; `none` only on throwaway repos. Report anything else.
- `git.base_branch` matches the archetype: `main` for main-only, `dev` for
  dev/test/prod. Never `prod`.
- Every open milestone has one owner, and each owner has their own workstream
  (`ls .planning/workstreams/`). Two developers sharing one milestone branch is
  the drift case to flag.

**Do not resolve archetype questions here.** `gsd-settings.md` §1–§3 is canonical
for what each repo's `git` block should be; this audit only reports disagreement
and points at that file.

---

## 6. Autonomy posture

Report what the machine is actually configured to do unattended, so the engineer
can confirm it is what they intended. These are choices, not defects — the
finding is a *surprise*, not a value.

| Setting | Where | What to report |
|---|---|---|
| `mode` | repo `.planning/config.json` | `interactive` gates each phase; `yolo` runs autonomously with no approval. Flag any `yolo` repo the engineer may not know about. |
| `workflow.auto_advance` | repo config | `true` chains phases without stopping. |
| `workflow.subagent_timeout` | repo config | **Milliseconds.** Anything under `1000` is a bug — `900` means 0.9 s and every subagent dies instantly. House value is `900000`. |
| `context_window` | repo config | Keep `200000`. `≥500000` enables adaptive context enrichment, which overflows the 200k-context models GSD actually spawns. Your interactive session running a 1M model does not change what spawned agents get. |
| `permissions.defaultMode` | `~/.claude/settings.json` | `auto` / `acceptEdits` means tool calls proceed without prompting, machine-wide. |
| `approval_policy`, `sandbox_mode` | `~/.codex/config.toml` | `never` + `danger-full-access` is full autonomy with no sandbox. Legitimate on a trusted dev box; report it so it is a decision, not a default. |

For `/gsd-autonomous` specifically, confirm the skill is present in each CLI
(§3.3 will already have caught it if the file is missing) and that
`workflow.subagent_timeout` is sane — an autonomous run with a broken timeout
fails in a way that looks like a model problem.

---

## 7. Cross-CLI alignment

The point of the shared files is that Claude and Codex behave the same. Verify
they actually do.

- **Shared rules identical.** §1.2 already compared the synced copies; §1.4
  compared Codex's inlined body. If both passed, the two CLIs are reading the
  same rules.
- **Agent roster parity.** GSD installs its subagents into both config dirs:

  ```bash
  diff <(ls ~/.claude/agents/ | sed 's/\.md$//') \
       <(ls ~/.codex/agents/ | sed 's/\.\(md\|toml\)$//' | sort -u) \
    && echo "ok  agent rosters match" || echo "DIVERGED  see diff above"
  ```

  Codex carries a `.toml` beside each `.md`; a `.md` with no `.toml` is not
  registered and the agent is unavailable in Codex.

- **Review lanes match reality.** `gsd-settings.md` §7 is canonical for how each
  lane is invoked. Here, only check consistency: every name in
  `review.default_reviewers` must be either a built-in slug or a defined
  `review.reviewer_instances` entry, and every CLI it names must be installed
  (§0). A name that is neither is a hard error at review time, not a silent drop.

- **Contradictions between files.** If `~/.claude/CLAUDE.md` and
  `~/.codex/AGENTS.md` state different rules for the same thing, the shared
  source has been forked. Report both texts and which file each came from; let
  the engineer choose. Do not silently pick one.

---

## 8. Repo sweep

A shallow pass over every repo on the machine. Depth is `gsd-settings.md`'s job —
this section finds repos that need it.

```bash
for r in ~/Code/*/; do
  [ -d "$r/.git" ] || continue
  printf '%-26s' "$(basename $r)"
  for f in CLAUDE.md AGENTS.md .claude/settings.json .planning/config.json .gemini/.env; do
    [ -e "$r$f" ] && printf ' [x]%s' "$f" || printf ' [ ]%s' "$f"
  done
  echo
done
```

Per repo, check:

1. **`CLAUDE.md` is a pointer, not a second source.** The house pattern is a
   `CLAUDE.md` containing little more than `@AGENTS.md`, because Codex, Gemini,
   and Cursor all read `AGENTS.md` and only Claude reads `CLAUDE.md`. A
   `CLAUDE.md` with substantive rules of its own means Claude and every other
   tool are working from different instructions. Flag it.

2. **`AGENTS.md` is concise and repo-specific.** It should cover what an agent
   cannot infer from the code: how to run and deploy, the test command, domain
   vocabulary, non-obvious constraints. It should **not** restate the global
   prompt or `gsd-settings.md` — both are already loaded or one read away. Size
   is a signal, not a verdict: an 18 KB `AGENTS.md` is worth reading for
   duplication; a large one that is all repo-specific is fine.

3. **`AGENTS.md` supplies the inputs the house rituals need.** This is the check
   most repos fail, and it fails invisibly: the shared rules describe *what* to
   do, and only the repo can say *how*. The milestone close ritual
   (`gsd-settings.md` §6) runs unattended right up until it needs one of these
   and has to stop and ask:

   | Input | Used by | Absent means |
   |---|---|---|
   | Deploy command, per environment | §6.6 deploy | The agent guesses or stops |
   | How to watch a deploy finish — log command, status URL, or CI run | §6.6 watch | "Deployed" gets reported for a build still running |
   | Deployed URL for each environment | §6.6 browser test | The interface is never actually looked at |
   | Test / UAT command | §6.6 test | Only what the agent invents gets tested |
   | Tag scheme | §6.6 tag | A one-off tag format enters the repo's history |
   | Rollback command | §6.6 step 9 | A broken production stays broken while the agent asks |

   ```bash
   for r in ~/Code/*/; do
     [ -f "$r/AGENTS.md" ] || continue
     printf '%-26s' "$(basename $r)"
     grep -qiE 'deploy'            "$r/AGENTS.md" && printf ' deploy' || printf ' -----'
     grep -qiE 'test|uat'          "$r/AGENTS.md" && printf ' test'   || printf ' ----'
     grep -qiE 'https?://'         "$r/AGENTS.md" && printf ' url'    || printf ' ---'
     grep -qiE 'tag|version|release' "$r/AGENTS.md" && printf ' tag'  || printf ' ---'
     grep -qiE 'rollback|revert'   "$r/AGENTS.md" && printf ' rollback' || printf ' --------'
     echo
   done
   ```

   Treat this as a **shortlist, not a verdict** — the grep finds the word, not a
   usable instruction. Open every repo that shows a gap, plus any that shows all
   five, and confirm the instructions are specific enough to execute without
   asking. Report the missing ones per repo; filling them in is a Tier 2 change
   because only the engineer knows the real commands.

4. **`AGENTS.md` doesn't contradict the shared rules.** Repos accumulate local
   rules that quietly override house policy — an older milestone checklist, a
   "always ask before deploying" line that defeats the autonomous close, a
   review-lane invocation that has since changed. For each repo, scan for text
   that restates any of: the milestone close ritual, cross-AI review lanes,
   process-killing, env-file handling, spend approval, or how to ask questions.

   Where a repo restates a shared rule **identically**, delete the copy — it will
   drift. Where it **contradicts**, the repo may be right (a genuine local
   exception) or stale (the shared rule moved on). Report both texts and which
   file each came from, and let the engineer choose. Never silently pick one.

   Repos that predate the shared files are the common case here, and the fix is
   usually to replace a long local checklist with a one-line pointer to
   `gsd-settings.md` §6 plus the repo-specific inputs from item 3.

5. **GSD managed blocks are intact.** GSD delimits any block it owns in a project
   instruction file:

   ```bash
   grep -c 'GSD Configuration — managed by gsd-core installer' "$r/AGENTS.md"
   grep -c 'End GSD Configuration' "$r/AGENTS.md"
   ```

   Both counts must be equal, and each must be `0` or `1`. Anything else means a
   reinstall or an agent edit broke the block, and GSD can no longer find its own
   span to replace — so the next update either duplicates it or gives up. Also
   confirm nothing hand-written sits *inside* the markers: it will be destroyed
   on the next install, and it is the single most common way a carefully written
   repo rule vanishes.

6. **`.gemini/.env` exists** where the repo commits its own root `.env` — without
   it Gemini dies with `ProjectIdRequiredError` and drops out of every review.
   The project id is in `global-machine.md`; the file should be gitignored on its
   own, not by ignoring all of `.gemini/`.

7. **Hand off.** For any repo with real findings, the next step is
   `gsd-settings.md`'s own work order ("If you are an agent reading this file"),
   run inside that repo. Name the repos; do not run it here.

---

## 9. Layering, duplication, and clobbering

Sections 0–8 check that each file is *present and internally healthy*. This one
checks the thing that actually rots over time: whether the **same rule now lives
in two files**, whether a rule sits at the **wrong layer**, and whether something
**overwrote** hand-written content.

Read `examples/README.md` before starting — the placement test and the layer
diagram there are the standard. This section only applies them.

### 9.1 Build the corpus

You have already opened most of these. Collect them in one place:

```bash
REPO=~/Code/templates
{ echo "--- global-prompt"; cat "$REPO/global-prompt.md"; } > /dev/null   # sanity
ls -l ~/.claude/CLAUDE.md ~/.claude/global-machine.md ~/.codex/AGENTS.md \
      ~/.gemini/GEMINI.md 2>/dev/null
for r in ~/Code/*/; do [ -f "$r/AGENTS.md" ] && echo "$r/AGENTS.md"; done
```

### 9.2 Duplication — the same rule in two files

For each **always-loaded** file, ask of every substantive rule: *is this already
stated at a higher layer?* Work outward from `global-prompt.md`, since anything
duplicated there is duplicated across all three CLIs at once.

A keyword sweep finds candidates fast — it will not find paraphrases, so read
the files too:

```bash
# Distinctive phrases from the shared rules. A hit outside global-prompt.md is
# a candidate duplicate, not proof — open it and compare meaning.
#
# Use -lF, never -ilF: the -i + -F + -l combination SIGABRTs in Git Bash's grep
# on Windows. These phrases are lowercase in the sources, so dropping -i costs
# nothing.
for pat in 'already-running dev server' 'servers you started' 'kill a process' \
           'bare image name' 'drive the browser' 'loopback' 'plain English' \
           'spend' 'milestone close' 'review lane'; do
  echo "── $pat"
  grep -lF "$pat" ~/.claude/CLAUDE.md ~/.codex/AGENTS.md ~/.gemini/GEMINI.md \
       ~/Code/*/AGENTS.md 2>/dev/null | sed 's|^|   |'
done
```

**Expect `~/.codex/AGENTS.md` to match nearly every phrase** — that is the
inlined copy, and it is correct. If it matches *nothing*, the sync is broken, not
clean. Any *other* file matching is the real signal.

This sweep catches verbatim copies only. The more common case is a **paraphrase**
— "check whether this workspace already has a dev server listening" restating
"check for an already-running dev server" — which no keyword search will find.
Read each always-loaded file end to end at least once; the sweep is a shortcut,
not the check.

Classify each hit:

| Finding | Fix |
|---|---|
| Identical rule, stated twice | Delete the copy at the **lower** layer. The higher-layer file is already loaded. |
| Same topic, wording drifted | The two have already diverged. Decide which is current, delete the other, and note the drift — this is the failure the whole layering model exists to prevent. |
| Genuine local exception | Keep it, but it **must say it is an exception** and name what it overrides. An unmarked contradiction makes the agent choose at random. |
| Paraphrase that adds nothing | Delete. "Restated for emphasis" is duplication with extra steps. |

Note the Codex special case: everything below the generated marker in
`~/.codex/AGENTS.md` is a *deliberate* inline copy of `global-prompt.md`, not
duplication. Only the preamble above the marker can duplicate.

### 9.3 Misplacement — a rule at the wrong layer

Run the placement test from `examples/README.md` over each file. The three
recurring shapes:

**Prose restating config.** The highest-value check, because these silently
become false. Search the always-loaded files for sentences that name a config
key and assert its value:

```bash
grep -rinE '(config\.json|settings\.json|settings\.local).*(set to|must be|keep|should be)|\
(set to|must be|keep it|should be) *(true|false|[0-9]+)' \
  ~/.claude/CLAUDE.md ~/.codex/AGENTS.md ~/Code/*/AGENTS.md 2>/dev/null | head -20
```

For every hit, **read the actual config value** and compare. If they already
disagree, that is a confirmed defect, not a style note — report it with both
values. Either way the fix is the same: delete the sentence, keep at most one
line of rationale, never repeat the value.

**Repo-level rule that is true everywhere.** Generic GSD usage, milestone
numbering, workstream naming, tool guidance sitting in one repo's `AGENTS.md`.
Fix: promote it to `gsd-settings.md` or `global-prompt.md` and delete the local
copy — but propose, don't apply. Promoting a rule changes behavior in every repo.

**Global rule that is only true somewhere.** Rarer, and worse: a rule in
`global-prompt.md` that only makes sense for one repo or one CLI. Fix: demote it.

### 9.4 Clobbering — content that got overwritten

Four checks, in order of how much damage each represents:

```bash
# 1. Marker integrity — a broken pair means the next install cannot find its
#    own span, so it duplicates the block or gives up.
# NOTE: `grep -c` prints its count AND exits 1 when the count is zero, so
# `$(grep -c … || echo 0)` yields the two-line string "0\n0" and every numeric
# test below then fails with "integer expression expected". Use `|| true`.
for f in ~/.codex/AGENTS.md ~/Code/*/AGENTS.md; do
  [ -f "$f" ] || continue
  o=$(grep -c 'GSD Configuration — managed by gsd-core installer' "$f" 2>/dev/null || true)
  c=$(grep -c 'End GSD Configuration' "$f" 2>/dev/null || true)
  g=$(grep -c 'GENERATED by sync-global-prompt.ps1' "$f" 2>/dev/null || true)
  [ "$o" = "$c" ] && [ "$o" -le 1 ] && [ "$g" -le 1 ] \
    || echo "  MARKERS  $f  gsd-open=$o gsd-close=$c sync=$g"
done
echo "(no output above = every marker pair is intact)"

# 2. Backup files — each one is evidence something was overwritten. Read it
#    before proposing deletion; it may hold content that never made it across.
ls -1 ~/.claude/*.bak* ~/.claude/*.old ~/.codex/*.pre-* ~/.codex/*.bak \
      ~/Code/*/AGENTS.md.bak* 2>/dev/null

# 3. Duplicate headings inside one file — the signature of a sync or install
#    that appended instead of replacing.
for f in ~/.claude/CLAUDE.md ~/.codex/AGENTS.md ~/.gemini/GEMINI.md ~/Code/*/AGENTS.md; do
  [ -f "$f" ] || continue
  d=$(grep '^#\{1,3\} ' "$f" | sort | uniq -d)
  [ -n "$d" ] && { echo "  DUPLICATE HEADINGS in $f:"; echo "$d" | sed 's|^|    |'; }
done
echo "(no output above = no repeated headings)"

# 4. GSD-managed files edited in place — §3.3 already found these. They are
#    clobbering in the other direction: your edit is about to be destroyed by
#    the next /gsd-update.
```

For **every backup file found**, diff it against the live file before proposing
deletion:

```bash
diff ~/.claude/settings.local.json.bak-YYYYMMDD ~/.claude/settings.local.json
```

The question is not "is this file old" but **"did anything in it fail to make
the trip?"** A backup whose content is fully present in the live file is safe to
delete (Tier 1). A backup containing a key the live file lacks is a partial
migration, and the missing key is the finding — not the backup.

### 9.5 Context budget

Always-loaded bytes are paid on every session forever. Measure, then judge:

```bash
printf '%-46s %6s\n' 'global-prompt.md (×3 CLIs)'  "$(wc -c < ~/.claude/global-prompt.md)"
printf '%-46s %6s\n' 'global-machine.md (×3)'      "$(wc -c < ~/.claude/global-machine.md)"
printf '%-46s %6s\n' '~/.claude/CLAUDE.md'         "$(wc -c < ~/.claude/CLAUDE.md)"
printf '%-46s %6s\n' '~/.codex/AGENTS.md (inc. inlined)' "$(wc -c < ~/.codex/AGENTS.md)"
for r in ~/Code/*/; do [ -f "$r/AGENTS.md" ] && \
  printf '  repo %-40s %6s\n' "$(basename "$r")" "$(wc -c < "$r/AGENTS.md")"; done
```

Compare against the budget table in `examples/README.md`. **Being over budget is
a prompt to look, not a defect by itself** — report an oversized file only
alongside the specific content in it that belongs elsewhere. "This file is large"
is not a finding; "these three sections duplicate the global prompt" is.

### 9.6 Conformance to the examples

Finally, compare each live file against its reference copy in
`templates/examples/`. These are **not** meant to be byte-identical — the
examples carry placeholders and every machine has real local content. Compare
*structure*:

| Live file | Example | Must match on |
|---|---|---|
| `~/.claude/CLAUDE.md` | `machine/claude/CLAUDE.md.example` | imports present and resolving; nothing below them that is cross-CLI |
| `~/.codex/AGENTS.md` | `machine/codex/AGENTS.md.example` | exactly one generated marker; preamble is Codex-only |
| `~/.gemini/GEMINI.md` | `machine/gemini/GEMINI.md.example` | imports the side-car rather than restating it |
| `~/.claude/settings.json` | `machine/claude/settings.json.example` | GSD hook block intact; no `worktree.baseRef` at user level |
| `<repo>/CLAUDE.md` | `repo/CLAUDE.md.example` | pointer only, no rules of its own |
| `<repo>/AGENTS.md` | `repo/AGENTS.md.example` | has the milestone-close inputs; none of the six "does not belong" shapes |
| `<repo>/.claude/settings.json` | `repo/claude-settings.json.example` | committed, has `worktree.baseRef: "head"` |
| `<repo>/.planning/config.json` | `repo/planning-config.json.example` | matches the baseline; `gsd-settings.md` wins on any disagreement |

Where the machine and the example disagree, **the example is not automatically
right.** It is a reference copy that can itself go stale. If the machine's
version is better, the finding is "update the example," and that belongs in the
report as a Tier 2 proposal against the `templates` repo.

---

## Fix policy

Findings fall into three tiers. **Tier 1 is the only one you apply without
asking.**

**Tier 1 — apply, then report what you did.** Provably safe, fully reversible,
and re-derivable from a source of truth:

- Re-running `sync-global-prompt.ps1` to repair a drifted synced copy — *after*
  diffing and confirming the local edit is not worth keeping.
- Reinstalling GSD to repair `missing` files from the manifest check.
- Deleting a stale `.bak` / `.old` file once the live file is verified healthy.

**Tier 2 — propose with the exact diff, then ask.** Correct-looking but
judgment-dependent:

- Removing a duplicate hook entry or a subsumed permission rule.
- Deleting content from an instruction file.
- Retiring a local patch you believe is obsolete.
- Moving a setting between the shared and local files.

**Tier 3 — report only, never touch.** The engineer's call:

- Autonomy posture (`mode`, `approval_policy`, `sandbox_mode`, `defaultMode`).
- Anything under a GSD managed-block marker — fix by reinstalling, never by hand.
- Contradictions between instruction files where either could be the intended one.
- Anything in a repo with uncommitted changes: say so and stop.

Ask about Tier 2 items **in one batch at the end**, not one at a time.

---

## Severity rubric

| Severity | Test |
|---|---|
| **CRITICAL** | Actively wrong output or a leak: a secret in a public repo, an untrusted hook silently not firing, a broken managed block about to eat someone's rules. |
| **HIGH** | Silently degrades work: worktrees degrading to sequential, `subagent_timeout` in seconds, a partial GSD install, a review lane that never runs. |
| **MEDIUM** | Costs context or time on every session: duplicate hooks, duplicated rules across instruction files, a stale local patch. |
| **LOW** | Untidy but inert: leftover backup files, subsumed permission entries, cosmetic drift. |
| **INFO** | Posture worth confirming: autonomy settings, deliberate absences. |

---

## Report format

Lead with the verdict. Keep the summary to five lines, then the table, then the
questions. No preamble, no recap.

```
AI setup audit — <hostname>, <date>

Verdict: HEALTHY | DEGRADED | BROKEN
Critical <n> · High <n> · Medium <n> · Low <n>
Fixed automatically: <n>   Awaiting your call: <n>
CLIs: claude <v> · codex <v> · gemini <v>   GSD <version> (<which CLIs>)
<one line naming the single most important thing to do next>

| # | Sev | Area | Finding | Evidence | Fix |
|---|-----|------|---------|----------|-----|
| 1 | HIGH | GSD install | ... | <command → output> | Tier 1, applied |

Needs your decision:
1. <one plain-English question, with the trade-off>
```

Rules for the report:

- **Every row cites evidence** — the command and the part of its output that
  proves the finding. A row without evidence is an opinion; delete it.
- **A clean audit is a five-line report.** Do not pad it with everything that
  passed. Name the sections that passed in one line and stop.
- **`SKIPPED` is a real result.** A check you could not run belongs in the table
  with the reason, not omitted.
- **Questions are plain English.** No paths, hashes, or flag names in the
  question itself — say what happens in the real world and what it costs.
