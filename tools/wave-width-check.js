#!/usr/bin/env node
'use strict';

// scripts/gsd-checks/wave-width-check.js
//
// Turns AGENTS.md's "plan wide, or autonomous mode cannot run" targets into a
// runnable gate.
//
// WHY THIS EXISTS. The targets have been written in AGENTS.md the whole time and
// have not held: measured 2026-08-06, phases 95/96/97/98/100 were all planned
// near-serial (96 and 97 were EVERY wave a single plan). `parallelization: true`
// was set throughout and had nothing to parallelize. A prose rule that is never
// executed is a suggestion; this is the same rule as an exit code.
//
// GSD only runs plans concurrently WITHIN a wave. Wave topology is therefore the
// whole story — agent count, worktree isolation and `parallelization` cannot
// rescue a dependency chain that is serial by construction.
//
// Reads PLAN.md frontmatter directly rather than `gsd-tools phase-plan-index`,
// deliberately: it must work on archived phases (for backtesting) and must not
// break when a GSD update changes an internal JSON shape.
//
// Read-only. Never writes, never touches git.
//
// Usage:
//   node wave-width-check.js <phase-dir>          # gate a phase
//   node wave-width-check.js <phase-dir> --json   # machine-readable
//   node wave-width-check.js --all                # every phase under .planning
//
// Exit codes: 0 pass · 1 fail · 2 usage/no-plans error.

const fs = require('fs');
const path = require('path');

// Targets, verbatim from AGENTS.md "Plan wide, or autonomous mode cannot run".
const MEDIAN_WIDTH_MIN = 3;
const SINGLE_WAVE_MAX_FRACTION = 1 / 3;

// Below this plan count the width targets are not meaningful and are skipped.
// A 2-plan phase cannot reach a median width of 3 even when both plans run
// together in one wave — which is already maximally parallel. Applying the
// target there produces a failure that no replan can fix, and a gate that
// cannot be satisfied gets ignored, taking the real findings down with it.
// Small phases are still checked for undeclared files_modified and intra-wave
// overlap, because those are defects at any size.
const WIDTH_TARGET_MIN_PLANS = 5;

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const body = m[1];
  const out = {};
  // Scalars: `key: value`
  for (const line of body.split(/\r?\n/)) {
    const s = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (s && s[2] !== '') out[s[1]] = s[2].trim();
  }
  // files_modified: block list OR inline [a, b]
  //
  // The block pattern matches indented `- item` lines EXPLICITLY rather than
  // lazily scanning to the next unindented line. Two bugs the tests caught in
  // the lazy version: `\s*` after the colon greedily ate the newline AND the
  // list item's own indentation, and `\Z` is not a JS regex anchor (it matches a
  // literal "Z"), so a block that ended at end-of-string never terminated. Both
  // silently produced an empty list — which reads as "this plan declares no
  // files", the exact defect this gate exists to report. A false positive here
  // would be worse than no gate at all.
  const inline = /^files_modified:[ \t]*\[([^\]]*)\]/m.exec(body);
  if (inline) {
    out.files_modified = inline[1].split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  } else {
    const block = /^files_modified:[ \t]*\r?\n((?:[ \t]+-[^\n]*\r?\n?)+)/m.exec(body);
    out.files_modified = block
      ? block[1].split(/\r?\n/)
          .map((l) => /^[ \t]+-[ \t]*(.*)$/.exec(l))
          .filter(Boolean)
          .map((x) => x[1].trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean)
      : [];
  }
  return out;
}

