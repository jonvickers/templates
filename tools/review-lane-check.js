#!/usr/bin/env node
/**
 * review-lane-check — prove all four cross-AI review lanes actually WORK.
 *
 * Three-lane convergence is a machine property, not a repo setting: GSD skips
 * whichever tool hosts the session and reviews with the other three
 * (gsd-settings.md §7.2). So if any one of the four is broken, every review
 * silently runs with two reviewers and still reports success.
 *
 * `command -v` is not enough. Each lane has a failure mode that only shows up
 * when you actually run it:
 *
 *   claude    installed, not logged in
 *   codex     installed, auth expired
 *   gemini    installed, dies with ProjectIdRequiredError in any repo that
 *             commits its own root .env (it resolves env files first-match-wins
 *             and never merges, so the repo .env shadows ~/.gemini/.env)
 *   opencode  installed with an empty auth.json — works, but only on its free
 *             hosted models, so a missing model pin is a real difference
 *
 * This sends each lane a trivial prompt and checks for a sentinel in the reply.
 *
 * THE PROBE RUNS THROUGH GSD'S OWN RUNNER — `gsd-tools review-lane invoke` —
 * and not through a spawn of this script's own. That is the whole point, and it
 * is not negotiable: this script must fail whenever GSD fails, and every version
 * that reimplemented the invocation eventually diverged from it and reported
 * green through a real outage.
 *
 * It has already happened once, and expensively. This script used to spawn each
 * CLI itself with `shell: true`; GSD spawns with `shell: false` and an argv
 * array. On Windows the reviewer CLIs are `.cmd` shims, which `cmd.exe` resolves
 * via PATHEXT and `CreateProcess` does not — so every GSD reviewer lane died
 * with ENOENT and wrote its "returned no assistant text" stub, which reads
 * exactly like a reviewer with no concerns. This check passed throughout,
 * because a shell had resolved the shim for it. Two convergence cycles came back
 * with fabricated results.
 *
 * So: no argv table here, no spawn options here, no model flags here. The lane
 * definitions live in GSD (`bin/lib/review-lane-descriptor.cjs`) and this script
 * asks GSD to run them. A lane's pinned model, its stdin-vs-argv prompt channel,
 * its output channel, its handler and its timeout floor all come from there. If
 * GSD cannot be found, that is a FAILURE and not a skip — a probe that cannot
 * reproduce the real path proves nothing at all.
 *
 * NOT A DEFECT — do not "fix" it: ANSI escapes do not reach the sentinel match.
 * Measured 2026-08-19, piped stdout from all three lanes was byte-exactly
 * "LANECHECK7Q\n" (`od -c`). The banner and colour are terminal-only. Adding an
 * escape stripper would be dead code hiding a future real defect.
 *
 * It then checks the OPENCODE MODEL PINS, because "the lane replied" and "the
 * lane is a strong reviewer" are different facts. The opencode lane is our Grok
 * seat, and a reply proves neither which Grok answered nor at what reasoning
 * effort. Grok ships a new version every few weeks, so a pin written once is a
 * silent downgrade a month later — the check therefore derives the expected
 * model from opencode's own catalog rather than hard-coding a version.
 * gsd-settings.md §7.3 is canonical for all of it.
 *
 * Usage:
 *   node tools/review-lane-check.js              # probe from the current directory
 *   node tools/review-lane-check.js --json       # machine-readable
 *   node tools/review-lane-check.js --timeout 90 # seconds per lane (default 120)
 *   node tools/review-lane-check.js --lane gemini,codex
 *   node tools/review-lane-check.js --models-only  # skip the live probes
 *   node tools/review-lane-check.js --skip-models  # probes only, as before
 *   node tools/review-lane-check.js --fix          # rewrite a stale machine default
 *   node tools/review-lane-check.js --tools <path> # probe a specific gsd-tools.cjs
 *
 * `--tools` exists so the check can be pointed at a pristine or patched GSD and
 * shown to go red and green accordingly. A health check nobody has watched fail
 * is a health check nobody should trust.
 *
 * Run it from INSIDE a repo you care about, not just from home: the gemini
 * failure above is repo-dependent and a probe run from home will pass while
 * every review in that repo drops the lane.
 *
 * Exit codes: 0 everything checked passed · 1 something failed · 2 bad usage.
 */

