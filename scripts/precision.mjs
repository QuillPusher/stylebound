#!/usr/bin/env node
// Precision gate: every default-on strict-plain overlay rule needs 90% correct
// findings on the trial documents. Exit code 1 when one is below.
//   node scripts/precision.mjs           table and outcome per rule
//   node scripts/precision.mjs --details also list every finding with its verdict
import { measure, failing, THRESHOLD, MIN_FINDINGS } from '../trial/precision.mjs';

const rows = measure();
const pct = x => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);
console.log('Rule                        Findings  Correct  Debatable  False+  Unjudged  Precision  (debatable as correct)  Outcome');
for (const r of rows) {
  console.log(`${r.ruleId.padEnd(28)}${String(r.findings).padStart(8)}  ${String(r.correct).padStart(7)}  ${String(r.debatable).padStart(9)}  ${String(r.falsePositive).padStart(6)}  ${String(r.unjudged).padStart(8)}  ${pct(r.precision).padStart(9)}  ${pct(r.precisionIfDebatableCorrect).padStart(22)}  ${r.outcome}`);
  if (process.argv.includes('--details')) {
    for (const d of r.details.filter(x => x.verdict !== 'correct')) console.log(`    ${d.verdict.padEnd(14)} ${d.file}:${d.line} "${d.text.slice(0, 70)}"`);
  }
}
const bad = failing(rows);
console.log(`\nThreshold ${Math.round(THRESHOLD * 100)}%; rules with fewer than ${MIN_FINDINGS} findings go to the owner.`);
if (bad.length) {
  console.log(`Below the threshold and on by default: ${bad.map(r => r.ruleId).join(', ')}. Each needs an owner decision before it is kept or removed (a removal is recorded in rules/dropped.json).`);
  process.exitCode = 1;
} else {
  console.log('Every default-on overlay rule with enough evidence is at or above the threshold.');
}
