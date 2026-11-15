import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRegressionSet, sha256, KINDS } from '../../regression/harness.mjs';

test('the regression set has 84 intact paragraphs', () => {
  const { meta, paragraphs, failures } = loadRegressionSet();
  assert.deepEqual(failures, []);
  assert.equal(paragraphs.length, 84);
  assert.equal(meta.count, 84);
  assert.equal(meta.license, 'MIT');
  for (const p of paragraphs) assert.equal(p.sha256, sha256(p.text), p.id);
});

test('every paragraph kind is represented', () => {
  const { paragraphs } = loadRegressionSet();
  for (const k of KINDS) assert.ok(paragraphs.some(p => p.kind === k), k);
});

test('a changed text, a duplicate id and a wrong count are all reported', () => {
  const { meta, paragraphs } = loadRegressionSet();
  const broken = structuredClone(paragraphs);
  broken[0].text += ' Edited.';
  broken[2].id = broken[1].id;
  delete broken[3].must_keep.modals;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylebound-regress-'));
  try {
    const file = path.join(dir, 'paragraphs.json');
    fs.writeFileSync(file, JSON.stringify({ ...meta, count: 65, paragraphs: broken }));
    const problems = loadRegressionSet(file).failures.map(f => `${f.id}: ${f.problem}`);
    assert.ok(problems.includes(`${broken[0].id}: sha256 does not match the text`));
    assert.ok(problems.includes(`${broken[2].id}: duplicate id`));
    assert.ok(problems.includes(`${broken[3].id}: must_keep.modals is not a list`));
    assert.ok(problems.includes('(file): count says 65, file has 84'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
