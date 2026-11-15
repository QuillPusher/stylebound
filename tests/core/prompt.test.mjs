import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { check, renderCheckHtml, promptText, cleanChoices } from '../../packages/core/index.mjs';
import { root } from '../helpers/examples.mjs';

// The prompt goes to any AI agent, including small models. These tests hold
// it to the rules that make it hard to misread.
const text = fs.readFileSync(path.join(root, 'trial', 'docs', '02-install-upgrade-guide.md'), 'utf8');
const reportData = html => JSON.parse(html.match(/<script type="application\/json" id="sb-data">([\s\S]*?)<\/script>/)[1]);
const data = reportData(renderCheckHtml(text, check(text, { profile: 'strict-plain' }), { file: 'docs/guide.md', profile: 'strict-plain', run: 3 }));

test('prompt: two tasks, named at the start and spelled out at the end', () => {
  const { text: p } = promptText(data, [], []);
  assert.ok(p.startsWith('Edit a document so that it follows a style guide.'));
  assert.ok(p.indexOf('Task 2: Save one small file.') < p.indexOf('TASK 1: EDIT THE DOCUMENT'));
  assert.ok(p.indexOf('Changes to make:') < p.indexOf('TASK 2: SAVE ONE SMALL FILE'));
  assert.ok(p.includes('1. In the same folder as the document, create a file with this name: guide.style-choices-3.json'));
  assert.ok(!/guide\.md/.test(p.slice(0, p.indexOf('TASK 2'))), 'Task 1 never names the document');
});

test('prompt: no state words and no tool words that an agent could act on', () => {
  // Quoted text is the document's own text or a rule's example; the words around it are the tool's.
  const p = promptText(data, [data.findings[0].ruleId], [data.findings[1].id]).text.replace(/"[^"\n]*"/g, '""');
  for (const word of [/\bkeep\b/i, /\bkept\b/i, /\bdismiss/i, /\bapproved?\b/i, /\bignored?\b/i, /strict-plain/i, /\bseverity\b/i, /\bline \d/i, /\bp\d+\b/]) {
    assert.ok(!word.test(p), `the prompt contains ${word}`);
  }
});

test('prompt: places are found by their first words, and each change says what to do', () => {
  const { text: p } = promptText(data, [], []);
  assert.ok(p.includes('In the list item that starts "Execute demosync status to check the result.":\n- Use the glossary\'s preferred word: change "Execute" to "Run".'));
  assert.ok(p.includes('In the heading "Install on a New Machine":'));
  assert.ok(/- No contractions: change "can't" to "cannot"\./.test(p));
  assert.ok(!p.includes('`'.repeat(1) + 'damaged'), 'no Markdown marks inside quotes');
});

test('prompt: ignored findings are left out, and the choices are one short line', () => {
  const rule = data.findings[0].ruleId;
  const single = data.findings.find(f => f.ruleId !== rule);
  const all = promptText(data, [], []);
  const some = promptText(data, [rule], [single.id]);
  assert.equal(some.count, all.count - data.findings.filter(f => f.ruleId === rule).length - 1);
  const block = some.text.slice(some.text.indexOf('```\n') + 4, some.text.lastIndexOf('\n```'));
  assert.equal(block, some.choices);
  assert.ok(!block.includes('\n') && block.length < 200, block);
  assert.deepEqual(cleanChoices(JSON.parse(block), 'guide.md'), { doc: 'guide.md', run: 3, skipRules: [rule], skip: [single.id] });
});

test('prompt: no changes left still gives both tasks', () => {
  const rules = [...new Set(data.findings.map(f => f.ruleId))];
  const { text: p, count } = promptText(data, rules, []);
  assert.equal(count, 0);
  assert.ok(p.includes('There are no changes to make. Do not edit the document.'));
  assert.ok(p.includes('TASK 2: SAVE ONE SMALL FILE'));
});

test('prompt: the limits follow the profile', () => {
  const base = reportData(renderCheckHtml(text, check(text), { file: 'guide.md', profile: 'base' }));
  assert.ok(base.intro.includes('   - A sentence has at most 30 words.'));
  assert.ok(data.intro.includes('   - An instruction has at most 20 words. Any other sentence has at most 25 words.'));
});
