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

// ── PROMPT-CAP ─────────────────────────────────────────────────────────────────────────────
//
// `review-lane-descriptor.cjs` declares `promptBudgetKey: null` for every CLI lane, so
// `review-lane plan` reports `promptBudget: null` and NO size limit is applied to a review prompt.
// A real review prompt on a mature repo runs to hundreds of KB (~168k tokens measured). Past the
// model's context window nothing errors: the model compacts and answers confidently about material
// it never read. That is how two convergence cycles came back "reviewed, found nothing".
//
// This is the other half of the same failure the windows-shim patch fixes — a review that did not
// happen, reported as a review with no concerns.
//
// Refuse, do not trim. GSD already has a trimmer (`prompt-budget`), and routing these lanes
// through it would swap a silent overflow for a silent truncation — worse, its own disclosure note
// tells the model to "treat any missing context as out-of-scope rather than a review concern",
// which is an instruction to do the exact thing that produced the fabricated results. A reviewer
// that could not see the whole input must SAY SO.
//
// The window is DERIVED, never hard-coded — a constant is right the day it is written and a silent
// lie the next time a vendor ships. Source is the models.dev catalog opencode caches locally.
// Where the window is genuinely unknowable (an unpinned lane running the CLI's own default model)
// the cap is null and the reason says why, rather than inventing a number.
//
// Detected BY SHAPE, like the shim: any `promptCap` handling between the budget resolver and the
// runLane call reads as patched, so a hand-written or upstream implementation is left alone.

