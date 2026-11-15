import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../../packages/cli/src/cli.mjs';
import { markdownToDocx } from '../helpers/docx-writer.mjs';
import { runGate, loadDocxWriter, DOCX_SAMPLE } from '../../regression/gate.mjs';
import { root } from '../helpers/examples.mjs';

const original = fs.readFileSync(path.join(root, 'trial', 'docs', '06-ui-strings.md'), 'utf8');
// The trial's agent edit of document 06, brought up to date: the section added to the
// document in 2.5 is kept as written, and "Remove Job" stays, because the rule that
// asked for "Delete Job" (one-term-per-concept) was dropped in 2.5.
const added = original.slice(original.indexOf('## More strings'));
const agentEdit = fs.readFileSync(path.join(root, 'trial', 'runs', '06-ui-strings.md'), 'utf8')
  .replace('| Delete Job |', '| Remove Job |').replace(/\n*$/, '\n\n') + added;

// Exports the original .docx, saves an edited .docx over it, and verifies.
function verifyDocx(editedMarkdown, extra = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylebound-vdocx-'));
  const cwd = process.cwd();
  const lines = [];
  const io = { out: s => lines.push(s), err: s => lines.push(s) };
  try {
    process.chdir(dir);
    fs.writeFileSync('strings.docx', markdownToDocx(original));
    assert.equal(main(['export', 'strings.docx', '--profile', 'strict-plain'], io), 0);
    fs.writeFileSync('strings.docx', markdownToDocx(editedMarkdown));
    const code = main(['verify', 'strings.docx', '--json', ...extra], { out: s => lines.push(s), err: () => {} });
    const html = fs.existsSync('strings.style-verify.html') ? fs.readFileSync('strings.style-verify.html', 'utf8') : null;
    return { code, json: JSON.parse(lines[lines.length - 1].startsWith('{') ? lines[lines.length - 1] : lines.find(l => l.startsWith('{'))), html };
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const missing = r => r.json.paragraphs.flatMap(p => p.missing.map(m => m.item));

test('DOCX fixture: the agent edit from the trial, saved as .docx, loses nothing', () => {
  const r = verifyDocx(agentEdit, ['--html']);
  assert.equal(r.code, 0);
  assert.equal(r.json.summary.status, 'ok');
  assert.ok(r.json.summary.items.changedExpected >= 1, 'should-to-imperative and similar changes are reported for review');
  assert.ok(r.html && r.html.includes('OK: no must-keep item was lost.'), 'verify --html renders a DOCX verify');
});

test('DOCX fixture: a dropped number is caught', () => {
  const r = verifyDocx(original.replace('longer than 260 characters', 'that are very long'));
  assert.equal(r.code, 1);
  assert.ok(missing(r).includes('260'));
});

test('DOCX fixture: a removed negation is caught', () => {
  const r = verifyDocx(original.replace('Windows does not support paths', 'Windows supports paths'));
  assert.equal(r.code, 1);
  assert.ok(missing(r).includes('not'));
});

test('DOCX fixture: a lost placeholder is caught', () => {
  const r = verifyDocx(original.replace('while uploading {filename}', 'while uploading a file'));
  assert.equal(r.code, 1);
  assert.ok(missing(r).includes('{filename}'));
});

test('the gate runs regression paragraphs through the DOCX path with 0 lost facts', async () => {
  await loadDocxWriter();
  const d = runGate({ docx: true });
  assert.deepEqual([...d.good.failures, ...d.bad.failures], []);
  assert.equal(d.good.total, DOCX_SAMPLE);
  assert.equal(d.good.lost, 0);
  assert.ok(d.bad.total >= 20);
  assert.equal(d.bad.caught, d.bad.total);
});
