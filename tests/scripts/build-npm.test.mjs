import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import {
  root, runtimeFiles, packageManifest, stage, tarEntries, forbiddenEntries, updateSums, readPublishName, tarballName
} from '../../scripts/npm-package.mjs';

const readme = path.join(root, 'docs', 'NPM-README.md');
const sample = fs.readFileSync(path.join(root, 'regression', 'sample.md'), 'utf8');

function tmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return { dir, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('runtime files: CLI, core, rules and glossary; nothing from tests or trial, and no page or stylesheet', () => {
  const files = runtimeFiles();
  for (const must of ['LICENSE', 'packages/core/LICENSE', 'packages/cli/bin/stylebound.mjs', 'packages/cli/src/cli.mjs',
    'packages/core/index.mjs', 'packages/core/index.d.mts', 'packages/core/src/engine.js', 'packages/core/src/load-rules.js',
    'packages/core/src/rules/meta.json', 'packages/core/src/rules/coverage.json', 'packages/core/src/rules/06-strict-plain-a.json',
    'packages/core/glossary/starter.csv']) {
    assert.ok(files.includes(must), must);
  }
  for (const f of files) assert.ok(/\.(m?js|d\.mts|json|csv)$|LICENSE$/.test(f), f);
  assert.deepEqual(forbiddenEntries(files), []);
});

test('the manifest is public, with bin, engines, licence, keywords and a files list', () => {
  const m = packageManifest('@example/stylebound', '1.2.3');
  assert.equal(m.name, '@example/stylebound');
  assert.equal(m.version, '1.2.3');
  assert.equal(m.private, undefined);
  assert.deepEqual(m.publishConfig, { access: 'public' }, 'a scoped package is published as public');
  assert.equal(packageManifest('stylebound', '1.2.3').publishConfig, undefined);
  assert.equal(m.license, 'MIT');
  // The whole package is MIT, the core included (owner decision 2026-10-25).
  for (const rel of ['LICENSE', 'packages/core/LICENSE']) {
    assert.match(fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'), /^MIT License\r?\n/, rel);
  }
  for (const rel of ['packages/cli/package.json', 'packages/core/package.json']) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8')).license, 'MIT', rel);
  }
  assert.deepEqual(m.bin, { stylebound: 'packages/cli/bin/stylebound.mjs' });
  assert.equal(m.engines.node, '>=22');
  assert.ok(m.keywords.length >= 5);
  assert.ok(m.files.includes('packages/core/src/'));
  assert.equal(m.dependencies, undefined);
});

test('a staged copy runs on its own: --version, and the same findings as the repository CLI', () => {
  const out = tmp('stylebound-stage-');
  const docs = tmp('stylebound-stage-docs-');
  try {
    const staged = stage(path.join(out.dir, 'npm'), '@example/stylebound', '9.9.9-test', readme);
    assert.ok(staged.includes('package.json') && staged.includes('README.md') && staged.includes('packages/cli/package.json'));
    assert.deepEqual(forbiddenEntries(staged), []);
    const pkg = JSON.parse(fs.readFileSync(path.join(out.dir, 'npm', 'package.json'), 'utf8'));
    assert.equal(pkg.private, undefined);
    const corePkg = JSON.parse(fs.readFileSync(path.join(out.dir, 'npm', 'packages', 'core', 'package.json'), 'utf8'));
    assert.equal(corePkg.license, 'MIT');
    assert.match(fs.readFileSync(path.join(out.dir, 'npm', 'packages', 'core', 'LICENSE'), 'utf8'), /^MIT License\r?\n/);

    const bin = path.join(out.dir, 'npm', 'packages', 'cli', 'bin', 'stylebound.mjs');
    const v = spawnSync(process.execPath, [bin, '--version'], { encoding: 'utf8' });
    assert.equal(v.status, 0, v.stderr);
    assert.equal(v.stdout.trim(), 'stylebound 9.9.9-test');

    fs.writeFileSync(path.join(docs.dir, 'sample.md'), sample);
    const args = ['check', 'sample.md', '--profile', 'strict-plain', '--json'];
    const stagedRun = spawnSync(process.execPath, [bin, ...args], { cwd: docs.dir, encoding: 'utf8' });
    const repoRun = spawnSync(process.execPath, [path.join(root, 'packages', 'cli', 'bin', 'stylebound.mjs'), ...args], { cwd: docs.dir, encoding: 'utf8' });
    assert.equal(stagedRun.status, repoRun.status, stagedRun.stderr);
    const issues = r => JSON.parse(r.stdout).issues.map(i => [i.rule, i.line, i.message]);
    assert.ok(issues(repoRun).length > 10);
    assert.deepEqual(issues(stagedRun), issues(repoRun));

    const review = spawnSync(process.execPath, [bin, 'export', 'sample.md'], { cwd: docs.dir, encoding: 'utf8' });
    assert.equal(review.status, 0, review.stderr);
    const json = JSON.parse(fs.readFileSync(path.join(docs.dir, 'sample.style-review.json'), 'utf8'));
    assert.equal(json.tool, 'stylebound-core 9.9.9-test');
  } finally {
    out.done();
    docs.done();
  }
});

// A one-file tar archive, as a tar program would write it (ustar header).
function tinyTgz(name, content) {
  const data = Buffer.from(content);
  const header = Buffer.alloc(512);
  header.write(name, 0, 'utf8');
  header.write('0000644', 100, 'ascii');
  header.write('0000000', 108, 'ascii');
  header.write('0000000', 116, 'ascii');
  header.write(data.length.toString(8).padStart(11, '0'), 124, 'ascii');
  header.write('00000000000', 136, 'ascii');
  header.write('0', 156, 'ascii');
  header.write('ustar', 257, 'ascii');
  header.write('00', 263, 'ascii');
  header.write('        ', 148, 'ascii');
  let sum = 0;
  for (const b of header) sum += b;
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  const body = Buffer.alloc(Math.ceil(data.length / 512) * 512);
  data.copy(body);
  return zlib.gzipSync(Buffer.concat([header, body, Buffer.alloc(1024)]));
}

test('the publish name must be a valid npm name; a scope becomes a prefix in the tarball name', () => {
  assert.equal(readPublishName('@example/stylebound'), '@example/stylebound');
  assert.throws(() => readPublishName('Not A Name'), /invalid npm package name/);
  assert.equal(tarballName('@example/stylebound', '1.0.0-rc.1'), 'example-stylebound-1.0.0-rc.1.tgz');
  assert.equal(tarballName('stylebound', '1.0.0'), 'stylebound-1.0.0.tgz');
});

test('tarEntries lists the files of a .tgz with their sizes', () => {
  const entries = tarEntries(tinyTgz('package/packages/core/index.mjs', 'export const x = 1;\n'));
  assert.deepEqual(entries, [{ name: 'package/packages/core/index.mjs', size: 20 }]);
});

test('forbidden entries: tests, trial data, fixtures, scripts, binaries and anything that is not a run-time file', () => {
  const bad = forbiddenEntries([
    'package/tests/a.test.mjs', 'package/trial/docs/01.md', 'package/tests/fixtures/docx/a.docx', 'package/scripts/gate.mjs',
    'package/packages/core/src/template.html', 'package/STATE.md', 'package/packages/core/src/engine.js', 'package/packages/cli/bin/stylebound.mjs',
    'package/packages/core/src/styles.css', 'package/packages/core/page.html', 'package/NOTES.md', 'package/packages/core/src/rules/notes.txt'
  ]);
  assert.equal(bad.length, 10);
  assert.ok(bad.every(b => !b.includes('engine.js') && !b.includes('stylebound.mjs')));
});

test('updateSums adds a line, replaces the line of the same file and keeps the others', () => {
  const t = tmp('stylebound-sums-');
  try {
    const file = path.join(t.dir, 'SHA256SUMS.txt');
    updateSums(file, 'stylebound.exe', 'aa');
    updateSums(file, 'stylebound-1.0.0-rc.1.tgz', 'bb');
    const lines = updateSums(file, 'stylebound-1.0.0-rc.1.tgz', 'cc');
    assert.deepEqual(lines, ['aa  stylebound.exe', 'cc  stylebound-1.0.0-rc.1.tgz']);
    assert.equal(fs.readFileSync(file, 'utf8'), 'aa  stylebound.exe\ncc  stylebound-1.0.0-rc.1.tgz\n');
  } finally {
    t.done();
  }
});