'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const SENTINEL = 'LANECHECK7Q';
const PROMPT = `Reply with exactly this token and nothing else: ${SENTINEL}`;

// The four lanes of gsd-settings.md §7.2. NO invocation detail lives here — GSD's
// lane descriptor owns the binary, argv template, prompt channel, output channel,
// model flag and timeout floor, and this script drives it through
// `review-lane invoke`. All that remains per lane is what GSD cannot tell you:
// what a human should DO when it fails.
const LANES = {
  claude: {
    hint: 'run `claude` once interactively and sign in',
  },
  codex: {
    hint: 'run `codex` once interactively and sign in',
  },
  gemini: {
    hint:
      'ProjectIdRequiredError here means a repo .env is shadowing ~/.gemini/.env — ' +
      'add .gemini/.env in this repo (project id is in global-machine.md) and gitignore that file alone',
  },
  opencode: {
    hint: 'install with `npm i -g opencode-ai`; it works with no credentials on its free hosted models',
  },
};

function parseArgs(argv) {
  const opts = {
    json: false, timeout: 120, lanes: Object.keys(LANES),
    probes: true, models: true, fix: false, tools: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--timeout') opts.timeout = Number(argv[++i]);
    else if (a === '--lane') opts.lanes = String(argv[++i]).split(',').map((s) => s.trim());
    else if (a === '--skip-models') opts.models = false;
    else if (a === '--models-only') opts.probes = false;
    else if (a === '--fix') opts.fix = true;
    else if (a === '--tools') opts.tools = argv[++i];
    else if (a === '-h' || a === '--help') opts.help = true;
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(opts.timeout) || opts.timeout <= 0) {
    console.error('--timeout must be a positive number of seconds');
    process.exit(2);
  }
  const unknown = opts.lanes.filter((l) => !LANES[l]);
  if (unknown.length) {
    console.error(`unknown lane(s): ${unknown.join(', ')} — known: ${Object.keys(LANES).join(', ')}`);
    process.exit(2);
  }
  return opts;
}

/**
 * Ask GSD to plan a lane, so the probe can report which model will answer.
 *
 * Purely informational — a failure here never fails the lane. `promptCap` and
 * `promptCapReason` are present only on a GSD carrying the per-lane prompt-cap
 * patch; absent, the lane is simply uncapped and the field is omitted.
 */
function lanePlan(tools, cwd, slug, runDir) {
  const res = spawnSync(
    process.execPath,
    [tools, 'review-lane', 'plan', '--selected', slug, '--run-dir', runDir,
      '--repo-root', cwd, '--json'],
    { cwd, encoding: 'utf8', timeout: 60000, windowsHide: true },
  );
  try {
    const rows = JSON.parse(res.stdout);
    return (Array.isArray(rows) ? rows : [rows]).find((r) => r && r.slug === slug) || null;
  } catch {
    return null;
  }
}

/**
 * Probe one lane THROUGH `gsd-tools review-lane invoke`.
 *
 * Three properties this buys that a local spawn cannot:
 *   - it exercises GSD's real binary resolution, argv template and spawn options,
 *     so a defect in any of them fails here too;
 *   - it uses the model pinned in `review.models.<slug>`, resolved by GSD, so the
 *     probe answers with the reviewer that would actually review;
 *   - it distinguishes a REPLY from a STUB. GSD writes a diagnostic stub when a
 *     lane fails or returns nothing, and reports it as `stubbed: true` while
 *     `ok` stays true — a stub is a dropped reviewer, so this treats
 *     `stubbed: true` as a failure no matter what `ok` says.
 */
