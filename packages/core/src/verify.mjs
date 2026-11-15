/*
 * Verifier (plan chunk 1.9): after a person or an agent edits a document from
 * a review export, check that every must-keep item of every paragraph is
 * still there. No file access: the CLI reads the files.
 *
 * Alignment is order-preserving dynamic programming over paragraphs, scored
 * by Dice similarity of word sets, with splits (one original paragraph into
 * up to three) and merges (up to three into one). Paragraphs that moved are
 * matched in a second pass. Thresholds are documented in docs/VERIFY.md.
 */
import crypto from 'node:crypto';
import { parse } from './blocks.mjs';
import { MUST_KEEP_KEYS } from './mustkeep.mjs';

export const VERIFY_VERSION = 1;
export const MATCH_THRESHOLD = 0.35;   // in-order match, split or merge
export const MOVE_THRESHOLD = 0.5;     // second pass, for paragraphs that moved
const MAX_PARTS = 3;

export class VerifyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VerifyError';
    this.code = code;
  }
}

const sha256 = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

// Contractions written out, so "don't" and "do not" compare equal.
const CONTRACTIONS = [
  [/\bcan['’]t\b/g, 'cannot'], [/\bwon['’]t\b/g, 'will not'], [/\bshan['’]t\b/g, 'shall not'],
  [/\b(\w+)n['’]t\b/g, '$1 not'], [/\bcan not\b/g, 'cannot']
];

/** Lowercase, contractions written out, single spaces: the form items are compared in. */
export function comparable(text) {
  let s = String(text).toLowerCase().replace(/[’‘]/g, "'");
  for (const [re, to] of CONTRACTIONS) s = s.replace(re, to);
  return s.replace(/\s+/g, ' ').trim();
}

function tokens(text) {
  return new Set(comparable(text).match(/[a-z0-9]+/g) || []);
}

export function dice(a, b) {
  if (!a.size && !b.size) return 1;
  let common = 0;
  for (const t of a) if (b.has(t)) common++;
  return (2 * common) / (a.size + b.size);
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// An item is present when it appears with no letter or digit glued to either side.
function contains(haystack, item, exact) {
  const h = exact ? haystack.replace(/\s+/g, ' ') : comparable(haystack);
  const n = exact ? item.replace(/\s+/g, ' ').trim() : comparable(item).replace(/[.,;:!?]+$/, '');
  if (!n) return true;
  return new RegExp('(?:^|[^A-Za-z0-9])' + escapeRe(n) + '(?![A-Za-z0-9])').test(h);
}

// Modal strength classes: must > should > can > may (plan chunk 1.9).
const MODAL_RANK = {
  must: 4, 'must not': 4, shall: 4, 'have to': 4, 'need to': 4, required: 4, will: 4, "won't": 4,
  should: 3,
  can: 2, cannot: 2, "can't": 2, optional: 2,
  may: 1, might: 1
};
// Rules whose fix legitimately changes a must-keep word in the flagged text.
// A numeric date has no single safe rewrite (6/12 is June or December), so its change is reviewed.
const EXPECTED_BY_RULE = new Set(['modal-should', 'modal-may', 'future-tense', 'stacked-hedges', 'promised-outcomes', 'numeric-date']);

// Findings that span a clause or more. Their fix moves or splits words but must keep them.
const SPAN_RULES = new Set(['sentence-length', 'plain-sentence-length', 'paragraph-length', 'plain-paragraph-sentences', 'condition-first', 'one-instruction']);

// True when a finding asked for a change to this item: a rule that changes such
// words, or, for a name or a modal, a short finding whose text holds the item
// ("Oops", "Click OK", "must be installed") or is held by it ("Remove" in
// "Remove Job"). Negations, conditions, numbers and code never qualify that way:
// the regression gate showed a contraction finding would hide a deleted "not".
function answers(f, item, kind) {
  if (EXPECTED_BY_RULE.has(f.ruleId) && contains(f.text, item, false)) return true;
  if (kind !== 'names' && kind !== 'modals') return false;
  if (SPAN_RULES.has(f.ruleId)) return false;
  const t = f.text.trim();
  if (t.length < 3 || t.length > 40) return false;
  return contains(t, item, false) || contains(item, t, false);
}

const NUMBER_WORDS =['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

// Ways to write the same number that the base rules ask for: 25MB and 25 MB,
// 40% and 40 percent, 9am and 9 AM, 5 and five.
function numberForms(item) {
  const forms = new Set([item]);
  const m = /^(v?[\d.,:/-]*\d)\s?(.*)$/.exec(item.trim());
  if (m) {
    const [, num, unit] = m;
    if (unit) { forms.add(num + unit); forms.add(num + ' ' + unit); }
    if (unit === '%' || unit.toLowerCase() === 'percent') { forms.add(num + '%'); forms.add(num + ' percent'); }
    if (/^(am|pm)$/i.test(unit)) for (const u of [unit.toLowerCase(), unit.toUpperCase()]) { forms.add(num + u); forms.add(num + ' ' + u); }
    if (!unit && /^\d+$/.test(num) && Number(num) <= 10) forms.add(NUMBER_WORDS[Number(num)]);
  }
  return [...forms];
}

/** The paragraphs of a document as the export defines them: every block with text. */
export function paragraphsOf(text) {
  return parse(text).blocks
    .filter(b => b.source.trim() !== '')
    .map(b => ({ id: `e${b.id}`, lines: [b.line, b.endLine], text: b.source }));
}

// Order-preserving alignment. Returns pairs { o: [indexes], e: [indexes], score }.
function align(O, E) {
  const ot = O.map(p => tokens(p.text));
  const et = E.map(p => tokens(p.text));
  const union = sets => { const u = new Set(); for (const s of sets) for (const t of s) u.add(t); return u; };
  const n = O.length, m = E.length;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const from = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (!i && !j) continue;
      let best = -1, how = null;
      const consider = (score, step) => { if (score > best) { best = score; how = step; } };
      if (i) consider(dp[i - 1][j], { di: 1, dj: 0 });
      if (j) consider(dp[i][j - 1], { di: 0, dj: 1 });
      for (let a = 1; a <= MAX_PARTS && a <= i; a++) {
        for (let b = 1; b <= MAX_PARTS && b <= j; b++) {
          if (a > 1 && b > 1) continue; // a split or a merge, never both
          const s = dice(a === 1 ? ot[i - 1] : union(ot.slice(i - a, i)), b === 1 ? et[j - 1] : union(et.slice(j - b, j)));
          if (s >= MATCH_THRESHOLD) consider(dp[i - a][j - b] + s, { di: a, dj: b, score: s });
        }
      }
      dp[i][j] = best;
      from[i][j] = how;
    }
  }
  const pairs = [];
  for (let i = n, j = m; i || j;) {
    const step = from[i][j];
    if (step.di && step.dj) {
      pairs.unshift({ o: range(i - step.di, i), e: range(j - step.dj, j), score: step.score });
    }
    i -= step.di; j -= step.dj;
  }
  // Paragraphs rewritten in place: in a gap between two matched steps, the
  // unmatched originals and edits pair up in order when there are as many of each.
  pairs.sort((x, y) => x.o[0] - y.o[0]);
  const gaps = [];
  let prevO = -1, prevE = -1;
  for (const p of [...pairs, { o: [n], e: [m] }]) {
    const os = range(prevO + 1, p.o[0]), es = range(prevE + 1, p.e[0]);
    if (os.length && os.length === es.length && os.length <= MAX_PARTS) {
      os.forEach((oi, k) => gaps.push({ o: [oi], e: [es[k]], score: dice(ot[oi], et[es[k]]), positional: true }));
    }
    prevO = p.o[p.o.length - 1]; prevE = p.e[p.e.length - 1];
  }
  pairs.push(...gaps);
  // Second pass: paragraphs that moved.
  const usedO = new Set(pairs.flatMap(p => p.o));
  const usedE = new Set(pairs.flatMap(p => p.e));
  const candidates = [];
  for (let i = 0; i < n; i++) {
    if (usedO.has(i)) continue;
    for (let j = 0; j < m; j++) if (!usedE.has(j)) candidates.push({ i, j, s: dice(ot[i], et[j]) });
  }
  candidates.sort((x, y) => y.s - x.s);
  for (const c of candidates) {
    if (c.s < MOVE_THRESHOLD || usedO.has(c.i) || usedE.has(c.j)) continue;
    usedO.add(c.i); usedE.add(c.j);
    pairs.push({ o: [c.i], e: [c.j], score: c.s, moved: true });
  }
  return pairs;
}

function range(a, b) {
  const out = [];
  for (let k = a; k < b; k++) out.push(k);
  return out;
}

function modalsIn(text) {
  const t = comparable(text);
  return Object.keys(MODAL_RANK).filter(m => contains(t, m, false));
}

// Compares one original paragraph with the edited text mapped to it.
function compare(para, editedText, findings) {
  const missing = [];
  const changed = [];
  const editedModals = modalsIn(editedText);
  const originalModals = new Set(para.mustKeep.modals.map(m => comparable(m)));
  for (const kind of MUST_KEEP_KEYS) {
    for (const item of para.mustKeep[kind]) {
      const exact = kind === 'code';
      if (contains(editedText, item, exact)) continue;
      // Another form of the number counts only if the original did not already use that form ("at least one error ... code 1").
      if (kind === 'numbers' && numberForms(item).some(f => !contains(para.text, f, false) && contains(editedText, f, false))) continue;
      // An item that a finding asked to change counts as expected, for review.
      const answered = findings.find(f => answers(f, item, kind));
      if (kind === 'modals') {
        const rank = MODAL_RANK[comparable(item)];
        const replacements = editedModals.filter(x => !originalModals.has(x));
        const same = replacements.find(x => MODAL_RANK[x] === rank);
        if (same) continue; // same strength, for example "must" to "have to"
        if (replacements.length || answered) {
          changed.push({ kind, from: item, to: replacements, expected: !!answered, ruleId: answered ? answered.ruleId : null });
          continue;
        }
      } else if (answered) {
        changed.push({ kind, from: item, to: [], expected: true, ruleId: answered.ruleId });
        continue;
      }
      missing.push({ kind, item });
    }
  }
  return { missing, changed };
}

/**
 * Verifies an edited document against its review export.
 *   review   the parsed .style-review.json
 *   edited   the edited document text
 *   options  { original: the text that was exported (optional), force: boolean }
 */
export function verify(review, edited, options = {}) {
  if (!review || review.version !== 1 || !Array.isArray(review.paragraphs)) {
    throw new VerifyError('bad-review', 'This is not a Stylebound review file (format version 1).');
  }
  let hashMismatch = false;
  if (options.original !== undefined && sha256(options.original) !== review.originalSha256) {
    if (!options.force) {
      throw new VerifyError('hash-mismatch', 'The original document has changed since the review was exported (SHA-256 differs). Export a new review, or use --force to verify anyway.');
    }
    hashMismatch = true;
  }
  const tampered = review.paragraphs.filter(p => sha256(p.text) !== p.sha256).map(p => p.id);
  if (tampered.length && !options.force) {
    throw new VerifyError('hash-mismatch', `The review file was edited: paragraph ${tampered.join(', ')} no longer matches its SHA-256. Export a new review, or use --force.`);
  }
  if (tampered.length) hashMismatch = true;

  const O = review.paragraphs;
  const E = paragraphsOf(edited);
  const pairs = align(O, E);
  const byO = new Map();
  for (const p of pairs) for (const i of p.o) byO.set(i, p);
  const findingsBy = new Map();
  for (const f of review.findings || []) {
    if (!findingsBy.has(f.paragraphId)) findingsBy.set(f.paragraphId, []);
    findingsBy.get(f.paragraphId).push(f);
  }

  const paragraphs = O.map((para, i) => {
    const pair = byO.get(i);
    const findings = findingsBy.get(para.id) || [];
    const base = { id: para.id, lines: para.lines, findings: findings.length };
    // An empty original (a blank table cell with a finding) has nothing to keep.
    if (!pair && !para.text.trim()) {
      return { ...base, status: 'ok', editedIds: [], editedLines: null, missing: [], changed: [], moved: false, empty: true };
    }
    if (!pair) {
      const items = MUST_KEEP_KEYS.flatMap(kind => para.mustKeep[kind].map(item => ({ kind, item })));
      return { ...base, status: items.length ? 'missing' : 'removed', editedIds: [], editedLines: null, missing: items, changed: [], moved: false };
    }
    const mapped = pair.e.map(j => E[j]);
    const editedText = mapped.map(p => p.text).join('\n\n');
    const editedLines = [mapped[0].lines[0], mapped[mapped.length - 1].lines[1]];
    const editedIds = mapped.map(p => p.id);
    // In a merge, compare against the merged paragraph; the other originals share it.
    if (pair.e.length === 1 && pair.o.length === 1 && mapped[0].text === para.text) {
      return { ...base, status: 'unchanged', editedIds, editedLines, missing: [], changed: [], moved: !!pair.moved, score: 1 };
    }
    const { missing, changed } = compare(para, editedText, findings);
    const status = missing.length ? 'missing'
      : changed.some(c => !c.expected) ? 'changed'
        : changed.length ? 'changed-expected' : 'ok';
    return {
      ...base, status, editedIds, editedLines, missing, changed, moved: !!pair.moved,
      split: pair.e.length > 1, merged: pair.o.length > 1, score: Math.round(pair.score * 100) / 100
    };
  });
  const mappedE = new Set(pairs.flatMap(p => p.e));
  const added = E.filter((_, j) => !mappedE.has(j)).map(p => ({ id: p.id, lines: p.lines, status: 'new', text: p.text }));
  const lost = paragraphs.reduce((n, p) => n + p.missing.length, 0);
  return {
    version: VERIFY_VERSION,
    originalFile: review.originalFile,
    profile: review.profile,
    hashMismatch,
    status: lost ? 'loss' : paragraphs.some(p => p.status === 'changed') ? 'changed' : 'ok',
    paragraphs,
    added,
    editedSha256: sha256(edited)
  };
}
