/*
 * HTML reports (plan chunk 1.13): one self-contained file each for check and
 * verify. All CSS is inline and there is no font, image, stylesheet or script
 * from anywhere else, so the file opens from disk with no network. Every piece
 * of document text is escaped. The check report has one inline script for the
 * severity filter, the finding pop-ups and the prompt export; its findings are
 * embedded as JSON with every "<" escaped, and the script only ever writes them
 * with textContent. The verify report has no script.
 */

import { createRequire } from 'node:module';

const SEVERITY_RANK = { error: 3, warning: 2, suggestion: 1 };

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CSS = `
:root { --fg: #1f2328; --muted: #59636e; --bg: #ffffff; --panel: #f6f8fa; --line: #d0d7de;
  --error: #cf222e; --error-bg: #ffebe9; --error-hl: #ffc9c6; --error-line: #a40e26; --warning: #9a6700; --warning-bg: #fff8c5; --suggestion: #0969da; --suggestion-bg: #ddf4ff;
  --ins: #1a7f37; --ins-bg: #dafbe1; --del: #cf222e; --del-bg: #ffebe9; --ink: #1f2328; }
@media (prefers-color-scheme: dark) {
  :root { --fg: #e6edf3; --muted: #9198a1; --bg: #0d1117; --panel: #151b23; --line: #3d444d;
    --error: #ff7b72; --error-bg: #4b1113; --error-hl: #6b1a1e; --error-line: #ff8f87; --warning: #d29922; --warning-bg: #3b2e0a; --suggestion: #58a6ff; --suggestion-bg: #0c2d6b;
    --ins: #3fb950; --ins-bg: #0f3d1d; --del: #ff7b72; --del-bg: #4b1113; --ink: #c9d1d9; }
}
* { box-sizing: border-box; }
body { font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--fg); background: var(--bg); margin: 0; }
main { max-width: 78rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
h2 { font-size: 1.15rem; margin: 2rem 0 .5rem; border-bottom: 1px solid var(--line); padding-bottom: .25rem; }
h3 { font-size: 1rem; margin: 1.25rem 0 .4rem; }
.meta { color: var(--muted); margin: 0 0 1rem; }
.counts { display: flex; flex-wrap: wrap; gap: .5rem; margin: .75rem 0; padding: 0; list-style: none; }
.counts li { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: .35rem .7rem; }
.doc { white-space: pre-wrap; word-wrap: break-word; background: var(--panel); border: 1px solid var(--line); border-radius: 6px;
  padding: 1rem; font: 14px/1.85 ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace; }
mark { color: inherit; border-radius: 3px; padding: 0 1px; }
mark.error { background: var(--error-hl); box-shadow: inset 0 -2px var(--error-line); }
mark.warning { background: var(--warning-bg); box-shadow: inset 0 -2px var(--warning); }
mark.suggestion { background: var(--suggestion-bg); box-shadow: inset 0 -2px var(--suggestion); }
mark:target, a.anchor:target + mark { outline: 2px solid var(--fg); }
.sev { display: inline-block; min-width: 5.5rem; font-size: .8rem; font-weight: 600; text-transform: uppercase; }
.sev.error { color: var(--error); } .sev.warning { color: var(--warning); } .sev.suggestion { color: var(--suggestion); }
ul.findings { list-style: none; padding: 0; margin: 0; }
ul.findings li { padding: .35rem 0; border-bottom: 1px solid var(--line); }
code, .rule { font: 13px ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace; }
.fix { color: var(--muted); }
.banner { border-radius: 6px; padding: .75rem 1rem; font-weight: 600; margin: 1rem 0; border: 1px solid var(--line); }
.banner.ok { background: var(--ins-bg); color: var(--ins); }
.banner.loss, .banner.changed { background: var(--del-bg); color: var(--del); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.pair > div { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: .6rem .8rem; white-space: pre-wrap; word-wrap: break-word; }
.pair .label { display: block; color: var(--muted); font-size: .8rem; margin-bottom: .25rem; }
ins { background: var(--ins-bg); color: var(--ins); text-decoration: none; }
del { background: var(--del-bg); color: var(--del); }
.lost { color: var(--del); font-weight: 600; }
.expected { color: var(--warning); }
table { border-collapse: collapse; }
td, th { border: 1px solid var(--line); padding: .3rem .6rem; text-align: left; }
@media (max-width: 50rem) { .pair { grid-template-columns: 1fr; } }
[hidden] { display: none !important; }
.notice { background: var(--warning-bg); border: 1px solid var(--warning); border-radius: 6px; padding: .45rem .75rem; margin: .5rem 0; }
.callout p { margin: 0 0 .3rem; }
.callout ul { margin: 0; padding-left: 1.2rem; list-style: none; }
.callout li { margin: .15rem 0; }
.ic { width: 1.15em; height: 1.15em; vertical-align: -0.2em; }
.ic.skipall, .ic.fixall { width: 1.7em; }
.ic.ptr { width: 1.7em; height: 1.55em; vertical-align: -0.45em; }
.callout { background: var(--warning-bg); border: 1px solid var(--warning); border-left: 6px solid var(--warning); border-radius: 0 6px 6px 0;
  padding: .7rem 1rem; margin: .5rem 0 1rem; font-weight: 600; }
.filters, .actions { display: flex; flex-wrap: wrap; gap: .5rem; margin: .75rem 0; }
button { font: inherit; font-size: .9rem; color: var(--fg); background: var(--panel); border: 1px solid var(--line); border-radius: 6px;
  padding: .35rem .75rem; cursor: pointer; }
button:hover { border-color: var(--muted); }
button[aria-pressed="true"] { border-color: var(--fg); box-shadow: inset 0 0 0 1px var(--fg); }
button .sev { min-width: 0; margin-right: .35rem; }
.actions .retro { display: inline-flex; align-items: center; gap: .45rem; font-weight: 600; color: #1f2328; border: 2px solid var(--ink);
  border-radius: 4px; padding: .45rem .9rem; box-shadow: 3px 3px 0 var(--ink); transition: transform .05s, box-shadow .05s; }
.actions .retro svg { width: 1.15em; height: 1.15em; flex: none; }
.actions .sb-copy { background: #f2c14e; }
.actions .sb-export { background: #7cc4b2; }
.actions .retro:hover { border-color: var(--ink); transform: translate(1px, 1px); box-shadow: 2px 2px 0 var(--ink); }
.actions .retro:active { transform: translate(3px, 3px); box-shadow: 0 0 0 var(--ink); }
.doc mark[data-g] { cursor: pointer; }
.doc mark mark { padding: 1px 3px; margin: 0 2px; }
.doc mark mark.error { box-shadow: inset 0 -2px var(--error-line), 0 0 0 1px var(--error-line); }
.doc mark mark.warning { box-shadow: inset 0 -2px var(--warning), 0 0 0 1px var(--warning); }
.doc mark mark.suggestion { box-shadow: inset 0 -2px var(--suggestion), 0 0 0 1px var(--suggestion); }
.doc mark.off { background: none; box-shadow: none; padding: 0; margin: 0; cursor: text; pointer-events: none; }
.doc mark:not(.off) { pointer-events: auto; }
.doc mark.skipped { background: none; box-shadow: none; border-bottom: 2px dotted var(--muted); color: var(--muted); }
.doc mark.skipped.error { border-bottom-color: var(--error-line); }
.doc mark.skipped.warning { border-bottom-color: var(--warning); }
.doc mark.skipped.suggestion { border-bottom-color: var(--suggestion); }
.doc mark.fix { outline: 2px solid var(--ins); outline-offset: 0; }
.doc mark:focus-visible { outline: 2px solid var(--fg); }
.qa { display: inline-flex; gap: 2px; margin: 0 3px 0 2px; vertical-align: -0.2em; user-select: none; pointer-events: auto; }
.qa .q { width: 1.15em; height: 1.15em; padding: 0; margin: 0; border: 0; border-radius: 4px; background: none; box-shadow: none;
  line-height: 0; cursor: pointer; }
.qa .q.skipall, .qa .q.fixall { width: 1.7em; }
.qa .q svg { display: block; width: 100%; height: 100%; }
.qa .q:hover { transform: scale(1.15); }
.qa .q[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--fg); }
.qa:has(.q[aria-pressed="true"]) .q:not([aria-pressed="true"]) { opacity: .4; }
.doc.noquick .qa { display: none; }
.quick-switch { margin-left: auto; align-self: center; font-size: .8rem; color: var(--muted); cursor: pointer; }
.float { position: absolute; z-index: 10; max-width: 32rem; background: var(--bg); color: var(--fg); border: 1px solid var(--line);
  border-radius: 6px; box-shadow: 0 4px 16px rgba(0, 0, 0, .2); padding: .5rem .75rem; font-size: .9rem; }
#sb-tip { pointer-events: none; }
.float .item + .item { border-top: 1px solid var(--line); margin-top: .5rem; padding-top: .5rem; }
.float .sev { min-width: 0; margin-right: .5rem; }
.float .rule { margin-right: .35rem; }
.float .flagged { font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace; }
.float .state { color: var(--muted); font-size: .8rem; }
.float .hint { color: var(--muted); font-size: .8rem; margin-top: .35rem; }
.float .buttons { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .45rem; }
.float .close { float: right; padding: 0 .45rem; margin: 0 0 .25rem .5rem; }
`;

