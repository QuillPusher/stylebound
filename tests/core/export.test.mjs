import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { exportReview, extractMustKeep, REVIEW_VERSION } from '../../packages/core/index.mjs';
import { sha256, paragraphMustKeep } from '../../packages/core/src/export.mjs';
import { validate } from '../../scripts/json-schema.mjs';
import { root, exampleOutputs, sampleReview } from '../helpers/examples.mjs';

const read = rel => fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8');
const reviewSchema = JSON.parse(read('docs/review.schema.json'));
const trialDocs = fs.readdirSync(path.join(root, 'trial', 'docs')).filter(f => /^\d\d-.*\.md$/.test(f));

test('every export passes the review schema', () => {
  assert.deepEqual(validate(reviewSchema, sampleReview().json), []);
  for (const f of trialDocs) {
    for (const profile of ['base', 'strict-plain']) {
      const { json } = exportReview(read('trial/docs/' + f), { file: 'trial/docs/' + f, profile });
      assert.deepEqual(validate(reviewSchema, json), [], `${f} ${profile}`);
    }
  }
});

test('the schema check catches a broken review', () => {
  const json = structuredClone(sampleReview().json);
  json.version = 2;
  delete json.paragraphs[0].sha256;
  json.findings[0].severity = 'info';
  json.extra = true;
  const problems = validate(reviewSchema, json);
  assert.ok(problems.includes('$.version: expected 1'));
  assert.ok(problems.includes('$.paragraphs[0]: missing sha256'));
  assert.ok(problems.some(p => p.startsWith('$.findings[0].severity: expected one of')));
  assert.ok(problems.includes('$: unexpected property extra'));
});

test('the examples in examples/ are up to date (snapshot)', async () => {
  for (const [name, content] of Object.entries(await exampleOutputs())) {
    assert.equal(read('examples/' + name).replace(/\r\n/g, '\n'), content, `run \`npm run examples\` if the change to ${name} is intended`);
  }
});

test('the review is complete and self-consistent', () => {
  const text = read('regression/sample.md');
  const { json, result } = sampleReview();
  assert.equal(json.version, REVIEW_VERSION);
  assert.equal(json.originalSha256, sha256(text));
  assert.equal(json.findings.length, result.issues.length);
  const ids = new Set(json.paragraphs.map(p => p.id));
  for (const p of json.paragraphs) {
    assert.equal(p.sha256, sha256(p.text));
    assert.deepEqual(p.mustKeep, paragraphMustKeep(p.kind, p.text));
    assert.ok(text.includes(p.text), `${p.id} text comes from the document`);
  }
  for (const f of json.findings) {
    assert.ok(ids.has(f.paragraphId), `${f.paragraphId} exists`);
    assert.equal(text.slice(f.start, f.end), f.text);
  }
  assert.deepEqual(json.rules.map(r => r.id), [...new Set(json.findings.map(f => f.ruleId))].sort());
  for (const r of json.rules) assert.ok(r.says.length > 0, r.id);
});

test('the Markdown lists instructions, rules and each paragraph with findings', () => {
  const { json, markdown } = sampleReview();
  const lines = markdown.split('\n');
  assert.equal(lines[0], '# Review for regression/sample.md');
  const headings = lines.filter(l => l.startsWith('## ')).map(l => l.slice(3));
  assert.equal(headings[0], 'Instructions');
  assert.equal(headings[1], 'Rules in plain words');
  const withFindings = [...new Set(json.findings.map(f => f.paragraphId))];
  assert.deepEqual(headings.slice(2).map(h => h.split(' ')[1]), json.paragraphs.filter(p => withFindings.includes(p.id)).map(p => p.id));
  assert.equal((markdown.match(/^```/gm) || []).length % 2, 0, 'no unbalanced code fence');
  for (const f of json.findings) assert.ok(markdown.includes(`${f.ruleId}, line ${f.line}:`), f.ruleId);
});

test('a document without findings says so', () => {
  const { json, markdown } = exportReview('Select Save.\n', { profile: 'base' });
  assert.equal(json.findings.length, 0);
  assert.ok(markdown.includes('No findings. Nothing to change.'));
  assert.deepEqual(validate(reviewSchema, json), []);
});

test('the config schema accepts the documented example and rejects a bad one', () => {
  const schema = JSON.parse(read('docs/config.schema.json'));
  const good = { $schema: './docs/config.schema.json', profile: 'strict-plain', thresholds: { instructionWords: 20 }, enable: [], ignore: ['em-dash'], glossary: 'g.csv', productNames: ['Demo Sync'], brands: ['GitHub'] };
  assert.deepEqual(validate(schema, good), []);
  assert.ok(validate(schema, { profile: 'strict', thresholds: { instructionWords: 3 } }).length >= 2);
});
