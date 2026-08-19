# #3086 is not fixed on Windows: the `.cmd` gate tests the configured name, which is always bare

**Repo:** `open-gsd/gsd-core` · **Version:** 1.10.0 · **Platform:** Windows 10, Node 22.19, PowerShell 7 + Git Bash, CLIs installed via npm (fnm shims)

**Impact:** every spawn-transport reviewer lane whose binary is an npm `.cmd` shim fails with `ENOENT` and is replaced by a stub. Because the stub is reported as `ok: true, stubbed: true`, a cross-AI review that ran with **zero** working reviewers is indistinguishable from one where every reviewer had no concerns.

## The defect

`bin/gsd-tools.cjs`, `review-lane invoke` spawn helper (~line 1382 in 1.10.0):

```js
const isWin = process.platform === 'win32';
const winShim = isWin && /\.(cmd|bat)$/i.test(path.basename(binary));
const spawnBinary = winShim ? (process.env.ComSpec || 'cmd.exe') : binary;
const spawnArgv   = winShim ? ['/d', '/s', '/c', binary, ...argv] : argv;
```

The `cmd.exe` mediation added by #3086 is correct. It never fires.

`binary` here is the **configured** name from `bin/lib/review-lane-descriptor.cjs` `invoke.binary`, and every CLI lane declares a bare one:

| lane | `invoke.binary` | `/\.(cmd\|bat)$/` |
|---|---|---|
| `gemini` | `gemini` | false |
| `codex` | `codex` | false |
| `opencode` | `opencode` | false |
| `claude` | `claude` | false |

So `spawnSync` gets a bare name with `shell: false`. Windows `CreateProcess` does **not** apply `PATHEXT`, so it never finds `codex.cmd` — `ENOENT`.

`claude` survives only because it is a genuine `.exe` (`~/.local/bin/claude.exe`), which `CreateProcess` resolves without help. And `claude` is the one lane GSD skips whenever Claude Code hosts the session — so from Claude Code, **every** reviewer fails.

## Reproduction

```
codex      ERROR ENOENT
gemini     ERROR ENOENT
opencode   ERROR ENOENT
claude     ok  2.1.234 (Claude Code)
```

End to end, from a repo with a `.planning/` directory:

```bash
mkdir -p /tmp/run
printf 'Reply with exactly this token and nothing else: LANECHECK7Q\n' > /tmp/run/gsd-review-prompt.md

node ~/.claude/gsd-core/bin/gsd-tools.cjs review-lane invoke \
  --slug gemini --selected gemini --run-dir /tmp/run --repo-root "$PWD" --json
```

Observed on 1.10.0:

```json
{ "slug": "gemini", "ok": true, "stubbed": true }
```

```
$ cat /tmp/run/gsd-review-gemini.err
[spawn error: ENOENT]

$ cat /tmp/run/gsd-review-gemini.md
gemini review failed or returned empty output. stderr:

[spawn error: ENOENT]
```

`where gemini` on the same machine:

```
C:\Users\...\AppData\Local\fnm_multishells\50028_.../gemini       <- extensionless sh script
C:\Users\...\AppData\Local\fnm_multishells\50028_.../gemini.cmd   <- the shim CreateProcess needs
```

## Why this stayed invisible

This is the `#2494`/`#2605` ambiguity re-entering through a different door. The lane's `emptyOutput: 'stub-with-stderr'` policy does its job — the stderr *is* captured — but the JSON result reports `ok: true`. Any caller that branches on `ok` treats a total outage as a clean review. Two full convergence cycles on a production repo came back "reviewed, no concerns" with no reviewer having run.

Two suggestions beyond the fix, if useful:

1. **`stubbed: true` should not be reported as `ok: true`.** A stub is a dropped reviewer.
2. **A spawn `ENOENT` should be a typed reason**, not free-text stderr — `MISSING_BINARY` already exists, and the `command-exists` probe passes here because `hasBinary()` *is* PATHEXT-aware. The probe and the spawn disagree about what "installed" means, which is the deeper bug.

## Fix

Resolve the configured name to a real file on PATH — PATHEXT-aware, the way `where`/cmd.exe do — **before** the extension test, then apply the existing #3086 gate to the resolved path. `shell: false`, the explicit argv array, and the existing `timeout` / `killSignal` / `maxBuffer` are all preserved; no config value is ever interpolated into a shell string.

Patch: `3086-resolve-windows-shim.patch` (one new helper, four changed lines).

Deliberate details in the resolver:

- **PATHEXT order, directory-major** — exactly cmd.exe's own search order.
- **The extensionless sibling is skipped.** npm drops both `codex` (a POSIX sh script for Git Bash) and `codex.cmd`. `where` lists the extensionless one *first*; taking it reintroduces the same `ENOENT`. Only `name + ext` candidates are considered, which is what cmd.exe does.
- **Unresolvable names fall through unchanged**, so Node's own lookup and today's error surface are preserved rather than replaced by a new failure mode.
- **`.exe` stays out of the cmd.exe gate**, per the note in `runWithTimeout` (#2667): mediating a real PE through cmd.exe breaks the timeout's process kill and risks cmd re-parsing an argument.
- **POSIX is untouched** — the helper returns its input unchanged off win32.

## Verification

Against pristine `@opengsd/gsd-core@1.10.0` with only this patch applied, same machine, same repo, same prompt:

```
ok   codex     replied (9.8s)
ok   gemini    replied (15.0s)
ok   opencode  replied (10.3s)
```

All three return `{"ok": true, "stubbed": false}` and the review artifact contains the sentinel byte-exactly (`od -c` → `LANECHECK7Q\n`; no ANSI escapes reach piped stdout).

Re-tested with a realistic source-grounded prompt (a 321-line GitHub Actions workflow, numbered): all three lanes returned concrete critiques citing verified `file:line` references, with codex at 28 s, gemini at 88 s and opencode at 49 s.

## Related

`bin/lib/review-lane-descriptor.cjs` declares `promptBudgetKey: null` for every CLI lane, so `review-lane plan` reports `promptBudget: null` and no size limit is ever applied. A prompt past the model's context window does not error — the model compacts and answers confidently about material it never read. Happy to file that separately if it is not already tracked.
