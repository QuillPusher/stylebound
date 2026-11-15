#!/usr/bin/env node
// Rewrites the example outputs in examples/ from regression/sample.md. Run only
// after an intended change, and review the diff before committing; tests compare
// the current output with these files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exampleOutputs } from '../tests/helpers/examples.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'examples');
fs.mkdirSync(dir, { recursive: true });
for (const [name, content] of Object.entries(await exampleOutputs())) {
  fs.writeFileSync(path.join(dir, name), content);
  console.log(`wrote examples/${name}`);
}
