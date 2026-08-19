# Upstream submissions

**This directory is not where the carried patches live.** `tools/gsd-patch-check.js` carries them —
it finds every GSD install, detects each patch by shape, and reapplies with `--fix`. Read
`ai-setup-audit.md` §4.1 first; it is canonical.

What lives here is the other half: **the version we want upstream to take**, written against a
pristine release so it can be filed as-is. A patch we carry forever without ever offering it back is
a patch we have chosen to maintain forever.

| File | Against | Status |
|---|---|---|
| `3086-resolve-windows-shim.patch` | `@opengsd/gsd-core@1.10.0`, `gsd-core/bin/gsd-tools.cjs` | **superseded — never filed** |
| `3086-issue-body.md` | `open-gsd/gsd-core` issue #3086 | **superseded — never filed** |

## Superseded by 1.11.0 (2026-08-19)

Upstream reached the same fix without us, and a better-placed one. #3275 carried
the reviewer-lane symptom; epic #3411 named the actual cause — **four divergent
Windows binary resolvers, of which this patch was a fifth** — and closed it by
routing the lane spawn through `shell-command-projection`'s
`projectSpawnInvocation`, the PATH+PATHEXT resolver `hasBinary` already used. Both
issues are closed COMPLETED and the fix ships in 1.11.0, the current `latest`.

Do not file this. It is a duplicate of closed, released work, and #3411's seam is
the fix worth having: ours corrected one call site, theirs gave the machine one
owner for the question. `gsd-patch-check.js` detects the new shape and reports the
patch retired, so upgrading is all that is required.

Kept as the worked example the process is supposed to produce — and as the record
of what "not filed yet" costs. This sat unfiled long enough for someone else to
fix it, which is the good outcome only because the fix landed at all.

## `3086-resolve-windows-shim.patch`

The minimal form of the `windows-shim` patch: one new helper and four changed lines. Written with
clean naming rather than the `__gsd`-prefixed identifiers `gsd-patch-check.js` injects, because
those prefixes exist only so a local injection cannot collide with upstream — they would be noise
in a contribution.

Verified against pristine 1.10.0 with only this patch applied, on Windows 10 / Node 22:

```
ok   codex     replied (9.8s)
ok   gemini    replied (15.0s)
ok   opencode  replied (10.3s)
```

Apply with `git apply` from a `gsd-core` checkout root.

## What is deliberately NOT here

The `prompt-cap` patch — which, unlike the shim, is **still present in 1.11.0**: every CLI lane
declares `promptBudgetKey: null` while the three local-server lanes (`ollama`, `lm_studio`,
`llama_cpp`) declare real keys, so the cap exists and is simply never wired to the lanes that need
it most. Its context-window derivation reads the models.dev catalog opencode caches
locally, which is fine for one machine and wrong as a library dependency. Upstream would also want a
`PROMPT_EXCEEDS_CONTEXT` member in `LANE_UNAVAILABLE` (the local patch reuses the declared
`budget_too_small` rather than extending a frozen enum).

**Filed upstream as [#3691](https://github.com/open-gsd/gsd-core/issues/3691)** (2026-08-19), which
also carries a second defect found while verifying it: `review.max_prompt_tokens` is listed in
`config-schema.manifest.json` as a valid key but is declared by no capability, so the resolver drops
it and `budgetFor`'s documented fallback to it is dead code. That is why the missing per-lane key
cannot be worked around from config — neither route reaches a CLI lane. The issue asks for the two
config-level fixes, not for our patch's shape.
