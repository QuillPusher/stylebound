import test from 'node:test';
import assert from 'node:assert/strict';
import { countWordsPlain, parse } from '../../packages/core/index.mjs';

const MASK = String.fromCharCode(0xe000);
const BACKSLASH = String.fromCharCode(92);

const FIXTURES = [
  ['Select Save.', 2],
  ['Run `docs/guide.md --profile` now.', 3],
  ['Run docs/guide.md --profile now.', 4],
  ['Set the limit to 5 MB.', 5],
  ['Wait 30 seconds before you retry.', 5],
  ['The cache uses 10% of the disk.', 7],
  ['Open the read-only file.', 4],
  ['The sync (it runs every hour) keeps your files current.', 7],
  [`Copy the file(s) to C:${BACKSLASH}Data${BACKSLASH}Backup.`, 5],
  ['The fast—and free—option.', 5],
  ['Call the API at https://example.com/v2/items for details.', 7],
  [`${MASK.repeat(12)} starts the service.`, 4],
  ['Version 2.4.1 adds three new options.', 6],
  ['Use v2 or later.', 4],
  ['Contact support@example.com for help.', 4],
  ["It's ready.", 2],
  ['Press Ctrl+S to save.', 4],
  ['', 0],
  ['— and —', 1],
  ['Type 1,024 MB or 1 GB.', 4],
  ['Retry after 2 minutes (default: 5).', 4]
];

test(`word-count fixtures: ${FIXTURES.length} of ${FIXTURES.length} pass`, () => {
  const wrong = [];
  for (const [text, expected] of FIXTURES) {
    const got = countWordsPlain(text);
    if (got !== expected) wrong.push(`${JSON.stringify(text)}: expected ${expected}, got ${got}`);
  }
  assert.deepEqual(wrong, []);
});

test('masked code in parsed prose counts as one word', () => {
  const block = parse('Run `demosync sync --all --verbose` to start.\n').blocks[0];
  assert.ok(block.prose.includes(MASK));
  assert.equal(countWordsPlain(block.prose), 4);
});

test('plain prose counts like ordinary words', () => {
  const text = 'The connector saves your changes locally and sends them when the network is back.';
  assert.equal(countWordsPlain(text), text.split(' ').length);
});
