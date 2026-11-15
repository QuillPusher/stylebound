import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanChoices, reportRun, choicesFile, findingId } from '../../packages/core/index.mjs';
import { main } from '../../packages/cli/src/cli.mjs';

const reportData = html => JSON.parse(html.match(/<script type="application\/json" id="sb-data">([\s\S]*?)<\/script>/)[1]);

test('cleanChoices reads the lean format, and the first format, for the same document only', () => {
  const raw = { stylebound: 'choices', v: 2, doc: 'guide.md', run: 2, skipRules: ['in-order-to', 7], skip: ['1abc2de', { x: 1 }] };
  assert.deepEqual(cleanChoices(raw, 'guide.md'), { doc: 'guide.md', run: 2, skipRules: ['in-order-to'], skip: ['1abc2de'] });
  assert.equal(cleanChoices(raw, 'other.md'), null, 'another document');
  assert.equal(cleanChoices({ ...raw, v: 3 }, 'guide.md'), null);
  const first = { stylebound: 'choices', version: 1, doc: 'guide.md', run: 1, rules: { 'in-order-to': 'similar', x: 'keptSimilar' }, findings: { 'a|b|1': 'dismissed', 'c|d|1': 'kept' } };
  assert.deepEqual(cleanChoices(first, 'guide.md'), { doc: 'guide.md', run: 1, skipRules: ['in-order-to'], skip: [findingId('a|b|1')] });
  assert.equal(cleanChoices('not an object', 'guide.md'), null);
  assert.equal(choicesFile('guide.docx', 3), 'guide.style-choices-3.json');
});

test('check --html carries choices from the file the agent saved, and says how to go on without it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylebound-choices-'));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    fs.writeFileSync('guide.md', 'Click Save in order to keep the file.\n');
    const run = () => {
      const lines = [];
      main(['check', 'guide.md', '--html'], { out: s => lines.push(s), err: s => lines.push(s) });
      const html = fs.readFileSync('guide.style-check.html', 'utf8');
      return { lines, html, data: reportData(html) };
    };

    const first = run();
    assert.equal(reportRun(first.html), 1);
    assert.equal(first.data.run, 1);
    assert.equal(first.data.carried, null);
    assert.ok(!first.lines.some(l => /choices/.test(l)), 'first run: nothing to carry, nothing to say');
    assert.ok(first.data.task2.includes('1. In the same folder as the document, create a file with this name: guide.style-choices-1.json'));

    // The agent did not save the file: a short note, and the run goes on.
    const second = run();
    assert.equal(reportRun(second.html), 2);
    const note = 'guide.style-choices-1.json was not found next to the document, so your choices from run 1 are not applied. Skip those findings again in the new report, as before.';
    assert.ok(second.lines.includes(note));
    assert.ok(second.html.includes(`<p class="notice" role="note">${note}</p>`));

    // The agent saved the file from the run-2 prompt.
    const ruleId = second.data.findings[0].ruleId;
    fs.writeFileSync('guide.style-choices-2.json', JSON.stringify({ stylebound: 'choices', v: 2, doc: 'guide.md', run: 2, skipRules: [ruleId], skip: [] }));
    const third = run();
    assert.equal(reportRun(third.html), 3);
    assert.ok(third.lines.includes('Applied your choices from guide.style-choices-2.json.'));
    assert.deepEqual(third.data.carried.skipRules, [ruleId]);
    assert.ok(third.html.includes('Your choices from guide.style-choices-2.json are applied.'));
    assert.ok(!third.html.includes('class="notice"'));

    // A damaged file is reported the same way, and the older choices still apply.
    fs.writeFileSync('guide.style-choices-3.json', '{ not json');
    const fourth = run();
    assert.equal(reportRun(fourth.html), 4);
    assert.ok(fourth.lines.some(l => l.startsWith('guide.style-choices-3.json could not be read, so your choices from run 3 are not applied.') && l.endsWith('The older choices from guide.style-choices-2.json are applied.')));
    assert.deepEqual(fourth.data.carried.skipRules, [ruleId]);
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
