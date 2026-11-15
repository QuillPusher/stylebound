#!/usr/bin/env node
// Rewrites the golden files in tests/fixtures/ from the current core. Run only
// when a change to the output is intended, and review the diff before committing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from '../packages/core/index.mjs';
import { sampleEdit } from '../tests/helpers/verify-scenario.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'tests', 'fixtures');
fs.mkdirSync(dir, { recursive: true });
const write = (name, content) => {
  fs.writeFileSync(path.join(dir, name), content);
  console.log(`wrote tests/fixtures/${name}`);
};

const text = fs.readFileSync(path.join(root, 'regression', 'sample.md'), 'utf8');
write('sample.issues.json', JSON.stringify(check(text).issues, null, 2) + '\n');
const edit = sampleEdit();
write('verify-summary.txt', edit.text + '\n');
write('verify-summary.json', JSON.stringify(edit.result.summary, null, 2) + '\n');
