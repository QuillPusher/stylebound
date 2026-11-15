#!/usr/bin/env node
// The regression gate: good edits lose no fact, every bad edit is caught.
//   node scripts/gate.mjs                 run the gate (exit code 1 on failure)
//   node scripts/gate.mjs --write-edits   rebuild the bad edits in regression/edits.json from the good edits
import fs from 'node:fs';
import { runGate, badEdits, loadEdits, loadDocxWriter, EDITS_FILE } from '../regression/gate.mjs';
import { loadRegressionSet } from '../regression/harness.mjs';

if (process.argv.includes('--write-edits')) {
  const edits = loadEdits();
  const { paragraphs } = loadRegressionSet();
  let n = 0;
  for (const p of paragraphs) {
    const entry = edits.paragraphs[p.id];
    if (!entry) continue;
    entry.bad = badEdits(entry.good, p.must_keep);
    n += entry.bad.length;
  }
  fs.writeFileSync(EDITS_FILE, JSON.stringify(edits, null, 1) + '\n');
  console.log(`wrote regression/edits.json: ${paragraphs.length} good edits, ${n} bad edits`);
}

const r = runGate();
for (const f of [...r.good.failures, ...r.bad.failures]) console.log('FAIL ' + f);
console.log(`${r.good.total} good edits: ${r.good.lost} lost; ${r.bad.total} bad edits: ${r.bad.caught} caught`);
await loadDocxWriter();
const d = runGate({ docx: true });
for (const f of [...d.good.failures, ...d.bad.failures]) console.log('FAIL (DOCX path) ' + f);
console.log(`DOCX path: ${d.good.total} good edits: ${d.good.lost} lost; ${d.bad.total} bad edits: ${d.bad.caught} caught`);
const failed = g => g.good.lost || g.good.failures.length || g.bad.caught !== g.bad.total;
process.exitCode = failed(r) || failed(d) ? 1 : 0;
