# Upstream submissions

**This directory is not where the carried patches live.** `tools/gsd-patch-check.js` carries them —
it finds every GSD install, detects each patch by shape, and reapplies with `--fix`. Read
`ai-setup-audit.md` §4.1 first; it is canonical.

What lives here is the other half: **the version we want upstream to take**, written against a
pristine release so it can be filed as-is. A patch we carry forever without ever offering it back is
a patch we have chosen to maintain forever.

| File | Against | Status |
|---|---|---|
| `3086-resolve-windows-shim.patch` | `@opengsd/gsd-core@1.10.0`, `gsd-core/bin/gsd-tools.cjs` | **not filed** |
| `3086-issue-body.md` | `open-gsd/gsd-core` issue #3086 | **not filed** |

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

The `prompt-cap` patch. Its context-window derivation reads the models.dev catalog opencode caches
locally, which is fine for one machine and wrong as a library dependency. Upstream would also want a
`PROMPT_EXCEEDS_CONTEXT` member in `LANE_UNAVAILABLE` (the local patch reuses the declared
`budget_too_small` rather than extending a frozen enum). The defect is described at the end of
`3086-issue-body.md` so it is at least on the record.
