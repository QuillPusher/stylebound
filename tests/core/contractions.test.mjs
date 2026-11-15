import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, rulesFor } from '../../packages/core/index.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8');
const found = (text, profile) => check(text, { profile }).issues.filter(i => i.ruleId === 'no-contractions');

test('sample file: the contraction is an error under strict-plain and not flagged under base', () => {
  const sample = read('regression/sample.md');
  assert.deepEqual(found(sample, 'strict-plain').map(i => [i.text, i.severity, i.replacement]), [["didn't", 'error', 'did not']]);
  assert.deepEqual(found(sample, 'base'), []);
});

test("trial document: can't is flagged under strict-plain, not under base", () => {
  const doc = read('trial/docs/02-install-upgrade-guide.md');
  assert.ok(found(doc, 'strict-plain').some(i => i.text === "can't" && i.replacement === 'cannot'));
  assert.deepEqual(found(doc, 'base'), []);
});

test('strict-plain replaces the base advice to use contractions', () => {
  assert.ok(rulesFor('base').some(r => r.id === 'use-contractions'));
  assert.ok(!rulesFor('strict-plain').some(r => r.id === 'use-contractions'));
  assert.deepEqual(check('Do not close the window.', { profile: 'strict-plain' }).issues.map(i => i.ruleId), []);
});

test('case and curly apostrophes are handled; possessives are not contractions', () => {
  assert.deepEqual(found("Don't wait. You’ll see it. The team's file.", 'strict-plain').map(i => [i.text, i.replacement]),
    [["Don't", 'Do not'], ['You’ll', 'You will']]);
});
