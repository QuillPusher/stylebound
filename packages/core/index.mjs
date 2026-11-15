/*
 * Stylebound core: the ESM entry point. It wraps the ES5 engine in src/engine.js
 * without changing it, and returns plain data in the shape documented in
 * docs/API.md and typed in index.d.mts.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { validateConfig, applyConfig, applyGlossary } from './src/config.mjs';
import { parse, toBlocks, findBlock } from './src/blocks.mjs';

export { validateConfig, ConfigError, DEFAULT_THRESHOLDS, CONFIG_KEYS } from './src/config.mjs';
export { extractMustKeep, normalizeItem, mustKeepItems, MUST_KEEP_KEYS } from './src/mustkeep.mjs';
import { exportReview as buildReview, renderReviewMarkdown, REVIEW_VERSION } from './src/export.mjs';
export { renderReviewMarkdown, REVIEW_VERSION };
export { verify, VerifyError, VERIFY_VERSION, MATCH_THRESHOLD, MOVE_THRESHOLD } from './src/verify.mjs';
import { verify } from './src/verify.mjs';
import { wordDiff } from './src/diff.mjs';
import { summarize, formatSummary } from './src/summary.mjs';
export { wordDiff, summarize, formatSummary };
export { renderCheckHtml, renderVerifyHtml, cleanChoices, reportRun, choicesFile, findingId, promptText, promptIntro, promptLimits } from './src/renderHtml.mjs';
export { docxToMarkdown, paragraphAt, DocxError } from './src/docx.mjs';

const require = createRequire(import.meta.url);
const engine = require('./src/engine.js');
const { loadRules, selectRules, loadStarterGlossary, PROFILES } = require('./src/load-rules.js');
const glossaryModule = require('./src/glossary.js');
const context = require('./src/context.js');
const wordcount = require('./src/wordcount.js');

export const apiVersion = '0.1';

const bundle = loadRules();
/** Every built-in rule: the OSS Writing Style Guide rules and the strict-plain overlay. */
export const rules = bundle.rules;
/** Profile names, in order of strictness. */
export const profiles = PROFILES.slice();
/** The starter glossary entries (packages/core/glossary/starter.csv). */
export const starterGlossary = loadStarterGlossary();

/** Parses glossary CSV text (term,preferred,pos,note) into { entries, problems }. */
export function parseGlossary(text, label) {
  return glossaryModule.parseGlossary(text, label);
}
/** Guide metadata and the severity mapping from src/rules/meta.json. */
export const meta = bundle.meta;

/** 'procedure', 'description' or 'other' (headings, table cells, alt text). */
export function classify(block) {
  return context.classify(block);
}

/** True when the text starts with a command, after an optional opening clause. */
export function isInstruction(text) {
  return context.isInstruction(text);
}

/** Words for sentence-length limits: code, paths, numbers with units and parentheses count as one. */
export function countWordsPlain(text) {
  return wordcount.countWordsPlain(text);
}

export function compileRules(ruleSet = rules) {
  return engine.compileRules(ruleSet);
}

export function runSelfTest(ruleSet = rules) {
  return engine.runSelfTest(ruleSet);
}

export { parse };

// The selected rule array is cached per profile, so the engine's compiled-rule
// cache is reused instead of recompiling for every call.
const selected = new Map();

/** The rules that run for a profile (default 'base'). */
export function rulesFor(profile = 'base', ruleSet = rules) {
  const key = ruleSet === rules ? profile : null;
  if (key && selected.has(key)) return selected.get(key);
  const out = selectRules(ruleSet, { profile });
  if (key) selected.set(key, out);
  return out;
}

// Rule sets built from a config, cached by the config's content.
const configured = new Map();

function resolveRules(options) {
  const ruleSet = options.rules || rules;
  const glossary = options.glossary || null;
  if (!options.config && !glossary) return rulesFor(options.profile || 'base', ruleSet);
  const config = validateConfig(options.config || {}, ruleSet.map(r => r.id));
  const profile = options.profile || config.profile;
  const key = ruleSet === rules ? JSON.stringify([profile, config, glossary]) : null;
  if (key && configured.has(key)) return configured.get(key);
  let applied = applyConfig(ruleSet, config);
  if (glossary) applied = applyGlossary(applied, starterGlossary, glossary);
  const out = selectRules(applied, { profile, enable: config.enable });
  if (key) {
    if (configured.size > 50) configured.clear();
    configured.set(key, out);
  }
  return out;
}

