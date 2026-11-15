/*
 * Precision gate (plan chunk 2.5). For each strict-plain overlay rule, a
 * finding on the six trial documents is correct when it overlaps a planted
 * snippet labelled overlay or base+overlay whose issue names that rule's
 * problem, or when the trial judged it correct (trial/judgements.json).
 * Precision is correct findings divided by all findings of the rule.
 */
import fs from 'node:fs';
import path from 'node:path';
import { rules } from '../packages/core/index.mjs';
import { loadKey, scoreDocument, TRIAL_DIR } from './kit.mjs';

export const THRESHOLD = 0.9;
export const MIN_FINDINGS = 5;
// Rules whose strength the owner set by decision: below the threshold, ask the owner.
export const OWNER_DECIDED = new Set(['modal-should', 'modal-may']);

// How the answer key names each overlay rule's problem.
export const ISSUE_PATTERNS = {
  'plain-sentence-length': /sentence over|long sentence/i,
  'plain-paragraph-sentences': /paragraph/i,
  'one-instruction': /instructions? in one/i,
  'condition-first': /condition after/i,
  'perfect-tense': /perfect/i,
  'progressive-tense': /progressive/i,
  'passive-in-procedure': /passive/i,
  'modal-should': /should/i,
  'modal-may': /\bmay\b/i,
  'no-contractions': /contraction/i,
  'glossary-preferred': /glossary|preferred/i
};

export const overlayRuleIds = () => rules.filter(r => r.profiles && r.profiles.includes('strict-plain')).map(r => r.id);

function loadJudgements() {
  return JSON.parse(fs.readFileSync(path.join(TRIAL_DIR, 'judgements.json'), 'utf8'));
}

/** Per overlay rule: findings, correct, debatable, false positives, unjudged, precision and outcome. */
export function measure() {
  const key = loadKey();
  const judged = loadJudgements().documents;
  const ids = overlayRuleIds();
  const rows = Object.fromEntries(ids.map(id => [id, { ruleId: id, findings: 0, correct: 0, debatable: 0, falsePositive: 0, unjudged: 0, details: [] }]));
  for (const entry of key.documents) {
    const score = scoreDocument(entry, 'strict-plain');
    const text = fs.readFileSync(path.join(TRIAL_DIR, 'docs', entry.file), 'utf8');
    const snippets = entry.seeded
      .filter(s => s.layer === 'overlay' || s.layer === 'base+overlay')
      .map(s => ({ ...s, start: text.indexOf(s.snippet), end: text.indexOf(s.snippet) + s.snippet.length }))
      .filter(s => s.start >= 0);
    const verdicts = (judged[entry.file] && judged[entry.file].findings) || [];
    for (const f of score.issues) {
      const row = rows[f.ruleId];
      if (!row) continue;
      row.findings++;
      const planted = snippets.some(s => f.start < s.end && Math.max(f.end, f.start + 1) > s.start && ISSUE_PATTERNS[f.ruleId] && ISSUE_PATTERNS[f.ruleId].test(s.issue));
      const v = verdicts.find(j => j.ruleId === f.ruleId && j.line === f.line && j.text === f.text);
      const verdict = planted ? 'correct' : v ? v.verdict : 'unjudged';
      if (verdict === 'correct') row.correct++;
      else if (verdict === 'debatable') row.debatable++;
      else if (verdict === 'false-positive') row.falsePositive++;
      else row.unjudged++;
      row.details.push({ file: entry.file, line: f.line, text: f.text, verdict, planted });
    }
  }
  for (const row of Object.values(rows)) {
    row.precision = row.findings ? row.correct / row.findings : null;
    row.precisionIfDebatableCorrect = row.findings ? (row.correct + row.debatable) / row.findings : null;
    const rule = rules.find(r => r.id === row.ruleId);
    row.defaultOn = rule.default !== 'opt-in';
    if (row.findings < MIN_FINDINGS) row.outcome = 'insufficient evidence: owner decides';
    else if (row.precision >= THRESHOLD) row.outcome = 'stays on by default';
    else if (OWNER_DECIDED.has(row.ruleId)) row.outcome = 'below 90%: owner decides (owner-decided rule)';
    else row.outcome = 'below 90%: propose opt-in';
  }
  return Object.values(rows);
}

/** Default-on overlay rules with enough evidence that are below the threshold. */
export function failing(rows) {
  return rows.filter(r => r.defaultOn && r.findings >= MIN_FINDINGS && r.precision < THRESHOLD);
}