function page(title, body, script = '', head = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>${head}
<style>${CSS}</style>
</head>
<body>
<main>
${body}
</main>
${script}</body>
</html>
`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const lineText = (a, b) => (a === b ? `line ${a}` : `lines ${a} to ${b}`);

// The findings as a tree of nested marks. Findings with the same span share
// one mark. A finding inside another one gets its own mark inside the outer
// mark, with padding, so that it has its own hover area. A finding that
// crosses the end of another one is split into two marks with the same group.
function markTree(text, issues) {
  const groups = [];
  const bySpan = new Map();
  issues.forEach((i, n) => {
    const end = Math.min(text.length, Math.max(i.end, i.start + 1));
    const key = `${i.start}:${end}`;
    if (!bySpan.has(key)) { bySpan.set(key, groups.length); groups.push({ start: i.start, end, ids: [] }); }
    groups[bySpan.get(key)].ids.push(n);
  });
  const order = (a, b) => a.start - b.start || b.end - a.end;
  const queue = groups.map((g, gi) => ({ start: g.start, end: g.end, g: gi, first: true })).sort(order);
  const root = { start: 0, end: text.length, children: [] };
  const stack = [root];
  while (queue.length) {
    let s = queue.shift();
    while (s.start >= stack[stack.length - 1].end) stack.pop();
    const top = stack[stack.length - 1];
    if (s.end > top.end) {
      const rest = { start: top.end, end: s.end, g: s.g, first: false };
      let k = 0;
      while (k < queue.length && order(queue[k], rest) <= 0) k++;
      queue.splice(k, 0, rest);
      s = { ...s, end: top.end };
    }
    if (s.end <= s.start) continue;
    s.children = [];
    top.children.push(s);
    stack.push(s);
  }
  return { root, groups };
}

function highlighted(text, issues) {
  const { root, groups } = markTree(text, issues);
  const render = node => {
    let html = '';
    let at = node.start;
    for (const c of node.children) {
      html += esc(text.slice(at, c.start));
      const ids = groups[c.g].ids;
      if (c.first) for (const n of ids) html += `<a class="anchor" id="f${n + 1}"></a>`;
      const top = ids.map(n => issues[n]).reduce((x, y) => (SEVERITY_RANK[y.severity] > SEVERITY_RANK[x.severity] ? y : x));
      html += `<mark class="${top.severity}" data-g="${c.g}">${render(c)}</mark>`;
      at = c.end;
    }
    return html + esc(text.slice(at, node.end));
  };
  return { html: render(root), groups: groups.map(g => g.ids) };
}

function findingItem(i, n) {
  const fix = i.replacement ? ` Suggested: “${esc(i.replacement)}”.` : '';
  return `<li><span class="sev ${i.severity}">${i.severity}</span> <a href="#f${n}">line ${i.line}</a> <span class="rule">${esc(i.ruleId)}</span>: “${esc(i.text.replace(/\s+/g, ' '))}”${i.detail ? ` (${esc(i.detail)})` : ''}. ${esc(i.message)} <span class="fix">${esc(i.fix)}${fix}</span></li>`;
}

// Rule names and the sentence limits of each profile, for the prompt.
const require = createRequire(import.meta.url);
let ruleMap = null;
function ruleById(id) {
  if (!ruleMap) ruleMap = new Map(require('./load-rules.js').loadRules().rules.map(r => [r.id, r]));
  return ruleMap.get(id);
}

/** The limits that the prompt's last check names, for a profile and optional config thresholds. */
export function promptLimits(profile = 'base', thresholds = {}) {
  if (profile === 'strict-plain') {
    const s = ruleById('plain-sentence-length') || {};
    const p = ruleById('plain-paragraph-sentences') || {};
    return {
      instruction: thresholds.instructionWords || s.maxWordsProcedure || 20,
      other: thresholds.descriptionWords || s.maxWordsDescription || 25,
      sentences: thresholds.paragraphSentences || p.maxSentences || 6
    };
  }
  return { instruction: null, other: (ruleById('sentence-length') || {}).maxWords || 30, sentences: null };
}

// The prompt is written for any AI agent, including small models: one task
// per step, no tool words, and no words from the report's buttons. It never
// names the document: the person who sends the prompt names it.
export function promptIntro(limits) {
  const sentence = limits.instruction
    ? `An instruction has at most ${limits.instruction} words. Any other sentence has at most ${limits.other} words.`
    : `A sentence has at most ${limits.other} words.`;
  return [
    'Edit a document so that it follows a style guide.',
    '',
    'The person who sent you this prompt names or attaches the document. Below is a list of changes to make, grouped by place. Each group starts with the first words of the heading, paragraph, list item or table row where the changes go. Find each place by those words.',
    '',
    'You have two tasks. Do both.',
    'Task 1: Edit the document.',
    'Task 2: Save one small file. The steps for it are at the end of this prompt.',
    '',
    'TASK 1: EDIT THE DOCUMENT',
    '',
    '1. Make every change in the list below. Each change says what was found and what to do. Quoted sentences inside the instructions are only examples of the style. Do not copy them into the document.',
    '2. Change only the text that a change is about. Do not change any other text.',
    '3. Do not change the meaning. Do not remove any number, name, code, placeholder, link, negation (such as "not" or "never"), condition (such as "if" or "when") or limit.',
    '4. To shorten a long sentence, split it into two or more sentences. Do not leave out information.',
    '5. Do not change code, file paths, bold text or quoted messages. Bold text is usually a label in the user interface.',
    '6. Some changes need a decision that only the author can make: the change would alter the meaning, or the change says to flag the text for the author. Do not edit that text. Name it in your report instead.',
    '7. Do not change headings, lists, tables or formatting, unless a change asks for it.',
    '8. Check your new text before you go on:',
    `   - ${sentence}`,
    '   - A heading is never directly above another heading.',
    '   - There are no parentheses inside parentheses.',
    ...(limits.sentences ? [`   - A paragraph has at most ${limits.sentences} sentences.`] : []),
    '9. Save the document with the same name and the same file type. If you cannot save files, give the edited document back in your reply.',
    '10. Report what you did: list the changes that you made, then the changes that you did not make, with the reason for each.',
    '',
    'Changes to make:'
  ];
}

// The prompt's last part: the small file that carries the reviewer's choices
// to the next check. It is one short line, so that any agent writes it in one go.
export const choicesFile = (docName, run) => `${String(docName).replace(/\.[^.]*$/, '') || 'document'}.style-choices-${run}.json`;
export function promptTask2(file) {
  return [
    '',
    'TASK 2: SAVE ONE SMALL FILE',
    '',
    'Do Task 2 after Task 1, even if you made no changes.',
    'This file tells the style checker which findings the reviewer chose to skip, so that the next check skips them too. The line below is the whole file. It is not a list of your changes, and you do not add anything to it.',
    `1. In the same folder as the document, create a file with this name: ${file}`,
    '2. Put the one line below in the file, and nothing else. Do not include the ``` marks.',
    '```',
    '@@CHOICES@@',
    '```',
    '3. Save the file. If a file with this name already exists, replace it.',
    'If you cannot create files, do not do Task 2, and say so in your report.'
  ];
}

