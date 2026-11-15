import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { wordDiff } from '../../packages/core/index.mjs';
import { sides, tokenize } from '../../packages/core/src/diff.mjs';
import { sampleEdit } from '../helpers/verify-scenario.mjs';
import { root } from '../helpers/examples.mjs';

const read = rel => fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');
const ops = runs => runs.map(r => `${r.op === 'equal' ? '=' : r.op === 'delete' ? '-' : '+'}${r.text}`);

const DIFFS = [
  ['The upgrade takes about 30 seconds.', 'The upgrade takes a short time.',
    ['=The upgrade takes ', '-about 30 seconds', '+a short time', '=.']],
  ['Click Save when you finish.', 'When you finish, select Save.',
    ['-Click Save when', '+When', '= you finish', '+, select Save', '=.']],
  ['same text', 'same text', ['=same text']],
  ['', 'New text.', ['+New text.']],
  ['Old text.', '', ['-Old text.']],
  ['You must not close the window.', 'You should not close the window.',
    ['=You ', '-must', '+should', '= not close the window.']],
  ['Line one.\nLine two.', 'Line one.\n\nLine two.', ['=Line one.', '-\n', '+\n\n', '=Line two.']]
];

test(`diff fixtures: ${DIFFS.length} of ${DIFFS.length} pass`, () => {
  for (const [before, after, expected] of DIFFS) {
    const runs = wordDiff(before, after);
    assert.deepEqual(ops(runs), expected, JSON.stringify(before));
    assert.deepEqual(sides(runs), { before, after }, 'the diff gives both texts back');
  }
});

test('tokens join back into the text', () => {
  const t = 'Run `demosync push --dry-run` (5 MB), then wait—or don’t.';
  assert.equal(tokenize(t).join(''), t);
});

test('a very long paragraph is shown as replaced', () => {
  const long = 'word '.repeat(4000);
  assert.deepEqual(wordDiff(long, long + 'x').map(r => r.op), ['delete', 'insert']);
});

test('summary snapshot is stable (text and JSON)', () => {
  const { result, text } = sampleEdit();
  assert.equal(text + '\n', read('tests/fixtures/verify-summary.txt'), 'run `npm run golden` if the change is intended');
  assert.deepEqual(result.summary, JSON.parse(read('tests/fixtures/verify-summary.json')));
});

test('the summary counts what happened in the edit', () => {
  const { result } = sampleEdit();
  const s = result.summary;
  assert.equal(s.status, 'loss');
  assert.equal(s.exitCode, 1);
  assert.equal(s.paragraphs.checked, result.verified.paragraphs.length);
  assert.equal(s.items.missing, 1, '"they can trust" was cut, so "can" is missing');
  assert.ok(s.findings.after < s.findings.before);
  assert.deepEqual(s.findings.byRule['condition-first'], { before: 1, after: 0 });
  assert.deepEqual(s.findings.byRule['wordy-phrases'], { before: 1, after: 0 });
  assert.ok(Object.keys(result.diffs).length >= 3);
});
