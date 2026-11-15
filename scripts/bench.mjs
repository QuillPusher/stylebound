#!/usr/bin/env node
// Measures check time and finding density, for the rule budget (plan chunk 1.4).
//   node scripts/bench.mjs          prints a table; numbers depend on the machine
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, rulesFor } from '../packages/core/index.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const trialDir = path.join(root, 'trial', 'docs');
const trial = fs.readdirSync(trialDir).filter(f => /^\d\d-.*\.md$/.test(f))
  .map(f => ({ file: f, text: fs.readFileSync(path.join(trialDir, f), 'utf8') }));

// About 10,000 words of realistic text: the trial documents, repeated.
let doc = '';
while (check(doc, { rules: [] }).words < 10000) doc += trial.map(t => t.text).join('\n\n') + '\n\n';
const words = check(doc, { rules: [] }).words;

// Timer noise on a desktop is large, so take the fastest of several runs after a warm-up.
function fastest(fn, runs = 9) {
  let best = Infinity;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

for (let i = 0; i < 3; i++) { check(doc, { profile: 'base' }); check(doc, { profile: 'strict-plain' }); }
const empty = fastest(() => check(doc, { rules: [] }));
const rows = [];
for (const profile of ['base', 'strict-plain']) {
  const n = rulesFor(profile).length;
  const ms = fastest(() => check(doc, { profile }));
  rows.push({ profile, rules: n, ms, perRule: (ms - empty) / n });
}

console.log(`Document: ${words} words (the six trial documents, repeated). Fastest of 9 runs after a warm-up.`);
console.log(`Parse and fixed cost, no rules: ${empty.toFixed(0)} ms`);
for (const r of rows) {
  console.log(`${r.profile.padEnd(13)} ${String(r.rules).padStart(4)} rules  ${r.ms.toFixed(0).padStart(5)} ms  ${r.perRule.toFixed(2)} ms per rule`);
}
const strict = rows[1];
const capAtHalfBudget = Math.floor((250 - empty) / strict.perRule);
console.log(`Rules that fit in 250 ms (half the 500 ms budget) at the strict-plain average cost: ${capAtHalfBudget}`);

console.log('\nFindings per 100 words on the trial documents:');
for (const profile of ['base', 'strict-plain']) {
  let issues = 0, total = 0;
  for (const t of trial) {
    const res = check(t.text, { profile });
    issues += res.issues.length;
    total += res.words;
  }
  console.log(`${profile.padEnd(13)} ${issues} findings in ${total} words: ${(100 * issues / total).toFixed(1)} per 100 words`);
}
