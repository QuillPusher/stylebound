import test from 'node:test';
import assert from 'node:assert/strict';
import { check, docxToMarkdown, documentNames } from '../../packages/core/index.mjs';
import { styledDocx } from '../helpers/docx-writer.mjs';

// A Word document the way Word builds one: a title page, a table of contents,
// chapters in Heading 1, sections in Heading 2, captions, and bold UI labels.
const items = [
  { style: 'Title', text: 'Demo Sync Setup Guide' },
  { style: 'Subtitle', text: 'Version 1.0' },
  { style: 'TOCHeading', text: 'Table of Contents' },
  { style: 'TOC1', text: '1 About Demo Sync 4' },
  { style: 'TOC2', text: '1.1 Why use Demo Sync 4' },
  { style: 'TOC1', text: '2 Save & close 6' },
  { style: 'Heading1', text: '1 About Demo Sync' },
  { text: 'Demo Sync copies your files to the bucket. The setup is done in Demo Sync (Figure 3).' },
  { style: 'Heading2', text: '1.1 Why use Demo Sync' },
  { text: 'Open the **Save & Close** step, and check the summary that Demo Sync shows.' },
  { style: 'Caption', text: 'Figure 2. The Save & Close summary' },
  { style: 'Heading1', text: '2 Review the setup' },
  { text: 'Click Save in order to keep the settings.' }
];

test('DOCX: the table of contents is not checked, the title is the only top-level heading', () => {
  const md = docxToMarkdown(styledDocx(items)).markdown;
  const lines = md.split('\n');
  assert.equal(lines[0], '# Demo Sync Setup Guide');
  assert.ok(lines.includes('Version 1.0'), 'the subtitle is a line, not a heading');
  assert.ok(md.includes('<!-- Table of contents (not checked):\nTable of Contents\n1 About Demo Sync 4\n1.1 Why use Demo Sync 4\n2 Save & close 6\n-->'));
  assert.ok(lines.includes('## 1 About Demo Sync') && lines.includes('### 1.1 Why use Demo Sync') && lines.includes('## 2 Review the setup'));
  assert.equal(lines.filter(l => /^# /.test(l)).length, 1);
});

test('DOCX: a table of contents in a content control is skipped the same way', () => {
  const md = docxToMarkdown(styledDocx([items[0], { toc: [{ style: 'TOC1', text: '1 About Demo Sync 4' }] }, items[6], items[7]])).markdown;
  assert.ok(md.includes('<!-- Table of contents (not checked):\n1 About Demo Sync 4\n-->'));
});

test('DOCX: structure, labels and names cause no findings; real problems still do', () => {
  const md = docxToMarkdown(styledDocx(items)).markdown;
  const ids = check(md, { profile: 'strict-plain' }).issues.map(i => `${i.ruleId}: ${i.text}`);
  for (const rule of ['multiple-h1', 'stacked-headings', 'sentence-start-numeral', 'numerals-in-prose', 'ampersand', 'heading-title-case']) {
    assert.deepEqual(ids.filter(x => x.startsWith(rule + ':')), [], rule);
  }
  assert.ok(ids.some(x => x.startsWith('click-and-select') || x.includes('in order to')), `real findings still found: ${ids.join('; ')}`);
});

test('document names: bold labels and phrases that are always capitalized', () => {
  const names = documentNames('Use the **Save & Close** step. Then Demo Sync saves it, and Demo Sync shows it. The sync folder and the Sync Folder differ.\n');
  assert.ok(names.includes('Save & Close'));
  assert.ok(names.includes('Demo Sync'));
  assert.ok(!names.includes('Sync Folder'), 'it also appears in lower case');
});

test('numbers that label something are not findings: Figure 3, Section 5, Step 2', () => {
  const ids = check('See Figure 3 and Step 2 for the 4 options.\n').issues.filter(i => i.ruleId === 'numerals-in-prose').map(i => i.text);
  assert.deepEqual(ids, ['4']);
});
