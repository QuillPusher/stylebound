import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, rules, rulesFor, profiles } from '../../packages/core/index.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8');
const OVERLAY_A = ['plain-sentence-length', 'plain-paragraph-sentences', 'one-instruction', 'condition-first'];
const ids = (text, profile) => check(text, { profile }).issues.map(i => i.ruleId);
const found = (text, ruleId, profile = 'strict-plain') => check(text, { profile }).issues.filter(i => i.ruleId === ruleId);

test('profiles: base has no overlay rules; strict-plain adds them and drops the base sentence-length rule', () => {
  assert.deepEqual(profiles, ['base', 'strict-plain']);
  const base = rulesFor('base').map(r => r.id);
  const strict = rulesFor('strict-plain').map(r => r.id);
  for (const id of OVERLAY_A) {
    assert.ok(!base.includes(id), `${id} not in base`);
    assert.ok(strict.includes(id), `${id} in strict-plain`);
  }
  assert.ok(base.includes('sentence-length'));
  assert.ok(!strict.includes('sentence-length'), 'replaced by plain-sentence-length');
  assert.equal(rulesFor('strict-plain'), rulesFor('strict-plain'), 'selection is cached');
});

test('an unknown profile is rejected with a readable message', () => {
  assert.throws(() => check('Text.', { profile: 'strict' }), /unknown profile "strict"; use one of: base, strict-plain/);
});

test('trial documents: long sentences are reported under strict-plain, overlay rules never under base', () => {
  for (const f of ['01-readme.md', '02-install-upgrade-guide.md', '04-api-reference.md']) {
    const text = read('trial/docs/' + f);
    assert.ok(ids(text, 'strict-plain').includes('plain-sentence-length'), f);
  }
  for (const f of fs.readdirSync(path.join(root, 'trial', 'docs')).filter(f => /^\d\d-.*\.md$/.test(f))) {
    const base = ids(read('trial/docs/' + f), 'base');
    for (const id of OVERLAY_A) assert.ok(!base.includes(id), `${f}: ${id} under base`);
  }
});

test('sample file: overlay rules add findings only under strict-plain', () => {
  const sample = read('regression/sample.md');
  assert.equal(ids(sample, 'base').length, 50);
  assert.deepEqual(ids(sample, 'base').filter(id => OVERLAY_A.includes(id)), []);
  assert.deepEqual(found(sample, 'condition-first').map(i => i.text), ['when you finish']);
});

test('sentence length: 20 words for an instruction, 25 for a description, code counts as one word', () => {
  const instruction22 = 'Open the Settings page and then choose the folder that you want to keep in sync with the server every single day.';
  const description24 = 'The connector keeps a local copy of each file that you change while the network is down and sends it later.';
  assert.equal(found(instruction22, 'plain-sentence-length').length, 1);
  assert.match(found(instruction22, 'plain-sentence-length')[0].detail, /^22 words, limit 20 for an instruction$/);
  assert.equal(found(description24, 'plain-sentence-length').length, 0);
  assert.equal(found('Run `demosync sync --all --verbose --retry 3 --timeout 30s --log-level debug` now.', 'plain-sentence-length').length, 0);
});

test('a description sentence inside a numbered step gets the instruction limit', () => {
  const step = '1. Select Save. The service then copies every file that changed since the last run to the backup folder on the server in the main office.';
  assert.equal(found(step, 'plain-sentence-length').length, 1);
});

test('thresholds come from the rule, so configuration can change them', () => {
  const tight = rules.map(r => (r.id === 'plain-sentence-length' ? { ...r, maxWordsProcedure: 3 } : r));
  assert.equal(found('Select the Save button now.', 'plain-sentence-length').length, 0);
  assert.equal(check('Select the Save button now.', { profile: 'strict-plain', rules: tight }).issues.filter(i => i.ruleId === 'plain-sentence-length').length, 1);
});

test('paragraph with more than six sentences', () => {
  const seven = 'One. Two. Three. Four. Five. Six. Seven.'.replace(/(\w+)\./g, 'Step $1 runs.');
  assert.equal(found(seven, 'plain-paragraph-sentences').length, 1);
  assert.equal(found(seven, 'plain-paragraph-sentences')[0].detail, '7 sentences, limit 6');
  assert.equal(found('Step one runs. Step two runs.', 'plain-paragraph-sentences').length, 0);
});

test('one instruction per sentence: the second command is marked', () => {
  assert.deepEqual(found('Open the Settings page and select the Sync tab.', 'one-instruction').map(i => i.text), ['and select']);
  assert.deepEqual(found('Select the file, then select Delete.', 'one-instruction').map(i => i.text), ['then select']);
  assert.deepEqual(found('Run the installer and accept the default folder.', 'one-instruction').map(i => i.text), ['and accept']);
  for (const ok of ['Select Save and Close.', 'Press and hold the power button.', 'The service starts and stops on a schedule.',
    'Select the files and folders that you want to share.', 'Select Save to close the dialog.']) {
    assert.deepEqual(found(ok, 'one-instruction'), [], ok);
  }
});

test('condition first: the trailing condition is marked', () => {
  assert.deepEqual(found('Restart the service if the sync stops.', 'condition-first').map(i => i.text), ['if the sync stops']);
  assert.deepEqual(found('Run `demosync push` when the dry run looks correct.', 'condition-first').map(i => i.text), ['when the dry run looks correct']);
  for (const ok of ['If the sync stops, restart the service.', 'Check if the service is running.', 'Select the date when the backup runs.',
    'The sync stops if the disk is full.', 'Select Save (if available).']) {
    assert.deepEqual(found(ok, 'condition-first'), [], ok);
  }
});
