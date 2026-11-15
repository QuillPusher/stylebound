import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, classify, isInstruction } from '../../packages/core/index.mjs';

// Each fixture is a small Markdown document; the first block is classified.
const FIXTURES = [
  ['1. Open the Settings page.', 'procedure'],
  ['- Select **Save**.', 'procedure'],
  ['- The sync runs every hour.', 'description'],
  ['Select **Export** to download the report.', 'procedure'],
  ['If the sync fails, restart the service.', 'procedure'],
  ['To change the schedule, open **Settings > Sync**.', 'procedure'],
  ['The connector retries a failed request three times.', 'description'],
  ['Update 2.1 fixes the crash on start-up.', 'description'],
  ['Export is available on the Pro plan.', 'description'],
  ['Do not close the window during the upgrade.', 'procedure'],
  ["Don't share your API key.", 'procedure'],
  ['Make sure that the service is running.', 'procedure'],
  ['Note: the export can take a few minutes.', 'description'],
  ['# Install the app', 'other'],
  ['| Action |\n|---|\n| Select Save |', 'other'],
  ['> Run `demosync status` to check the connection.', 'procedure'],
  ['You can select more than one file.', 'description'],
  ['When the upload finishes, the status changes to Done.', 'description'],
  ['Please wait until the sync completes.', 'procedure'],
  ['The **Save** button stores your changes.', 'description'],
  ['`demosync start` starts the sync.', 'description'],
  ['Sign in with your work account.', 'procedure'],
  ['Search results show the newest items first.', 'description'],
  ['Sync runs every 15 minutes.', 'description'],
  ['Open **Settings**, then select **Sync**.', 'procedure']
];

test(`classifier fixtures: ${FIXTURES.length} of ${FIXTURES.length} pass`, () => {
  const wrong = [];
  for (const [md, expected] of FIXTURES) {
    const got = classify(parse(md + '\n').blocks[0]);
    if (got !== expected) wrong.push(`${JSON.stringify(md)}: expected ${expected}, got ${got}`);
  }
  assert.deepEqual(wrong, []);
});

test('isInstruction looks past an opening clause and leading markup', () => {
  assert.equal(isInstruction('Before you upgrade, back up the database.'), true);
  assert.equal(isInstruction('**Optional:** select a folder.'), false);
  assert.equal(isInstruction('“Select” the file.'), true);
  assert.equal(isInstruction(''), false);
  assert.equal(isInstruction(String.fromCharCode(0xe000).repeat(4) + ' Select Save.'), true);
});

test('classify needs no more than kind, prose and ordered', () => {
  assert.equal(classify({ kind: 'paragraph', prose: 'Select Save.' }), 'procedure');
  assert.equal(classify({ kind: 'list', prose: 'The file.', ordered: true }), 'procedure');
  assert.equal(classify({ kind: 'image-alt', prose: 'Select Save.' }), 'other');
});