// A short id for a finding: a hash of its rule, its text and which occurrence
// of that text it is. Lines can move after an edit; the id stays the same.
export function findingId(key) {
  let h = 0x811c9dc5;
  for (let k = 0; k < key.length; k++) { h ^= key.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36).padStart(7, '0');
}
function findingIds(issues) {
  const seen = {};
  return issues.map(i => {
    const k = i.ruleId + '|' + i.text.replace(/\s+/g, ' ').trim();
    seen[k] = (seen[k] || 0) + 1;
    return findingId(k + '|' + seen[k]);
  });
}

// Where a finding is, for the prompt: the first words of its line without
// Markdown marks, so that an agent finds the place in Word or in a text file.
function placeOf(line) {
  let kind = 'paragraph';
  let t = line;
  if (/^#{1,6}\s/.test(t)) { kind = 'heading'; t = t.replace(/^#{1,6}\s+/, ''); }
  else if (/^\s*(?:[-*+]|\d+[.)])\s/.test(t)) { kind = 'list item'; t = t.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''); }
  else if (/^\s*\|/.test(t)) { kind = 'table row'; t = t.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '').replace(/\s*\|\s*/g, ' | '); }
  else t = t.replace(/^\s*>\s?/, '');
  t = t.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
  if (kind === 'heading') return `In the heading "${t}":`;
  const words = t.split(' ');
  return `In the ${kind} that starts "${words.slice(0, 10).join(' ')}${words.length > 10 ? '...' : ''}":`;
}

