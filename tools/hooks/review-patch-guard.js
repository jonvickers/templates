#!/usr/bin/env node
/**
 * review-patch-guard — refuse to start a cross-AI review on an unpatched GSD runtime.
 *
 * `gsd-patch-check.js` already knows how to prove the two carried runtime patches survived the
 * last `/gsd-update`, and how to reapply them. What it lacked was a caller. Both `ai-setup-audit.md`
 * §4.1 and `gsd-settings.md` §7.2 said "run it after every update" — a rule enforced by human
 * memory, which is the same class of defect as the patch it guards: nothing errors when it is
 * skipped. A review on an unpatched runtime does not fail. Every lane dies with ENOENT and writes a
 * stub, and the review reports success having had zero reviewers.
 *
 * So this runs the check at the only moment it is load-bearing: immediately before GSD spawns a
 * reviewer lane. Wired as a Claude Code PreToolUse hook on `Bash`, it exits silently for every
 * command that is not a review, repairs a reverted patch in place when it can, and BLOCKS the
 * review when it cannot. Blocking is the point — a review that cannot run should look like a
 * failure, never like a clean bill of health.
 *
 * Registration lives in the machine's `~/.claude/settings.json` (an absolute path to this file in
 * the templates clone, so there is no copy to drift). GSD's own installer rewrites only hook
 * entries whose script basename it manages — `runtime-hooks-surface.cjs` skips every foreign entry
 * — so this survives `/gsd-update`, which is the entire requirement.
 *
 * Fails OPEN on its own errors. A broken guard must not wedge every Bash call on the machine; it
 * says so on the way past instead of pretending it checked.
 *
 * Protocol: stdin is the PreToolUse payload; exit 0 proceeds, exit 2 blocks with stderr shown to
 * the model.
 */

'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CHECK = path.join(__dirname, '..', 'gsd-patch-check.js');

/**
 * Commands that reach a reviewer lane.
 *
 * `review-lane` is GSD's own subcommand and covers the plan/invoke path every reviewer goes
 * through, whichever workflow called it (/gsd-review, /gsd-code-review, plan-review-convergence).
 * The lane-check tool is included deliberately: it drives the same runner, so a stale patch would
 * make the health check itself report the outage it exists to detect.
 */
const REVIEW_COMMAND = /\breview-lane\b|\breview-lane-check(\.js)?\b/;

function readStdin() {
  const fs = require('node:fs');
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/** Non-blocking note to the user; still exit 0. */
function pass(systemMessage) {
  if (systemMessage) process.stdout.write(`${JSON.stringify({ systemMessage })}\n`);
  process.exit(0);
}

function block(reason) {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
}

function main() {
  const raw = readStdin();
  if (!raw) process.exit(0);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0); // Not a shape we understand — not ours to judge.
  }

  if (payload?.tool_name !== 'Bash') process.exit(0);
  const command = String(payload?.tool_input?.command ?? '');
  if (!REVIEW_COMMAND.test(command)) process.exit(0);

  // Past this point the command is a review, so the cost of being thorough is paid once per
  // review rather than once per shell command.
  const r = spawnSync(process.execPath, [CHECK, '--fix', '--json'], {
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });

  if (r.error || typeof r.stdout !== 'string' || !r.stdout.trim()) {
    pass(`review-patch-guard: could not run ${path.basename(CHECK)} (${r.error?.code ?? 'no output'}). ` +
      'The GSD runtime patches were NOT verified — check them by hand before trusting this review.');
  }

  let result;
  try {
    result = JSON.parse(r.stdout);
  } catch {
    pass('review-patch-guard: gsd-patch-check produced unreadable output. The GSD runtime patches ' +
      'were NOT verified — check them by hand before trusting this review.');
  }

  const installs = Array.isArray(result?.installs) ? result.installs : [];
  const broken = installs.filter((i) => i.status !== 'patched');
  const repaired = installs.filter((i) => i.fixed);

  if (broken.length > 0) {
    block(
      'Cross-AI review BLOCKED — the GSD runtime is missing a patch it needs to spawn reviewers, ' +
      'and it could not be reapplied automatically:\n' +
      broken.map((i) => `  ${i.patch} @ ${i.root} (${i.version}) — ${i.status}: ${i.detail}`).join('\n') +
      `\n\nWithout it every reviewer lane dies with ENOENT and writes a stub that reads like a ` +
      `reviewer with no concerns. Fix it first:\n  node ${CHECK} --fix\n` +
      'See ai-setup-audit.md §4.1.',
    );
  }

  if (repaired.length > 0) {
    // Name the patches rather than describing their effect: the set varies (an update may revert
    // one, both, or — once upstream owns a fix — none), and a fixed sentence would be wrong for
    // every case but the one it was written for.
    pass(
      `review-patch-guard: reapplied ${repaired.length} GSD runtime patch(es) an update had reverted ` +
      `(${[...new Set(repaired.map((i) => i.patch))].join(', ')}). The review proceeds.`,
    );
  }

  process.exit(0);
}

try {
  main();
} catch (err) {
  // Fail open, loudly. A guard that crashes must not become an outage of its own.
  process.stdout.write(`${JSON.stringify({
    systemMessage: `review-patch-guard crashed (${err && err.message}); GSD runtime patches were NOT verified.`,
  })}\n`);
  process.exit(0);
}
