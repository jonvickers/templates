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

const SENTINEL = 'LANECHECK7Q';
const PROMPT = `Reply with exactly this token and nothing else: ${SENTINEL}`;

// The four lanes of gsd-settings.md §7.2, with the invocation each one needs.
// `stdin: true` means the prompt goes on stdin rather than in argv.
const LANES = {
  claude: {
    cmd: 'claude',
    args: ['-p', PROMPT, '--model', 'sonnet'],
    hint: 'run `claude` once interactively and sign in',
  },
  codex: {
    cmd: 'codex',
    args: [
      'exec',
      '--ephemeral',
      '--dangerously-bypass-approvals-and-sandbox',
      '--skip-git-repo-check',
      '-c',
      'model_reasoning_effort="low"',
      '-',
    ],
    stdin: true,
    hint: 'run `codex` once interactively and sign in',
  },
  gemini: {
    cmd: 'gemini',
    args: ['-p', PROMPT],
    hint:
      'ProjectIdRequiredError here means a repo .env is shadowing ~/.gemini/.env — ' +
      'add .gemini/.env in this repo (project id is in global-machine.md) and gitignore that file alone',
  },
  opencode: {
    cmd: 'opencode',
    args: ['run', PROMPT],
    hint: 'install with `npm i -g opencode-ai`; it works with no credentials on its free hosted models',
  },
};

function parseArgs(argv) {
  const opts = { json: false, timeout: 120, lanes: Object.keys(LANES), probes: true, models: true, fix: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--timeout') opts.timeout = Number(argv[++i]);
    else if (a === '--lane') opts.lanes = String(argv[++i]).split(',').map((s) => s.trim());
    else if (a === '--skip-models') opts.models = false;
    else if (a === '--models-only') opts.probes = false;
    else if (a === '--fix') opts.fix = true;
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

function onPath(cmd) {
  // `command -v` equivalent that also finds Windows .cmd/.ps1 shims.
  const probe = process.platform === 'win32'
    ? spawnSync('where', [cmd], { encoding: 'utf8' })
    : spawnSync('command', ['-v', cmd], { encoding: 'utf8', shell: true });
  return probe.status === 0;
}

/**
 * Windows needs shell:true (claude/codex/gemini/opencode are .cmd/.ps1 shims),
 * but Node's shell:true joins argv with plain spaces and quotes NOTHING — so any
 * argument containing a space arrives as several arguments. That silently
 * shredded the probe prompt and made two working lanes look broken. Quote every
 * argument ourselves and hand the shell one finished command line.
 */
function shellCommandLine(cmd, args) {
  const quote = (a) => (/[\s"&|<>^()]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a);
  return [cmd, ...args].map(quote).join(' ');
}

function probe(name, timeoutSec) {
  const lane = LANES[name];
  const started = Date.now();

  if (!onPath(lane.cmd)) {
    return { lane: name, ok: false, reason: 'not installed', detail: lane.hint, ms: 0 };
  }

  const useShell = process.platform === 'win32';
  const res = useShell
    ? spawnSync(shellCommandLine(lane.cmd, lane.args), {
        input: lane.stdin ? PROMPT : undefined,
        encoding: 'utf8',
        timeout: timeoutSec * 1000,
        shell: true,
        windowsHide: true,
      })
    : spawnSync(lane.cmd, lane.args, {
        input: lane.stdin ? PROMPT : undefined,
        encoding: 'utf8',
        timeout: timeoutSec * 1000,
        windowsHide: true,
      });

  const ms = Date.now() - started;
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;

  if (res.error && res.error.code === 'ETIMEDOUT') {
    return {
      lane: name,
      ok: false,
      reason: `no reply within ${timeoutSec}s`,
      detail: 'a real review needs ≥1800s, but a one-token prompt should not — treat this as a stuck lane',
      ms,
    };
  }
  if (res.error) {
    return { lane: name, ok: false, reason: 'failed to launch', detail: String(res.error.message), ms };
  }
  if (out.includes(SENTINEL)) {
    return { lane: name, ok: true, reason: 'replied', ms };
  }

  // Surface the most informative line rather than a wall of output.
  const firstError =
    out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      .find((l) => /error|denied|unauthor|forbidden|not logged|sign in|credential|quota|ProjectId/i.test(l)) ||
    out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(-1)[0] ||
    '(no output)';

  return {
    lane: name,
    ok: false,
    reason: `exit ${res.status}, no sentinel in reply`,
    detail: `${firstError.slice(0, 300)}${firstError.length > 300 ? '…' : ''}  ·  ${lane.hint}`,
    ms,
  };
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

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
    process.exit(0);
  }

  const cwd = process.cwd();
  const inRepo = fs.existsSync(path.join(cwd, '.git'));
  const shadowingEnv = fs.existsSync(path.join(cwd, '.env')) && !fs.existsSync(path.join(cwd, '.gemini', '.env'));

  if (!opts.json) {
    console.log(`review lanes — probing from ${cwd}`);
    if (!inRepo) console.log('  note: not a git repo. The gemini lane fails repo-by-repo — probe inside each repo too.');
    if (shadowingEnv) console.log('  note: this repo has a root .env and no .gemini/.env — expect the gemini lane to fail here.');
    console.log('');
  }

  const results = !opts.probes ? [] : opts.lanes.map((l) => {
    const r = probe(l, opts.timeout);
    if (!opts.json) {
      const mark = r.ok ? 'ok  ' : 'FAIL';
      console.log(`  ${mark} ${r.lane.padEnd(9)} ${r.reason}${r.ok ? ` (${(r.ms / 1000).toFixed(1)}s)` : ''}`);
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

  const failed = [...results, ...models].filter((r) => !r.ok);

  if (opts.json) {
    console.log(JSON.stringify({ cwd, in_repo: inRepo, results, models, failed: failed.length }, null, 2));
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
  }

  process.exit(failed.length ? 1 : 0);
}

main();
