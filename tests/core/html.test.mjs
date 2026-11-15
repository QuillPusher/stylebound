import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { check, exportReview, verifyDocument, renderCheckHtml, renderVerifyHtml } from '../../packages/core/index.mjs';
import { promptIntro, promptLimits } from '../../packages/core/src/renderHtml.mjs';
import { main } from '../../packages/cli/src/cli.mjs';
import { exampleOutputs } from '../helpers/examples.mjs';

const outputs = await exampleOutputs();
const reports = { check: outputs['sample.style-check.html'], verify: outputs['sample.style-verify.html'] };

// Every src and href value, and every element that could load something.
// Only real tags count: escaped text such as &lt;img src=...&gt; is not a tag.
function externalRefs(html) {
  const tags = html.match(/<[a-z][^>]*>/gi) || [];
  const refs = tags.flatMap(t => [...t.matchAll(/\b(?:src|href)\s*=\s*["']?([^"'\s>]+)/gi)].map(m => m[1]));
  return refs.filter(r => !r.startsWith('#'));
}

const styles = html => (html.match(/<style>[\s\S]*?<\/style>/g) || []).join('');
const scripts = html => html.match(/<script\b[^>]*>/gi) || [];
const reportData = html => JSON.parse(html.match(/<script type="application\/json" id="sb-data">([\s\S]*?)<\/script>/)[1]);
const docPart = html => html.slice(html.indexOf('<div class="doc">'), html.indexOf('</div>\n<div id="sb-tip"'));

test('both reports are self-contained: no external URL, no <link>, no script from elsewhere', () => {
  for (const [name, html] of Object.entries(reports)) {
    assert.deepEqual(externalRefs(html), [], name);
    assert.ok(!/<link\b/i.test(html), `${name}: no <link>`);
    assert.ok(!/@import|url\(/i.test(styles(html)), `${name}: no CSS that loads anything`);
    assert.ok(html.startsWith('<!DOCTYPE html>'));
  }
  assert.deepEqual(scripts(reports.verify), [], 'the verify report has no script');
  assert.deepEqual(scripts(reports.check), ['<script type="application/json" id="sb-data">', '<script>'], 'check: the data and one inline script');
  const code = reports.check.slice(reports.check.lastIndexOf('<script>'));
  assert.ok(!/\bsrc\s*=|fetch\(|XMLHttpRequest|import\(|innerHTML|eval\(/.test(code), 'the script loads nothing and writes no markup');
});

test('document text with markup is shown as text, never run', () => {
  const text = 'Run <script>alert("x")</script> now. <img src="https://example.com/x.png" onerror="alert(1)">\n';
  const html = renderCheckHtml(text, check(text), { file: '<b>evil</b>.md' });
  assert.ok(!html.includes('<script>alert'), 'the script tag is escaped');
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
  assert.ok(!/<img\b/i.test(html), 'no image element');
  assert.ok(html.includes('&lt;b&gt;evil&lt;/b&gt;.md'));
  assert.deepEqual(externalRefs(html), []);

  const review = exportReview(text, { profile: 'strict-plain' }).json;
  const edited = text.replace('now', 'today') + '\n<script>alert(2)</script>\n';
  const vhtml = renderVerifyHtml(review, verifyDocument(review, edited), {});
  assert.ok(!vhtml.includes('<script>alert'));
  assert.deepEqual(externalRefs(vhtml), []);
});

test('check report: every finding is highlighted, listed and linked', () => {
  const html = reports.check;
  const n = (html.match(/ href="#f\d+"/g) || []).length;
  assert.equal(n, 52, 'one list item per finding');
  for (let k = 1; k <= n; k++) {
    assert.ok(html.includes(`id="f${k}"`), `anchor f${k}`);
    assert.ok(html.includes(`href="#f${k}"`), `link to f${k}`);
  }
  assert.ok(/<mark class="error" data-g="\d+">/.test(html));
  assert.ok(!/<mark[^>]* title=/.test(html), 'no slow browser tooltip: the script shows the rule at once');
  assert.ok(html.includes('<h3>Paragraph p4 (line 9)</h3>'));
  assert.ok(html.indexOf('<noscript>') < html.indexOf('<h3>Paragraph p4'), 'the static list is only for browsers without scripts');
});

test('check report: help call-out above the document, severity filters, prompt buttons', () => {
  const html = reports.check;
  const at = s => html.indexOf(s);
  const help = html.slice(at('<div class="callout"'), html.indexOf('</div>', at('<div class="callout"'))).replace(/<svg[^]*?<\/svg>/g, '[icon]').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(help, 'HOVER [icon] for details, CLICK [icon] for multiple actions, or use QUICK BUTTONS ([icon]/[icon]) to: [icon] Fix (include in the prompt, so the agent changes the text) [icon] Fix this and similar findings [icon] Skip (leave out of the prompt, so the agent does not change the text) [icon] Skip this and similar findings [icon] No action means Fix (include in the prompt)');
  for (const kind of ['fix', 'fixall', 'skip', 'skipall', 'default', 'hover', 'click']) assert.ok(html.includes(`data-icon="${kind}"`), `the ${kind} icon is in the call-out`);
  assert.ok(at('<h2>Document</h2>') < at('class="callout"') && at('class="callout"') < at('<div class="doc">'));
  assert.ok(html.includes('<button type="button" data-filter="all" aria-pressed="true">All 52 findings</button>'));
  for (const sev of ['error', 'warning', 'suggestion']) assert.ok(html.includes(`data-filter="${sev}"`), sev);
  assert.ok(html.includes('<label class="quick-switch" hidden><input type="checkbox" id="sb-quick" checked> Show buttons on every finding</label>'), 'the switch is on by default and shows only with scripts');
  for (const kind of ["add('fix', 'Fix'", "add('fixall', `Fix all similar", "button(`Fix all similar", "add('skip', 'Skip'", "add('skipall', `Skip all similar", "button('Fix'", "button('Skip'", "button(`Skip all similar"]) assert.ok(html.includes(kind), kind);
  assert.ok(html.includes('>Copy Suggested Changes as a Prompt</button>'));
  assert.ok(html.includes('>Export Suggested Changes as a Prompt</button>'));
  const copies = [...html.matchAll(/class="retro sb-copy"/g)].map(m => m.index);
  assert.equal(copies.length, 2, 'the prompt buttons are under the help call-out and at the end');
  assert.ok(at('class="callout"') < copies[0] && copies[0] < at('<div class="doc">'), 'first set: under the help, above the document');
  assert.ok(at('<h2>Copy or Export suggestions for your AI Agent</h2>') < copies[1], 'second set: at the end');
  assert.equal([...html.matchAll(/class="meta sb-status"/g)].length, 2);
  const data = reportData(html);
  assert.equal(data.findings.length, 52);
  assert.deepEqual(data.intro, promptIntro(promptLimits('strict-plain')));
  assert.equal(data.download, 'sample.style-prompt.txt');
  assert.ok(!data.intro.join(' ').includes('sample'), 'the fixed prompt never names the document');
  assert.deepEqual(data.groups.flat().sort((a, b) => a - b), data.findings.map((f, n) => n), 'every finding is in one group');
});

test('check report: a finding inside another one gets its own mark, and crossing findings are split', () => {
  const text = 'Your existing config is migrated automatically, but the manifest format has changed and it cannot be read by older versions, so you will not be able to downgrade after the first sync with 3.0.\n';
  const result = check(text, { profile: 'strict-plain' });
  const doc = docPart(renderCheckHtml(text, result, {}));
  assert.match(doc, /<mark class="warning" data-g="\d+">[^]*<mark class="warning" data-g="\d+">has changed<\/mark>/, 'perfect-tense inside the long sentence');
  assert.equal(doc.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'"), text, 'the marks change no text');

  const crossing = [
    { ...result.issues[0], start: 0, end: 10, severity: 'warning' },
    { ...result.issues[0], start: 5, end: 20, severity: 'error' }
  ];
  const html2 = renderCheckHtml(text, { ...result, issues: crossing }, {});
  assert.match(docPart(html2), /<mark class="warning" data-g="0">(<a [^>]*><\/a>)?Your (<a [^>]*><\/a>)?<mark class="error" data-g="1">exist<\/mark><\/mark><mark class="error" data-g="1">ing config<\/mark>/);
  assert.deepEqual(reportData(html2).groups, [[0], [1]]);
});

test('check report: the embedded data cannot close its script element', () => {
  const text = 'Click </script><script>alert(1)</script> to save the file in order to keep it.\n';
  const html = renderCheckHtml(text, check(text), {});
  assert.equal(scripts(html).length, 2);
  assert.ok(!html.includes('</script><script>alert'));
  assert.ok(reportData(html).findings.some(f => f.text === 'in order to'));
});

test('verify report: summary first, then the diff, lost items in red, then remaining findings', () => {
  const html = reports.verify;
  const at = s => html.indexOf(s);
  assert.ok(at('class="banner loss"') < at('<h2>Paragraphs to review</h2>'));
  assert.ok(at('<h2>Paragraphs to review</h2>') < at('<h2>Changed paragraphs</h2>'));
  assert.ok(at('<h2>Changed paragraphs</h2>') < at('<h2>Findings after the edit</h2>'));
  assert.ok(html.includes('<li class="lost">Missing modals: “can”</li>'));
  assert.ok(html.includes('<del>in order </del>') || html.includes('<del>in order</del>'));
  assert.ok(html.includes('<ins>When you finish, select </ins>'));
});

test('CLI --html writes <doc>.style-check.html and <doc>.style-verify.html', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylebound-html-'));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    fs.writeFileSync('guide.md', 'Click **Save** when you finish.\n');
    const lines = [];
    const io = { out: s => lines.push(s), err: s => lines.push(s) };
    assert.equal(main(['check', 'guide.md', '--profile', 'strict-plain', '--html'], io), 0);
    assert.ok(fs.readFileSync('guide.style-check.html', 'utf8').includes('Check report: guide.md'));
    assert.equal(main(['export', 'guide.md', '--profile', 'strict-plain'], io), 0);
    fs.writeFileSync('guide.md', 'When you finish, select **Save**.\n');
    assert.equal(main(['verify', 'guide.md', '--html'], io), 0);
    assert.ok(fs.readFileSync('guide.style-verify.html', 'utf8').includes('OK: no must-keep item was lost.'));
    assert.ok(lines.includes('Wrote guide.style-check.html.') && lines.includes('Wrote guide.style-verify.html.'));
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