// One change in the prompt: what was found and what to do. The same change
// found more than once in a place is listed once, with a count.
function promptChange(i) {
  const rule = ruleById(i.ruleId);
  const name = (rule && rule.name ? rule.name : i.ruleId).replace(/ (?:in|for) strict-plain$/i, '');
  const found = i.text.replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
  if (i.replacement) return { head: `${name}: change "${found}" to "${i.replacement}"`, tail: '.' };
  const quote = found.length > 80 ? found.slice(0, 72).replace(/\s+\S*$/, '') + '...' : found;
  return { head: `${name}: "${quote}"${i.detail ? ` (${i.detail})` : ''}`, tail: `. ${i.fix || ''}`.replace(/\s+$/, '') };
}

/* global document, window, navigator, Blob, URL */
// Builds the prompt text. It runs in the report (written in with toString())
// and in the tests, so it uses nothing from this module.
//   data          the report data: intro, places, findings, task2, docName, run
//   skipRules     rule ids whose findings the reviewer skipped as a whole
//   skipIds       ids of findings skipped one by one
export function promptText(data, skipRules, skipIds) {
  const skipRule = new Set(skipRules);
  const skipId = new Set(skipIds);
  const order = [];
  const byPlace = {};
  let count = 0;
  for (const f of data.findings) {
    if (skipRule.has(f.ruleId) || skipId.has(f.id)) continue;
    count++;
    if (!byPlace[f.place]) { byPlace[f.place] = []; order.push(f.place); }
    const same = byPlace[f.place].find(x => x.head === f.head && x.tail === f.tail);
    if (same) same.n++;
    else byPlace[f.place].push({ head: f.head, tail: f.tail, n: 1 });
  }
  const lines = data.intro.slice();
  if (!order.length) lines.push('', 'There are no changes to make. Do not edit the document.');
  for (const p of order) {
    lines.push('', data.places[p]);
    for (const x of byPlace[p]) lines.push(`- ${x.head}${x.n > 1 ? ` (${x.n} times)` : ''}${x.tail}`);
  }
  const choices = JSON.stringify({ stylebound: 'choices', v: 2, doc: data.docName, run: data.run, skipRules: [...skipRule].sort(), skip: [...skipId].sort() });
  for (const l of data.task2) lines.push(l === '@@CHOICES@@' ? choices : l);
  return { text: lines.join('\n') + '\n', count, places: order.length, choices };
}

