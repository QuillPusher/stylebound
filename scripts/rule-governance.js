'use strict';
/*
 * Brakes on rule growth and on silent rule removal (plan chunk 1.4).
 *
 *   rules/RULE-IDS.lock  every rule id ever shipped, with its default (on or opt-in)
 *   rules/dropped.json   every removal or demotion, with the owner's approval
 *   rules/budget.json    the soft cap on default-on rules, approved by the owner
 *
 * The tests in tests/rules/ call these checks; `npm test` fails when one fails.
 */
const fs = require('fs');
const path = require('path');
const { loadRules } = require('../packages/core/src/load-rules.js');

const ROOT = path.join(__dirname, '..');
const FILES = {
  lock: path.join(ROOT, 'rules', 'RULE-IDS.lock'),
  dropped: path.join(ROOT, 'rules', 'dropped.json'),
  budget: path.join(ROOT, 'rules', 'budget.json'),
  report: path.join(ROOT, 'docs', 'RULES-DROPPED.html')
};
const DROPPED_FIELDS = ['id', 'action', 'flagged', 'why', 'evidence', 'approvedBy', 'date'];
const LOCK_HEADER = [
  '# Every rule id that has shipped, with its default: on or opt-in.',
  '# Never delete a line. A rule that is removed or demoted needs an entry in rules/dropped.json',
  "# with the owner's approval. `npm run rules:lock` appends new rules; it never removes any.",
  ''
].join('\n');

const defaultOf = r => (r.default === 'opt-in' ? 'opt-in' : 'on');

function readLock(text) {
  const lock = new Map();
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [id, def] = t.split(/\s+/);
    lock.set(id, def === 'opt-in' ? 'opt-in' : 'on');
  }
  return lock;
}

function formatLock(lock) {
  const lines = [...lock].map(([id, def]) => `${id}\t${def}`);
  return LOCK_HEADER + lines.join('\n') + '\n';
}

/** Lock entries plus any rule that is not in the lock yet. Existing lines are never changed. */
function appendNew(lock, rules) {
  const out = new Map(lock);
  const added = [];
  for (const r of rules) if (!out.has(r.id)) { out.set(r.id, defaultOf(r)); added.push(r.id); }
  return { lock: out, added };
}

/** Problems with removals, demotions and the dropped list, as readable sentences. */
function lockProblems(rules, lock, dropped) {
  const problems = [];
  const byId = new Map(rules.map(r => [r.id, r]));
  const entry = (id, action) => dropped.find(d => d.id === id && d.action === action);
  for (const d of dropped) {
    const missing = DROPPED_FIELDS.filter(f => !d[f] || !String(d[f]).trim());
    if (missing.length) problems.push(`rules/dropped.json: entry for ${d.id || '(no id)'} is missing ${missing.join(', ')}.`);
    if (d.action !== 'dropped' && d.action !== 'demoted') problems.push(`rules/dropped.json: entry for ${d.id} has action "${d.action}"; use dropped or demoted.`);
  }
  for (const [id, def] of lock) {
    const rule = byId.get(id);
    if (!rule && !entry(id, 'dropped')) {
      problems.push(`Rule ${id} was removed without an entry in rules/dropped.json. Removing a rule needs the owner's approval: propose it with evidence, then record the approval in rules/dropped.json.`);
    }
    if (rule && def === 'on' && defaultOf(rule) === 'opt-in' && !entry(id, 'demoted')) {
      problems.push(`Rule ${id} was demoted to opt-in without an entry in rules/dropped.json. Demoting a rule needs the owner's approval.`);
    }
  }
  for (const r of rules) {
    if (!lock.has(r.id)) problems.push(`New rule ${r.id} is not in rules/RULE-IDS.lock. Run \`npm run rules:lock\`.`);
  }
  return problems;
}

function defaultOnCount(rules) {
  return rules.filter(r => defaultOf(r) === 'on').length;
}

/** Problems with the rule budget: more default-on rules than the approved cap. */
function budgetProblems(rules, budget) {
  const n = defaultOnCount(rules);
  if (!Number.isInteger(budget.cap) || budget.cap < 1) return ['rules/budget.json: cap must be a positive whole number.'];
  if (!budget.approvedBy || !budget.date) return ['rules/budget.json: the cap needs approvedBy and date.'];
  if (n > budget.cap) {
    return [`There are ${n} default-on rules, over the cap of ${budget.cap} in rules/budget.json. ` +
      'The cap is a prompt to prune, not a wall: ask the owner to approve a removal or a higher cap, ' +
      'then record the new cap with approvedBy and date in rules/budget.json.'];
  }
  return [];
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** docs/RULES-DROPPED.html: one self-contained page, no scripts, no network. */
function renderReport(dropped) {
  const rows = dropped.map(d => `<tr>
<td><code>${esc(d.id)}</code></td>
<td>${esc(d.action)}</td>
<td>${esc(d.flagged)}</td>
<td>${esc(d.why)}</td>
<td>${esc(d.evidence)}</td>
<td>${esc(d.returns || '')}</td>
<td>${esc(d.approvedBy)}, ${esc(d.date)}</td>
</tr>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stylebound: rules dropped or demoted</title>
<style>
body { font: 15px/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 75rem; padding: 0 1rem; color: #1f2328; }
h1 { font-size: 1.5rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #d0d7de; padding: .5rem; text-align: left; vertical-align: top; }
th { background: #f6f8fa; }
code { font-size: .9em; }
</style>
</head>
<body>
<h1>Rules dropped or demoted</h1>
<p>Every rule that was removed or made opt-in, why, and who approved it. Generated from <code>rules/dropped.json</code> by <code>npm run rules:report</code>; do not edit this page by hand.</p>
<table>
<thead><tr><th>Rule</th><th>Action</th><th>What it flagged</th><th>Why</th><th>Evidence</th><th>What would bring it back</th><th>Approved</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function current() {
  return {
    rules: loadRules().rules,
    lock: readLock(fs.readFileSync(FILES.lock, 'utf8')),
    dropped: readJson(FILES.dropped),
    budget: readJson(FILES.budget)
  };
}

module.exports = {
  FILES, readLock, formatLock, appendNew, lockProblems, budgetProblems, defaultOnCount, renderReport, readJson, current
};