function probe(name, timeoutSec, cwd, tools) {
  const lane = LANES[name];
  const started = Date.now();
  const fail = (reason, detail) => ({
    lane: name, ok: false, reason, detail, ms: Date.now() - started,
  });

  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), `lanecheck-${name}-`));
  try {
    // GSD reads the prompt from `<run-dir>/gsd-review-prompt.md`; ask it where
    // rather than assuming, so a future rename cannot make this silently pass.
    const plan = lanePlan(tools, cwd, name, runDir);
    const promptPath = (plan && plan.promptPath) || path.join(runDir, 'gsd-review-prompt.md');
    fs.writeFileSync(promptPath, `${PROMPT}\n`);

    const res = spawnSync(
      process.execPath,
      [tools, 'review-lane', 'invoke', '--slug', name, '--selected', name,
        '--run-dir', runDir, '--repo-root', cwd, '--explicit', '--json'],
      { cwd, encoding: 'utf8', timeout: timeoutSec * 1000, windowsHide: true,
        maxBuffer: 16 * 1024 * 1024 },
    );

    const ms = Date.now() - started;
    const model = plan && plan.promptCapReason
      ? (String(plan.promptCapReason).match(/derived \(([^\s—:]+)/) || [])[1] || null
      : null;

    if (res.error && res.error.code === 'ETIMEDOUT') {
      return {
        ...fail(`no reply within ${timeoutSec}s`,
          'a real review needs ≥1800s, but a one-token prompt should not — treat this as a stuck lane'),
        model,
      };
    }
    if (res.error) {
      return { ...fail('gsd-tools failed to launch', String(res.error.message)), model };
    }

    let result = null;
    try { result = JSON.parse(res.stdout); } catch { /* handled below */ }
    const stderrTail = String(res.stderr || '').split(/\r?\n/)
      .map((l) => l.trim()).filter(Boolean).slice(-1)[0] || '';
    if (!result) {
      return {
        ...fail(`gsd-tools exit ${res.status}, unparseable result`,
          `${stderrTail.slice(0, 300) || '(no output)'}  ·  ${lane.hint}`),
        model,
      };
    }

    // A stub IS the outage. GSD reports ok:true, stubbed:true for a lane that
    // failed to launch or returned nothing — indistinguishable downstream from a
    // reviewer with no concerns, which is precisely why this must be red here.
    if (result.stubbed || result.ok === false) {
      const errFile = path.join(runDir, `gsd-review-${name}.err`);
      const captured = fs.existsSync(errFile) ? fs.readFileSync(errFile, 'utf8') : '';
      const line = `${result.detail || ''} ${captured} ${stderrTail}`
        .split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        .find((l) => /error|denied|unauthor|forbidden|not logged|sign in|credential|quota|ProjectId|ENOENT|EINVAL/i.test(l))
        || String(result.detail || captured || stderrTail || '(no diagnostic)').trim();
      return {
        ...fail(
          result.ok === false ? `lane refused: ${result.reason || 'unknown'}` : 'lane returned a STUB, not a review',
          `${line.slice(0, 300)}${line.length > 300 ? '…' : ''}  ·  ${lane.hint}`),
        model,
      };
    }

    // The lane claims a real reply — confirm the sentinel actually survived to
    // the artifact the review pipeline would read.
    const reviewFile = path.join(runDir, `gsd-review-${name}.md`);
    const body = fs.existsSync(reviewFile) ? fs.readFileSync(reviewFile, 'utf8') : '';
    if (!body.includes(SENTINEL)) {
      const first = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || '(empty review file)';
      return {
        ...fail('replied, but no sentinel in the review artifact',
          `${first.slice(0, 300)}  ·  ${lane.hint}`),
        model,
      };
    }

    return { lane: name, ok: true, reason: 'replied', ms, model };
  } catch (e) {
    return fail('probe error', String((e && e.message) || e));
  } finally {
    try { fs.rmSync(runDir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Model pins — is the opencode lane actually the latest Grok, and at what effort
// ---------------------------------------------------------------------------

const HOME = process.env.HOME || process.env.USERPROFILE || '';

function readJsonish(file) {
  // opencode accepts .jsonc. Strip // and /* */ comments and trailing commas so
  // a commented config does not read as "no model configured".
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const stripped = raw
      .replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, str) => str || '')
      .replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

/**
 * The newest Grok, read from the models.dev catalog opencode caches locally.
 *
 * Deriving this beats a hard-coded constant: a constant is right the day it is
 * written and a silent downgrade the day xAI ships the next one. The catalog
 * carries `release_date`, so "latest" is a fact we can look up.
 *
 * Only plain `grok-<n>[.<n>]` ids are eligible. xAI also publishes dated
 * snapshots (`grok-4.20-0309-reasoning`), image models, and `grok-build-*`;
 * ranking those by date would eventually hand the reviewer seat to a snapshot
 * or a non-chat model. The excluded ids are reported rather than dropped
 * silently, so a genuinely new naming scheme shows up as something to look at.
 */
function latestGrok() {
  const cachePaths = [
    process.env.XDG_CACHE_HOME && path.join(process.env.XDG_CACHE_HOME, 'opencode', 'models.json'),
    HOME && path.join(HOME, '.cache', 'opencode', 'models.json'),
  ].filter(Boolean);

  const file = cachePaths.find((p) => fs.existsSync(p));
  if (!file) {
    return { error: `no opencode model catalog at ${cachePaths.join(' or ')} — run \`opencode models\` once to populate it` };
  }

  const catalog = readJsonish(file);
  const models = catalog && catalog.xai && catalog.xai.models;
  if (!models) return { error: `${file} has no xai.models section` };

  const eligible = [];
  const skipped = [];
  for (const [id, meta] of Object.entries(models)) {
    if (/^grok-\d+(\.\d+)?$/.test(id) && meta && meta.reasoning) eligible.push({ id, release: meta.release_date || '' });
    else if (/^grok-/.test(id)) skipped.push(id);
  }
  if (!eligible.length) return { error: `no plain grok-<version> reasoning model in ${file}` };

  eligible.sort((a, b) => (a.release < b.release ? 1 : a.release > b.release ? -1 : a.id < b.id ? 1 : -1));
  const ageDays = Math.floor((Date.now() - fs.statSync(file).mtimeMs) / 86400000);
  return { model: `xai/${eligible[0].id}`, release: eligible[0].release, file, ageDays, skipped, all: eligible };
}

/** Every opencode config that could set a default model, and what each one says. */
function opencodeDefaults() {
  const dirs = [
    process.env.XDG_CONFIG_HOME && path.join(process.env.XDG_CONFIG_HOME, 'opencode'),
    HOME && path.join(HOME, '.config', 'opencode'),
  ].filter(Boolean);

  const files = [];
  if (process.env.OPENCODE_CONFIG) files.push(process.env.OPENCODE_CONFIG);
  for (const d of dirs) for (const f of ['opencode.json', 'opencode.jsonc']) files.push(path.join(d, f));

  return files
    .filter((f) => fs.existsSync(f))
    .map((f) => ({ file: f, model: (readJsonish(f) || {}).model }));
}

/**
 * Rewrite the machine default's `model` in place, under --fix.
 *
 * Only ever touches that one key, and only in a strict-JSON file: reformatting
 * someone's commented .jsonc to change one string would lose the comments, so a
 * file that does not round-trip is reported rather than mangled.
 */
function applyDefault(file, model) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw); // deliberately strict — see above
    parsed.model = model;
    fs.writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `${e.message} — edit the "model" key by hand` };
  }
}

