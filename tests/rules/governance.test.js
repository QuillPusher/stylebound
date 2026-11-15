'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const g = require('../../scripts/rule-governance.js');

const { rules, lock, dropped, budget } = g.current();
const OWNER = { approvedBy: 'owner', date: '2026-10-14' };
const entry = (id, action) => ({ id, action, flagged: 'x', why: 'x', evidence: 'x', ...OWNER });

test('the repository passes the removal review and the rule budget', () => {
  assert.deepStrictEqual(g.lockProblems(rules, lock, dropped), []);
  assert.deepStrictEqual(g.budgetProblems(rules, budget), []);
  assert.ok(g.defaultOnCount(rules) <= budget.cap);
});

test('docs/RULES-DROPPED.html is up to date with rules/dropped.json', () => {
  const html = fs.readFileSync(g.FILES.report, 'utf8').replace(/\r\n/g, '\n');
  assert.strictEqual(html, g.renderReport(dropped), 'run `npm run rules:report`');
});

test('removing a rule without an entry in dropped.json fails', () => {
  const without = rules.filter(r => r.id !== 'modal-may');
  const problems = g.lockProblems(without, lock, dropped);
  assert.strictEqual(problems.length, 1);
  assert.match(problems[0], /^Rule modal-may was removed without an entry in rules\/dropped\.json\. Removing a rule needs the owner's approval/);
  assert.deepStrictEqual(g.lockProblems(without, lock, [...dropped, entry('modal-may', 'dropped')]), []);
});

test('demoting a rule to opt-in without an entry fails', () => {
  const demoted = rules.map(r => (r.id === 'condition-first' ? { ...r, default: 'opt-in' } : r));
  assert.match(g.lockProblems(demoted, lock, dropped).join('\n'), /Rule condition-first was demoted to opt-in without an entry/);
  assert.deepStrictEqual(g.lockProblems(demoted, lock, [...dropped, entry('condition-first', 'demoted')]), []);
});

test('a new rule must be added to the lock, and the lock only grows', () => {
  const added = [...rules, { id: 'new-rule' }];
  assert.match(g.lockProblems(added, lock, dropped).join('\n'), /New rule new-rule is not in rules\/RULE-IDS\.lock/);
  const { lock: grown, added: ids } = g.appendNew(lock, added);
  assert.deepStrictEqual(ids, ['new-rule']);
  for (const [id, def] of lock) assert.strictEqual(grown.get(id), def);
  assert.deepStrictEqual(g.readLock(g.formatLock(grown)), grown);
});

test('a dropped entry needs every field, including the approval', () => {
  const bad = [{ id: 'x', action: 'dropped', flagged: 'x', why: 'x', evidence: 'x', date: '2026-10-14' }];
  assert.match(g.lockProblems(rules, lock, [...dropped, ...bad]).join('\n'), /entry for x is missing approvedBy/);
});

test('exceeding the cap fails with a message that asks for the owner\'s approval', () => {
  const problems = g.budgetProblems(rules, { cap: 100, ...OWNER });
  assert.strictEqual(problems.length, 1);
  assert.match(problems[0], new RegExp(`^There are ${g.defaultOnCount(rules)} default-on rules, over the cap of 100`));
  assert.match(problems[0], /ask the owner to approve a removal or a higher cap/);
  assert.deepStrictEqual(g.budgetProblems(rules, { cap: 100 }), ['rules/budget.json: the cap needs approvedBy and date.']);
});

test('opt-in rules do not count against the cap', () => {
  const optIn = rules.map((r, i) => (i < 10 ? { ...r, default: 'opt-in' } : r));
  assert.strictEqual(g.defaultOnCount(optIn), g.defaultOnCount(rules) - 10);
});
