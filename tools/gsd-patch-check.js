#!/usr/bin/env node
/**
 * gsd-patch-check — prove the local GSD runtime patches survived the last update.
 *
 * GSD installs per config directory (`~/.claude/gsd-core`, `~/.codex/gsd-core`, ...) and
 * `/gsd-update` REPLACES those files wholesale. A fix we carry locally is therefore reverted on a
 * schedule we do not control, silently, for every project at once — the installs are shared, so
 * one update takes cross-AI review out in every repo on the machine simultaneously.
 *
 * This script finds every install, checks each carried patch, and reapplies it with `--fix`.
 *
 * ── The patch it carries ───────────────────────────────────────────────────────────────────
 *
 * WINDOWS-SHIM (open-gsd/gsd-core #3086, still present in 1.10.0 — the current `latest`):
 *   `review-lane invoke` spawns the reviewer CLI with `shell:false` and an argv array, then
 *   decides whether to mediate through cmd.exe by testing whether the CONFIGURED binary name ends
 *   in `.cmd`/`.bat`. Every lane configures a BARE name (`codex`, `gemini`, `opencode`), so the
 *   test is always false, and Windows CreateProcess — which does not apply PATHEXT — cannot start
 *   an npm `.cmd` shim. Every lane dies instantly with ENOENT.
 *
 *   `claude` is the sole survivor, because it installs as a real `.exe`. It is also the one lane
 *   GSD skips when Claude Code hosts the session, so a Claude-driven review reaches ZERO working
 *   reviewers — and a dead lane writes a stub that reads exactly like a reviewer with no concerns.
 *
 *   Fix: resolve the configured name on PATH the way cmd.exe does (PATHEXT-aware) BEFORE testing
 *   the extension, then let the existing gate run against the resolved path. Unresolvable names
 *   fall through unchanged, so Node's own lookup and today's error surface are preserved.
 *
 * ── What this does NOT prove ───────────────────────────────────────────────────────────────
 *
 * That the lanes answer. A patched runtime with a logged-out CLI behind it is still a dead
 * reviewer. This is the cheap static half; `review-lane-check.js`, run INSIDE a repo, is the live
 * half that drives GSD's own runner end to end. Run both after every `/gsd-update` — this one
 * first, because it explains the failure the other one reports.
 *
 * Usage:
 *   node tools/gsd-patch-check.js           # report every install, exit 1 if any is unpatched
 *   node tools/gsd-patch-check.js --fix     # reapply what is missing, then re-verify
 *   node tools/gsd-patch-check.js --json    # machine-readable
 *
 * Exit: 0 every install carries every patch · 1 something is missing, unknown, or unfixable.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();

/** Every config dir that can hold an install, in the order GSD's own shim resolver checks them. */
function installRoots() {
  const roots = [
    process.env.CLAUDE_CONFIG_DIR,
    HOME && path.join(HOME, '.claude'),
    process.env.CODEX_HOME,
    HOME && path.join(HOME, '.codex'),
    process.env.GEMINI_CONFIG_DIR,
    HOME && path.join(HOME, '.gemini'),
    process.env.CURSOR_CONFIG_DIR,
    HOME && path.join(HOME, '.cursor'),
    process.env.OPENCODE_CONFIG_DIR,
    HOME && path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, '.config'), 'opencode'),
    HOME && path.join(HOME, '.hermes'),
    // A repo-local install shadows the machine ones for that repo, so it needs the patch too.
    path.join(process.cwd(), '.claude'),
    process.cwd(),
  ].filter(Boolean);

  const seen = new Set();
  const found = [];
  for (const root of roots) {
    const tools = path.join(root, 'gsd-core', 'bin', 'gsd-tools.cjs');
    let real;
    try { real = fs.realpathSync(tools); } catch { continue; }
    if (seen.has(real)) continue;
    seen.add(real);
    let version = 'unknown';
    try { version = fs.readFileSync(path.join(root, 'gsd-core', 'VERSION'), 'utf8').trim(); } catch { /* older layout */ }
    found.push({ root, tools: real, version });
  }
  return found;
}

