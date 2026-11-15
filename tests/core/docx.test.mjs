import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { check, docxToMarkdown, paragraphAt, DocxError, exportReview } from '../../packages/core/index.mjs';
import { readZip, writeZip, crc32 } from '../../packages/core/src/zip.mjs';
import { parseXml } from '../../packages/core/src/docx.mjs';
import { main } from '../../packages/cli/src/cli.mjs';
import { markdownToDocx } from '../helpers/docx-writer.mjs';
import { validate } from '../../scripts/json-schema.mjs';
import { root } from '../helpers/examples.mjs';

const fixtures = path.join(root, 'tests', 'fixtures', 'docx');
const names = fs.readdirSync(fixtures).filter(f => f.endsWith('.docx'));
const findingKeys = text => check(text, { profile: 'strict-plain' }).issues.map(i => `${i.ruleId} | ${i.text.replace(/\s+/g, ' ')}`).sort();
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

test('zip: write and read back, with a correct CRC-32', () => {
  assert.equal(crc32(Buffer.from('123456789')).toString(16), 'cbf43926');
  const zip = writeZip([['a.txt', 'hello'], ['dir/b.xml', '<x>é</x>']]);
  const files = readZip(zip);
  assert.equal(files.get('a.txt').toString(), 'hello');
  assert.equal(files.get('dir/b.xml').toString('utf8'), '<x>é</x>');
  assert.throws(() => readZip(Buffer.from('not a zip')), /not a ZIP file/);
});

test('xml: entities, attributes and self-closing elements', () => {
  const doc = parseXml('<?xml version="1.0"?><a x="1 &amp; 2"><b/><c>&lt;tag&gt; &#65;&#x42;</c></a>');
  const a = doc.children[0];
  assert.equal(a.attrs.x, '1 & 2');
  assert.equal(a.children[0].name, 'b');
  assert.equal(a.children[1].children[0].text, '<tag> AB');
});

test('the six trial fixtures exist and match their Markdown sources', () => {
  assert.equal(names.length, 6);
  for (const f of names) {
    const md = fs.readFileSync(path.join(root, 'trial', 'docs', f.replace(/\.docx$/, '.md')), 'utf8');
    assert.ok(markdownToDocx(md).equals(fs.readFileSync(path.join(fixtures, f))), `${f} is current: run npm run fixtures:docx`);
  }
});

test('check on each trial .docx gives the same findings as on its .md', () => {
  for (const f of names) {
    const md = fs.readFileSync(path.join(root, 'trial', 'docs', f.replace(/\.docx$/, '.md')), 'utf8');
    const { markdown } = docxToMarkdown(fs.readFileSync(path.join(fixtures, f)));
    assert.deepEqual(findingKeys(markdown), findingKeys(md), f);
  }
});

test('structure survives: headings, lists, numbered steps, tables, code', () => {
  const { markdown, blocks } = docxToMarkdown(fs.readFileSync(path.join(fixtures, '02-install-upgrade-guide.docx')));
  assert.match(markdown, /^# Installing and Upgrading Demo Sync$/m);
  assert.match(markdown, /^## Before You Begin$/m);
  assert.match(markdown, /^- 64-bit Windows 10 or later/m);
  assert.match(markdown, /^3\. Open a terminal and type `demosync --version`/m);
  const kinds = new Set(blocks.map(b => b.kind));
  for (const k of ['heading', 'paragraph', 'list', 'step']) assert.ok(kinds.has(k), k);
  const api = docxToMarkdown(fs.readFileSync(path.join(fixtures, '04-api-reference.docx'))).markdown;
  assert.match(api, /^\| `status` \| string \| No \|/m);
  assert.match(api, /^```\n\{\n {2}"source": "\/data\/reports",/m);
});

test('findings point to the DOCX paragraph and its style', () => {
  const { markdown, blocks } = docxToMarkdown(fs.readFileSync(path.join(fixtures, '02-install-upgrade-guide.docx')));
  const title = check(markdown, { profile: 'strict-plain' }).issues.find(i => i.ruleId === 'heading-title-case');
  assert.deepEqual(paragraphAt(blocks, title.line), { paragraph: 3, style: 'heading 2', kind: 'heading', line: title.line });
});

test('tracked changes: insertions count, deletions do not; styles are resolved by name', () => {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const doc = `<w:document ${W}><w:body>
    <w:p><w:pPr><w:pStyle w:val="Kop1"/></w:pPr><w:r><w:t>Install the agent</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Restart the </w:t></w:r><w:del><w:r><w:delText>old </w:delText></w:r></w:del><w:ins><w:r><w:t xml:space="preserve">new </w:t></w:r></w:ins><w:r><w:t>service.</w:t></w:r></w:p>
  </w:body></w:document>`;
  const styles = `<w:styles ${W}><w:style w:type="paragraph" w:styleId="Kop1"><w:name w:val="heading 1"/></w:style></w:styles>`;
  const buf = writeZip([['word/document.xml', doc], ['word/styles.xml', styles]]);
  assert.equal(docxToMarkdown(buf).markdown, '# Install the agent\n\nRestart the new service.\n');
});

test('a file that is not a .docx is rejected with a readable message', () => {
  assert.throws(() => docxToMarkdown(Buffer.from('plain text')), err => err instanceof DocxError && /not a DOCX file/.test(err.message));
  assert.throws(() => docxToMarkdown(writeZip([['a.txt', 'x']])), /word\/document\.xml is missing/);
});

test('CLI: check and export read a .docx, name its paragraphs, pass the schema, and never change the file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylebound-docx-'));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    fs.copyFileSync(path.join(fixtures, '02-install-upgrade-guide.docx'), 'guide.docx');
    const before = sha(fs.readFileSync('guide.docx'));
    const lines = [];
    const io = { out: s => lines.push(s), err: s => lines.push(s) };
    main(['check', 'guide.docx', '--profile', 'strict-plain'], io);
    assert.ok(lines.some(l => l.startsWith('paragraph 3 (heading 2), line 5  warning    heading-title-case')));
    assert.equal(main(['export', 'guide.docx', '--profile', 'strict-plain'], io), 0);
    const review = JSON.parse(fs.readFileSync('guide.style-review.json', 'utf8'));
    const schema = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'review.schema.json'), 'utf8'));
    assert.deepEqual(validate(schema, review), []);
    assert.equal(review.originalFile, 'guide.docx');
    assert.ok(review.instructions.some(s => s.startsWith('This review comes from a .docx file.')));
    assert.match(fs.readFileSync('guide.style-review.md', 'utf8'), /## Paragraph p2 \(line 5; DOCX paragraph 3, style heading 2\)/);
    assert.equal(sha(fs.readFileSync('guide.docx')), before, 'the .docx bytes never change');
    fs.writeFileSync('broken.docx', 'not a zip');
    assert.equal(main(['check', 'broken.docx'], io), 2);
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the review export from a .docx matches the export from its Markdown view', () => {
  const { markdown, blocks } = docxToMarkdown(fs.readFileSync(path.join(fixtures, '06-ui-strings.docx')));
  const a = exportReview(markdown, { profile: 'strict-plain', docx: blocks, generatedAt: '2026-10-15T00:00:00Z' }).json;
  const b = exportReview(markdown, { profile: 'strict-plain', generatedAt: '2026-10-15T00:00:00Z' }).json;
  assert.deepEqual({ ...a, instructions: [] }, { ...b, instructions: [] });
});
