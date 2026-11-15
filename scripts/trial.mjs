#!/usr/bin/env node
// Trial kit: check and score the trial documents against the answer key.
//   node scripts/trial.mjs                 all six documents, both profiles; prints a table
//   node scripts/trial.mjs 03-release-notes.md
//   node scripts/trial.mjs --log           also append one row per document and profile to trial/LOG.md
//   node scripts/trial.mjs --export DIR    also write each document's strict-plain review files into DIR
import fs from 'node:fs';
import path from 'node:path';
import { loadKey, scoreDocument, catchByLayer, readDoc, TRIAL_DIR } from '../trial/kit.mjs';
import { exportReview } from '../packages/core/index.mjs';

const args = process.argv.slice(2);
const only = args.find(a => a.endsWith('.md'));
const exportDir = args.includes('--export') ? args[args.indexOf('--export') + 1] : null;
const key = loadKey();
const entries = key.documents.filter(d => !only || d.file === only);
if (!entries.length) { console.error(`No trial document named ${only}.`); process.exit(2); }

const scores = [];
for (const entry of entries) {
  for (const profile of ['base', 'strict-plain']) scores.push(scoreDocument(entry, profile));
  if (exportDir) {
    fs.mkdirSync(exportDir, { recursive: true });
    const stem = path.join(exportDir, entry.file.replace(/\.md$/, ''));
    const { json, markdown } = exportReview(readDoc(entry.file), { profile: 'strict-plain', file: entry.file });
    fs.copyFileSync(path.join(TRIAL_DIR, 'docs', entry.file), stem + '.md');
    fs.writeFileSync(stem + '.style-review.json', JSON.stringify(json, null, 2) + '\n');
    fs.writeFileSync(stem + '.style-review.md', markdown);
  }
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : 'n/a');
console.log('Document                      Profile        Words  Findings  Caught       Possible FPs  On "none"');
for (const s of scores) {
  console.log(`${s.file.padEnd(30)}${s.profile.padEnd(15)}${String(s.words).padStart(5)}  ${String(s.findings).padStart(8)}  ${`${s.caught}/${s.inScope}`.padStart(6)} ${pct(s.caught, s.inScope).padStart(4)}  ${String(s.possibleFalsePositives.length).padStart(12)}  ${String(s.flaggedNone.length).padStart(9)}`);
  if (s.missingSnippets.length) console.log(`  answer key snippets not found: ${s.missingSnippets.join(' | ')}`);
}
for (const profile of ['base', 'strict-plain']) {
  const layers = catchByLayer(scores, profile);
  console.log(`\n${profile}: caught by layer: ` + Object.entries(layers).map(([l, r]) => `${l} ${r.caught}/${r.planted}`).join(', '));
  const missed = scores.filter(s => s.profile === profile).flatMap(s => s.missed.map(m => `  ${s.file}: [${m.layer}] ${m.issue}: "${m.snippet.slice(0, 60)}"`));
  if (missed.length) console.log(`${profile}: missed (${missed.length}):\n${missed.join('\n')}`);
}

if (args.includes('--log')) {
  const log = path.join(TRIAL_DIR, 'LOG.md');
  if (!fs.existsSync(log)) {
    fs.writeFileSync(log, '# Trial log\n\nOne row per document and profile for each run of `node scripts/trial.mjs --log`. Caught counts planted issues in scope for the profile (base: base and base+overlay; strict-plain: also overlay). Possible false positives are findings outside every planted snippet; 2.3 and 2.4 judge them in `trial/judgements.json`.\n\n| Date | Document | Profile | Words | Findings | Caught | Missed | Possible FPs | Findings per rule |\n|---|---|---|---|---|---|---|---|---|\n');
  }
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const rows = scores.map(s => `| ${date} | ${s.file} | ${s.profile} | ${s.words} | ${s.findings} | ${s.caught}/${s.inScope} | ${s.missed.length} | ${s.possibleFalsePositives.length} | ${Object.entries(s.byRule).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(', ')} |`);
  fs.appendFileSync(log, rows.join('\n') + '\n');
  console.log(`\nAppended ${rows.length} rows to trial/LOG.md.`);
}