const BUDGET_FOR_LINE = /^(\s*)const budgetFor = \(lane\) => \{$/;
const PLANS_MAP_LINE = /^\s*const plans = chosen\.map\(\(slug\) => \{$/;
const PROMPT_BUDGET_FIELD = /^(\s*)promptBudget: budgetFor\(lane\),$/;
const RUN_LANE_LINE = /^(\s*)const result = await runner\.runLane\(/;

function capHelperSource(indent) {
  const body = [
    '// LOCAL PATCH (jonvickers/templates, tools/gsd-patch-check.js) — per-lane prompt cap.',
    '// `promptBudget` above is a TRIM knob and is null for every CLI lane, so a prompt of any size',
    '// reaches the reviewer. Past the context window the model compacts and answers confidently',
    '// about material it never read. This derives a hard ceiling from the lane\'s pinned model and',
    '// the invoke site REFUSES over it. Reapply after a /gsd-update.',
    'let __gsdCatalog;',
    'const __gsdModelCatalog = () => {',
    '  if (__gsdCatalog !== undefined) return __gsdCatalog;',
    '  __gsdCatalog = null;',
    "  const _fs = require('node:fs');",
    "  const _path = require('node:path');",
    "  const _os = require('node:os');",
    '  const candidates = [',
    "    process.env.XDG_CACHE_HOME && _path.join(process.env.XDG_CACHE_HOME, 'opencode', 'models.json'),",
    "    _path.join(_os.homedir(), '.cache', 'opencode', 'models.json'),",
    '  ].filter(Boolean);',
    '  for (const p of candidates) {',
    "    try { __gsdCatalog = JSON.parse(_fs.readFileSync(p, 'utf8')); break; } catch { /* next */ }",
    '  }',
    '  return __gsdCatalog;',
    '};',
    '// Accepts the three shapes a `review.models.*` value takes: provider-qualified',
    '// (`xai/grok-4.6`), a bare catalog id, or a VENDOR ALIAS the CLI resolves at run time',
    '// (`sonnet`). An alias is matched to the newest entry by release_date and, among equally',
    '// new ones, the SMALLEST window — a cap set too low fails loudly and is fixed in one config',
    '// line, while one set too high silently readmits the overflow this exists to catch.',
    'const __gsdContextWindow = (model) => {',
    '  const cat = __gsdModelCatalog();',
    "  if (!cat || typeof model !== 'string' || !model.trim()) return null;",
    '  const id = model.trim();',
    '  const win = (m) => (m && m.limit && Number.isFinite(m.limit.context) && m.limit.context > 0 ? m.limit.context : null);',
    "  if (id.includes('/')) {",
    "    const [prov, ...rest] = id.split('/');",
    "    const w = win(cat[prov] && cat[prov].models && cat[prov].models[rest.join('/')]);",
    '    return w ? { tokens: w, model: id, exact: true } : null;',
    '  }',
    '  for (const [prov, p] of Object.entries(cat)) {',
    '    const w = win(p && p.models && p.models[id]);',
    '    if (w) return { tokens: w, model: prov + \'/\' + id, exact: true };',
    '  }',
    "  const alias = id.toLowerCase().replace(/[^a-z0-9.]/g, '');",
    '  if (!alias) return null;',
    "  const re = new RegExp('(^|[-/])' + alias + '([-.]|$)', 'i');",
    '  let matches = [];',
    '  for (const [prov, p] of Object.entries(cat)) {',
    '    for (const [mid, m] of Object.entries((p && p.models) || {})) {',
    '      if (!re.test(mid)) continue;',
    '      const w = win(m);',
    "      if (w) matches.push({ tokens: w, model: prov + '/' + mid, release: String(m.release_date || '') });",
    '    }',
    '  }',
    '  if (!matches.length) return null;',
    '  const newest = matches.reduce((a, b) => (b.release > a.release ? b : a)).release;',
    '  matches = matches.filter((m) => m.release === newest);',
    '  const best = matches.reduce((a, b) => (b.tokens < a.tokens ? b : a));',
    '  return { tokens: best.tokens, model: best.model, exact: false };',
    '};',
    '// Precedence: explicit config > derived from the pinned model > uncapped. `0` means UNCAPPED',
    '// (matching #2797\'s treatment of 0 for the trim budget); `-1` and absence both mean unset.',
    '// Headroom is generous on purpose: it covers the reply, the CLI\'s own system prompt and tool',
    '// definitions, and the file contents a source-grounded reviewer reads WHILE reviewing.',
    'const __gsdPromptCap = (lane) => {',
    "  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);",
    "  const explicit = configGet('review.max_prompt_tokens_per_reviewer.' + lane.slug);",
    '  if (isNum(explicit) && explicit !== -1) {',
    "    return explicit === 0 ? { cap: null, reason: 'uncapped-by-config' } : { cap: explicit, reason: 'config' };",
    '  }',
    "  if (!lane.modelConfigKey) return { cap: null, reason: 'lane-accepts-no-model' };",
    '  const raw = configGet(lane.modelConfigKey);',
    "  let model = typeof raw === 'string' ? raw.trim() : '';",
    '  let src = lane.modelConfigKey;',
    "  if ((!model || model === 'null') && lane.slug === 'opencode') {",
    '    // The house convention leaves `review.models.opencode` UNSET so the Grok version lives in',
    '    // ONE machine file rather than one per repo. GSD then omits --model and opencode uses its',
    '    // own default — so that file, not the repo config, is where the model is knowable.',
    "    const _fs = require('node:fs');",
    "    const _path = require('node:path');",
    "    const _os = require('node:os');",
    "    for (const dir of [process.env.XDG_CONFIG_HOME, _path.join(_os.homedir(), '.config')]) {",
    '      if (!dir) continue;',
    "      for (const f of ['opencode.json', 'opencode.jsonc']) {",
    '        try {',
    "          const txt = _fs.readFileSync(_path.join(dir, 'opencode', f), 'utf8')",
    "            .replace(/(\"(?:\\\\.|[^\"\\\\])*\")|\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*/g, (m, s) => s || '')",
    "            .replace(/,(\\s*[}\\]])/g, '$1');",
    '          const val = JSON.parse(txt).model;',
    "          if (typeof val === 'string' && val.trim()) { model = val.trim(); src = _path.join(dir, 'opencode', f); }",
    '        } catch { /* next candidate */ }',
    '      }',
    '    }',
    '  }',
    "  if (!model || model === 'null') {",
    "    return { cap: null, reason: 'model-unpinned (' + lane.modelConfigKey + ' is unset — the CLI\\'s own default model is not knowable here)' };",
    '  }',
    '  const w = __gsdContextWindow(model);',
    '  if (!w) {',
    "    return { cap: null, reason: \"context-window-unknown (no entry for '\" + model + \"' in the models.dev catalog; run `opencode models` to refresh it)\" };",
    '  }',
    "  const pctRaw = configGet('review.context_headroom_pct');",
    '  const pct = isNum(pctRaw) && pctRaw >= 0 && pctRaw < 100 ? pctRaw : 35;',
    '  return {',
    '    cap: Math.floor(w.tokens * (100 - pct) / 100),',
    "    reason: 'derived (' + w.model + (w.exact ? '' : ' — alias, best effort') + ': ' + w.tokens +",
    "      ' tokens, ' + pct + '% headroom' + (src === lane.modelConfigKey ? '' : ', model from ' + src) + ')',",
    '  };',
    '};',
    'const __gsdPromptCapFields = (lane) => {',
    '  const c = __gsdPromptCap(lane);',
    '  return { promptCap: c.cap, promptCapReason: c.reason };',
    '};',
  ];
  return body.map((l) => indent + l).join('\n');
}

function capEnforcementSource(indent) {
  const body = [
    '// LOCAL PATCH (jonvickers/templates) — enforce the prompt cap at the LAST point before the',
    '// model sees the prompt: after --prompt-file and after any instance re-resolution. Measured',
    '// with the same estimator the trimmer uses (chars/4) so the two cannot disagree about what a',
    "// token is. `reason` reuses the DECLARED 'budget_too_small' rather than extending a frozen",
    '// enum; upstream wants a PROMPT_EXCEEDS_CONTEXT member.',
    '{',
    '  const __capLane = laneBySlug.get(entry.slug);',
    "  const __cap = __capLane ? __gsdPromptCap(__capLane) : { cap: null, reason: 'unknown-lane' };",
    "  const __pp = entry.plan.transport === 'spawn' ? entry.plan.stdin : entry.plan.promptPath;",
    '  if (__cap.cap && __pp) {',
    '    let __tok = null;',
    '    try {',
    "      const { estimateTokens } = require('./lib/prompt-budget.cjs');",
    "      __tok = estimateTokens(require('node:fs').readFileSync(__pp, 'utf8'));",
    '    } catch { __tok = null; }',
    '    if (__tok !== null && __tok > __cap.cap) {',
    "      const __d = 'prompt is ~' + __tok + ' tokens but lane \\'' + entry.slug + '\\' caps at ' + __cap.cap +",
    "        ' — ' + __cap.reason + '. Refused rather than sent: past the context window the model compacts ' +",
    "        'silently and answers confidently about material it never read. Split the review, or raise ' +",
    "        'review.max_prompt_tokens_per_reviewer.' + entry.slug + ' deliberately (0 disables the cap).';",
    '      try {',
    "        const _fs = require('node:fs');",
    "        _fs.writeFileSync(entry.plan.errPath, '[prompt exceeds context cap] ' + __d + '\\n', 'utf8');",
    "        _fs.writeFileSync(entry.plan.reviewPath, entry.slug +",
    "          ' review failed or returned empty output. stderr:\\n[prompt exceeds context cap] ' + __d + '\\n', 'utf8');",
    '      } catch { /* the JSON result below is still the authoritative signal */ }',
    "      process.stderr.write(__d + '\\n');",
    "      output({ slug: entry.slug, ok: false, stubbed: true, reason: 'budget_too_small',",
    '        detail: __d, promptTokens: __tok, promptCap: __cap.cap }, raw);',
    '      return;',
    '    }',
    '  }',
    '}',
  ];
  return body.map((l) => indent + l).join('\n');
}

/** @returns {{status:'patched'|'unpatched'|'unknown', detail:string}} plus locations when found. */
function inspectPromptCap(source) {
  const lines = source.split('\n');
  const budgetIdx = lines.findIndex((l) => BUDGET_FOR_LINE.test(l));
  const plansIdx = lines.findIndex((l) => PLANS_MAP_LINE.test(l));
  const fieldIdx = lines.findIndex((l) => PROMPT_BUDGET_FIELD.test(l));
  const runIdx = lines.findIndex((l) => RUN_LANE_LINE.test(l));
  if (budgetIdx === -1 || plansIdx === -1 || runIdx === -1) {
    return {
      status: 'unknown',
      detail: 'review-lane budget/plan/runLane sites not found — the file changed shape; verify prompt sizing by hand',
    };
  }
  // By SHAPE: any promptCap handling in the review-lane route counts, whoever wrote it.
  const region = lines.slice(budgetIdx, runIdx + 1).join('\n');
  if (/promptCap/.test(region)) {
    return { status: 'patched', detail: 'a per-lane promptCap is resolved and enforced before runLane' };
  }
  if (fieldIdx === -1 || fieldIdx < plansIdx || fieldIdx > runIdx) {
    return { status: 'unknown', detail: 'promptBudget field not found in the plan row — verify prompt sizing by hand' };
  }
  return {
    status: 'unpatched',
    detail: 'no prompt size limit at all — an over-long review prompt is compacted by the model, not rejected',
    lines, budgetIdx, plansIdx, fieldIdx, runIdx,
  };
}

function applyPromptCap(file, source) {
  const found = inspectPromptCap(source);
  if (found.status !== 'unpatched') return { changed: false, reason: found.detail };
  const { lines, plansIdx, fieldIdx, runIdx } = found;

  // Splice from the BOTTOM up so earlier indices stay valid.
  lines.splice(runIdx, 0, capEnforcementSource(RUN_LANE_LINE.exec(lines[runIdx])[1]));
  const fieldIndent = PROMPT_BUDGET_FIELD.exec(lines[fieldIdx])[1];
  lines[fieldIdx] = `${lines[fieldIdx]}\n${fieldIndent}...__gsdPromptCapFields(lane),`;
  lines.splice(plansIdx, 0, capHelperSource(PLANS_MAP_LINE.exec(lines[plansIdx])[0].match(/^\s*/)[0]));

  const patched = lines.join('\n');
  fs.writeFileSync(file, patched, 'utf8');

  // A patch that does not parse is worse than the bug it fixes — gsd-tools would stop loading and
  // take every GSD command with it. Verify, and put the original back if anything is off.
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status !== 0) {
    fs.writeFileSync(file, source, 'utf8');
    return { changed: false, reason: `patched file failed node --check, reverted: ${String(check.stderr || '').trim().slice(0, 200)}` };
  }
  if (inspectPromptCap(patched).status !== 'patched') {
    fs.writeFileSync(file, source, 'utf8');
    return { changed: false, reason: 'patch applied but did not verify, reverted' };
  }
  return { changed: true, reason: 'lanes now refuse a prompt larger than the pinned model can actually read' };
}

const PATCHES = [
  {
    id: 'windows-shim',
    issue: 'open-gsd/gsd-core #3086',
    appliesOn: () => process.platform === 'win32',
    inspect: inspectWindowsShim,
    apply: applyWindowsShim,
  },
  {
    id: 'prompt-cap',
    issue: 'open-gsd/gsd-core (unfiled) — promptBudgetKey null on every CLI lane',
    // Not platform-specific: a model silently compacting an over-long prompt is not a Windows bug.
    appliesOn: () => true,
    inspect: inspectPromptCap,
    apply: applyPromptCap,
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

module.exports = {
  installRoots, inspectWindowsShim, applyWindowsShim, inspectPromptCap, applyPromptCap, PATCHES,
};