// The quick-button icons, drawn here so that they look the same on every
// system. The help call-out shows them, and the script copies them from there.
const ICONS = {
  fix: { w: 16, fill: '#1a7f37', d: 'M4 8.4l2.9 2.9L12.2 5.2' },
  fixall: { w: 24, fill: '#116329', d: 'M2.8 8.4l2.6 2.7L10.2 5.3M13.8 8.4l2.6 2.7L21.2 5.3' },
  skip: { w: 16, fill: '#cf222e', d: 'M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6' },
  skipall: { w: 24, fill: '#a40e26', d: 'M3.6 5.2l5.4 5.6M9 5.2l-5.4 5.6M15 5.2l5.4 5.6M20.4 5.2L15 10.8' }
};
const icon = kind => {
  const k = ICONS[kind];
  return `<svg class="ic ${kind}" data-icon="${kind}" viewBox="0 0 ${k.w} 16" aria-hidden="true"><rect x="0.5" y="0.5" width="${k.w - 1}" height="15" rx="3.5" fill="${k.fill}"/>` +
    `<path d="${k.d}" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};
// Two mouse pointers for the help call-out: one with motion lines (hover)
// and one with click rays (click). A white arrow with a dark outline, like a
// real pointer, so it shows on light and dark backgrounds.
const ARROW = tipY => `<path d="M9 ${tipY}v11.5l3-3 2.2 4.6 1.8-.8-2.1-4.5H18z" fill="#ffffff" stroke="#1f2328" stroke-width="1.3" stroke-linejoin="round"/>`;
const POINTERS = {
  hover: ARROW(2) + '<path d="M1 7h4M2 10h3M1 13h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  click: ARROW(5) + '<path d="M9 .8v2.2M4.6 1.6l1.5 1.5M13.4 1.6l-1.5 1.5M3.6 5.4h2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
};
const ACTION_ICONS = {
  copy: '<rect x="5.5" y="5.5" width="8" height="9" rx="1.5"/><path d="M3.5 10.5h-.5a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 3 1.5h6A1.5 1.5 0 0 1 10.5 3v.5"/>',
  export: '<path d="M8 1.5v8M4.8 6.6 8 9.8l3.2-3.2M2 10.5v2.5A1.5 1.5 0 0 0 3.5 14.5h9a1.5 1.5 0 0 0 1.5-1.5v-2.5"/>'
};
const actionIcon = kind => `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ACTION_ICONS[kind]}</svg>`;
// "No action": a dashed outline with a light check, so it reads as the default
// rather than as a button.
const DEFAULT_ICON = '<svg class="ic" data-icon="default" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3.5" fill="none" stroke="#1a7f37" stroke-width="1.4" stroke-dasharray="2.4 1.8"/><path d="M4.6 8.4l2.4 2.4L11.6 5.6" fill="none" stroke="#1a7f37" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const pointer = kind => `<svg class="ic ptr" data-icon="${kind}" viewBox="0 0 20 18" aria-hidden="true">${POINTERS[kind]}</svg>`;

const HELP = `<div class="callout" role="note"><p>HOVER ${pointer('hover')} for details, CLICK ${pointer('click')} for multiple actions, or use QUICK BUTTONS (${icon('fix')}/${icon('skip')}) to:</p>
<ul><li>${icon('fix')} Fix (include in the prompt, so the agent changes the text)</li><li>${icon('fixall')} Fix this and similar findings</li><li>${icon('skip')} Skip (leave out of the prompt, so the agent does not change the text)</li><li>${icon('skipall')} Skip this and similar findings</li><li>${DEFAULT_ICON} No action means Fix (include in the prompt)</li></ul></div>`;

// JSON inside a script element: escape every "<" so that no text can close
// the element. The backslash is built from its code so that no tool between
// here and the file changes the escape.
const LT_ESCAPE = String.fromCharCode(92) + 'u003c';
const scriptJson = value => JSON.stringify(value).replace(/</g, LT_ESCAPE);

// Choices carried over from an earlier run (<name>.style-choices-<run>.json,
// saved by the agent from the prompt's Task 2): the rules and the findings that
// the reviewer skipped. Only for the same document name.
export function cleanChoices(raw, docName) {
  if (!raw || typeof raw !== 'object' || raw.stylebound !== 'choices') return null;
  if (docName && raw.doc !== docName) return null;
  const run = Number.isInteger(raw.run) ? raw.run : 0;
  const strings = a => (Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.length <= 200) : []);
  if (raw.v === 2) return { doc: raw.doc, run, skipRules: strings(raw.skipRules), skip: strings(raw.skip) };
  if (raw.version === 1) {
    // The first format: a state for each rule and for each finding key.
    const entries = o => Object.entries(o && typeof o === 'object' ? o : {});
    return {
      doc: raw.doc, run,
      skipRules: entries(raw.rules).filter(([, v]) => v === 'similar').map(([k]) => k),
      skip: entries(raw.findings).filter(([, v]) => v === 'dismissed' || v === 'similar').map(([k]) => findingId(k))
    };
  }
  return null;
}

// The run number of an earlier check report, from its meta tag; 0 if none.
export function reportRun(html) {
  const m = /<meta name="stylebound-run" content="(\d+)">/.exec(String(html));
  return m ? Number(m[1]) : 0;
}

// Runs in the browser. It is written into the report with toString(), so it
// must not use anything from this module.
function reportScript() {
  const data = JSON.parse(document.getElementById('sb-data').textContent);
  const F = data.findings;
  const RANK = { error: 3, warning: 2, suggestion: 1 };
  const state = F.map(() => 'open');
  let filter = 'all';
  const doc = document.querySelector('.doc');
  const marks = Array.from(doc.querySelectorAll('mark[data-g]'));
  const tip = document.getElementById('sb-tip');
  const pop = document.getElementById('sb-pop');
  // The copy and export buttons and their status line are in two places: under
  // the help call-out and at the end of the report.
  const statusLines = Array.from(document.querySelectorAll('.sb-status'));
  const status = { set textContent(text) { for (const s of statusLines) s.textContent = text; } };
  for (const a of document.querySelectorAll('.sb-actions')) a.hidden = false;
  const sameRule = id => F.filter(f => f.ruleId === id).length;
  const ruleIds = rules => F.map((f, k) => k).filter(k => rules.includes(F[k].ruleId));

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const shown = n => filter === 'all' || F[n].severity === filter;
  const groupOf = m => data.groups[Number(m.getAttribute('data-g'))].filter(shown);
  // A finding is 'open' (fix by default), 'fix' or 'fixSimilar' (in the prompt,
  // the same as no action), 'skip' or 'skipSimilar' (left out of the prompt;
  // "similar" means with every finding of the same rule).
  const skipped = n => state[n] === 'skip' || state[n] === 'skipSimilar';
  const chosenFix = n => state[n] === 'fix' || state[n] === 'fixSimilar';
  const stateText = n => ({ fix: 'Fix (include in prompt)', fixSimilar: 'Fix, with all similar (include in prompt)', skip: 'Skipped', skipSimilar: 'Skipped, with all similar' }[state[n]] || 'Fix (include in prompt)');

  function refresh() {
    for (const m of marks) {
      const ns = groupOf(m);
      if (!ns.length) { m.className = 'off'; m.removeAttribute('tabindex'); continue; }
      const top = ns.reduce((a, b) => (RANK[F[b].severity] > RANK[F[a].severity] ? b : a));
      const cls = [F[top].severity];
      if (ns.every(skipped)) cls.push('skipped');
      else if (ns.every(chosenFix)) cls.push('fix');
      m.className = cls.join(' ');
      m.setAttribute('tabindex', '0');
    }
    for (const box of quick) {
      const ns = data.groups[Number(box.getAttribute('data-g'))].filter(shown);
      box.hidden = !ns.length;
      const buttons = { fix: '.fix', fixSimilar: '.fixall', skip: '.skip', skipSimilar: '.skipall' };
      for (const [kind, sel] of Object.entries(buttons)) {
        box.querySelector(sel).setAttribute('aria-pressed', String(ns.length > 0 && ns.every(n => state[n] === kind)));
      }
    }
    for (const b of document.querySelectorAll('[data-filter]')) b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === filter));
    const out = F.filter((f, n) => skipped(n)).length;
    status.textContent = `The prompt includes ${F.length - out} of ${F.length} findings` + (out ? ` (${out} skipped).` : '.');
  }

  function place(box, m, y) {
    box.hidden = false;
    const rects = Array.from(m.getClientRects());
    const r = rects.find(q => y >= q.top && y <= q.bottom) || rects[0] || m.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const left = Math.max(8, Math.min(r.left, width - box.offsetWidth - 8));
    box.style.left = (left + window.scrollX) + 'px';
    box.style.top = (r.bottom + window.scrollY + 6) + 'px';
  }

  function head(f, n) {
    const h = el('div');
    h.append(el('span', 'sev ' + f.severity, f.severity), el('span', 'rule', f.ruleId), document.createTextNode(` line ${f.line} `));
    if (stateText(n)) h.append(el('span', 'state', stateText(n)));
    return h;
  }

  // The small buttons right after each finding: a tick (fix) puts it in the
  // prompt, an X (skip) leaves it out, a double X skips every finding of the same rule. The icons
  // are copied from the help call-out.
  const icon = kind => {
    const svg = document.querySelector(`.callout svg[data-icon="${kind}"]`).cloneNode(true);
    svg.removeAttribute('class');
    return svg;
  };
  const lastPiece = {};
  for (const m of marks) lastPiece[m.getAttribute('data-g')] = m;
  const quick = [];
  for (const g of Object.keys(lastPiece)) {
    const ids = data.groups[Number(g)];
    const rules = [...new Set(ids.map(n => F[n].ruleId))];
    const similar = ruleIds(rules).length;
    const box = el('span', 'qa');
    box.setAttribute('data-g', g);
    const add = (kind, label, act) => {
      const b = el('button', 'q ' + kind);
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.setAttribute('data-label', label);
      b.append(icon(kind));
      b.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        act(ids.filter(shown));
        if (!tip.hidden) showTip(lastPiece[g], b.getBoundingClientRect().top + 1, label);
      });
      box.append(b);
    };
    const toggle = value => ns => setState(ns, ns.every(n => state[n] === value) ? 'open' : value);
    const toggleRule = value => () => {
      const all = ruleIds(rules);
      setState(all, all.every(n => state[n] === value) ? 'open' : value);
    };
    add('fix', 'Fix', toggle('fix'));
    add('fixall', `Fix all similar (${similar})`, toggleRule('fixSimilar'));
    add('skip', 'Skip', toggle('skip'));
    add('skipall', `Skip all similar (${similar})`, toggleRule('skipSimilar'));
    lastPiece[g].after(box);
    quick.push(box);
  }
  const quickSwitch = document.getElementById('sb-quick');
  quickSwitch.parentElement.hidden = false;
  quickSwitch.addEventListener('change', () => { doc.classList.toggle('noquick', !quickSwitch.checked); tip.hidden = true; });

  function showTip(m, y, label) {
    tip.replaceChildren();
    for (const n of groupOf(m)) {
      const item = el('div', 'item');
      item.append(head(F[n], n), el('div', null, F[n].message));
      tip.append(item);
    }
    tip.append(el('div', 'hint', label ? `${label}. Select the button again to undo.` : 'Click for multiple actions.'));
    place(tip, m, y);
  }

  let popMark = null;
  function closePop() { pop.hidden = true; popMark = null; }
  function setState(ns, value) { for (const n of ns) state[n] = value; refresh(); }

  function openPop(m, y) {
    tip.hidden = true;
    popMark = m;
    const ns = groupOf(m);
    pop.replaceChildren();
    const close = el('button', 'close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.onclick = closePop;
    pop.append(close);
    for (const n of ns) {
      const f = F[n];
      const item = el('div', 'item');
      item.append(head(f, n), el('div', 'flagged', `"${f.text.replace(/\s+/g, ' ')}"` + (f.detail ? ` (${f.detail})` : '')),
        el('div', null, f.message), el('div', 'fix', f.fix + (f.replacement ? ` Suggested: "${f.replacement}".` : '')));
      const row = el('div', 'buttons');
      const button = (label, pressed, act) => {
        const b = el('button', null, label);
        b.type = 'button';
        if (pressed != null) b.setAttribute('aria-pressed', String(pressed));
        b.onclick = () => { act(); if (ns.length === 1) closePop(); else openPop(m, y); };
        row.append(b);
      };
      const rule = () => F.map((g, k) => k).filter(k => F[k].ruleId === f.ruleId);
      button('Fix', state[n] === 'fix', () => setState([n], 'fix'));
      button(`Fix all similar (${sameRule(f.ruleId)})`, state[n] === 'fixSimilar', () => setState(rule(), 'fixSimilar'));
      row.lastChild.title = `Fix every ${f.ruleId} finding in this report`;
      button('Skip', state[n] === 'skip', () => setState([n], 'skip'));
      button(`Skip all similar (${sameRule(f.ruleId)})`, state[n] === 'skipSimilar', () => setState(rule(), 'skipSimilar'));
      row.lastChild.title = `Skip every ${f.ruleId} finding in this report`;
      item.append(row);
      pop.append(item);
    }
    place(pop, m, y);
    pop.querySelector('.buttons button').focus({ preventScroll: true });
  }

  const markAt = target => (target && target.closest ? target.closest('mark[data-g]:not(.off)') : null);
  doc.addEventListener('mouseover', e => {
    const q = e.target.closest ? e.target.closest('.qa .q') : null;
    if (q) {
      if (pop.hidden) showTip(lastPiece[q.parentElement.getAttribute('data-g')], q.getBoundingClientRect().top + 1, q.getAttribute('data-label'));
      return;
    }
    const m = markAt(e.target);
    if (!m || !pop.hidden) { tip.hidden = true; return; }
    showTip(m, e.clientY);
  });
  doc.addEventListener('mouseleave', () => { tip.hidden = true; });
  doc.addEventListener('click', e => {
    const m = markAt(e.target);
    if (m) { e.preventDefault(); openPop(m, e.clientY); }
  });
  doc.addEventListener('keydown', e => {
    const m = markAt(e.target);
    if (m && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const r = m.getBoundingClientRect();
      openPop(m, r.top + 1);
    }
  });
  document.addEventListener('mousedown', e => {
    if (!pop.hidden && !pop.contains(e.target) && !markAt(e.target)) closePop();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    tip.hidden = true;
    if (!pop.hidden) { const m = popMark; closePop(); if (m) m.focus(); }
  });

  for (const b of document.querySelectorAll('[data-filter]')) {
    b.addEventListener('click', () => { filter = b.getAttribute('data-filter'); closePop(); refresh(); });
  }

  // The rules skipped as a whole, and the findings skipped one by one, for the
  // prompt and for the small file of Task 2. A rule that an earlier run skipped
  // and that has no findings now stays skipped.
  function choices() {
    const present = new Set(F.map(f => f.ruleId));
    const rules = [...present].filter(id => F.every((f, n) => f.ruleId !== id || state[n] === 'skipSimilar'));
    if (data.carried) for (const id of data.carried.skipRules) if (!present.has(id)) rules.push(id);
    const ids = F.filter((f, n) => skipped(n) && !rules.includes(f.ruleId)).map(f => f.id);
    return { rules, ids };
  }
  function prompt() {
    const c = choices();
    return promptText(data, c.rules, c.ids);
  }
  const done = (p, what) => { status.textContent = `${what} the prompt with ${p.count} findings in ${p.places} places.`; };

  function fallbackCopy(text) {
    const area = el('textarea');
    area.value = text;
    area.style.position = 'absolute';
    area.style.left = '-9999px';
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    area.remove();
    return ok;
  }
  const copy = () => {
    const p = prompt();
    const failed = () => { status.textContent = 'The browser did not allow the copy. Use the export button instead.'; };
    const fallback = () => (fallbackCopy(p.text) ? done(p, 'Copied to the clipboard:') : failed());
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(p.text).then(() => done(p, 'Copied to the clipboard:'), fallback);
    else fallback();
  };
  const save = () => {
    const p = prompt();
    const link = el('a');
    link.href = URL.createObjectURL(new Blob([p.text], { type: 'text/plain;charset=utf-8' }));
    link.download = data.download;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    done(p, `Saved ${data.download}:`);
  };
  // Skip choices from the last run: the next check reads the small file that
  // the agent saved (Task 2 of the prompt) and passes it in.
  if (data.carried) {
    F.forEach((f, n) => {
      if (data.carried.skipRules.includes(f.ruleId)) state[n] = 'skipSimilar';
      else if (data.carried.skip.includes(f.id)) state[n] = 'skip';
    });
  }

  for (const b of document.querySelectorAll('.sb-copy')) b.addEventListener('click', copy);
  for (const b of document.querySelectorAll('.sb-export')) b.addEventListener('click', save);

  refresh();
}

/**
 * The check report.
 *   text     the document text
 *   result   the CheckResult
 *   info     { file, profile, generatedAt, tool }
 */
export function renderCheckHtml(text, result, info = {}) {
  const issues = result.issues;
  const c = { error: 0, warning: 0, suggestion: 0 };
  issues.forEach(i => c[i.severity]++);
  const byBlock = new Map();
  issues.forEach((i, n) => {
    if (!byBlock.has(i.blockId)) byBlock.set(i.blockId, []);
    byBlock.get(i.blockId).push(findingItem(i, n + 1));
  });
  const groups = [...byBlock].map(([id, items]) => {
    const b = result.blocks[id];
    return `<h3>Paragraph p${id} (${lineText(b.line, b.endLine)})</h3>\n<ul class="findings">\n${items.join('\n')}\n</ul>`;
  });
  const marked = highlighted(text, issues);
  const docName = String(info.file || 'document').split(/[\\/]/).pop();
  const base = docName.replace(/\.[^.]*$/, '');
  const run = Number.isInteger(info.run) && info.run > 0 ? info.run : 1;
  const ids = findingIds(issues);
  const lines = text.split('\n');
  const places = [];
  const placeIndex = new Map();
  const placeFor = line => {
    if (!placeIndex.has(line)) {
      let label = placeOf(lines[line - 1] || '');
      const same = places.filter(p => p === label || p.startsWith(label.slice(0, -1) + ' (')).length;
      if (same) label = label.slice(0, -1) + ` (number ${same + 1} that starts this way):`;
      placeIndex.set(line, places.length);
      places.push(label);
    }
    return placeIndex.get(line);
  };
  const data = {
    findings: issues.map((i, n) => ({
      id: ids[n], severity: i.severity, ruleId: i.ruleId, line: i.line, text: i.text,
      message: i.message, fix: i.fix || '', replacement: i.replacement || null, detail: i.detail || null,
      place: placeFor(i.line), ...promptChange(i)
    })),
    groups: marked.groups,
    places,
    intro: promptIntro(promptLimits(info.profile, info.thresholds || {})),
    task2: promptTask2(choicesFile(docName, run)),
    download: (base ? base + '.' : '') + 'style-prompt.txt',
    docName,
    run,
    carried: info.choices ? cleanChoices({ stylebound: 'choices', v: 2, doc: docName, run: info.choices.run, skipRules: info.choices.skipRules, skip: info.choices.skip }, docName) : null
  };
  const filter = (sev, label) => `<button type="button" data-filter="${sev}" aria-pressed="false"><span class="sev ${sev}">${sev}</span> ${label}</button>`;
  const actions = `<div class="sb-actions" hidden><div class="actions"><button type="button" class="retro sb-copy">${actionIcon('copy')}Copy Suggested Changes as a Prompt</button><button type="button" class="retro sb-export">${actionIcon('export')}Export Suggested Changes as a Prompt</button></div>
