/*
 * The regression gate (plan chunk 1.11). For every paragraph of the
 * regression set, a hand-written good edit must lose no must-keep item, and
 * every bad edit must be caught. Bad edits are made from the good edit by
 * removing or weakening one item, so each one tests exactly one kind of loss.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportReview, verify, docxToMarkdown } from '../packages/core/index.mjs';
import { loadRegressionSet } from './harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const EDITS_FILE = path.join(here, 'edits.json');
export const GATE_PROFILE = 'strict-plain';

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = item => new RegExp('(?<![A-Za-z0-9])' + escapeRe(item).replace(/\s+/g, '\\s+') + '(?![A-Za-z0-9])', 'gi');
const tidy = s => s.replace(/[ \t]{2,}/g, ' ').replace(/ ([.,;:])/g, '$1');

// Weaker modal for each strong one: the change a careless rewrite makes.
const WEAKER = { must: 'may', will: 'may', should: 'may', shall: 'may', 'need to': 'may', 'have to': 'may', can: 'might', cannot: 'might not', required: 'optional' };
// Contractions as they appear after a good edit wrote them out.
const WRITTEN_OUT = { "can't": 'cannot', "won't": 'will not' };
const negationForms = item => {
  const forms = [item];
  if (WRITTEN_OUT[item]) forms.push(WRITTEN_OUT[item]);
  const m = /^(\w+)n't$/.exec(item);
  if (m) forms.push(m[1] + ' not');
  return forms;
};

function replaceFirstKind(text, items, replacer) {
  for (const item of items) {
    for (const form of replacer.forms(item)) {
      const re = wordRe(form);
      if (re.test(text)) return { item, text: tidy(text.replace(wordRe(form), m => replacer.to(form, m))) };
    }
  }
  return null;
}

/** The bad edits for one paragraph: one per kind of item the good edit contains. */
export function badEdits(good, keep) {
  const out = [];
  const add = (kind, r) => { if (r && r.text !== good) out.push({ kind, item: r.item, text: r.text }); };
  // List markers ("1.") are numbering, not content, so they are not dropped.
  const content = good.replace(/^\s*\d+[.)]\s/gm, '');
  add('drop-number', replaceFirstKind(good, keep.numbers.filter(n => wordRe(n).test(content)), {
    forms: item => [item, item.replace(/(\d)([A-Za-z%])/, '$1 $2'), item.replace(/%$/, ' percent')],
    to: () => ''
  }));
  add('weaken-modal', replaceFirstKind(good, keep.modals.filter(m => WEAKER[m.toLowerCase()]), {
    forms: item => [item],
    to: (form, m) => (/^[A-Z]/.test(m) ? WEAKER[form.toLowerCase()].replace(/^./, c => c.toUpperCase()) : WEAKER[form.toLowerCase()])
  }));
  add('delete-negation', replaceFirstKind(good, keep.negations, {
    forms: negationForms,
    to: form => {
      if (form === 'cannot') return 'can';
      if (form === 'without') return 'with';
      if (form === 'nor') return 'or';
      if (form === 'neither') return 'either';
      const m = /^(\w+) not$/.exec(form) || /^(\w+)n't$/.exec(form);
      return m ? m[1] : '';
    }
  }));
  add('delete-condition', replaceFirstKind(good, keep.conditions, { forms: item => [item], to: () => '' }));
  add('drop-code', replaceFirstKind(good, keep.code, { forms: item => [item], to: () => '' }));
  return out;
}

export function loadEdits() {
  return JSON.parse(fs.readFileSync(EDITS_FILE, 'utf8'));
}

const LOST = new Set(['missing', 'changed']);

// The DOCX path: the text goes into a .docx file (test-only writer) and comes
// back through the core's reader before export and before verify.
export const DOCX_SAMPLE = 10;
let writer = null;
export async function loadDocxWriter() {
  if (!writer) writer = (await import('../tests/helpers/docx-writer.mjs')).markdownToDocx;
  return writer;
}
const viaDocx = text => docxToMarkdown(writer(text)).markdown;

/**
 * Runs the gate. Returns { good: {total, lost, failures}, bad: {total, caught, failures} }.
 * With options.docx (call loadDocxWriter first), the DOCX_SAMPLE paragraphs with
 * the most bad edits go through the DOCX path instead.
 */
export function runGate(options = {}) {
  const { paragraphs } = loadRegressionSet();
  const edits = options.edits || loadEdits();
  const eol = options.crlf ? (s => s.replace(/\n/g, '\r\n')) : (s => s);
  const result = { good: { total: 0, lost: 0, failures: [] }, bad: { total: 0, caught: 0, failures: [] } };
  const route = options.docx ? viaDocx : (s => s);
  // For the DOCX path: the paragraphs with the most bad edits, so each kind of loss goes through DOCX.
  const docxSample = () => paragraphs
    .map(p => ({ p, n: (edits.paragraphs[p.id] || { bad: [] }).bad.length }))
    .sort((a, b) => b.n - a.n || a.p.id.localeCompare(b.p.id))
    .slice(0, DOCX_SAMPLE).map(x => x.p);
  for (const p of options.docx ? docxSample() : paragraphs) {
    const entry = edits.paragraphs[p.id];
    if (!entry) { result.good.failures.push(`${p.id}: no good edit in regression/edits.json`); continue; }
    const review = exportReview(eol(route(p.text + '\n')), { profile: GATE_PROFILE, file: p.id }).json;
    const lostIn = text => verify(review, eol(route(text + '\n'))).paragraphs.filter(x => LOST.has(x.status));
    result.good.total++;
    const goodLost = lostIn(entry.good);
    if (goodLost.length) {
      result.good.lost++;
      const what = goodLost.flatMap(x => [...x.missing.map(m => `${m.kind} "${m.item}"`), ...x.changed.filter(c => !c.expected).map(c => `${c.kind} "${c.from}"`)]);
      result.good.failures.push(`${p.id}: the good edit loses ${what.join(', ')}`);
    }
    for (const bad of entry.bad) {
      result.bad.total++;
      if (lostIn(bad.text).length) result.bad.caught++;
      else result.bad.failures.push(`${p.id}: bad edit ${bad.kind} (${bad.item}) was not caught`);
    }
  }
  return result;
}
