import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, reviewPaths, EXIT } from '../../packages/cli/src/cli.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const bin = path.join(root, 'packages', 'cli', 'bin', 'stylebound.mjs');
const sample = fs.readFileSync(path.join(root, 'regression', 'sample.md'), 'utf8');

function run(args, cwd) {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function workspace(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylebound-cli-'));
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return { dir, file: rel => path.join(dir, ...rel.split('/')), done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('e2e: export, edit, verify on the sample file', () => {
  const w = workspace({ 'docs/guide.md': sample });
  try {
    const ex = run(['export', 'docs/guide.md', '--profile', 'strict-plain'], w.dir);
    assert.equal(ex.code, EXIT.ok, ex.err);
    assert.match(ex.out, /Wrote docs\/guide\.style-review\.json and docs\/guide\.style-review\.md\./);
    const review = JSON.parse(fs.readFileSync(w.file('docs/guide.style-review.json'), 'utf8'));
    assert.equal(review.originalFile, 'docs/guide.md');
    assert.equal(review.profile, 'strict-plain');
    assert.ok(fs.readFileSync(w.file('docs/guide.style-review.md'), 'utf8').startsWith('# Review for docs/guide.md'));

    // A good edit: three findings fixed, nothing lost.
    const good = sample
      .replace('Click **Save** when you finish.', 'When you finish, select **Save**.')
      .replace('Create a project in order to group related tasks.', 'Create a project to group related tasks.')
      .replace('The user can invite teammates from the project page.', 'You can invite teammates from the project page.');
    fs.writeFileSync(w.file('docs/guide.md'), good);
    const ok = run(['verify', 'docs/guide.md'], w.dir);
    assert.equal(ok.code, EXIT.ok, ok.out + ok.err);
    assert.match(ok.out, /OK: no must-keep item was lost\. Exit code 0\./);
    assert.match(ok.out, /Findings: 52 before the edit, 49 after\./);
    assert.match(ok.out, /Findings after the edit \(49\):/, 'verify reports the remaining findings');

    // A bad edit: a number is dropped.
    fs.writeFileSync(w.file('docs/guide.md'), good.replace('5 projects', 'a few projects'));
    const bad = run(['verify', 'docs/guide.md', '--json'], w.dir);
    assert.equal(bad.code, EXIT.found);
    const json = JSON.parse(bad.out);
    assert.equal(json.summary.status, 'loss');
    assert.ok(json.paragraphs.some(p => p.missing.some(m => m.item === '5')));
  } finally {
    w.done();
  }
});

test('verify refuses a changed original unless forced', () => {
  const w = workspace({ 'guide.md': 'Select Save.\n', 'old.md': 'Select Save now.\n' });
  try {
    assert.equal(run(['export', 'guide.md'], w.dir).code, EXIT.ok);
    const refused = run(['verify', 'guide.md', '--original', 'old.md'], w.dir);
    assert.equal(refused.code, EXIT.refused);
    assert.match(refused.err, /^Verify refused: The original document has changed/);
    assert.equal(run(['verify', 'guide.md', '--original', 'old.md', '--force'], w.dir).code, EXIT.ok);
    fs.writeFileSync(w.file('guide.style-review.json'), '{ not json');
    assert.equal(run(['verify', 'guide.md'], w.dir).code, EXIT.refused);
  } finally {
    w.done();
  }
});

test('check: text, JSON and exit codes; the config file is found from the document folder', () => {
  const w = workspace({
    'stylebound.config.json': '{ "profile": "strict-plain", "glossary": "terms.csv" }',
    'terms.csv': 'term,preferred,pos,note\nbucket,storage bucket,noun,Our word.\n',
    'docs/a.md': 'You should copy the bucket.\n',
    'docs/clean.md': 'Select Save.\n'
  });
  try {
    const text = run(['check', 'docs/a.md'], w.dir);
    assert.equal(text.code, EXIT.found, 'modal-should is an error');
    assert.match(text.out, /1:5 {2}error {6}modal-should/);
    assert.match(text.out, /glossary-preferred .*"bucket".*Suggested: "storage bucket"/);
    assert.match(text.out, /profile strict-plain\.$/m);
    const json = JSON.parse(run(['check', 'docs/a.md', '--json', '--profile=base'], w.dir).out);
    assert.equal(json.profile, 'base');
    assert.ok(!json.issues.some(i => i.ruleId === 'modal-should'));
    assert.equal(run(['check', 'docs/clean.md'], w.dir).code, EXIT.ok);
  } finally {
    w.done();
  }
});

test('usage problems exit with code 2 and a readable message', () => {
  const w = workspace({ 'a.md': 'Text.\n', 'bad.json': '{ "profile": "strict" }' });
  try {
    const cases = [
      [['frobnicate', 'a.md'], /Unknown command "frobnicate"/],
      [['check'], /stylebound check needs a file/],
      [['check', 'missing.md'], /File not found: missing\.md/],
      [['check', 'a.md', '--profile'], /--profile needs a value/],
      [['check', 'a.md', '--colour'], /Unknown option --colour/],
      [['check', 'a.md', '--config', 'bad.json'], /profile must be one of "base", "strict-plain", not "strict"/],
      [['check', 'a.md', '--profile', 'strict'], /unknown profile "strict"/],
      [['verify', 'a.md'], /Review file not found/]
    ];
    for (const [args, message] of cases) {
      const r = run(args, w.dir);
      assert.equal(r.code, EXIT.usage, args.join(' '));
      assert.match(r.err, message, args.join(' '));
    }
    assert.equal(run([], w.dir).code, EXIT.usage);
  } finally {
    w.done();
  }
});

test('--help and --version', () => {
  const help = run(['--help'], root);
  assert.equal(help.code, 0);
  assert.match(help.out, /^Stylebound: check technical writing/);
  assert.match(help.out, /Exit codes: 0 success/);
  assert.match(run(['--version'], root).out, /^stylebound \d+\.\d+\.\d+/);
});

test('argument parsing and review paths', () => {
  assert.deepEqual(parseArgs(['check', 'a.md', '--profile=strict-plain', '--json']),
    { positional: ['check', 'a.md'], flags: { profile: 'strict-plain', json: true } });
  const docs = name => path.join('docs', name);
  assert.deepEqual(reviewPaths(docs('guide.md')), {
    json: docs('guide.style-review.json'), md: docs('guide.style-review.md'),
    checkHtml: docs('guide.style-check.html'), verifyHtml: docs('guide.style-verify.html')
  });
  assert.equal(reviewPaths('README').json, 'README.style-review.json');
});
