import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDoc } from '../../trial/kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const judgements = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'trial', 'judgements.json'), 'utf8'));
const FINDING = ['correct', 'false-positive', 'debatable'];
const MISSED = ['rule-gap', 'wrong-label'];
const REPORT = ['true-loss', 'false-alarm'];

test('judgements are well formed and point at real text in the trial documents', () => {
  for (const [file, doc] of Object.entries(judgements.documents)) {
    const lines = readDoc(file).split('\n');
    for (const f of doc.findings) {
      assert.ok(FINDING.includes(f.verdict), `${file}: ${f.ruleId} verdict ${f.verdict}`);
      assert.ok(lines[f.line - 1] && lines[f.line - 1].includes(f.text.split('\n')[0]), `${file}:${f.line} has "${f.text}"`);
    }
    for (const m of doc.missed) {
      assert.ok(MISSED.includes(m.verdict), `${file}: ${m.snippet}`);
      assert.ok(readDoc(file).includes(m.snippet), `${file} has the missed snippet`);
    }
    assert.ok(doc.verifier.factsKept <= doc.verifier.factsTotal);
    for (const r of doc.verifier.reports) assert.ok(REPORT.includes(r.verdict), `${file}: ${r.item}`);
  }
});
