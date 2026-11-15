/*
 * Must-keep extractor (plan chunk 1.7): the items a rewrite of a paragraph
 * must not lose. A JS port of extract() in regression/build_regression.py,
 * which stays the reference; tests/core/mustkeep.test.mjs checks that the two
 * agree on every paragraph of the regression set.
 */

const NEG = /\b(?:not|no|never|none|neither|nor|without|only|cannot|n't)\b|\w+n't\b/g;
const COND = /\b(?:if|unless|when|whenever|before|after|until|while|once|provided that|as long as|in case)\b/g;
const MODAL = /\b(?:must|must not|can|cannot|can't|may|might|should|will|won't|shall|need to|have to|required|optional)\b/g;
const QUANT = /\b(?:all|any|each|every|at least|at most|up to|more than|less than|fewer than|no more than|several|some|most|both|one or more|per)\b/g;
const NUM = /(?<![\w/])(?:v?\d+(?:[.,:/-]\d+)*(?:\s?(?:%|percent|MB|GB|KB|TB|ms|s|sec|seconds?|minutes?|min|hours?|days?|weeks?|months?|years?|AM|PM|am|pm|px|USD|EUR|x))?)(?![\w/])/g;
// Code spans and {placeholders} such as {filename}: both must survive exactly.
const CODE = /`[^`\n]+`|\{[A-Za-z_][A-Za-z0-9_.-]*\}/g;
const BOLD = /\*\*([^*\n]+)\*\*/g;
const QUOTE = /"([^"\n]{2,80})"/g;
const NAME = /(?<![.!?]\s)(?<!^)\b(?:[A-Z][a-zA-Z0-9+.-]+(?:\s+[A-Z][a-zA-Z0-9+.-]+)*)\b/g;
const NAME_RUN = /(?<![A-Za-z0-9])[A-Z][a-zA-Z0-9+.-]*(?:\s+[A-Z][a-zA-Z0-9+.-]*)+(?![A-Za-z0-9])/g;
// Capitalized words that start a sentence or a run without being a name.
const NOT_NAMES = new Set(['the', 'a', 'an', 'if', 'when', 'you', 'your', 'select', 'enter', 'open', 'create', 'add', 'run',
  'set', 'use', 'do', 'it', 'this', 'these', 'each', 'every', 'all', 'for', 'in', 'on', 'to', 'and', 'but', 'or', 'not', 'no',
  'never', 'only', 'before', 'after', 'optional', 'note', 'warning', 'caution', 'important']);

export const MUST_KEEP_KEYS = ['numbers', 'code', 'names', 'negations', 'conditions', 'modals', 'quantifiers'];

const all = (re, text, group = 0) => [...text.matchAll(re)].map(m => m[group]);
const uniqueSorted = list => [...new Set(list)].sort();

/** The must-keep items of one paragraph, in the shape stored in regression/paragraphs.json. */
export function extractMustKeep(text) {
  const code = all(CODE, text);
  const t = text.replace(CODE, ' ');
  const numbers = all(NUM, t).map(s => s.trim());
  const names = new Set([...all(BOLD, t, 1), ...all(QUOTE, t, 1)]);
  for (const run of all(NAME_RUN, t)) names.add(stripLeadingStopword(run));
  for (const w of all(NAME, t)) {
    if ([...names].some(n => n !== w && n.includes(w))) continue;
    if (NOT_NAMES.has(w.toLowerCase())) continue;
    names.add(w);
  }
  const low = t.toLowerCase();
  return {
    numbers,
    code: uniqueSorted(code),
    names: uniqueSorted([...names].filter(n => n.trim())),
    negations: uniqueSorted(all(NEG, low)),
    // ", while" joins a contrast, not a condition.
    conditions: uniqueSorted([...low.matchAll(COND)].filter(m => !(m[0] === 'while' && /,\s*$/.test(low.slice(0, m.index)))).map(m => m[0])),
    modals: uniqueSorted(all(MODAL, low)),
    quantifiers: uniqueSorted(all(QUANT, low))
  };
}

// "On Windows" at the start of a sentence is the name "Windows".
function stripLeadingStopword(run) {
  const words = run.split(/\s+/);
  while (words.length > 1 && NOT_NAMES.has(words[0].toLowerCase())) words.shift();
  return words.join(' ');
}

/** Normal form for comparing an item before and after an edit. */
export function normalizeItem(s) {
  return String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/, '');
}

/** Every must-keep item as a flat list of { kind, item }. */
export function mustKeepItems(keep) {
  const out = [];
  for (const kind of MUST_KEEP_KEYS) for (const item of keep[kind] || []) out.push({ kind, item });
  return out;
}
