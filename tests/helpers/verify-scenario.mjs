// A fixed edit of the sample file, used by the summary golden files and the HTML examples.
import fs from 'node:fs';
import path from 'node:path';
import { exportReview, verifyDocument, formatSummary } from '../../packages/core/index.mjs';
import { root, FIXED_DATE } from './examples.mjs';

export function sampleEdit() {
  const original = fs.readFileSync(path.join(root, 'regression', 'sample.md'), 'utf8');
  const review = exportReview(original, { profile: 'strict-plain', file: 'regression/sample.md', generatedAt: FIXED_DATE }).json;
  const edited = original
    .replace('Click **Save** when you finish.', 'When you finish, select **Save**.')
    .replace('Create a project in order to group related tasks.', 'Create a project to group related tasks.')
    .replace("In today's fast-paced digital world, teams need one list they can trust.", 'Teams need one list.');
  const result = verifyDocument(review, edited);
  const text = formatSummary(result.summary, result.verified, { edited: 'sample.md', review: 'sample.style-review.json' });
  return { original, review, edited, result, text };
}
