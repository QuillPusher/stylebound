import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, parseGlossary, starterGlossary, rulesFor } from '../../packages/core/index.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8');
const HEADER = 'term,preferred,pos,note\n';
const strict = (text, extra = {}) => check(text, { profile: 'strict-plain', ...extra }).issues;

test('the starter glossary parses cleanly: about 50 rows, every row explained', () => {
  const { entries, problems } = parseGlossary(read('packages/core/glossary/starter.csv'), 'starter.csv');
  assert.deepEqual(problems, []);
  assert.equal(entries.length, starterGlossary.length);
  assert.ok(entries.length >= 40 && entries.length <= 60, `${entries.length} rows`);
  for (const e of entries) assert.ok(e.note, `${e.term} has a note`);
  assert.ok(entries.every(e => e.kind === 'replacement'), 'the starter has replacements only (synonym groups were dropped in 2.5)');
});

test('no starter term repeats a term that a base rule already checks', () => {
  const baseTerms = [];
  for (const r of rulesFor('base')) {
    if (r.type !== 'term-replace' && r.type !== 'term-ban') continue;
    for (const t of r.terms) baseTerms.push([r.id, new RegExp('^(?:' + (t.match || t) + ')$', 'i')]);
  }
  for (const e of starterGlossary.filter(x => x.kind === 'replacement')) {
    const dup = baseTerms.filter(([, re]) => re.test(e.term)).map(([id]) => id);
    assert.deepEqual(dup, [], `${e.term} is already checked by ${dup.join(', ')}`);
  }
});

test('the preferred term is suggested, with the note as detail', () => {
  const found = strict('Execute the script again.').filter(i => i.ruleId === 'glossary-preferred');
  assert.deepEqual(found.map(i => [i.text, i.replacement, i.detail]), [['Execute', 'Run', 'For a command, a script or a job.']]);
  assert.deepEqual(check('Execute the script again.').issues.filter(i => i.ruleId === 'glossary-preferred'), [], 'not under base');
});

test('the dropped synonym-group rule is gone and stays recorded', () => {
  assert.ok(!rulesFor('strict-plain').some(r => r.id === 'one-term-per-concept'));
  assert.deepEqual(strict('The job was deleted. Select Remove to clear the list.').filter(i => i.ruleId === 'one-term-per-concept'), []);
  const dropped = JSON.parse(read('rules/dropped.json'));
  assert.ok(dropped.some(d => d.id === 'one-term-per-concept' && d.action === 'dropped' && d.approvedBy.startsWith('owner')));
});

test('a project glossary adds terms, overrides the starter, and its names are exempt from title case', () => {
  const { entries, problems } = parseGlossary(HEADER + 'execute,launch,verb,Our word.\nbucket,storage bucket,noun,\nDemo Sync Server,,name,\n', 'project.csv');
  assert.deepEqual(problems, []);
  const text = '## Back up Demo Sync Server data\n\nExecute the job. Copy the bucket. Start demo sync server.\n';
  const issues = strict(text, { glossary: entries });
  const pick = id => issues.filter(i => i.ruleId === id).map(i => [i.text, i.replacement]);
  assert.deepEqual(pick('glossary-preferred'), [['Execute', 'Launch'], ['bucket', 'storage bucket']]);
  assert.deepEqual(pick('brand-casing'), [['demo sync server', 'Demo Sync Server']]);
  assert.deepEqual(pick('heading-title-case'), []);
  assert.ok(strict(text).some(i => i.ruleId === 'heading-title-case'), 'without the name, the heading is flagged');
});

test('glossary problems are reported with line numbers', () => {
  const bad = HEADER + [
    'abort,,verb,no preferred',
    'x,y,pronoun,bad pos',
    'a | b,c,verb,group with preferred',
    'retry,try again,verb,ok',
    'retry,again,verb,duplicate',
    'only,three,fields'
  ].join('\n');
  const { entries, problems } = parseGlossary(bad, 'g.csv');
  assert.equal(entries.length, 1);
  assert.deepEqual(problems, [
    'g.csv line 2: preferred must name a different word.',
    'g.csv line 3: pos must be one of noun, verb, adjective, adverb, phrase, name, or empty.',
    'g.csv line 4: synonym groups ("a | b") are not supported; write one row per term with its preferred word.',
    'g.csv line 6: the term "retry" is already on line 5.',
    'g.csv line 7: expected 4 fields (term, preferred, pos, note), found 3.'
  ]);
  assert.deepEqual(parseGlossary('a,b\n', 'g.csv').problems, ['g.csv: the first line must be: term,preferred,pos,note']);
});

test('CSV details: quotes, commas in quotes, CRLF and a byte order mark', () => {
  const text = String.fromCharCode(0xfeff) + 'term,preferred,pos,note\r\n"sign into","sign in to",verb,"""Sign in"" is the verb, ""to"" the place."\r\n';
  const { entries, problems } = parseGlossary(text);
  assert.deepEqual(problems, []);
  assert.equal(entries[0].note, '"Sign in" is the verb, "to" the place.');
  assert.equal(entries[0].line, 2);
});
