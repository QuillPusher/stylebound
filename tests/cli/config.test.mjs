import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findConfig, loadConfig, CONFIG_FILE } from '../../packages/cli/src/config.mjs';

function tree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stylebound-config-'));
  const deep = path.join(root, 'docs', 'guides', 'v2');
  fs.mkdirSync(deep, { recursive: true });
  return { root, deep, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('finds the config in a parent folder, nearest first', () => {
  const t = tree();
  try {
    fs.writeFileSync(path.join(t.root, CONFIG_FILE), '{ "profile": "base" }');
    assert.equal(findConfig(t.deep), path.join(t.root, CONFIG_FILE));
    fs.writeFileSync(path.join(t.root, 'docs', CONFIG_FILE), '{ "profile": "strict-plain" }');
    const found = loadConfig(t.deep);
    assert.equal(found.file, path.join(t.root, 'docs', CONFIG_FILE));
    assert.equal(found.dir, path.join(t.root, 'docs'));
    assert.deepEqual(found.config, { profile: 'strict-plain' });
  } finally {
    t.done();
  }
});

test('returns null when no folder up to the root has a config', () => {
  const t = tree();
  try {
    const file = findConfig(t.deep);
    // A config may exist above the temp folder on some machines; it must not be inside the tree.
    assert.ok(file === null || !file.startsWith(t.root));
  } finally {
    t.done();
  }
});

test('invalid JSON is reported with the file path', () => {
  const t = tree();
  try {
    const file = path.join(t.deep, CONFIG_FILE);
    fs.writeFileSync(file, '{ "profile": "base", }');
    assert.throws(() => loadConfig(t.deep), err => err.message.startsWith(`${file} is not valid JSON:`));
  } finally {
    t.done();
  }
});

test('a byte order mark at the start of the file is ignored', () => {
  const t = tree();
  try {
    fs.writeFileSync(path.join(t.deep, CONFIG_FILE), String.fromCharCode(0xfeff) + '{ "profile": "strict-plain" }');
    assert.deepEqual(loadConfig(t.deep).config, { profile: 'strict-plain' });
  } finally {
    t.done();
  }
});
