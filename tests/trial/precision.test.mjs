import test from 'node:test';
import assert from 'node:assert/strict';
import { measure, overlayRuleIds, ISSUE_PATTERNS, THRESHOLD } from '../../trial/precision.mjs';

// The gate itself is `npm run precision` (exit code 1 while a default-on rule is below 90%).
// This test checks that the measurement is complete; the owner's decisions on removals are in rules/dropped.json.
test('every overlay rule is measured, and every finding has a verdict', () => {
  const rows = measure();
  assert.deepEqual(rows.map(r => r.ruleId).sort(), overlayRuleIds().sort());
  for (const id of overlayRuleIds()) assert.ok(ISSUE_PATTERNS[id], `${id} has an answer-key pattern`);
  for (const r of rows) {
    assert.equal(r.unjudged, 0, `${r.ruleId}: every finding is planted or judged`);
    assert.equal(r.correct + r.debatable + r.falsePositive, r.findings);
  }
  assert.equal(THRESHOLD, 0.9);
});
