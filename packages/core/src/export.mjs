/*
 * Review export (plan chunk 1.8): the hand-off to the person or agent who
 * edits the document. Format version 1 is frozen; a change bumps `version`.
 * The JSON is the contract (schema: docs/review.schema.json); the Markdown is
 * the same content for reading. No file access here: the CLI writes the files.
 */
import crypto from 'node:crypto';
import { extractMustKeep, MUST_KEEP_KEYS } from './mustkeep.mjs';

export const REVIEW_VERSION = 1;

export const DOCX_INSTRUCTION = 'This review comes from a .docx file. Edit the text in Word or another DOCX editor, keep the paragraph styles, and save it as .docx under the same name.';

export const INSTRUCTIONS = [
  'Fix only the findings listed below.',
  'Never delete or change a must-keep item.',
  'Split long sentences instead of cutting words.',
  'Keep every condition, negation, number, name and code span.',
  'Do not touch code blocks, paths, UI labels or quoted error text.',
  'Leave paragraphs without findings as they are.',
  'Save the result over the original file. Do not rename it.'
];

export function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

const paragraphId = blockId => `p${blockId}`;

/** The must-keep items of an exported paragraph. Alt text belongs to its own image-alt block, so other blocks skip it. */
export function paragraphMustKeep(kind, text) {
  return extractMustKeep(kind === 'image-alt' ? text : text.replace(/!\[[^\]]*\]\(/g, '![]('));
}

/**
 * Builds the review for a checked document.
 *   text      the document text that was checked
 *   result    the CheckResult from check(text, ...)
 *   options   { file, profile, rules, tool, generatedAt }
 * Returns { json, markdown }.
 */
export function exportReview(text, result, options = {}) {
  const byRule = new Map((options.rules || []).map(r => [r.id, r]));
  // Every block with text, and any empty block that has a finding (a blank table cell).
  const flagged = new Set(result.issues.map(i => i.blockId));
  const paragraphs = result.blocks
    .filter(b => b.source.trim() !== '' || flagged.has(b.id))
    .map(b => ({
      id: paragraphId(b.id),
      kind: b.kind,
      lines: [b.line, b.endLine],
      sha256: sha256(b.source),
      text: b.source,
      mustKeep: paragraphMustKeep(b.kind, b.source)
    }));
  const findings = result.issues.map(i => ({
    paragraphId: paragraphId(i.blockId),
    line: i.line,
    col: i.col,
    start: i.start,
    end: i.end,
    text: i.text,
    ruleId: i.ruleId,
    severity: i.severity,
    message: i.message,
    fix: i.fix,
    replacement: i.replacement,
    detail: i.detail
  }));
  const ruleIds = [...new Set(findings.map(f => f.ruleId))].sort();
  const rules = ruleIds.map(id => {
    const r = byRule.get(id);
    return { id, name: r ? r.name : id, says: r ? r.message : '' };
  });
  const json = {
    version: REVIEW_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    tool: options.tool || 'stylebound',
    originalFile: options.file || 'document.md',
    originalSha256: sha256(text),
    profile: options.profile || 'base',
    instructions: options.docx ? [...INSTRUCTIONS, DOCX_INSTRUCTION] : INSTRUCTIONS.slice(),
    rules,
    paragraphs,
    findings
  };
  return { json, markdown: renderReviewMarkdown(json, { docx: options.docx }) };
}

// Paragraph text quoted as Markdown, one "> " per line.
function quoteBlock(text) {
  if (!text.trim()) return '> (empty)';
  return text.split(/\r?\n/).map(l => ('> ' + l).trimEnd()).join('\n');
}

function mustKeepLine(keep) {
  const items = MUST_KEEP_KEYS.flatMap(k => keep[k]);
  return items.length ? items.map(x => (x.startsWith('`') ? x : '`' + x.replace(/`/g, '') + '`')).join(' · ') : 'nothing listed';
}

/** The Markdown form of a review: instructions, rules, then each paragraph with findings. */
export function renderReviewMarkdown(review, extra = {}) {
  const L = [];
  L.push(`# Review for ${review.originalFile}`, '');
  L.push(`Generated ${review.generatedAt} by Stylebound (review format ${review.version}). Original SHA-256 \`${review.originalSha256}\`. Profile: ${review.profile}.`, '');
  L.push(`${review.findings.length} findings in ${new Set(review.findings.map(f => f.paragraphId)).size} of ${review.paragraphs.length} paragraphs.`, '');
  L.push('## Instructions', '');
  review.instructions.forEach((s, n) => L.push(`${n + 1}. ${s}`));
  L.push('');
  if (review.rules.length) {
    L.push('## Rules in plain words', '');
    for (const r of review.rules) L.push(`- **${r.id}** (${r.name}): ${r.says}`);
    L.push('');
  }
  const byParagraph = new Map();
  for (const f of review.findings) {
    if (!byParagraph.has(f.paragraphId)) byParagraph.set(f.paragraphId, []);
    byParagraph.get(f.paragraphId).push(f);
  }
  for (const p of review.paragraphs) {
    const list = byParagraph.get(p.id);
    if (!list) continue;
    const lines = p.lines[0] === p.lines[1] ? `line ${p.lines[0]}` : `lines ${p.lines[0]} to ${p.lines[1]}`;
    const where = extra.docx ? docxLabel(extra.docx, p.lines[0]) : '';
    L.push(`## Paragraph ${p.id} (${lines}${where})`, '');
    L.push(quoteBlock(p.text), '');
    L.push(`Must keep: ${mustKeepLine(p.mustKeep)}`, '');
    for (const f of list) {
      const found = f.text.replace(/\s+/g, ' ');
      const suggestion = f.replacement ? ` Suggested: "${f.replacement}".` : '';
      const detail = f.detail ? ` (${f.detail})` : '';
      L.push(`- [${f.severity}] ${f.ruleId}, line ${f.line}: "${found}"${detail}. ${f.message} ${f.fix}${suggestion}`);
    }
    L.push('');
  }
  if (!review.findings.length) L.push('No findings. Nothing to change.', '');
  return L.join('\n');
}

// "; DOCX paragraph 14, style heading 2" for a line of the Markdown view of a .docx file.
function docxLabel(blocks, line) {
  let found = null;
  for (const b of blocks) {
    if (b.line <= line) found = b;
    else break;
  }
  return found ? `; DOCX paragraph ${found.paragraph}, style ${found.style}` : '';
}
