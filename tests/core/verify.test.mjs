import test from 'node:test';
import assert from 'node:assert/strict';
import { exportReview, verify, VerifyError } from '../../packages/core/index.mjs';

const ORIGINAL = [
  '# Upgrade the agent',
  '',
  'Stop the service before you upgrade. The upgrade takes about 30 seconds and you must not close the window.',
  '',
  'You should back up the database first. Each backup is stored in `~/.demosync/backups` for 7 days.',
  '',
  'If the upload of {filename} fails, the agent retries 3 times.',
  '',
  'Demo Sync never deletes files in the bucket.',
  ''
].join('\n');
const review = exportReview(ORIGINAL, { profile: 'strict-plain', file: 'guide.md' }).json;
const STEP = 'Stop the service before you upgrade. The upgrade takes about 30 seconds and you must not close the window.';
const RETRY = 'If the upload of {filename} fails, the agent retries 3 times.';
const NEVER = 'Demo Sync never deletes files in the bucket.';

const statuses = r => Object.fromEntries(r.paragraphs.map(p => [p.id, p.status]));
const para = (r, id) => r.paragraphs.find(p => p.id === id);

test('fixture 1: unchanged', () => {
  const r = verify(review, ORIGINAL);
  assert.equal(r.status, 'ok');
  assert.deepEqual(Object.values(statuses(r)), ['unchanged', 'unchanged', 'unchanged', 'unchanged', 'unchanged']);
  assert.deepEqual(r.added, []);
});

test('fixture 2: a good split keeps every item', () => {
  const r = verify(review, ORIGINAL.replace(STEP, 'Stop the service before you upgrade.\n\nThe upgrade takes about 30 seconds. You must not close the window.'));
  assert.equal(r.status, 'ok');
  const p = para(r, 'p1');
  assert.equal(p.status, 'ok');
  assert.equal(p.split, true);
  assert.equal(p.editedIds.length, 2);
});

test('fixture 3: a dropped number is missing', () => {
  const r = verify(review, ORIGINAL.replace('about 30 seconds', 'a short time'));
  assert.equal(r.status, 'loss');
  assert.deepEqual(para(r, 'p1').missing, [{ kind: 'numbers', item: '30 seconds' }]);
});

test('fixture 4: a weakened modal is a change', () => {
  const r = verify(review, ORIGINAL.replace('you must not close', 'you should not close'));
  assert.equal(r.status, 'changed');
  const p = para(r, 'p1');
  assert.equal(p.status, 'changed');
  assert.deepEqual(p.changed, [{ kind: 'modals', from: 'must', to: ['should'], expected: false, ruleId: null }]);
});

test('fixture 5: a removed negation is missing', () => {
  const r = verify(review, ORIGINAL.replace('Demo Sync never deletes', 'Demo Sync deletes'));
  assert.deepEqual(para(r, 'p4').missing, [{ kind: 'negations', item: 'never' }]);
});

test('fixture 6: merged paragraphs keep their items', () => {
  const r = verify(review, ORIGINAL.replace(RETRY + '\n\n' + NEVER, RETRY + ' ' + NEVER));
  assert.equal(r.status, 'ok');
  assert.equal(para(r, 'p3').merged, true);
  assert.deepEqual([para(r, 'p3').status, para(r, 'p4').status], ['ok', 'ok']);
  assert.deepEqual(para(r, 'p3').editedIds, para(r, 'p4').editedIds);
});

test('fixture 7: reordered paragraphs are matched', () => {
  const r = verify(review, ORIGINAL.replace(RETRY + '\n\n' + NEVER, NEVER + '\n\n' + RETRY));
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.added, []);
  assert.ok(r.paragraphs.some(p => p.moved));
  assert.ok(r.paragraphs.every(p => p.status === 'unchanged'));
});

test('fixture 8: a lost placeholder is missing', () => {
  const r = verify(review, ORIGINAL.replace('the upload of {filename} fails', 'an upload fails'));
  assert.deepEqual(para(r, 'p3').missing, [{ kind: 'code', item: '{filename}' }]);
});

test('a should-to-must change that answers a finding is expected, for review', () => {
  const r = verify(review, ORIGINAL.replace('You should back up', 'You must back up'));
  assert.equal(r.status, 'ok');
  const p = para(r, 'p2');
  assert.equal(p.status, 'changed-expected');
  assert.deepEqual(p.changed, [{ kind: 'modals', from: 'should', to: ['must'], expected: true, ruleId: 'modal-should' }]);
});

test('same-strength modals and written-out contractions are not losses', () => {
  const r = verify(review, ORIGINAL.replace('you must not close', 'you have to keep open').replace('never deletes', 'does not ever delete'));
  // "must not" to "have to keep open" keeps the strength but loses the negation; "never" to "not ever" keeps "not" only.
  assert.deepEqual(para(r, 'p1').missing, [{ kind: 'negations', item: 'not' }]);
  const r2 = verify(exportReview("Don't close the window.\n").json, 'Do not close the window.\n');
  assert.equal(r2.status, 'ok');
});

test('a deleted paragraph with items is missing; one without items is removed; new text is listed', () => {
  const r = verify(review, ORIGINAL.replace(RETRY + '\n\n', '').replace('# Upgrade the agent\n\n', '') + '\nRead the release notes.\n');
  assert.equal(para(r, 'p0').status, 'removed');
  assert.equal(para(r, 'p3').status, 'missing');
  assert.deepEqual(r.added.map(a => a.text), ['Read the release notes.']);
});

test('a paragraph rewritten in place with few shared words is paired by position', () => {
  const r = verify(review, ORIGINAL.replace(NEVER, 'The bucket keeps every file: the tool never deletes any of them in Demo Sync.'));
  const p = para(r, 'p4');
  assert.equal(p.status, 'ok');
  assert.deepEqual(r.added, []);
  const lost = verify(review, ORIGINAL.replace(NEVER, 'Read the release notes.'));
  assert.equal(para(lost, 'p4').status, 'missing', 'a replacement in place that drops the items is a loss, not new text');
});

test('alt text inside an image belongs to the image, not to the paragraph around it', () => {
  const doc = 'See the board.\n\n![Screenshot of the task board](images/board.png)\n';
  const rev = exportReview(doc, { profile: 'strict-plain' }).json;
  const r = verify(rev, doc.replace('Screenshot of the task board', 'The task board'));
  assert.equal(r.status, 'ok');
});

test('the verifier refuses a changed original or an edited review unless forced', () => {
  assert.throws(() => verify(review, ORIGINAL, { original: ORIGINAL + 'x' }), err => err instanceof VerifyError && err.code === 'hash-mismatch');
  assert.equal(verify(review, ORIGINAL, { original: ORIGINAL + 'x', force: true }).hashMismatch, true);
  assert.equal(verify(review, ORIGINAL, { original: ORIGINAL }).hashMismatch, false);
  const tampered = structuredClone(review);
  tampered.paragraphs[1].text += ' Edited.';
  assert.throws(() => verify(tampered, ORIGINAL), /The review file was edited: paragraph p1/);
  assert.throws(() => verify({ version: 2 }, ORIGINAL), err => err.code === 'bad-review');
});

test('CRLF in the edited file gives the same result as LF', () => {
  const edited = ORIGINAL.replace('about 30 seconds', 'a short time');
  const a = verify(review, edited);
  const b = verify(review, edited.replace(/\n/g, '\r\n'));
  assert.deepEqual(statuses(b), statuses(a));
  assert.deepEqual(b.paragraphs.map(p => p.missing), a.paragraphs.map(p => p.missing));
});