// ── WINDOWS-SHIM ───────────────────────────────────────────────────────────────────────────
//
// The site is identified by BEHAVIOUR, never by line number or by a marker comment we wrote:
// `const spawnArgv = winShim ? [..., ...argv] : argv;` is the review-lane spawn (runWithTimeout
// carries the identical gate but spreads `cmdArgs`, and its callers pass real `.exe` names, so it
// is not affected). Detection then reads which variable the extension test runs against. Testing
// the raw `binary` is the bug; testing anything else means something resolved it first — whoever
// wrote that resolver.
//
// Recognising the fix by shape rather than by our own marker matters: upstream may fix #3086 on
// its own, and a check that only looked for our comment would then demand a patch that is no
// longer needed and reapply it over better code (ai-setup-audit.md §4).

const SPAWN_ARGV_LINE = /^(\s*)const spawnArgv = winShim \? \['\/d', '\/s', '\/c', (\w+), \.\.\.argv\] : argv;$/;
const BASENAME_TEST = /const winShim = isWin && \/\\\.\(cmd\|bat\)\$\/i\.test\(path\.basename\((\w+)\)\);/;
const IS_WIN_LINE = /^\s*const isWin = process\.platform === 'win32';$/;

/**
 * The resolver we inject. Deliberately self-contained — it requires its own fs/path rather than
 * closing over gsd-tools' module-local bindings, so an upstream rename cannot silently break it.
 */
function resolverSource(indent) {
  const body = [
    '// LOCAL PATCH (jonvickers/templates, tools/gsd-patch-check.js) — open-gsd/gsd-core #3086.',
    '// Resolve the configured name on PATH the way cmd.exe does BEFORE the extension gate below:',
    '// every reviewer lane configures a BARE name, so testing the raw name never fires the gate,',
    '// and CreateProcess (no PATHEXT) fails ENOENT on every npm .cmd shim. Reapply after an update.',
    'const __gsdResolveExecutable = (name) => {',
    "  if (!name || process.platform !== 'win32') return name;",
    "  const _fs = require('node:fs');",
    "  const _path = require('node:path');",
    "  const exts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').map((e) => e.trim()).filter(Boolean);",
    '  const isFile = (p) => { try { return _fs.statSync(p).isFile(); } catch { return false; } };',
    '  // An explicit path is not a PATH lookup: honour it, and only extend it if it does not exist.',
    "  if (name.includes('/') || name.includes('\\\\')) {",
    '    if (isFile(name)) return name;',
    '    for (const ext of exts) if (isFile(name + ext)) return name + ext;',
    '    return name;',
    '  }',
    "  for (const dir of (process.env.PATH || '').split(_path.delimiter).filter(Boolean)) {",
    '    if (_path.extname(name)) {',
    '      const exact = _path.join(dir, name);',
    '      if (isFile(exact)) return exact;',
    '      continue;',
    '    }',
    "    // Directory-major, PATHEXT order — cmd.exe's own search. The extensionless sibling npm",
    '    // drops beside the shim is a POSIX sh script CreateProcess cannot run, so it is skipped.',
    '    for (const ext of exts) {',
    '      const candidate = _path.join(dir, name + ext);',
    '      if (isFile(candidate)) return candidate;',
    '    }',
    '  }',
    '  return name;',
    '};',
  ];
  return body.map((l) => indent + l).join('\n');
}

/** @returns {{status:'patched'|'unpatched'|'unknown', detail:string}} plus locations when found. */
function inspectWindowsShim(source) {
  const lines = source.split('\n');
  const idx = lines.findIndex((l) => SPAWN_ARGV_LINE.test(l));
  if (idx === -1) {
    return {
      status: 'unknown',
      detail: 'review-lane spawn site not found — the file changed shape; verify #3086 by hand before trusting a review',
    };
  }
  const window = Math.max(0, idx - 4);
  const gateOffset = lines.slice(window, idx).findIndex((l) => BASENAME_TEST.test(l));
  if (gateOffset === -1) {
    return { status: 'unknown', detail: 'shim gate not found beside the spawn site — verify #3086 by hand' };
  }
  const absGate = window + gateOffset;
  const tested = BASENAME_TEST.exec(lines[absGate])[1];
  if (tested === 'binary') {
    return {
      status: 'unpatched',
      detail: 'extension gate tests the bare configured name — every .cmd reviewer lane fails ENOENT',
      lines, idx, absGate,
    };
  }
  return {
    status: 'patched',
    detail: `extension gate tests "${tested}", so the name is resolved first`,
    lines, idx, absGate,
  };
}

