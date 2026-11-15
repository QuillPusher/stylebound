#!/usr/bin/env node
/*
 * Type-checks packages/core/index.d.mts and tests/types/*.mts with a TypeScript
 * copy that is already on this machine. Nothing is downloaded. It looks in
 * this order: an installed `typescript` package, TYPESCRIPT_PATH (a typescript
 * package folder), then the copy bundled with VS Code.
 *
 *   node scripts/typecheck.js
 *
 * Exit code 1 on type errors. If no TypeScript is found it says so and exits 0.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const BUNDLED = path.join('resources', 'app', 'extensions', 'node_modules', 'typescript');

// VS Code install folders on Windows, macOS and Linux. Newer Windows builds
// keep resources/ one folder down, in a folder named after the build.
function vscodeCandidates() {
  const roots = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft VS Code'),
    '/Applications/Visual Studio Code.app/Contents',
    path.join(os.homedir(), 'Applications', 'Visual Studio Code.app', 'Contents'),
    '/usr/share/code',
    '/usr/lib/code',
    '/opt/visual-studio-code',
    '/snap/code/current/usr/share/code'
  ].filter(Boolean);
  const out = [];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    out.push(path.join(r, BUNDLED), path.join(r, BUNDLED.replace('resources', 'Resources')));
    for (const sub of fs.readdirSync(r)) out.push(path.join(r, sub, BUNDLED));
  }
  return out;
}

function findTypeScript() {
  try { return { ts: require(require.resolve('typescript', { paths: [root] })), from: 'installed package' }; } catch (e) { /* not installed */ }
  const dirs = [process.env.TYPESCRIPT_PATH, ...vscodeCandidates()].filter(Boolean);
  for (const dir of dirs) {
    const lib = path.join(dir, 'lib', 'typescript.js');
    if (fs.existsSync(lib)) return { ts: require(lib), from: dir };
  }
  return null;
}

const found = findTypeScript();
if (!found) {
  console.log('Type check skipped: no TypeScript found (install typescript, set TYPESCRIPT_PATH, or install VS Code).');
  process.exit(0);
}
const { ts, from } = found;

const typesDir = path.join(root, 'tests', 'types');
const files = [path.join(root, 'packages', 'core', 'index.d.mts')]
  .concat(fs.readdirSync(typesDir).filter(f => f.endsWith('.mts')).map(f => path.join(typesDir, f)));

const program = ts.createProgram(files, {
  strict: true,
  noEmit: true,
  exactOptionalPropertyTypes: true,
  noUncheckedIndexedAccess: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  lib: ['lib.es2022.d.ts'],
  types: []
});
const diags = ts.getPreEmitDiagnostics(program);
for (const d of diags) {
  const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  if (d.file) {
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    console.log(`${path.relative(root, d.file.fileName)}:${line + 1}:${character + 1}  ${msg}`);
  } else {
    console.log(msg);
  }
}
console.log(`TypeScript ${ts.version} (${from}): ${files.length} files, ${diags.length} errors.`);
process.exitCode = diags.length ? 1 : 0;
