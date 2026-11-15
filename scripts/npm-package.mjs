// Shared pieces of the npm release scripts (plan chunk 3.4, local build):
// which repository files are run-time files, how the publishable package is
// staged, how npm is run without touching the registry, and how a tarball is
// listed and checked. Used by build-npm.mjs, pack-check.mjs and their test.
//
// Nothing here publishes, logs in, pushes or downloads. Every npm call runs
// with --offline, and the update notifier is switched off.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The folder that holds every release. */
export const RELEASE_DIR = path.join(root, 'release');

/**
 * The published package name, from the "publishName" field of
 * packages/cli/package.json, or from --name. It is "stylebound" (the owner
 * checked that the name is free, 2026-10-25). A scoped name such as
 * "@<npm user name>/stylebound" also works and is published as public.
 */
export function readPublishName(override) {
  const cli = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'cli', 'package.json'), 'utf8'));
  const name = override || cli.publishName;
  if (!name) throw new Error('no package name: set "publishName" in packages/cli/package.json (for example "stylebound"), or pass --name');
  if (!/^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)) throw new Error(`invalid npm package name: ${name}`);
  return name;
}
export const isScoped = name => name.startsWith('@');

/** Path segments that must never appear in the package (tests, data, repository tooling). */
export const FORBIDDEN_SEGMENTS = /^(tests?|trial|examples|regression|fixtures|scripts|skills|docs|plan|node_modules|\.github|release)$/i;

/** The version of the next release: the CLI package's version field. */
export function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'cli', 'package.json'), 'utf8'));
  if (!pkg.version || pkg.version === '0.0.0') throw new Error('packages/cli/package.json needs a release version (not 0.0.0)');
  return pkg.version;
}

export function releaseDir(version) { return path.join(RELEASE_DIR, version); }
/** npm names the tarball after the package: a scope becomes a prefix (@a/b -> a-b-<version>.tgz). */
export function tarballName(name, version) { return `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`; }

const slash = p => p.split(path.sep).join('/');

function walk(dir, rel, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const childRel = rel ? rel + '/' + entry.name : entry.name;
    if (entry.isDirectory()) walk(path.join(dir, entry.name), childRel, out);
    else if (entry.isFile()) out.push(childRel);
  }
  return out;
}

/** Every file in the repository (with forward slashes) that is copied into the package. */
export function runtimeFiles() {
  const files = ['LICENSE', 'packages/core/LICENSE', 'packages/core/index.mjs', 'packages/core/index.d.mts'];
  for (const dir of ['packages/cli/bin', 'packages/cli/src', 'packages/core/glossary']) {
    for (const f of walk(path.join(root, ...dir.split('/')), dir, [])) files.push(f);
  }
  for (const f of walk(path.join(root, 'packages', 'core', 'src'), 'packages/core/src', [])) {
    files.push(f);
  }
  return files.sort();
}

/** The manifest of the publishable package. Author, repository, homepage and
 *  bugs are copied from packages/cli/package.json when the owner has filled them in. */
export function packageManifest(name, version) {
  const cli = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'cli', 'package.json'), 'utf8'));
  const manifest = {
    name,
    version,
    description: 'Checks technical writing against plain-English rules, exports the findings for any person or agent, and verifies that no fact was lost. Markdown, plain text and .docx. No AI, no network.',
    license: 'MIT',
    bin: { stylebound: 'packages/cli/bin/stylebound.mjs' },
    exports: { '.': { types: './packages/core/index.d.mts', default: './packages/core/index.mjs' } },
    types: './packages/core/index.d.mts',
    engines: { node: '>=22' },
    keywords: ['technical-writing', 'plain-english', 'style-guide', 'documentation', 'lint', 'markdown', 'docx', 'cli'],
    files: [
      'LICENSE',
      'README.md',
      'packages/cli/package.json',
      'packages/cli/bin/',
      'packages/cli/src/',
      'packages/core/package.json',
      'packages/core/LICENSE',
      'packages/core/index.mjs',
      'packages/core/index.d.mts',
      'packages/core/src/',
      'packages/core/glossary/'
    ]
  };
  // A scoped package is private by default on npm; this makes `npm publish` public without a flag.
  if (isScoped(name)) manifest.publishConfig = { access: 'public' };
  for (const key of ['author', 'repository', 'homepage', 'bugs']) if (cli[key]) manifest[key] = cli[key];
  return manifest;
}

/**
 * Stages a clean copy of the package in outDir (created, or emptied first).
 * Returns the staged files, relative to outDir, with forward slashes.
 */
export function stage(outDir, name, version, readmePath = path.join(root, 'docs', 'NPM-README.md')) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const staged = [];
  const write = (rel, content) => {
    const file = path.join(outDir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    staged.push(rel);
  };
  for (const rel of runtimeFiles()) write(rel, fs.readFileSync(path.join(root, ...rel.split('/'))));
  write('package.json', JSON.stringify(packageManifest(name, version), null, 2) + '\n');
  // The CLI reads its version from packages/cli/package.json, and the core writes
  // "stylebound-core <version>" into review files from packages/core/package.json.
  write('packages/cli/package.json', JSON.stringify({
    name: 'stylebound-cli', version, private: true, license: 'MIT',
    description: 'Part of the Stylebound npm package; the package manifest is ../../package.json.'
  }, null, 2) + '\n');
  write('packages/core/package.json', JSON.stringify({
    name: 'stylebound-core', version, private: true, license: 'MIT',
    description: 'Stylebound core library: parser, rules and checker (MIT, see LICENSE in this folder).'
  }, null, 2) + '\n');
  write('README.md', fs.readFileSync(readmePath));
  return staged.sort();
}