function readPhase(dir) {
  const files = fs.readdirSync(dir).filter((f) => /-PLAN\.md$/.test(f)).sort();
  const plans = [];
  for (const f of files) {
    const fm = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!fm) continue;
    plans.push({
      file: f,
      id: fm.plan != null ? String(fm.plan) : f.replace(/-PLAN\.md$/, ''),
      wave: Number.isFinite(Number(fm.wave)) ? Number(fm.wave) : null,
      files_modified: fm.files_modified || [],
    });
  }
  return plans;
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function analyse(dir) {
  const plans = readPhase(dir);
  if (!plans.length) return { dir, error: 'no PLAN.md files found' };

  const waves = new Map();
  for (const p of plans) {
    const key = p.wave == null ? 'unassigned' : p.wave;
    if (!waves.has(key)) waves.set(key, []);
    waves.get(key).push(p);
  }
  const ordered = [...waves.entries()].sort((a, b) => (a[0] === 'unassigned' ? 1 : b[0] === 'unassigned' ? -1 : a[0] - b[0]));
  const widths = ordered.map(([, v]) => v.length);
  const singles = widths.filter((w) => w === 1).length;
  const med = median(widths);
  const singleFraction = widths.length ? singles / widths.length : 1;

  // Plans with no declared files_modified defeat the intra-wave overlap check
  // entirely — the wave silently drops to sequential with nothing to warn on.
  const undeclared = plans.filter((p) => p.files_modified.length === 0).map((p) => p.id);

  // Two plans in one wave sharing any file also drops that wave to sequential.
  const overlaps = [];
  for (const [wave, group] of ordered) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const shared = group[i].files_modified.filter((f) => group[j].files_modified.includes(f));
        if (shared.length) overlaps.push({ wave, a: group[i].id, b: group[j].id, shared });
      }
    }
  }

  const widthTargetsApply = plans.length >= WIDTH_TARGET_MIN_PLANS;

  const failures = [];
  if (widthTargetsApply) {
    if (med < MEDIAN_WIDTH_MIN) failures.push(`median wave width ${med} < ${MEDIAN_WIDTH_MIN}`);
    if (singleFraction > SINGLE_WAVE_MAX_FRACTION) {
      failures.push(`${singles}/${widths.length} waves hold a single plan (max ${Math.floor(widths.length * SINGLE_WAVE_MAX_FRACTION)})`);
    }
  }
  if (undeclared.length) failures.push(`${undeclared.length} plan(s) declare no files_modified: ${undeclared.join(', ')}`);
  if (overlaps.length) failures.push(`${overlaps.length} intra-wave file overlap(s) — those waves run sequentially`);

  return {
    dir,
    phase: path.basename(dir),
    planCount: plans.length,
    waveCount: widths.length,
    widths,
    medianWidth: med,
    singlePlanWaves: singles,
    widthTargetsApply,
    undeclaredFilesModified: undeclared,
    intraWaveOverlaps: overlaps,
    pass: failures.length === 0,
    failures,
  };
}

function report(r) {
  if (r.error) { console.log(`${r.dir}: ${r.error}`); return; }
  const verdict = r.pass ? 'PASS' : 'FAIL';
  console.log(`${verdict}  ${r.phase}`);
  console.log(`  ${r.planCount} plans in ${r.waveCount} waves — widths [${r.widths.join(',')}]`);
  if (r.widthTargetsApply) {
    console.log(`  median width ${r.medianWidth} (target >= ${MEDIAN_WIDTH_MIN}) · single-plan waves ${r.singlePlanWaves}/${r.waveCount} (target <= 1/3)`);
  } else {
    console.log(`  median width ${r.medianWidth} · width targets N/A below ${WIDTH_TARGET_MIN_PLANS} plans (still checked: files_modified, overlaps)`);
  }
  for (const f of r.failures) console.log(`  ✗ ${f}`);
  for (const o of r.intraWaveOverlaps.slice(0, 5)) {
    console.log(`      wave ${o.wave}: ${o.a} and ${o.b} share ${o.shared.slice(0, 2).join(', ')}${o.shared.length > 2 ? ` (+${o.shared.length - 2})` : ''}`);
  }
  if (!r.pass) {
    console.log('  → Regroup into bounded ownership lanes with disjoint file sets before dispatch.');
    console.log('    A genuinely serial phase is fine — say so in the plan and keep it short.');
  }
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const targets = [];

  if (args.includes('--all')) {
    for (const root of ['.planning/phases', '.planning/milestones']) {
      if (!fs.existsSync(root)) continue;
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, e.name);
          if (!e.isDirectory()) continue;
          if (fs.readdirSync(full).some((f) => /-PLAN\.md$/.test(f))) targets.push(full);
          else walk(full);
        }
      };
      walk(root);
    }
  } else {
    const dir = args.find((a) => !a.startsWith('--'));
    if (!dir) {
      console.error('usage: node wave-width-check.js <phase-dir> [--json] | --all [--json]');
      process.exit(2);
    }
    targets.push(dir);
  }

  if (!targets.length) { console.error('no phase directories with PLAN.md files found'); process.exit(2); }

  const results = targets.map(analyse);
  if (json) { console.log(JSON.stringify(results, null, 2)); }
  else {
    results.forEach((r, i) => { if (i) console.log(''); report(r); });
    const real = results.filter((r) => !r.error);
    if (real.length > 1) {
      const passed = real.filter((r) => r.pass).length;
      console.log(`\n${passed}/${real.length} phases meet the wave-width targets.`);
    }
  }
  process.exit(results.some((r) => r.error) ? 2 : results.every((r) => r.pass) ? 0 : 1);
}

main();
