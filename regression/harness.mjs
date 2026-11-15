/*
 * Loads the lossless regression set (regression/paragraphs.json) and checks
 * that it is intact. Tests and `npm run regress` use it; later chunks add the
 * extractor and verifier runs on top.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const DEFAULT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'paragraphs.json');
export const KINDS = ['description', 'procedure', 'ui', 'release-note'];
export const MUST_KEEP_KEYS = ['numbers', 'code', 'names', 'negations', 'conditions', 'modals', 'quantifiers'];

export function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Problems with one paragraph, as readable strings. Empty when it is intact. */
export function paragraphProblems(p) {
  const out = [];
  if (typeof p.id !== 'string' || !p.id) out.push('missing id');
  if (typeof p.text !== 'string' || !p.text.trim()) out.push('missing text');
  else if (p.sha256 !== sha256(p.text)) out.push('sha256 does not match the text');
  if (!KINDS.includes(p.kind)) out.push(`unknown kind ${JSON.stringify(p.kind)}`);
  if (typeof p.source !== 'string' || !p.source) out.push('missing source');
  if (!Array.isArray(p.facts) || p.facts.length === 0) out.push('no facts');
  if (!p.must_keep || typeof p.must_keep !== 'object') out.push('missing must_keep');
  else {
    for (const k of MUST_KEEP_KEYS) if (!Array.isArray(p.must_keep[k])) out.push(`must_keep.${k} is not a list`);
    for (const k of Object.keys(p.must_keep)) if (!MUST_KEEP_KEYS.includes(k)) out.push(`unknown must_keep.${k}`);
  }
  return out;
}

/** Loads the set and returns { meta, paragraphs, failures }. Never throws on content problems. */
export function loadRegressionSet(file = DEFAULT_FILE) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { paragraphs = [], ...meta } = data;
  const failures = [];
  if (meta.count !== paragraphs.length) failures.push({ id: '(file)', problem: `count says ${meta.count}, file has ${paragraphs.length}` });
  const seen = new Set();
  for (const p of paragraphs) {
    if (seen.has(p.id)) failures.push({ id: p.id, problem: 'duplicate id' });
    seen.add(p.id);
    for (const problem of paragraphProblems(p)) failures.push({ id: p.id || '(no id)', problem });
  }
  return { meta, paragraphs, failures };
}