function applyWindowsShim(file, source) {
  const found = inspectWindowsShim(source);
  if (found.status !== 'unpatched') return { changed: false, reason: found.detail };

  const { lines, idx, absGate } = found;
  const indent = SPAWN_ARGV_LINE.exec(lines[idx])[1];

  // Rewrite the three gate lines to run against the resolved name.
  lines[absGate] = lines[absGate].replace('path.basename(binary)', 'path.basename(__gsdResolvedBinary)');
  lines[absGate + 1] = lines[absGate + 1].replace(/: binary;$/, ': __gsdResolvedBinary;');
  lines[idx] = lines[idx].replace("'/c', binary,", "'/c', __gsdResolvedBinary,");

  // Insert the resolver and the resolved binding straight after `const isWin = ...`, in the same
  // scope as the gate, so the patch depends on nothing outside this one function.
  const winWindow = Math.max(0, absGate - 6);
  const isWinOffset = lines.slice(winWindow, absGate).findIndex((l) => IS_WIN_LINE.test(l));
  if (isWinOffset === -1) {
    return { changed: false, reason: 'no isWin binding above the gate — refusing to guess where the resolver goes' };
  }

  lines.splice(winWindow + isWinOffset + 1, 0,
    resolverSource(indent),
    `${indent}const __gsdResolvedBinary = isWin ? __gsdResolveExecutable(binary) : binary;`);

  const patched = lines.join('\n');
  fs.writeFileSync(file, patched, 'utf8');

  // A patch that does not parse is worse than the bug it fixes: gsd-tools would stop loading at
  // all, taking every GSD command with it. Verify, and put the original back if anything is off.
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status !== 0) {
    fs.writeFileSync(file, source, 'utf8');
    return { changed: false, reason: `patched file failed node --check, reverted: ${String(check.stderr || '').trim().slice(0, 200)}` };
  }
  if (inspectWindowsShim(patched).status !== 'patched') {
    fs.writeFileSync(file, source, 'utf8');
    return { changed: false, reason: 'patch applied but did not verify, reverted' };
  }
  return { changed: true, reason: 'name is now resolved on PATH before the extension gate' };
}

const PATCHES = [
  {
    id: 'windows-shim',
    issue: 'open-gsd/gsd-core #3086',
    appliesOn: () => process.platform === 'win32',
    inspect: inspectWindowsShim,
    apply: applyWindowsShim,
  },
];

function main(argv) {
  const json = argv.includes('--json');
  const fix = argv.includes('--fix');
  const installs = installRoots();
  const report = [];

  for (const install of installs) {
    let source;
    try {
      source = fs.readFileSync(install.tools, 'utf8');
    } catch (e) {
      report.push({ ...install, patch: null, status: 'unknown', detail: `unreadable: ${e.message}` });
      continue;
    }
    for (const patch of PATCHES) {
      if (!patch.appliesOn()) {
        report.push({ ...install, patch: patch.id, status: 'n/a', detail: 'not this platform' });
        continue;
      }
      let result = patch.inspect(source);
      let fixed = false;
      if (fix && result.status === 'unpatched') {
        const applied = patch.apply(install.tools, source);
        fixed = applied.changed;
        result = fixed
          ? { status: 'patched', detail: `reapplied — ${applied.reason}` }
          : { status: 'unpatched', detail: `could not apply: ${applied.reason}` };
      }
      report.push({
        ...install, patch: patch.id, issue: patch.issue, status: result.status, detail: result.detail, fixed,
      });
    }
  }

  const bad = report.filter((r) => r.status === 'unpatched' || r.status === 'unknown');

  if (json) {
    process.stdout.write(`${JSON.stringify({ ok: bad.length === 0, installs: report }, null, 2)}\n`);
    return bad.length === 0 ? 0 : 1;
  }

  if (!installs.length) {
    process.stdout.write('No GSD install found in any config directory.\n');
    return 1;
  }

  for (const r of report) {
    const mark = { patched: 'ok  ', unpatched: 'FAIL', unknown: 'FAIL', 'n/a': 'skip' }[r.status];
    process.stdout.write(`${mark} ${r.patch || '-'}  ${r.root} (${r.version})\n     ${r.detail}\n`);
  }
  if (bad.length && !fix) {
    process.stdout.write('\nReapply with:  node tools/gsd-patch-check.js --fix\n');
  }
  if (!bad.length) {
    process.stdout.write('\nStatic check only. Prove the lanes answer:  node tools/review-lane-check.js   (inside a repo)\n');
  }
  return bad.length === 0 ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { installRoots, inspectWindowsShim, applyWindowsShim, PATCHES };
