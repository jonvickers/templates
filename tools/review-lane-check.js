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
 * Usage:
 *   node tools/review-lane-check.js              # probe from the current directory
 *   node tools/review-lane-check.js --json       # machine-readable
 *   node tools/review-lane-check.js --timeout 90 # seconds per lane (default 120)
 *   node tools/review-lane-check.js --lane gemini,codex
 *
 * Run it from INSIDE a repo you care about, not just from home: the gemini
 * failure above is repo-dependent and a probe run from home will pass while
 * every review in that repo drops the lane.
 *
 * Exit codes: 0 all probed lanes replied · 1 at least one failed · 2 bad usage.
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
  const opts = { json: false, timeout: 120, lanes: Object.keys(LANES) };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--timeout') opts.timeout = Number(argv[++i]);
    else if (a === '--lane') opts.lanes = String(argv[++i]).split(',').map((s) => s.trim());
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

  const results = opts.lanes.map((l) => {
    const r = probe(l, opts.timeout);
    if (!opts.json) {
      const mark = r.ok ? 'ok  ' : 'FAIL';
      console.log(`  ${mark} ${r.lane.padEnd(9)} ${r.reason}${r.ok ? ` (${(r.ms / 1000).toFixed(1)}s)` : ''}`);
      if (!r.ok && r.detail) console.log(`       ${r.detail}`);
    }
    return r;
  });

  const failed = results.filter((r) => !r.ok);

  if (opts.json) {
    console.log(JSON.stringify({ cwd, in_repo: inRepo, results, failed: failed.length }, null, 2));
  } else {
    console.log('');
    if (failed.length === 0) {
      const complete = results.length === Object.keys(LANES).length;
      console.log(
        complete
          ? `  all ${results.length} lanes replied — a review from any host gets its full three.`
          : `  ${results.length} of ${Object.keys(LANES).length} lanes probed, all replied. ` +
            'Run without --lane to prove the full set.'
      );
    } else {
      console.log(
        `  ${failed.length} of ${results.length} lanes broken: ${failed.map((f) => f.lane).join(', ')}.\n` +
        '  Every review from a host other than a broken lane silently runs one reviewer short.'
      );
    }
  }

  process.exit(failed.length ? 1 : 0);
}

main();
