#!/usr/bin/env node
// Stages the publishable npm package and packs it, offline (plan chunk 3.4,
// local build). Run with `npm run build:npm`. Output, under release/<version>/
// (release/ is not committed):
//
//   npm/                     a clean copy of the package: CLI, core, rules,
//                            starter glossary, licences and the npm README
//   stylebound-<version>.tgz  the tarball from `npm pack`; `npm publish` runs
//                            from the npm/ folder when the owner gives the go
//   npm-contents.txt         the file list and sizes from `npm pack --dry-run`
//   SHA256SUMS.txt           the tarball's SHA-256 (its line is added or
//                            replaced; lines for other files stay)
//   LINUX-GUIDE.md           a copy of docs/LINUX-GUIDE.md, so a release
//                            folder copied to Linux carries the test steps
//
// The version comes from packages/cli/package.json, the package name from its
// "publishName" field (or --name @scope/stylebound). Nothing is published,
// logged in, pushed or downloaded; npm runs with --offline.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  root, readVersion, readPublishName, releaseDir, tarballName, stage, runNpm, sha256,
  tarEntries, forbiddenEntries, updateSums
} from './npm-package.mjs';

const rel = p => path.relative(root, p).split(path.sep).join('/');
const problems = [];
const problem = msg => { problems.push(msg); console.error('build:npm: ' + msg); };

const nameArg = process.argv.indexOf('--name');
let name;
try {
  name = readPublishName(nameArg >= 0 ? process.argv[nameArg + 1] : undefined);
} catch (e) {
  console.error('build:npm: ' + e.message);
  process.exit(2);
}
const version = readVersion();
const out = releaseDir(version);
const stagedDir = path.join(out, 'npm');
fs.mkdirSync(out, { recursive: true });

const staged = stage(stagedDir, name, version);
console.log(`Staged ${name}@${version}: ${staged.length} files in ${rel(stagedDir)}/`);

// The staged copy must run on its own before it is packed.
const bin = path.join(stagedDir, 'packages', 'cli', 'bin', 'stylebound.mjs');
let r = spawnSync(process.execPath, [bin, '--version'], { cwd: stagedDir, encoding: 'utf8' });
if (r.status !== 0 || r.stdout.trim() !== `stylebound ${version}`) problem(`staged CLI --version gave exit ${r.status}: ${(r.stdout + r.stderr).trim()}`);
r = spawnSync(process.execPath, [bin, 'check', 'README.md', '--profile', 'strict-plain', '--json'], { cwd: stagedDir, encoding: 'utf8' });
if (r.status !== 0 && r.status !== 1) problem(`staged CLI check gave exit ${r.status}: ${r.stderr.trim()}`);

// What `npm pack --dry-run` would include, for review.
r = runNpm(['pack', '--dry-run', '--json'], { cwd: stagedDir });
if (r.status !== 0) problem(`npm pack --dry-run failed: ${(r.stderr || r.stdout).trim()}`);
const dry = r.status === 0 ? JSON.parse(r.stdout)[0] : null;

// The tarball itself.
r = runNpm(['pack', '--json', '--pack-destination', out], { cwd: stagedDir });
if (r.status !== 0) problem(`npm pack failed: ${(r.stderr || r.stdout).trim()}`);
const packed = r.status === 0 ? JSON.parse(r.stdout)[0] : null;

if (dry && packed) {
  const tgz = path.join(out, packed.filename);
  if (packed.filename !== tarballName(name, version)) problem(`unexpected tarball name ${packed.filename}`);
  const buffer = fs.readFileSync(tgz);
  const entries = tarEntries(buffer);
  const names = entries.map(e => e.name);
  const expected = staged.map(f => 'package/' + f);
  const missing = expected.filter(n => !names.includes(n));
  const extra = names.filter(n => !expected.includes(n));
  if (missing.length) problem(`staged files missing from the tarball: ${missing.join(', ')}`);
  if (extra.length) problem(`unexpected files in the tarball: ${extra.join(', ')}`);
  for (const bad of forbiddenEntries(names)) problem(`forbidden in the tarball: ${bad}`);

  const files = [...dry.files].sort((a, b) => a.path.localeCompare(b.path));
  const width = String(Math.max(...files.map(f => f.size))).length;
  const contents = [
    `# npm pack --dry-run for ${dry.name}@${dry.version}: ${packed.filename}`,
    `# ${dry.entryCount} files, ${dry.unpackedSize} bytes unpacked, ${packed.size} bytes packed`,
    `# shasum ${packed.shasum}`,
    `# integrity ${packed.integrity}`,
    '# size (bytes)  path',
    ...files.map(f => `${String(f.size).padStart(width)}  ${f.path}`)
  ];
  fs.writeFileSync(path.join(out, 'npm-contents.txt'), contents.join('\n') + '\n');

  updateSums(path.join(out, 'SHA256SUMS.txt'), packed.filename, sha256(buffer));
  fs.copyFileSync(path.join(root, 'docs', 'LINUX-GUIDE.md'), path.join(out, 'LINUX-GUIDE.md'));

  console.log(`Packed ${rel(tgz)}: ${entries.length} files, ${packed.size} bytes (${dry.unpackedSize} unpacked)`);
  console.log(`Wrote ${rel(path.join(out, 'npm-contents.txt'))}, ${rel(path.join(out, 'SHA256SUMS.txt'))} and ${rel(path.join(out, 'LINUX-GUIDE.md'))}`);
}

if (problems.length) {
  console.error(`build:npm: ${problems.length} problem(s); the release folder is not ready`);
  process.exitCode = 1;
} else {
  console.log('Not published. Next: npm run test:pack.');
}