<p class="meta sb-status" aria-live="polite">The prompt includes ${plural(issues.length, 'finding')}.</p></div>`;
  const body = `<h1>Check report: ${esc(info.file || 'document')}</h1>
<p class="meta">Profile ${esc(info.profile || 'base')}. ${result.words} words. Generated ${esc(info.generatedAt || '')} by ${esc(info.tool || 'Stylebound')}. Run ${run}.${data.carried ? ` Your choices from ${esc(info.choicesFrom || 'the last run')} are applied.` : ''}</p>
${info.choicesNote ? `<p class="notice" role="note">${esc(info.choicesNote)}</p>` : ''}
<div class="filters" role="group" aria-label="Show findings"><button type="button" data-filter="all" aria-pressed="true">All ${plural(issues.length, 'finding')}</button>${filter('error', c.error)}${filter('warning', c.warning)}${filter('suggestion', c.suggestion)}<label class="quick-switch" hidden><input type="checkbox" id="sb-quick" checked> Show buttons on every finding</label></div>
<h2>Document</h2>
${HELP}
${actions}
<div class="doc">${marked.html}</div>
<div id="sb-tip" class="float" role="tooltip" hidden></div>
<div id="sb-pop" class="float" role="dialog" aria-label="Finding" hidden></div>
<h2>Copy or Export suggestions for your AI Agent</h2>
<p>Each button makes a prompt for an AI agent: fixed instructions, then the changes to make, grouped by place. Skipped findings are left out. The severity filter above does not change the prompt.</p>
${actions}
<noscript>
<p>Scripts are off in this browser, so the buttons do not work. These are all the findings.</p>
${groups.length ? groups.join('\n') : '<p>No findings.</p>'}
</noscript>`;
  const script = `<script type="application/json" id="sb-data">${scriptJson(data)}</script>