function quote(arg) { return '"' + String(arg).replace(/"/g, '\\"') + '"'; }

/**
 * Runs npm with the given arguments, never online: --offline is forced through
 * the environment, and the update notifier is off. When this script runs under
 * `npm run`, npm's own entry file is used; otherwise the `npm` command is found
 * through the shell.
 */
export function runNpm(args, options = {}) {
  const env = {
    ...process.env,
    npm_config_offline: 'true',
    npm_config_update_notifier: 'false',
    npm_config_audit: 'false',
    npm_config_fund: 'false'
  };
  const entry = process.env.npm_execpath;
  const base = { cwd: options.cwd || root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  if (entry && /\.c?js$/i.test(entry)) return spawnSync(process.execPath, [entry, ...args], base);
  return spawnSync(['npm', ...args.map(quote)].join(' '), { ...base, shell: true });
}

/** Runs a command-line program; a .cmd shim (npm on Windows) needs the shell. */
export function runProgram(program, args, options = {}) {
  const base = { cwd: options.cwd || root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  if (/\.cmd$/i.test(program)) return spawnSync([program, ...args].map(quote).join(' '), { ...base, shell: true });
  return spawnSync(program, args, base);
}

export function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

// A NUL-terminated text field of a tar header.
function tarField(header, start, length) {
  const bytes = header.subarray(start, start + length);
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end < 0 ? length : end).toString('utf8');
}

/** Lists the entries of a .tgz (ustar, with pax and GNU long names) without unpacking it. */
export function tarEntries(tgz) {
  const tar = zlib.gunzipSync(tgz);
  const entries = [];
  let longName = null;
  for (let pos = 0; pos + 512 <= tar.length; ) {
    const header = tar.subarray(pos, pos + 512);
    if (header.every(b => b === 0)) break;
    const size = parseInt(tarField(header, 124, 12).trim() || '0', 8);
    const type = header[156];
    const prefix = tarField(header, 257, 6) === 'ustar' ? tarField(header, 345, 155) : '';
    let name = (prefix ? prefix + '/' : '') + tarField(header, 0, 100);
    const data = tar.subarray(pos + 512, pos + 512 + size);
    pos += 512 + Math.ceil(size / 512) * 512;
    if (type === 76) { longName = tarField(data, 0, data.length); continue; } // 'L': GNU long name
    if (type === 120 || type === 103) { // 'x' or 'g': pax header
      for (const m of data.toString('utf8').matchAll(/^\d+ path=(.*)$/gm)) longName = m[1];
      continue;
    }
    if (longName) { name = longName; longName = null; }
    if (type === 48 || type === 0) entries.push({ name, size }); // '0' or NUL: a file
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The only kinds of file the package may hold: the manifests, licences and
 * README, the CLI and core modules, the rule files and the starter glossary.
 * Anything else (a page, a stylesheet, a note, a build tool) is not a run-time file.
 */
export const RUNTIME_PATTERNS = [
  /^(LICENSE|README\.md|package\.json)$/,
  /^packages\/(cli|core)\/package\.json$/,
  /^packages\/core\/(LICENSE|index\.mjs|index\.d\.mts)$/,
  /^packages\/cli\/(bin|src)\/[^/]+\.mjs$/,
  /^packages\/core\/src\/[^/]+\.(js|mjs)$/,
  /^packages\/core\/src\/rules\/[^/]+\.json$/,
  /^packages\/core\/glossary\/[^/]+\.csv$/
];

/** The names inside the tarball that must not be there, with the reason. */
export function forbiddenEntries(names) {
  const bad = [];
  for (const name of names) {
    const rel = name.replace(/^package\//, '');
    const segments = rel.split('/');
    if (segments.some(s => FORBIDDEN_SEGMENTS.test(s))) bad.push(`${name}: a test, data or repository folder`);
    else if (/\.(docx|tgz|zip)$/i.test(rel)) bad.push(`${name}: a binary data file`);
    else if (/^(STATE\.md|PRINCIPLES\.md|stylebound\.config\.json|package-lock\.json)$/.test(rel)) bad.push(`${name}: repository file`);
    else if (!RUNTIME_PATTERNS.some(p => p.test(rel))) bad.push(`${name}: not a run-time file`);
  }
  return bad;
}

/** Writes or updates one line of a SHA256SUMS.txt file (sha256sum format: hex, two spaces, name). */
export function updateSums(file, name, hex) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean) : [];
  const kept = lines.filter(l => l.split(/ {2}| \*/)[1] !== name);
  kept.push(`${hex}  ${name}`);
  fs.writeFileSync(file, kept.join('\n') + '\n');
  return kept;
}

/** Walks a folder and returns the files below it, with forward slashes. */
export function listFiles(dir) { return walk(dir, '', []).map(slash); }
