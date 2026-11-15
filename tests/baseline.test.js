'use strict';
// The checker must still give the original result on the sample file: 50 issues,
// frozen in tests/fixtures/sample.baseline.json (base profile).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const engine = require('../packages/core/src/engine.js');
const { loadRules, selectRules } = require('../packages/core/src/load-rules.js');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8');

test('sample file gives the 50 baseline issues, in the same order', () => {
  const rules = selectRules(loadRules().rules, { profile: 'base' });
  const issues = engine.check(read('regression/sample.md'), rules).issues
    .map(i => ({ line: i.line, col: i.col, rule: i.ruleId, severity: i.severity, text: i.text, replacement: i.replacement }));
  assert.strictEqual(issues.length, 50);
  for (const i of issues) {
    assert.ok(Number.isInteger(i.line) && Number.isInteger(i.col), 'line and col');
    assert.ok(i.rule && i.severity, 'rule and severity');
  }
  assert.deepStrictEqual(issues, JSON.parse(read('tests/fixtures/sample.baseline.json')));
});
