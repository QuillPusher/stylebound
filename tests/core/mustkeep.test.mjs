import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMustKeep, normalizeItem, mustKeepItems, MUST_KEEP_KEYS } from '../../packages/core/index.mjs';
import { loadRegressionSet } from '../../regression/harness.mjs';

test('the extractor matches the reference on all 84 regression paragraphs', () => {
  const { paragraphs } = loadRegressionSet();
  assert.equal(paragraphs.length, 84);
  const differ = [];
  for (const p of paragraphs) {
    const got = extractMustKeep(p.text);
    for (const k of MUST_KEEP_KEYS) if (JSON.stringify(got[k]) !== JSON.stringify(p.must_keep[k])) differ.push(`${p.id} ${k}`);
  }
  assert.deepEqual(differ, []);
});

test('placeholders such as {filename} are kept as code', () => {
  const keep = extractMustKeep('Something went wrong while uploading {filename}. We retry in {minutes} minutes.');
  assert.deepEqual(keep.code, ['{filename}', '{minutes}']);
});

test('each kind of item is found', () => {
  const keep = extractMustKeep('If the upload fails, you must not delete `cache.db` from **Demo Sync**. Each retry waits 30 seconds, at most 5 times.');
  assert.deepEqual(keep.numbers, ['30 seconds', '5']);
  assert.deepEqual(keep.code, ['`cache.db`']);
  assert.deepEqual(keep.names, ['Demo Sync']);
  assert.deepEqual(keep.negations, ['not']);
  assert.deepEqual(keep.conditions, ['if']);
  assert.deepEqual(keep.modals, ['must']);
  assert.deepEqual(keep.quantifiers, ['at most', 'each']);
});

test('a capitalized word that starts a run is not part of the name', () => {
  assert.deepEqual(extractMustKeep('On Windows the app uses WebView2.').names, ['WebView2', 'Windows']);
  assert.deepEqual(extractMustKeep('The MCP server needs no network.').names, ['MCP']);
});

test('normalizeItem and mustKeepItems', () => {
  assert.equal(normalizeItem('  Demo   Sync. '), 'demo sync');
  assert.equal(normalizeItem('Don’t'), "don't");
  const flat = mustKeepItems({ numbers: ['5'], code: [], names: ['Demo Sync'], negations: [], conditions: [], modals: ['must'], quantifiers: [] });
  assert.deepEqual(flat, [{ kind: 'numbers', item: '5' }, { kind: 'names', item: 'Demo Sync' }, { kind: 'modals', item: 'must' }]);
});