// Names that the document itself shows to be names, with no list to keep:
// bold UI labels ("**Access Key Based**") and capitalized phrases that appear
// at least twice in the middle of a sentence and never in lower case
// ("Demo Sync", "Sync Agent"). Headings keep the capitals of these words.
export function documentNames(text) {
  const body = text.split('\n').filter(l => !/^\s*(#|<!--|```|\|)/.test(l)).join('\n')
    .replace(/`[^`\n]*`/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const names = new Set();
  for (const m of body.matchAll(/\*\*([^*\n]+?)\*\*/g)) {
    const label = m[1].replace(/[.:,;!?]+$/, '').trim();
    if (/[A-Z]/.test(label) && label.split(/\s+/).length <= 6) names.add(label);
  }
  const plain = body.replace(/\*\*/g, '');
  const counts = new Map();
  const word = "[A-Z][A-Za-z0-9]*(?:['’-][A-Za-z0-9]+)*";
  for (const m of plain.matchAll(new RegExp(`(?<=[a-z0-9,;)][ \\t]+)${word}(?:[ \\t]+${word})*`, 'g'))) {
    counts.set(m[0], (counts.get(m[0]) || 0) + 1);
  }
  for (const [phrase, n] of counts) {
    if (n < 2) continue;
    const lower = phrase.toLowerCase();
    if (lower === phrase) continue;
    const re = new RegExp(`(?<![A-Za-z])${lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`);
    if (!re.test(plain)) names.add(phrase);
  }
  return [...names];
}

function withDocumentNames(ruleSet, text) {
  const names = documentNames(text);
  if (!names.length || !ruleSet.some(r => r.id === 'heading-title-case')) return ruleSet;
  return ruleSet.map(r => (r.id === 'heading-title-case' ? { ...r, names: [...new Set([...(r.names || []), ...names])] } : r));
}

// Findings that the document's structure explains, so no edit is wanted:
// - a number that labels something: "Figure 3", "Section 5.2", "Step 2";
// - wording inside bold text, which is a UI label or a defined term that the
//   prompt tells the agent not to change;
// - two headings with a table of contents between them (the DOCX reader puts
//   the table of contents in an HTML comment, which is not checked).
const LABEL_BEFORE = /\b(?:figure|fig\.|table|section|chapter|step|appendix|part|page|version|release|item|line|row|column|phase|level|option|example|exhibit|equation)\s*$/i;
const NUMBER_RULES = new Set(['numerals-in-prose', 'sentence-start-numeral']);

function explained(i, text, bold, labels) {
  if (NUMBER_RULES.has(i.ruleId)) {
    const before = text.slice(Math.max(0, i.start - 40), i.start);
    if (LABEL_BEFORE.test(before.split('\n').pop())) return true;
  }
  if (bold.some(([a, b]) => i.start >= a && i.end <= b)) return true;
  // The same label without bold, for example in a caption: "The Save & Close button".
  for (const label of labels) {
    for (let at = text.indexOf(label, Math.max(0, i.end - label.length)); at >= 0 && at <= i.start; at = text.indexOf(label, at + 1)) {
      if (at + label.length >= i.end) return true;
    }
  }
  if (i.ruleId === 'stacked-headings') {
    const before = text.slice(0, i.start);
    const prevHeading = before.lastIndexOf('\n#');
    if (prevHeading >= 0 && before.slice(prevHeading).includes('<!--')) return true;
  }
  return false;
}

export function check(text, options = {}) {
  const ruleSet = withDocumentNames(resolveRules(options), text);
  const res = engine.check(text, ruleSet);
  const blocks = toBlocks(res.parsed);
  const bold = [...text.matchAll(/\*\*[^*\n]+?\*\*/g)].map(m => [m.index, m.index + m[0].length]);
  const labels = [...new Set(bold.map(([a, b]) => text.slice(a + 2, b - 2).replace(/[.:,;!?]+$/, '').trim()))].filter(l => l.length > 2);
  const issues = res.issues.filter(i => !explained(i, text, bold, labels)).map(i => {
    const blockId = findBlock(i, blocks);
    return {
      ruleId: i.ruleId,
      severity: i.severity,
      heuristic: i.heuristic,
      message: i.rule.message,
      fix: i.rule.fix,
      replacement: i.replacement === undefined ? null : i.replacement,
      detail: i.detail === undefined ? null : i.detail,
      text: i.text,
      start: i.start,
      end: i.end,
      line: i.line,
      col: i.col,
      endLine: i.endLine,
      endCol: i.endCol,
      blockId,
      blockKind: blocks[blockId].kind
    };
  });
  return { issues, blocks, words: res.words, rulesChecked: res.rulesChecked, ms: res.ms };
}

const corePackage = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
/** Name and version of this core, as written into review files. */
export const tool = `stylebound-core ${corePackage.version}`;

/**
 * Checks the text and builds the review export.
 *   options: check options (profile, config, glossary, rules) plus file and generatedAt.
 * Returns { json, markdown, result }.
 */
export function exportReview(text, options = {}) {
  const result = check(text, options);
  const profile = options.profile || (options.config && options.config.profile) || 'base';
  const review = buildReview(text, result, {
    file: options.file, profile, rules: options.rules || rules, tool, generatedAt: options.generatedAt, docx: options.docx
  });
  return { ...review, result };
}

/**
 * Verifies an edited document and gathers everything a report needs: the
 * verify result, a word diff for each changed paragraph, the findings left
 * after the edit (same profile, config and glossary as `options`), and the summary.
 *   options: check options plus original and force (see verify).
 * Returns { verified, diffs, after, summary }.
 */
export function verifyDocument(review, edited, options = {}) {
  const verified = verify(review, edited, { original: options.original, force: options.force });
  const after = check(edited, { ...options, profile: options.profile || review.profile });
  const editedParas = new Map(after.blocks.map(b => [`e${b.id}`, b.source]));
  const diffs = {};
  for (const p of verified.paragraphs) {
    if (p.status === 'unchanged' || p.empty) continue;
    const original = review.paragraphs.find(x => x.id === p.id).text;
    const editedText = p.editedIds.map(id => editedParas.get(id)).join('\n\n');
    diffs[p.id] = wordDiff(original, editedText);
  }
  const summary = summarize(verified, review.findings || [], after.issues);
  return { verified, diffs, after, summary };
}
