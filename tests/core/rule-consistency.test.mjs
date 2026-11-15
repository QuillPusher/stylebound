import test from 'node:test';
import assert from 'node:assert/strict';
import { rules, rulesFor, check } from '../../packages/core/index.mjs';

// A rule's "pass" examples show the wording that its fix asks for. If another
// rule of the same profile flags that wording, the two rules contradict each
// other, and an agent that follows one creates a finding for the other.
// Base rules are judged under base; strict-plain rules under strict-plain.
test('no rule flags the good examples of another rule in the same profile', () => {
  const base = new Set(rulesFor('base').map(r => r.id));
  const strict = new Set(rulesFor('strict-plain').map(r => r.id));
  const problems = [];
  for (const r of rules) {
    const profile = base.has(r.id) ? 'base' : strict.has(r.id) ? 'strict-plain' : null;
    if (!profile) continue;
    for (const ex of (r.examples && r.examples.pass) || []) {
      for (const i of check(ex, { profile }).issues) {
        if (i.ruleId !== r.id) problems.push(`${r.id} example "${ex}" is flagged by ${i.ruleId} ("${i.text}")`);
      }
    }
  }
  assert.deepEqual(problems, []);
});
