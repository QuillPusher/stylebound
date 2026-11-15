/*
 * Trial kit (plan chunk 2.2): scores the checker against the answer key of
 * the six generated trial documents. A planted issue that a finding overlaps
 * is caught; one with no finding is missed; a finding that overlaps no
 * planted snippet is a possible false positive, to be judged in 2.3 and 2.4.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from '../packages/core/index.mjs';

export const TRIAL_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DOCS_DIR = path.join(TRIAL_DIR, 'docs');

// Which answer-key layers each profile is expected to catch.
export const IN_SCOPE = {
  base: ['base', 'base+overlay'],
  'strict-plain': ['base', 'overlay', 'base+overlay']
};

export function loadKey() {
  return JSON.parse(fs.readFileSync(path.join(DOCS_DIR, 'answer-key.json'), 'utf8'));
}

export function readDoc(file) {
  return fs.readFileSync(path.join(DOCS_DIR, file), 'utf8');
}

const overlaps = (f, s) => f.start < s.end && Math.max(f.end, f.start + 1) > s.start;

/** Scores one document of the answer key under one profile. */
export function scoreDocument(entry, profile, options = {}) {
  const text = readDoc(entry.file);
  const result = check(text, { profile, ...options });
  const snippets = entry.seeded.map(s => {
    const start = text.indexOf(s.snippet);
    return { ...s, start, end: start < 0 ? -1 : start + s.snippet.length };
  });
  const missingSnippets = snippets.filter(s => s.start < 0).map(s => s.snippet);
  const planted = snippets.filter(s => s.start >= 0).map(s => {
    const by = result.issues.filter(f => overlaps(f, s));
    return { snippet: s.snippet, issue: s.issue, layer: s.layer, inScope: IN_SCOPE[profile].includes(s.layer), caught: by.length > 0, by: [...new Set(by.map(f => f.ruleId))] };
  });
  const located = snippets.filter(s => s.start >= 0);
  const outside = result.issues.filter(f => !located.some(s => overlaps(f, s)));
  const onNone = result.issues.filter(f => located.some(s => s.layer === 'none' && overlaps(f, s)) && !located.some(s => s.layer !== 'none' && overlaps(f, s)));
  const byRule = {};
  for (const f of result.issues) byRule[f.ruleId] = (byRule[f.ruleId] || 0) + 1;
  const inScope = planted.filter(p => p.inScope);
  return {
    file: entry.file,
    profile,
    words: result.words,
    findings: result.issues.length,
    byRule,
    planted,
    inScope: inScope.length,
    caught: inScope.filter(p => p.caught).length,
    missed: inScope.filter(p => !p.caught),
    possibleFalsePositives: outside.map(f => ({ ruleId: f.ruleId, line: f.line, text: f.text, start: f.start, end: f.end })),
    flaggedNone: onNone.map(f => ({ ruleId: f.ruleId, line: f.line, text: f.text })),
    missingSnippets,
    issues: result.issues
  };
}

/** Scores every document under both profiles. */
export function scoreAll(options = {}) {
  const key = loadKey();
  const out = [];
  for (const entry of key.documents) for (const profile of ['base', 'strict-plain']) out.push(scoreDocument(entry, profile, options));
  return out;
}

/** Catch rate per answer-key layer, over all documents, for one profile. */
export function catchByLayer(scores, profile) {
  const out = {};
  for (const s of scores.filter(x => x.profile === profile)) {
    for (const p of s.planted) {
      const row = (out[p.layer] = out[p.layer] || { planted: 0, caught: 0 });
      row.planted++;
      if (p.caught) row.caught++;
    }
  }
  return out;
}
