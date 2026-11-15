'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scan, PATH_RULES, TEXT_RULES } = require('../scripts/scan-forbidden.js');

function tempDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylebound-scan-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

function rulesFound(files) {
  const dir = tempDir(files);
  try {
    return scan(dir).findings.map(f => f.rule).sort();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// One planted file per rule. Each must trigger its own rule and no other.
const TEXT_SAMPLES = {
  'spec-page-header': 'Simplified Technical English\nIssue 9\n',
  'spec-page-number': 'some text\nPage 2-1-A3\nmore text\n',
  'spec-part-footer': 'footer: Part 2 - Dictionary\n',
  'spec-dictionary-columns': 'Word | Approved meaning/ ALTERNATIVES | Examples\n',
  'spec-copyright-notice': '{"notice": "Copyright ASD. Personal use only."}\n',
  'spec-extracted-dictionary': '{"approved_count": 1, "not_approved_count": 2}\n',
  'openste-json': '{"words": [{"title": "a", "wordstatus": "approved", "spacypos": "DET"}]}\n'
};
const PATH_SAMPLES = {
  'spec-pdf': 'spec/STE100_ISSUE9.pdf',
  'openste-file': 'vocabulary/openste.json',
  'skill-repo-file': 'scripts/ste-lint.py',
  'skill-repo-folder': 'vendor/SimpleEnglish/notes.txt',
  'skill-eval-output': 'results/raw/model__baseline__readme-intro.txt'
};

test('every rule has a planted sample', () => {
  assert.deepStrictEqual(Object.keys(TEXT_SAMPLES).sort(), TEXT_RULES.map(r => r.id).sort());
  assert.deepStrictEqual(Object.keys(PATH_SAMPLES).sort(), PATH_RULES.map(r => r.id).sort());
});

for (const [id, content] of Object.entries(TEXT_SAMPLES)) {
  test(`text rule ${id} fires on its sample`, () => {
    assert.deepStrictEqual(rulesFound({ 'docs/planted.md': content }), [id]);
  });
}

for (const [id, rel] of Object.entries(PATH_SAMPLES)) {
  test(`path rule ${id} fires on ${rel}`, () => {
    assert.deepStrictEqual(rulesFound({ [rel]: 'x\n' }), [id]);
  });
}

test('ordinary project text passes', () => {
  const prose = [
    'Stylebound is based on the principles of plain and controlled technical English, not on a third-party specification.',
    'Never copy from AminBlg/SimpleEnglish. Reading it is allowed.',
    'See page 2 of the guide. Part 2 of this plan covers the verifier.',
    '{"approved": true, "status": "approved"}'
  ].join('\n');
  assert.deepStrictEqual(rulesFound({ 'README.md': prose, 'skills/stylebound/SKILL.md': prose }), []);
});

test('node_modules and .git are skipped', () => {
  assert.deepStrictEqual(rulesFound({
    'node_modules/x/openste.json': TEXT_SAMPLES['openste-json'],
    '.git/objects/notes': TEXT_SAMPLES['spec-copyright-notice']
  }), []);
});

test('the repository itself is clean', () => {
  const { files, findings } = scan(path.join(__dirname, '..'));
  assert.ok(files > 20);
  assert.deepStrictEqual(findings, []);
});
