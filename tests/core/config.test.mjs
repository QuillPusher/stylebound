import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, rules, validateConfig, ConfigError, CONFIG_KEYS, DEFAULT_THRESHOLDS } from '../../packages/core/index.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8');
const ids = rules.map(r => r.id);
const ruleIds = (text, options) => check(text, options).issues.map(i => i.ruleId);

test('same text, two profiles, different issue counts', () => {
  const doc = read('trial/docs/02-install-upgrade-guide.md');
  const base = check(doc, { config: { profile: 'base' } }).issues.length;
  const strict = check(doc, { config: { profile: 'strict-plain' } }).issues.length;
  assert.ok(strict > base, `strict-plain ${strict} > base ${base}`);
  assert.equal(base, check(doc).issues.length, 'base is the default');
});

test('options.profile overrides the profile in the config', () => {
  const t = 'You should restart the service.';
  assert.ok(ruleIds(t, { config: { profile: 'strict-plain' } }).includes('modal-should'));
  assert.ok(!ruleIds(t, { config: { profile: 'strict-plain' }, profile: 'base' }).includes('modal-should'));
});

test('an opt-in rule fires only when enabled', () => {
  const optIn = rules.map(r => (r.id === 'modal-may' ? { ...r, default: 'opt-in' } : r));
  const t = 'The sync may take a few minutes.';
  const run = config => check(t, { rules: optIn, config }).issues.map(i => i.ruleId);
  assert.ok(!run({ profile: 'strict-plain' }).includes('modal-may'));
  assert.ok(run({ profile: 'strict-plain', enable: ['modal-may'] }).includes('modal-may'));
  assert.ok(!run({ profile: 'base', enable: ['modal-may'] }).includes('modal-may'), 'enable does not cross profiles');
});

test('thresholds change the overlay limits', () => {
  const t = 'The connector keeps a local copy of each file that you change while the network is down and sends it later.';
  assert.deepEqual(ruleIds(t, { config: { profile: 'strict-plain' } }), []);
  const tight = check(t, { config: { profile: 'strict-plain', thresholds: { descriptionWords: 10 } } }).issues;
  assert.deepEqual(tight.map(i => [i.ruleId, i.detail]), [['plain-sentence-length', '21 words, limit 10 for a description']]);
  const seven = 'Step one runs. Step two runs. Step three runs. Step four runs. Step five runs. Step six runs. Step seven runs.';
  assert.ok(ruleIds(seven, { config: { profile: 'strict-plain' } }).includes('plain-paragraph-sentences'));
  assert.ok(!ruleIds(seven, { config: { profile: 'strict-plain', thresholds: { paragraphSentences: 8 } } }).includes('plain-paragraph-sentences'));
});

test('ignore switches rules off', () => {
  const t = 'You should restart the service.';
  assert.ok(!ruleIds(t, { config: { profile: 'strict-plain', ignore: ['modal-should'] } }).includes('modal-should'));
});

test('product names and brands are checked for exact casing', () => {
  const t = 'Install Demo sync and connect it to Github.';
  const found = check(t, { config: { productNames: ['Demo Sync'], brands: ['GitHub'] } }).issues
    .filter(i => i.ruleId === 'brand-casing').map(i => [i.text, i.replacement]);
  assert.deepEqual(found, [['Demo sync', 'Demo Sync'], ['Github', 'GitHub']]);
  assert.deepEqual(check(t).issues.filter(i => i.ruleId === 'brand-casing').map(i => i.text), ['Github']);
});

test('a valid config is completed with defaults', () => {
  assert.deepEqual(validateConfig({}, ids), {
    profile: 'base', thresholds: { ...DEFAULT_THRESHOLDS }, enable: [], ignore: [], glossary: null, productNames: [], brands: []
  });
  const full = validateConfig({ $schema: './docs/config.schema.json', profile: 'strict-plain', thresholds: { instructionWords: 18 },
    enable: [], ignore: ['em-dash'], glossary: 'glossary/project.csv', productNames: ['Demo Sync'], brands: ['GitHub'] }, ids);
  assert.equal(full.thresholds.instructionWords, 18);
  assert.equal(full.thresholds.descriptionWords, 25);
});

test('an invalid config is rejected with a readable message for each problem', () => {
  const bad = {
    colour: 'blue', profile: 'strict', thresholds: { instructionWords: 3, foo: 1 },
    enable: ['nope', 'em-dash'], ignore: ['em-dash'], glossary: '', productNames: ['Demo Sync', 'Demo Sync'], brands: 'GitHub'
  };
  let err;
  try { validateConfig(bad, ids); } catch (e) { err = e; }
  assert.ok(err instanceof ConfigError);
  assert.deepEqual(err.problems, [
    'unknown setting "colour". Known settings: profile, thresholds, enable, ignore, glossary, productNames, brands.',
    'profile must be one of "base", "strict-plain", not "strict".',
    'thresholds.instructionWords must be a whole number from 5 to 100, not 3.',
    'unknown threshold "foo". Known thresholds: instructionWords, descriptionWords, paragraphSentences.',
    'enable names an unknown rule "nope".',
    'rule "em-dash" is in both enable and ignore.',
    'glossary must be a path to a CSV file, relative to the config file.',
    'productNames lists "Demo Sync" more than once.',
    'brands must be a list of non-empty strings.'
  ]);
  assert.match(err.message, /^stylebound\.config\.json is not valid:\n- unknown setting "colour"/);
  assert.throws(() => validateConfig([], ids), /the file must contain one JSON object/);
  assert.throws(() => check('Text.', { config: { profile: 'strict' } }), ConfigError);
});

test('the JSON Schema lists the same settings and thresholds as the validator', () => {
  const schema = JSON.parse(read('docs/config.schema.json'));
  assert.deepEqual(Object.keys(schema.properties).sort(), [...CONFIG_KEYS].sort());
  assert.equal(schema.additionalProperties, false);
  const th = schema.properties.thresholds.properties;
  assert.deepEqual(Object.keys(th).sort(), Object.keys(DEFAULT_THRESHOLDS).sort());
  for (const [k, v] of Object.entries(DEFAULT_THRESHOLDS)) assert.equal(th[k].default, v, k);
  assert.deepEqual(schema.properties.profile.enum, ['base', 'strict-plain']);
});
