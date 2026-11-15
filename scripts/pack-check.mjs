#!/usr/bin/env node
// Installs the packed tarball into a temporary npm prefix, offline, and runs
// the installed command from a folder outside the repository (plan chunk 3.4,
// local build). Run with `npm run test:pack` after `npm run build:npm`.
//
// Checks: `npm install -g <tgz> --offline --no-audit --no-fund --prefix <temp>`
// succeeds; `stylebound --version` and `--help` work; check, export and verify
// (with --html) run on a trial Markdown file and a trial .docx copied to a
// temporary folder; the installed package holds no tests, trial data, fixtures,
// scripts or repository paths. Both temporary folders are removed at the end.
// Exit code 0 when every check passes, 1 otherwise, 2 when the tarball is missing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  root, readVersion, releaseDir, tarballName, runNpm, runProgram, forbiddenEntries, listFiles
} from './npm-package.mjs';

// The package name (possibly scoped) comes from the staged manifest that build-npm wrote.

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok });
  console.log((ok ? 'pass  ' : 'FAIL  ') + name + (!ok && detail ? '\n      ' + detail.trim().split('\n').join('\n      ') : ''));
  return ok;
}
const exists = f => fs.existsSync(f);
const output = r => (r.stdout || '') + (r.stderr || '');

const version = readVersion();
const stagedManifest = path.join(releaseDir(version), 'npm', 'package.json');
if (!exists(stagedManifest)) {
  console.error(`test:pack: ${path.relative(root, stagedManifest)} is missing; run npm run build:npm first`);
  process.exit(2);
}
const name = JSON.parse(fs.readFileSync(stagedManifest, 'utf8')).name;
const tgz = path.join(releaseDir(version), tarballName(name, version));
if (!exists(tgz)) {
  console.error(`test:pack: ${path.relative(root, tgz)} is missing; run npm run build:npm first`);
  process.exit(2);
}

const prefix = fs.mkdtempSync(path.join(os.tmpdir(), 'stylebound-npm-prefix-'));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'stylebound-npm-docs-'));
console.log(`Tarball: ${tgz}\nPrefix:  ${prefix}\nDocs:    ${work}`);

try {
  let r = runNpm(['install', '-g', tgz, '--offline', '--no-audit', '--no-fund', '--prefix', prefix]);
  if (!check('npm install -g from the tarball, offline, into a temporary prefix', r.status === 0, output(r))) throw new Error('install failed');

  // npm puts the command at <prefix>/stylebound.cmd on Windows and <prefix>/bin/stylebound elsewhere.
  const shim = [path.join(prefix, 'stylebound.cmd'), path.join(prefix, 'bin', 'stylebound')].find(exists);
  const parts = name.split('/');
  const pkgDir = [path.join(prefix, 'node_modules', ...parts), path.join(prefix, 'lib', 'node_modules', ...parts)].find(exists);
  if (!check('the stylebound command and the package are in the prefix', !!shim && !!pkgDir, `command: ${shim}\npackage: ${pkgDir}`)) throw new Error('layout');
  const run = (args, cwd) => runProgram(shim, args, { cwd });

  r = run(['--version'], work);
  check(`stylebound --version prints "stylebound ${version}"`, r.status === 0 && r.stdout.trim() === `stylebound ${version}`, output(r));
  r = run(['--help'], work);
  check('stylebound --help prints the usage', r.status === 0 && /Usage:/.test(r.stdout), output(r));

  const docs = [
    { name: 'readme.md', from: path.join(root, 'trial', 'docs', '01-readme.md') },
    { name: 'readme.docx', from: path.join(root, 'tests', 'fixtures', 'docx', '01-readme.docx') }
  ];
  for (const doc of docs) {
    const dir = path.join(work, path.extname(doc.name).slice(1));
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(doc.from, path.join(dir, doc.name));
    r = run(['check', doc.name, '--profile', 'strict-plain', '--html'], dir);
    check(`check ${doc.name} --html (exit 0 or 1, writes readme.style-check.html)`,
      (r.status === 0 || r.status === 1) && /findings/.test(r.stdout) && exists(path.join(dir, 'readme.style-check.html')), output(r));
    r = run(['export', doc.name, '--profile', 'strict-plain'], dir);
    check(`export ${doc.name} (writes the review JSON and Markdown)`,
      r.status === 0 && exists(path.join(dir, 'readme.style-review.json')) && exists(path.join(dir, 'readme.style-review.md')), output(r));
    r = run(['verify', doc.name, '--html'], dir);
    check(`verify ${doc.name} --html (unchanged file: exit 0, writes readme.style-verify.html)`,
      r.status === 0 && /0 missing/.test(r.stdout) && exists(path.join(dir, 'readme.style-verify.html')), output(r));
  }

  const files = listFiles(pkgDir);
  const bad = forbiddenEntries(files);
  check(`the installed package ${name} (${files.length} files) has no tests, trial data, fixtures, scripts or docs`, bad.length === 0, bad.join('\n'));

  const repoPaths = [root, root.split(path.sep).join('/')].map(p => p.toLowerCase());
  const hits = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(pkgDir, ...f.split('/')));
    if (buf.subarray(0, 8000).includes(0)) continue;
    const text = buf.toString('utf8').toLowerCase();
    if (repoPaths.some(p => text.includes(p))) hits.push(f);
  }
  check('no file in the installed package names the repository path', hits.length === 0, hits.join('\n'));

  const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  check('the installed package.json is public (no private field, public access for a scope) and names the bin',
    !manifest.private && manifest.bin && manifest.bin.stylebound === 'packages/cli/bin/stylebound.mjs' && (!name.startsWith('@') || (manifest.publishConfig && manifest.publishConfig.access === 'public')));
} catch (e) {
  if (!['install failed', 'layout'].includes(e.message)) check(`unexpected error: ${e.message}`, false, e.stack);
} finally {
  fs.rmSync(prefix, { recursive: true, force: true });
  fs.rmSync(work, { recursive: true, force: true });
  console.log('Removed the temporary prefix and docs folders.');
}

const failed = checks.filter(c => !c.ok).length;
console.log(failed ? `${failed} of ${checks.length} checks failed` : `All ${checks.length} checks passed. Nothing was published.`);
process.exitCode = failed ? 1 : 0;