<script>${promptText.toString()}
(${reportScript.toString()})();</script>
`;
  return page(`Check report: ${info.file || 'document'}`, body, script, `\n<meta name="stylebound-run" content="${run}">`);
}

function diffSide(runs, side) {
  return runs.map(r => {
    if (r.op === 'equal') return esc(r.text);
    if (side === 'before' && r.op === 'delete') return `<del>${esc(r.text)}</del>`;
    if (side === 'after' && r.op === 'insert') return `<ins>${esc(r.text)}</ins>`;
    return '';
  }).join('');
}

/**
 * The verify report.
 *   review   the parsed review
 *   result   the output of verifyDocument: { verified, diffs, after, summary }
 *   info     { file, reviewFile, generatedAt, tool }
 */
export function renderVerifyHtml(review, result, info = {}) {
  const { verified, diffs, after, summary: s } = result;
  const verdict = s.status === 'ok' ? 'OK: no must-keep item was lost.'
    : s.status === 'loss' ? `Loss: ${plural(s.items.missing, 'must-keep item')} missing.`
      : `Changed: ${plural(s.items.changed, 'modal')} changed strength.`;
  const toReview = verified.paragraphs.filter(p => p.missing.length || p.changed.length);
  const summaryList = toReview.map(p => {
    const parts = [
      ...p.missing.map(m => `<span class="lost">missing ${esc(m.kind)} “${esc(m.item)}”</span>`),
      ...p.changed.map(ch => `<span class="${ch.expected ? 'expected' : 'lost'}">${ch.expected ? 'changed as a finding asked' : 'changed'} ${esc(ch.kind)} “${esc(ch.from)}”${ch.to.length ? ` to “${esc(ch.to.join('”, “'))}”` : ''}</span>`)
    ];
    return `<li><a href="#${esc(p.id)}">${esc(p.id)}</a> (original ${lineText(p.lines[0], p.lines[1])}): ${parts.join('; ')}</li>`;
  });
  const original = new Map(review.paragraphs.map(p => [p.id, p]));
  const sections = verified.paragraphs.filter(p => p.status !== 'unchanged' && !p.empty).map(p => {
    const runs = diffs[p.id] || [{ op: 'delete', text: original.get(p.id).text }];
    const flags = [
      ...p.missing.map(m => `<li class="lost">Missing ${esc(m.kind)}: “${esc(m.item)}”</li>`),
      ...p.changed.map(ch => `<li class="${ch.expected ? 'expected' : 'lost'}">${ch.expected ? 'Changed as a finding asked' : 'Changed'} ${esc(ch.kind)}: “${esc(ch.from)}”${ch.to.length ? ` to “${esc(ch.to.join('”, “'))}”` : ''}${ch.ruleId ? ` (${esc(ch.ruleId)})` : ''}</li>`)
    ];
    const where = p.editedLines ? `edited ${lineText(p.editedLines[0], p.editedLines[1])}` : 'not in the edited file';
    const notes = [p.split ? 'split' : '', p.merged ? 'merged' : '', p.moved ? 'moved' : ''].filter(Boolean).join(', ');
    return `<h3 id="${esc(p.id)}">${esc(p.id)}: ${esc(p.status)} (original ${lineText(p.lines[0], p.lines[1])}; ${where}${notes ? '; ' + notes : ''})</h3>
