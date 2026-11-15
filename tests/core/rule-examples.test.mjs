import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Every rule's own examples: each "flag" example must give a finding from that
// rule, and each "pass" example must give none. Also the skip-region cases and
// the timing limit. Runs on every rule (base and strict-plain overlay), loaded
// from the rule files through the engine, the same code the CLI uses.
const require = createRequire(import.meta.url);
const engine = require('../../packages/core/src/engine.js');
const { loadRules } = require('../../packages/core/src/load-rules.js');

const rules = loadRules().rules;
const r = engine.runSelfTest(rules);

test('rule examples: 133 rules, 440 examples and 11 skip-region cases are run', () => {
  assert.equal(rules.length, 133);
  assert.equal(r.results.length, 440);
  assert.equal(r.skipTests.length, 11);
});

test('rule examples: every flag example is flagged and every pass example passes', () => {
  const failed = r.results.filter(x => !x.ok)
    .map(x => `${x.kind} ${x.ruleId}: ${JSON.stringify(x.text)} -> ${JSON.stringify(x.got)}`);
  assert.deepEqual(failed, []);
});

test('rule examples: no finding inside a skip region', () => {
  const failed = r.skipTests.filter(x => !x.ok).map(x => `${x.name}: ${x.got.join(', ')}`);
  assert.deepEqual(failed, []);
});

test('rule examples: the self-test passes, with 10,000 words checked in under 500 ms', () => {
  assert.ok(r.timing.words >= 10000, `${r.timing.words} words`);
  assert.ok(r.timing.ok, `${r.timing.ms} ms`);
  assert.ok(r.ok, `${r.failures} failures`);
});