/** gsd-tools, found the way GSD's own workflow shims find it. */
function findGsdTools(cwd) {
  const candidates = [
    path.join(cwd, 'gsd-core', 'bin', 'gsd-tools.cjs'),
    path.join(cwd, '.claude', 'gsd-core', 'bin', 'gsd-tools.cjs'),
    process.env.CLAUDE_CONFIG_DIR && path.join(process.env.CLAUDE_CONFIG_DIR, 'gsd-core', 'bin', 'gsd-tools.cjs'),
    HOME && path.join(HOME, '.claude', 'gsd-core', 'bin', 'gsd-tools.cjs'),
    process.env.CODEX_HOME && path.join(process.env.CODEX_HOME, 'gsd-core', 'bin', 'gsd-tools.cjs'),
    HOME && path.join(HOME, '.codex', 'gsd-core', 'bin', 'gsd-tools.cjs'),
    HOME && path.join(HOME, '.gemini', 'gsd-core', 'bin', 'gsd-tools.cjs'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/**
 * The reasoning effort the automatic opencode lane will actually use.
 *
 * GSD resolves every lane's effort from ONE agent — gsd-plan-checker — and turns
 * it into that host's argv syntax (`--variant <level>` for opencode). So this is
 * a property of the repo's effort resolution, not of the reviewer config, and
 * there is no per-lane knob for it.
 */
function laneVariant(cwd) {
  const tools = findGsdTools(cwd);
  if (!tools) return { skipped: 'gsd-tools not found — no GSD install to ask' };
  const res = spawnSync(
    process.execPath,
    [tools, 'query', 'resolve-execution', 'gsd-plan-checker', '--host', 'opencode', '--pick', 'effort_argv_string'],
    { cwd, encoding: 'utf8', timeout: 30000, windowsHide: true },
  );
  if (res.status !== 0) return { skipped: `gsd-tools query failed: ${String(res.stderr || '').trim().slice(0, 160)}` };
  const argv = String(res.stdout || '').trim();
  return { argv, level: (argv.match(/--variant\s+(\S+)/) || [])[1] || null };
}

function modelChecks(cwd, fix) {
  const out = [];
  const latest = latestGrok();

  if (latest.error) {
    out.push({ check: 'latest grok', ok: false, reason: 'cannot determine', detail: latest.error });
    return out;
  }

  const notes = [];
  if (latest.ageDays > 7) {
    notes.push(`catalog is ${latest.ageDays} days old — run \`opencode models\` to refresh before trusting this`);
  }
  if (latest.skipped.length) {
    // Named, not hidden: if xAI renames its chat line these become the thing to
    // look at, and a silent exclusion would just look like the catalog is thin.
    notes.push(`not eligible (snapshot / image / non-reasoning): ${latest.skipped.sort().join(', ')}`);
  }
  out.push({
    check: 'latest grok',
    ok: true,
    reason: `${latest.model} (released ${latest.release})`,
    detail: notes.length ? notes.join('  ·  ') : undefined,
  });

  // 1. opencode's own default. This governs the lane whenever the repo pin is
  //    unset, and it is the value a human sees in an interactive opencode run.
  const defaults = opencodeDefaults();
  const declared = defaults.filter((d) => d.model);
  if (!declared.length) {
    out.push({
      check: 'opencode default',
      ok: false,
      reason: 'no model set',
      detail: `set "model": "${latest.model}" in ${HOME}/.config/opencode/opencode.json — without it opencode picks whatever it likes, which with an empty auth.json is a free hosted model`,
    });
  } else if (declared.length > 1 && new Set(declared.map((d) => d.model)).size > 1) {
    out.push({
      check: 'opencode default',
      ok: false,
      reason: 'two configs disagree',
      detail: declared.map((d) => `${d.file} → ${d.model}`).join('  ·  '),
    });
  } else if (declared[0].model !== latest.model) {
    const fixed = fix ? applyDefault(declared[0].file, latest.model) : null;
    out.push({
      check: 'opencode default',
      ok: Boolean(fixed && fixed.ok),
      reason: fixed && fixed.ok
        ? `${declared[0].model} → ${latest.model} (updated)`
        : `${declared[0].model}, not ${latest.model}`,
      detail: fixed && !fixed.ok
        ? `could not rewrite ${declared[0].file}: ${fixed.error}`
        : fixed
          ? declared[0].file
          : `${declared[0].file} — a Grok version behind is a quieter downgrade than a broken lane, because the lane still replies. Re-run with --fix to update it.`,
    });
  } else {
    out.push({ check: 'opencode default', ok: true, reason: `${declared[0].model} (${declared[0].file})` });
  }

  // 2. The repo pin, which should NOT be set. Verified against GSD's own
  //    resolver: with review.models.opencode unset the lane omits --model
  //    entirely, so opencode falls back to the machine default above. That
  //    makes the version live in ONE file per machine instead of one per repo.
  //    A Grok version goes stale every few weeks, and a stale pin still replies
  //    — twelve copies of a number that silently rots is the failure mode, not
  //    the fix. (This is why opencode differs from `claude: "sonnet"`: that pin
  //    is a stable alias the vendor repoints, so it never goes stale.)
  const planningConfig = path.join(cwd, '.planning', 'config.json');
  if (!fs.existsSync(planningConfig)) {
    out.push({ check: 'repo pin', ok: true, reason: 'no .planning/config.json here — not a GSD repo' });
  } else {
    const cfg = readJsonish(planningConfig) || {};
    const pin = cfg.review && cfg.review.models ? cfg.review.models.opencode : undefined;
    if (pin === undefined || pin === null || pin === '') {
      out.push({
        check: 'repo pin',
        ok: true,
        reason: 'review.models.opencode unset — lane inherits the machine default (correct)',
      });
    } else if (pin === latest.model) {
      out.push({
        check: 'repo pin',
        ok: true,
        reason: `review.models.opencode = ${pin} — current, but it will rot`,
        detail: 'prefer unsetting it so the version lives only in the machine config: gsd-tools config-set review.models.opencode null',
      });
    } else {
      out.push({
        check: 'repo pin',
        ok: false,
        reason: `review.models.opencode = ${JSON.stringify(pin)}, but the newest Grok is ${latest.model}`,
        detail: 'this repo overrides the machine default with a stale model — unset it: gsd-tools config-set review.models.opencode null',
      });
    }
  }

  // 3. Reasoning effort. Reported, never failed: the only lever is an `effort`
  //    block, and adding one flattens GSD's shipped per-agent tiers onto
  //    effort.default — it drops gsd-planner from xhigh to high. Trading the
  //    planner's effort for the reviewer's is the wrong trade, so the fix is to
  //    run a high-effort Grok pass by hand. gsd-settings.md §5 and §7.3.
  const variant = laneVariant(cwd);
  if (variant.skipped) {
    out.push({ check: 'lane effort', ok: true, reason: `not checked — ${variant.skipped}` });
  } else if (variant.level === 'high' || variant.level === 'xhigh' || variant.level === 'max') {
    out.push({ check: 'lane effort', ok: true, reason: `${variant.argv}` });
  } else {
    out.push({
      check: 'lane effort',
      ok: true,
      reason: `${variant.argv || 'none'} — the automatic lane runs Grok at low reasoning`,
      detail:
        'expected, and not worth an `effort` block to change: any effort block flattens GSD\'s per-agent tiers ' +
        '(gsd-planner drops xhigh→high). For a high-effort pass run it by hand: ' +
        `opencode run --model ${latest.model} --variant high --format json - < prompt.md`,
    });
  }

  return out;
}

/**
 * Repo-scoped review config that a working lane cannot vouch for.
 *
 * A lane that replies proves the CLI is reachable. It says nothing about whether this repo will
 * ASK for it. `review.default_reviewers` is the setting that decides, and a hard-coded list is
 * wrong in a way no probe can see: GSD skips whichever tool is hosting the session and reviews
 * with the others, so `["codex","gemini","opencode"]` is correct only from Claude Code. Run the
 * same review from Codex and the host-skip removes codex from a list that never contained
 * `claude` — two reviewers instead of three, reported as a success.
 *
 * Found in three repos on this machine at once, which is why it is a check and not a paragraph.
 * gsd-settings.md §7.2 has the rule; this is its exit code.
 */
function repoConfigChecks(cwd) {
  const planningConfig = path.join(cwd, '.planning', 'config.json');
  if (!fs.existsSync(planningConfig)) {
    return [{ check: 'reviewer set', ok: true, reason: 'no .planning/config.json here — not a GSD repo' }];
  }
  const cfg = readJsonish(planningConfig) || {};
  const configured = cfg.review ? cfg.review.default_reviewers : undefined;

  if (configured === undefined || configured === null) {
    return [{
      check: 'reviewer set',
      ok: true,
      reason: 'review.default_reviewers unset — GSD picks every detected lane but the host (correct)',
    }];
  }

  // `reviewer_instances` is the one legitimate reason to set it: instance names are selectable
  // ONLY through default_reviewers, so a repo using them accepts the host-baking cost knowingly.
  // Reported rather than failed — it is a deliberate trade, not a mistake.
  if (cfg.review.reviewer_instances && Object.keys(cfg.review.reviewer_instances).length > 0) {
    return [{
      check: 'reviewer set',
      ok: true,
      reason: `review.default_reviewers = ${JSON.stringify(configured)}, required by reviewer_instances`,
      detail: 'instances are selectable only through this list, so it is a deliberate trade — but confirm the list still names the right set from every runtime you launch reviews from, since the host is skipped from it',
    }];
  }

  const list = Array.isArray(configured) ? configured : [configured];
  return [{
    check: 'reviewer set',
    ok: false,
    reason: `review.default_reviewers = ${JSON.stringify(list)} — this bakes in which tool is the host`,
    detail: 'GSD already skips the host and reviews with the rest, so a fixed list is right from one runtime and short a reviewer from the others. Unset it and pin models per lane instead (gsd-settings.md §7.2).',
  }];
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
    process.exit(0);
  }

  const cwd = process.cwd();
  const inRepo = fs.existsSync(path.join(cwd, '.git'));
  const shadowingEnv = fs.existsSync(path.join(cwd, '.env')) && !fs.existsSync(path.join(cwd, '.gemini', '.env'));

  // The probe runs through GSD's runner, so no GSD means no probe. That is a
  // FAILURE, never a skip: the whole value of this script is that it fails
  // wherever GSD fails, and a green "couldn't check" is the exact shape of the
  // outage it exists to catch.
  const tools = opts.tools || findGsdTools(cwd);
  const toolsMissing = opts.probes && (!tools || !fs.existsSync(tools));

  if (!opts.json) {
    console.log(`review lanes — probing from ${cwd}`);
    if (tools && !toolsMissing) console.log(`  through ${tools}`);
    if (!inRepo) console.log('  note: not a git repo. The gemini lane fails repo-by-repo — probe inside each repo too.');
    if (shadowingEnv) console.log('  note: this repo has a root .env and no .gemini/.env — expect the gemini lane to fail here.');
    console.log('');
  }

  const results = !opts.probes ? [] : opts.lanes.map((l) => {
    const r = toolsMissing
      ? {
          lane: l,
          ok: false,
          reason: 'cannot probe — no gsd-tools found',
          detail: `${opts.tools ? `--tools ${opts.tools} does not exist` : 'no GSD install under ~/.claude, ~/.codex or this repo'}` +
            ' — this check runs lanes through GSD\'s own runner and will not fake a pass without it',
          ms: 0,
        }
      : probe(l, opts.timeout, cwd, tools);
    if (!opts.json) {
      const mark = r.ok ? 'ok  ' : 'FAIL';
      const via = r.model ? ` [${r.model}]` : '';
      console.log(`  ${mark} ${r.lane.padEnd(9)} ${r.reason}${r.ok ? ` (${(r.ms / 1000).toFixed(1)}s)` : ''}${via}`);
      if (!r.ok && r.detail) console.log(`       ${r.detail}`);
    }
    return r;
  });

  const models = !opts.models ? [] : modelChecks(cwd, opts.fix);
  if (models.length && !opts.json) {
    console.log('');
    console.log('  opencode model pins — a lane that replies can still be the wrong Grok:');
    for (const m of models) {
      console.log(`  ${m.ok ? 'ok  ' : 'FAIL'} ${m.check.padEnd(18)} ${m.reason}`);
      if (m.detail) console.log(`       ${m.detail}`);
    }
  }

  // Always run: it is a file read, it needs no CLI, and `--models-only` is exactly the invocation
  // someone uses to check config without paying for probes.
  const repoConfig = repoConfigChecks(cwd);
  if (!opts.json) {
    console.log('');
    console.log('  repo review config — a lane that replies can still never be asked:');
    for (const c of repoConfig) {
      console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.check.padEnd(18)} ${c.reason}`);
      if (c.detail) console.log(`       ${c.detail}`);
    }
  }

  const failed = [...results, ...models, ...repoConfig].filter((r) => !r.ok);

  if (opts.json) {
    console.log(JSON.stringify({ cwd, in_repo: inRepo, gsd_tools: tools || null, results, models, repo_config: repoConfig, failed: failed.length }, null, 2));
  } else {
    console.log('');
    const laneFails = results.filter((r) => !r.ok);
    if (results.length) {
      if (laneFails.length === 0) {
        const complete = results.length === Object.keys(LANES).length;
        console.log(
          complete
            ? `  all ${results.length} lanes replied — a review from any host gets its full three.`
            : `  ${results.length} of ${Object.keys(LANES).length} lanes probed, all replied. ` +
              'Run without --lane to prove the full set.'
        );
      } else {
        console.log(
          `  ${laneFails.length} of ${results.length} lanes broken: ${laneFails.map((f) => f.lane).join(', ')}.\n` +
          '  Every review from a host other than a broken lane silently runs one reviewer short.'
        );
      }
    }
    const modelFails = models.filter((m) => !m.ok);
    if (modelFails.length) {
      console.log(`  ${modelFails.length} model pin problem(s): ${modelFails.map((m) => m.check).join(', ')}.`);
    } else if (models.length) {
      console.log('  opencode is pinned to the newest Grok everywhere it is configured.');
    }
    const configFails = repoConfig.filter((c) => !c.ok);
    if (configFails.length) {
      console.log(
        `  ${configFails.length} repo config problem(s): ${configFails.map((c) => c.check).join(', ')}.\n` +
        '  Working lanes do not help if this repo asks for the wrong set.'
      );
    }
  }

  process.exit(failed.length ? 1 : 0);
}

main();
