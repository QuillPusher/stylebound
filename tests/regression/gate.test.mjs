import test from 'node:test';
import assert from 'node:assert/strict';
import { runGate, loadEdits, badEdits } from '../../regression/gate.mjs';
import { loadRegressionSet } from '../../regression/harness.mjs';

test('gate: every good edit keeps every item; every bad edit is caught', () => {
  const r = runGate();
  assert.deepEqual([...r.good.failures, ...r.bad.failures], []);
  assert.equal(r.good.total, 84);
  assert.equal(r.good.lost, 0);
  assert.ok(r.bad.total >= 84);
  assert.equal(r.bad.caught, r.bad.total);
});

test('gate: CRLF and LF inputs give identical results', () => {
  assert.deepEqual(runGate({ crlf: true }), runGate());
});

test('bad edits are current and each covers one kind of loss', () => {
  const edits = loadEdits();
  const kinds = new Set();
  for (const p of loadRegressionSet().paragraphs) {
    const entry = edits.paragraphs[p.id];
    assert.deepEqual(entry.bad, badEdits(entry.good, p.must_keep), `${p.id}: run \`npm run gate -- --write-edits\``);
    for (const b of entry.bad) {
      kinds.add(b.kind);
      assert.notEqual(b.text, entry.good);
    }
  }
  assert.deepEqual([...kinds].sort(), ['delete-condition', 'delete-negation', 'drop-code', 'drop-number', 'weaken-modal']);
});

test('the facts review of the good edits is recorded', () => {
  const { factsReviewed } = loadEdits();
  assert.ok(factsReviewed.by && factsReviewed.date);
});