${flags.length ? `<ul>${flags.join('')}</ul>` : ''}
<div class="pair"><div><span class="label">Original</span>${diffSide(runs, 'before')}</div><div><span class="label">Edited</span>${diffSide(runs, 'after')}</div></div>`;
  });
  const added = verified.added.map(a => `<li>${lineText(a.lines[0], a.lines[1])}: <ins>${esc(a.text)}</ins></li>`);
  const remaining = after.issues.map(i => `<li><span class="sev ${i.severity}">${i.severity}</span> line ${i.line} <span class="rule">${esc(i.ruleId)}</span>: “${esc(i.text.replace(/\s+/g, ' '))}”. ${esc(i.message)}</li>`);
  const p = s.paragraphs;
  const body = `<h1>Verify report: ${esc(info.file || 'document')}</h1>
<p class="meta">Against ${esc(info.reviewFile || 'the review')} (profile ${esc(verified.profile)}). Generated ${esc(info.generatedAt || '')} by ${esc(info.tool || 'Stylebound')}.</p>
<div class="banner ${esc(s.status)}">${esc(verdict)}${s.hashMismatch ? ' The hashes did not match; verified with --force.' : ''}</div>
<table>
<tr><th>Paragraphs checked</th><td>${p.checked}</td><th>Unchanged</th><td>${p.unchanged}</td><th>Changed, every item kept</th><td>${p.ok}</td></tr>
<tr><th>With missing items</th><td>${p.missing}</td><th>With changed modals</th><td>${p.changed}</td><th>Changed as a finding asked</th><td>${p.changedExpected}</td></tr>
<tr><th>Removed</th><td>${p.removed}</td><th>New</th><td>${p.added}</td><th>Findings before, after</th><td>${s.findings.before}, ${s.findings.after}</td></tr>
</table>
${summaryList.length ? `<h2>Paragraphs to review</h2>\n<ul>${summaryList.join('\n')}</ul>` : ''}
<h2>Changed paragraphs</h2>
${sections.length ? sections.join('\n') : '<p>No paragraph changed.</p>'}
${added.length ? `<h2>New paragraphs</h2>\n<ul>${added.join('\n')}</ul>` : ''}
<h2>Findings after the edit</h2>
${remaining.length ? `<ul class="findings">\n${remaining.join('\n')}\n</ul>` : '<p>No findings.</p>'}`;
  return page(`Verify report: ${info.file || 'document'}`, body);
}
