// The example outputs in examples/, built from regression/sample.md with a
// fixed date so they are stable. Used by scripts/update-examples.mjs and the tests.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportReview, renderCheckHtml, renderVerifyHtml, tool } from '../../packages/core/index.mjs';

export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FIXED_DATE = '2026-10-15T00:00:00Z';

export function sampleReview() {
  const text = fs.readFileSync(path.join(root, 'regression', 'sample.md'), 'utf8');
  return exportReview(text, { file: 'regression/sample.md', profile: 'strict-plain', generatedAt: FIXED_DATE });
}

export async function exampleOutputs() {
  const review = sampleReview();
  const text = fs.readFileSync(path.join(root, 'regression', 'sample.md'), 'utf8');
  const { sampleEdit } = await import('./verify-scenario.mjs');
  const edit = sampleEdit();
  return {
    'sample.style-review.json': JSON.stringify(review.json, null, 2) + '\n',
    'sample.style-review.md': review.markdown,
    'sample.style-check.html': renderCheckHtml(text, review.result, { file: 'regression/sample.md', profile: 'strict-plain', generatedAt: FIXED_DATE, tool }),
    'sample.style-verify.html': renderVerifyHtml(edit.review, edit.result, { file: 'sample.md', reviewFile: 'sample.style-review.json', generatedAt: FIXED_DATE, tool })
  };
}
