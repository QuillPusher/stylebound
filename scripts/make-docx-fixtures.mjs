#!/usr/bin/env node
// Writes tests/fixtures/docx/<name>.docx from each trial document, with the
// test-only writer. The output is the same bytes every time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownToDocx } from '../tests/helpers/docx-writer.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'trial', 'docs');
const out = path.join(root, 'tests', 'fixtures', 'docx');
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(src).filter(f => /^\d\d-.*\.md$/.test(f))) {
  const target = path.join(out, f.replace(/\.md$/, '.docx'));
  fs.writeFileSync(target, markdownToDocx(fs.readFileSync(path.join(src, f), 'utf8')));
  console.log(`wrote tests/fixtures/docx/${path.basename(target)}`);
}
