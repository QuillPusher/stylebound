import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../../packages/cli/src/config.mjs';
import { loadGlossary } from '../../packages/cli/src/glossary.mjs';

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylebound-glossary-'));
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return { dir, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('the glossary path is relative to the config file', () => {
  const p = project({
    'stylebound.config.json': '{ "glossary": "terms/project.csv" }',
    'terms/project.csv': 'term,preferred,pos,note\nexecute,launch,verb,Our word.\n',
    'docs/guide.md': '# Guide\n'
  });
  try {
    const entries = loadGlossary(loadConfig(path.join(p.dir, 'docs')));
    assert.deepEqual(entries.map(e => [e.term, e.preferred]), [['execute', 'launch']]);
  } finally {
    p.done();
  }
});

test('no glossary setting gives no entries; a missing file and bad rows are errors that name the file', () => {
  const p = project({
    'stylebound.config.json': '{ "glossary": "missing.csv" }',
    'other/stylebound.config.json': '{ "glossary": "bad.csv" }',
    'other/bad.csv': 'term,preferred,pos,note\nabort,,verb,x\n',
    'none/stylebound.config.json': '{}'
  });
  try {
    assert.deepEqual(loadGlossary(loadConfig(path.join(p.dir, 'none'))), []);
    assert.throws(() => loadGlossary(loadConfig(p.dir)), err => err.message.includes('missing.csv: glossary file not found'));
    assert.throws(() => loadGlossary(loadConfig(path.join(p.dir, 'other'))), err =>
      err.message.startsWith('The glossary has 1 problem(s):') && err.message.includes('bad.csv line 2: preferred must name a different word'));
  } finally {
    p.done();
  }
});
