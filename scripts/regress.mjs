#!/usr/bin/env node
// Runs the lossless regression set: checks the set itself, then checks that the
// JS must-keep extractor reproduces the stored lists (the Python reference).
// The verifier (chunk 1.9) and the gate (chunk 1.11) build on this.
import { loadRegressionSet } from '../regression/harness.mjs';
import { extractMustKeep, MUST_KEEP_KEYS } from '../packages/core/src/mustkeep.mjs';

const { paragraphs, failures } = loadRegressionSet();
let parity = 0;
for (const p of paragraphs) {
  const got = extractMustKeep(p.text);
  const differ = MUST_KEEP_KEYS.filter(k => JSON.stringify(got[k]) !== JSON.stringify(p.must_keep[k]));
  if (differ.length) failures.push({ id: p.id, problem: `extractor differs from the reference in ${differ.join(', ')}` });
  else parity++;
}
for (const f of failures) console.log(`FAIL ${f.id}: ${f.problem}`);
console.log(`${paragraphs.length} paragraphs, ${failures.length} failures; extractor parity ${parity}/${paragraphs.length}`);
process.exitCode = failures.length ? 1 : 0;
