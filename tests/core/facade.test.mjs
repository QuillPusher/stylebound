import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiVersion, check, parse, compileRules, runSelfTest, rules, rulesFor, meta } from '../../packages/core/index.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8');
const sample = read('regression/sample.md');
const trialDocs = fs.readdirSync(path.join(root, 'trial', 'docs'))
  .filter(f => /^\d\d-.*\.md$/.test(f))
  .map(f => read('trial/docs/' + f));

// Keys and types of the public shapes, as in docs/API.md and index.d.mts.
const ISSUE_KEYS = {
  ruleId: 'string', severity: 'string', heuristic: 'boolean', message: 'string', fix: 'string',
  replacement: 'string|null', detail: 'string|null', text: 'string', start: 'number', end: 'number',
  line: 'number', col: 'number', endLine: 'number', endCol: 'number', blockId: 'number', blockKind: 'string'
};
const BLOCK_KEYS = {
  id: 'number', kind: 'string', start: 'number', end: 'number', line: 'number', endLine: 'number',
  source: 'string', prose: 'string', checked: 'boolean'
};
const BLOCK_OPTIONAL = { level: 'number', ordered: 'boolean', listId: 'number', header: 'boolean', column: 'number' };
const RULE_KEYS = ['id', 'name', 'severity', 'type', 'source', 'message', 'fix', 'examples', 'exceptions', 'caseSensitive',
  'heuristic', 'scope', 'patterns', 'terms', 'replacement', 'check', 'maxWords', 'maxItems', 'knownAcronyms',
  'allowSentenceStart', 'matchRaw', 'profiles', 'default', 'replaces', 'maxWordsProcedure', 'maxWordsDescription',
  'maxSentences', 'context', 'groups', 'inflect', 'names', 'mainClause'];
const SEVERITIES = ['error', 'warning', 'suggestion'];
const KINDS = ['paragraph', 'quote', 'heading', 'list', 'cell', 'image-alt'];

const typeOf = v => (v === null ? 'null' : typeof v);

function lineCol(text, offset) {
  const before = text.slice(0, offset);
  return { line: before.split('\n').length, col: offset - (before.lastIndexOf('\n') + 1) + 1 };
}

const exampleCount = set => set.reduce((n, r) => n + (r.examples.flag || []).length + (r.examples.pass || []).length, 0);

test('api version and default rules', () => {
  assert.equal(apiVersion, '0.1');
  assert.equal(rulesFor('base').length, 122);
  assert.equal(exampleCount(rulesFor('base')), 362); // 355 imported, plus 6 added by the trial tuning (2.4) and 1 for setup as a noun
  assert.equal(meta.guide.title, 'OSS Writing Style Guide');
  assert.equal(compileRules().length, rules.length);
});

test('self-test passes through the facade on every rule', () => {
  const r = runSelfTest();
  assert.equal(r.results.length, exampleCount(rules));
  assert.equal(r.skipTests.length, 11);
  assert.ok(r.ok, `${r.failures} failures`);
});

test('sample file matches the golden file (50 issues)', () => {
  const golden = JSON.parse(read('tests/fixtures/sample.issues.json'));
  const { issues } = check(sample);
  assert.equal(issues.length, 50);
  assert.deepEqual(issues, golden);
});

test('sample file gives the frozen baseline issues, in the same order', () => {
  const mine = check(sample).issues.map(i => ({
    line: i.line, col: i.col, rule: i.ruleId, severity: i.severity, text: i.text, replacement: i.replacement
  }));
  assert.deepEqual(mine, JSON.parse(read('tests/fixtures/sample.baseline.json')));
});

test('issues and blocks have exactly the documented shape', () => {
  for (const text of [sample, ...trialDocs]) {
    const { issues, blocks } = check(text);
    for (const i of issues) {
      assert.deepEqual(Object.keys(i).sort(), Object.keys(ISSUE_KEYS).sort());
      for (const [k, t] of Object.entries(ISSUE_KEYS)) {
        assert.ok(t.split('|').includes(typeOf(i[k])), `${i.ruleId}.${k} is ${typeOf(i[k])}`);
      }
      assert.ok(SEVERITIES.includes(i.severity));
      assert.ok(KINDS.includes(i.blockKind));
    }
    blocks.forEach((b, n) => {
      assert.equal(b.id, n);
      assert.ok(KINDS.includes(b.kind));
      for (const k of Object.keys(b)) assert.ok(k in BLOCK_KEYS || k in BLOCK_OPTIONAL, `unexpected block key ${k}`);
      for (const [k, t] of Object.entries(BLOCK_KEYS)) assert.equal(typeOf(b[k]), t, `block.${k}`);
      for (const [k, t] of Object.entries(BLOCK_OPTIONAL)) if (k in b) assert.equal(typeOf(b[k]), t, `block.${k}`);
      assert.equal(b.source, text.slice(b.start, b.end));
    });
  }
});

test('every rule uses only the documented rule keys', () => {
  for (const r of rules) for (const k of Object.keys(r)) assert.ok(RULE_KEYS.includes(k), `${r.id}: undocumented key ${k}`);
});

test('offsets, positions and block ids agree with the text', () => {
  for (const text of [sample, ...trialDocs]) {
    const { issues, blocks } = check(text);
    for (const i of issues) {
      assert.equal(text.slice(i.start, i.end), i.text);
      assert.deepEqual(lineCol(text, i.start), { line: i.line, col: i.col });
      assert.deepEqual(lineCol(text, i.end), { line: i.endLine, col: i.endCol });
      const b = blocks[i.blockId];
      assert.ok(b, `${i.ruleId}: block ${i.blockId} exists`);
      assert.equal(i.blockKind, b.kind);
      assert.ok(b.line <= i.line && i.line <= b.endLine, `${i.ruleId} on line ${i.line} is inside block lines ${b.line}-${b.endLine}`);
    }
  }
});

test('an empty table cell and an empty alt text map to their own blocks', () => {
  const t = '| Name | Value |\n|---|---|\n| a |  |\n|  | b |\n\nSee the screen.\n\n![](images/screen.png)\n';
  const { issues, blocks } = check(t);
  const blank = issues.filter(i => i.ruleId === 'blank-table-cell');
  assert.equal(blank.length, 2);
  for (const i of blank) {
    assert.equal(blocks[i.blockId].kind, 'cell');
    assert.equal(blocks[i.blockId].source, '');
  }
  const alt = issues.filter(i => i.blockKind === 'image-alt');
  assert.ok(alt.length >= 1);
  for (const i of alt) assert.equal(blocks[i.blockId].kind, 'image-alt');
});

test('CRLF input gives the same issues as LF input', () => {
  const crlf = sample.replace(/\n/g, '\r\n');
  const key = i => [i.ruleId, i.line, i.col, i.endLine, i.endCol, i.text.replace(/\r/g, ''), i.blockId].join('|');
  const lf = check(sample).issues;
  const cr = check(crlf).issues;
  assert.deepEqual(cr.map(key), lf.map(key));
  for (const i of cr) assert.equal(crlf.slice(i.start, i.end), i.text);
});

test('parse returns the same blocks as check', () => {
  assert.deepEqual(parse(sample).blocks, check(sample).blocks);
  assert.equal(parse(sample).text, sample);
});

test('a byte order mark does not change the issues', () => {
  const t = '# getting Started\n\nThe user should click here.\n';
  const key = i => [i.ruleId, i.line, i.text].join('|');
  assert.deepEqual(check(String.fromCharCode(0xfeff) + t).issues.map(key), check(t).issues.map(key));
});
