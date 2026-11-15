#!/usr/bin/env node
/*
 * Fails if content we must never ship appears anywhere in the repository:
 * text from a third-party specification (page furniture, dictionary layout,
 * locally extracted dictionaries), the OpenSTE word list, or files from the
 * public STE skill repositories (such as
 * AminBlg/SimpleEnglish).
 *
 *   node scripts/scan-forbidden.js          scan the repository
 *   node scripts/scan-forbidden.js DIR      scan another folder (used by the tests)
 *
 * Exit code 0 when clean, 1 when anything is found.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['.git', 'node_modules']);
// This file and its test hold the markers themselves.
const SELF = new Set(['scripts/scan-forbidden.js', 'tests/scan-forbidden.test.js']);
const MAX_BYTES = 20 * 1024 * 1024;

// Checked against the path relative to the scan root, with forward slashes.
const PATH_RULES = [
  { id: 'spec-pdf', re: /ste[-_ ]?100[^/]*\.pdf$/i, why: 'a copy of the specification PDF' },
  { id: 'openste-file', re: /(^|\/)openste\.json$/i, why: 'the OpenSTE word list' },
  { id: 'skill-repo-file', re: /(^|\/)(ste[-_]lint\.py|linter-edge-cases\.md|check_numbers\.py|pressure-tests\.md|reply_scenarios\.json)$/i, why: 'a file from a public STE skill repository' },
  { id: 'skill-repo-folder', re: /(^|\/)(SimpleEnglish|ste-dictionary)\//i, why: 'a folder from a public STE skill repository' },
  { id: 'skill-eval-output', re: /__(baseline|skill|judge)__[^/]*$/, why: 'an evaluation output file from a public STE skill repository' }
];

// Checked against the content of every text file.
const TEXT_RULES = [
  { id: 'spec-page-header', re: /Simplified Technical English[ \t]*\r?\n[ \t]*Issue 9/, why: 'specification page header' },
  { id: 'spec-page-number', re: /^[ \t]*Page [12]-\d{1,2}-[A-Z]?\d{1,3}[ \t]*$/m, why: 'specification page number line' },
  { id: 'spec-part-footer', re: /Part [12] - (Dictionary|Writing rules)/i, why: 'specification page footer' },
  { id: 'spec-dictionary-columns', re: /Approved meaning\s*\/\s*ALTERNATIVES/i, why: 'specification dictionary column heading' },
  { id: 'spec-copyright-notice', re: /Copyright ASD\b/, why: 'a file marked as specification copyright' },
  { id: 'spec-extracted-dictionary', re: /"not_approved_count"\s*:/, why: 'a locally extracted specification dictionary' },
  { id: 'openste-json', re: /"wordstatus"\s*:[\s\S]{0,300}?"spacypos"\s*:/, why: 'OpenSTE word list entries' }
];

function walk(root, rel, out) {
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const childRel = rel ? rel + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(root, childRel, out);
    } else if (entry.isFile()) {
      out.push(childRel);
    }
  }
  return out;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function scan(root) {
  const findings = [];
  const files = walk(root, '', []);
  for (const rel of files) {
    if (SELF.has(rel)) continue;
    for (const r of PATH_RULES) {
      if (r.re.test(rel)) findings.push({ file: rel, line: 0, rule: r.id, why: r.why });
    }
    const abs = path.join(root, rel);
    if (fs.statSync(abs).size > MAX_BYTES) continue;
    const buf = fs.readFileSync(abs);
    if (buf.subarray(0, 8000).includes(0)) continue; // binary
    const text = buf.toString('utf8');
    for (const r of TEXT_RULES) {
      const m = r.re.exec(text);
      if (m) findings.push({ file: rel, line: lineOf(text, m.index), rule: r.id, why: r.why });
    }
  }
  return { files: files.length, findings };
}

module.exports = { scan, PATH_RULES, TEXT_RULES };

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const { files, findings } = scan(root);
  for (const f of findings) console.log(`${f.file}${f.line ? ':' + f.line : ''}  ${f.rule}  (${f.why})`);
  console.log(findings.length
    ? `Forbidden content found: ${findings.length} finding(s) in ${files} files.`
    : `Scan passed: ${files} files, no forbidden content.`);
  process.exitCode = findings.length ? 1 : 0;
}
