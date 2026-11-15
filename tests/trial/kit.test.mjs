import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAll, catchByLayer, loadKey } from '../../trial/kit.mjs';

const scores = scoreAll();

test('the trial kit scores all six documents under both profiles', () => {
  assert.equal(loadKey().documents.length, 6);
  assert.equal(scores.length, 12);
  for (const s of scores) {
    assert.deepEqual(s.missingSnippets, [], `${s.file}: every answer-key snippet is in the document`);
    assert.ok(s.words > 0 && s.findings > 0, s.file);
  }
});

test('catch rates do not fall below the recorded baseline', () => {
  const base = catchByLayer(scores, 'base');
  const baseCaught = base.base.caught + base['base+overlay'].caught;
  const basePlanted = base.base.planted + base['base+overlay'].planted;
  assert.equal(basePlanted, 41);
  assert.ok(baseCaught >= 31, `base caught ${baseCaught} of 41 (28 at import, 31 after the 2.4 tuning)`);
  const strict = catchByLayer(scores, 'strict-plain');
  const inScope = ['base', 'overlay', 'base+overlay'];
  const caught = inScope.reduce((n, l) => n + strict[l].caught, 0);
  assert.equal(inScope.reduce((n, l) => n + strict[l].planted, 0), 86); // 65, plus 21 planted in 2.5
  assert.ok(caught >= 77, `strict-plain caught ${caught} of 86 (77 after 2.5; the 2 synonym issues have no rule since one-term-per-concept was dropped)`);
});
