/*
 * The stylebound command-line tool (plan chunk 1.12):
 *
 *   stylebound check  <file> [--profile NAME] [--config FILE] [--json]
 *   stylebound export <file> [--profile NAME] [--config FILE]
 *   stylebound verify <file> [--review FILE] [--original FILE] [--force] [--profile NAME] [--config FILE] [--json]
 *
 * Exit codes: 0 success; 1 errors found (check) or a lost or changed item
 * (verify); 2 a usage or input problem; 3 verify refused (hash mismatch or
 * a file that is not a review).
 */
import fs from 'node:fs';
import path from 'node:path';
import { check, exportReview, verifyDocument, formatSummary, renderCheckHtml, renderVerifyHtml, cleanChoices, reportRun, choicesFile, tool, docxToMarkdown, paragraphAt, ConfigError, VerifyError, DocxError } from '../../core/index.mjs';
import { loadConfig, CONFIG_FILE } from './config.mjs';
import { loadGlossary } from './glossary.mjs';

export const EXIT = { ok: 0, found: 1, usage: 2, refused: 3 };

const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export const HELP = `Stylebound: check technical writing against plain-English rules,
export the findings for a person or an agent, and verify the edit.

Usage:
  stylebound check  <file> [options]   list the findings
  stylebound export <file> [options]   write <file>.style-review.json and .md next to the file
  stylebound verify <file> [options]   compare the edited file with its review

Options:
  --profile NAME     base or strict-plain (default: the config file, else base)
  --config FILE      use this config file instead of the nearest ${CONFIG_FILE}
  --json             print JSON instead of text (check, verify)
  --html             also write a self-contained HTML report: <file>.style-check.html or <file>.style-verify.html
  --review FILE      the review to verify against (default: <file>.style-review.json)
  --original FILE    the original document; verify refuses if its hash differs from the review
  --force            verify even when the hashes differ
  --help, --version

A .docx file is read, never written: check, export and verify work on its
text, and findings name the DOCX paragraph as well as the line.

Exit codes: 0 success; 1 errors found (check) or a lost or changed item (verify);
2 a usage or input problem; 3 verify refused (hash mismatch, or not a review file).`;

class UsageError extends Error {}

const FLAGS = new Set(['--json', '--html', '--force', '--help', '--version', '-h']);
const VALUES = new Set(['--profile', '--config', '--review', '--original']);

export function parseArgs(argv) {
  const out = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.indexOf('=');
    const name = a.startsWith('--') && eq > 0 ? a.slice(0, eq) : a;
    if (FLAGS.has(name)) out.flags[name.replace(/^-+/, '')] = true;
    else if (VALUES.has(name)) {
      const value = eq > 0 && a.startsWith('--') ? a.slice(eq + 1) : argv[++i];
      if (value === undefined || value === '') throw new UsageError(`${name} needs a value.`);
      out.flags[name.slice(2)] = value;
    } else if (a.startsWith('-')) throw new UsageError(`Unknown option ${a}. Run stylebound --help.`);
    else out.positional.push(a);
  }
  return out;
}

/** The output paths for a document: docs/guide.md gives docs/guide.style-review.json, and so on. */
export function reviewPaths(file) {
  const ext = path.extname(file);
  const stem = ext ? file.slice(0, -ext.length) : file;
  return { json: stem + '.style-review.json', md: stem + '.style-review.md', checkHtml: stem + '.style-check.html', verifyHtml: stem + '.style-verify.html' };
}

const slash = p => p.split(path.sep).join('/');

function readText(file, what) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new UsageError(`${what} not found: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

const isDocx = file => path.extname(file).toLowerCase() === '.docx';

/**
 * The text to check: the file itself, or for a .docx file its Markdown view,
 * with `docx` mapping lines back to DOCX paragraphs. A .docx file is only read.
 */
function readDocument(file, what) {
  if (!isDocx(file)) return { text: readText(file, what), docx: null };
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new UsageError(`${what} not found: ${file}`);
  try {
    const { markdown, blocks } = docxToMarkdown(fs.readFileSync(file));
    return { text: markdown, docx: blocks };
  } catch (e) {
    if (e instanceof DocxError) throw new UsageError(`${file}: ${e.message}`);
    throw e;
  }
}

function docxWhere(docx, line) {
  const b = docx && paragraphAt(docx, line);
  return b ? { paragraph: b.paragraph, style: b.style } : null;
}

// Config and glossary for a document: --config, else the nearest config file.
function settingsFor(file, flags) {
  let loaded = null;
  if (flags.config) {
    const configFile = path.resolve(flags.config);
    let text = readText(configFile, 'Config file');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // byte order mark
    let config;
    try { config = JSON.parse(text); } catch (e) { throw new UsageError(`${configFile} is not valid JSON: ${e.message}`); }
    loaded = { file: configFile, dir: path.dirname(configFile), config };
  } else {
    loaded = loadConfig(path.dirname(path.resolve(file)));
  }
  const options = {};
  if (loaded) options.config = loaded.config;
  const glossary = loadGlossary(loaded);
  if (glossary.length) options.glossary = glossary;
  if (flags.profile) options.profile = flags.profile;
  return { options, configFile: loaded ? loaded.file : null };
}

function issueLine(i, docx) {
  const found = i.text.replace(/\s+/g, ' ');
  const shown = found.length > 60 ? found.slice(0, 57) + '...' : found;
  const fix = i.replacement ? ` Suggested: "${i.replacement}".` : '';
  const where = docxWhere(docx, i.line);
  const at = where ? `paragraph ${where.paragraph} (${where.style}), line ${i.line}` : `${i.line}:${i.col}`;
  return `${at}  ${i.severity.padEnd(10)} ${i.ruleId.padEnd(26)} "${shown}"${i.detail ? ` (${i.detail})` : ''}.${fix}`;
}

function counts(issues) {
  const c = { error: 0, warning: 0, suggestion: 0 };
  for (const i of issues) c[i.severity]++;
  return c;
}

// Choices from the last run: the newest <name>.style-choices-<run>.json next
// to the document, saved there by the agent (the prompt's last step). The run
// number continues from the earlier report or the choices file.
export function carryChoices(file, reportFile) {
  const docName = path.basename(file);
  const dir = path.dirname(path.resolve(file));
  let previous = 0;
  try { previous = reportRun(fs.readFileSync(reportFile, 'utf8')); } catch { previous = 0; }
  let best = null;
  let unreadable = null;
  let names = [];
  try { names = fs.readdirSync(dir); } catch { names = []; }
  const stem = choicesFile(docName, 0).replace(/0\.json$/, '');
  for (const n of names) {
    if (!n.startsWith(stem) || !/^\d+\.json$/.test(n.slice(stem.length))) continue;
    const run = Number(n.slice(stem.length, -5));
    let choices = null;
    try { choices = cleanChoices(JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')), docName); } catch { choices = null; }
    if (!choices) { if (run === previous) unreadable = n; continue; }
    if (!best || run > best.run) best = { run, choices, from: n };
  }
  const run = Math.max(previous, best ? best.run : 0) + 1;
  const expected = choicesFile(docName, previous);
  let note = null;
  if (previous && (!best || best.run < previous)) {
    note = unreadable
      ? `${expected} could not be read, so your choices from run ${previous} are not applied. Skip those findings again in the new report, as before.`
      : `${expected} was not found next to the document, so your choices from run ${previous} are not applied. Skip those findings again in the new report, as before.`;
    if (best) note += ` The older choices from ${best.from} are applied.`;
  }
  return { run, choices: best && best.choices, from: best && best.from, note };
}

function cmdCheck(file, flags, io) {
  const { text, docx } = readDocument(file, 'File');
  const { options } = settingsFor(file, flags);
  const result = check(text, options);
  const c = counts(result.issues);
  const profile = options.profile || (options.config && options.config.profile) || 'base';
  if (flags.json) {
    const issues = docx ? result.issues.map(i => ({ ...i, docx: docxWhere(docx, i.line) })) : result.issues;
    io.out(JSON.stringify({ file: slash(file), profile, words: result.words, counts: c, issues }, null, 2));
  } else {
    for (const i of result.issues) io.out(issueLine(i, docx));
    if (result.issues.length) io.out('');
    io.out(`${slash(file)}: ${result.issues.length} findings (${c.error} error, ${c.warning} warning, ${c.suggestion} suggestion), ${result.words} words, profile ${profile}.`);
  }
  if (flags.html) {
    const out = reviewPaths(file).checkHtml;
    const say = flags.json ? io.err : io.out;
    const carry = carryChoices(file, out);
    fs.writeFileSync(out, renderCheckHtml(text, result, {
      file: slash(file), profile, generatedAt: new Date().toISOString(), tool,
      run: carry.run, choices: carry.choices, choicesFrom: carry.from, choicesNote: carry.note,
      thresholds: (options.config && options.config.thresholds) || {}
    }));
    say(`Wrote ${slash(out)}.`);
    if (carry.from && !carry.note) say(`Applied your choices from ${carry.from}.`);
    if (carry.note) say(carry.note);
  }
  return c.error ? EXIT.found : EXIT.ok;
}

function cmdExport(file, flags, io) {
  const { text, docx } = readDocument(file, 'File');
  const { options } = settingsFor(file, flags);
  const { json, markdown } = exportReview(text, { ...options, file: slash(path.relative(process.cwd(), path.resolve(file))), docx: docx || undefined });
  const out = reviewPaths(file);
  fs.writeFileSync(out.json, JSON.stringify(json, null, 2) + '\n');
  fs.writeFileSync(out.md, markdown);
  io.out(`Wrote ${slash(out.json)} and ${slash(out.md)}.`);
  io.out(`${json.findings.length} findings in ${new Set(json.findings.map(f => f.paragraphId)).size} of ${json.paragraphs.length} paragraphs, profile ${json.profile}.`);
  io.out(`Next: edit ${slash(file)} (or ask an agent to apply ${slash(out.md)}), then run: stylebound verify ${slash(file)}`);
  return EXIT.ok;
}

function cmdVerify(file, flags, io) {
  const edited = readDocument(file, 'File').text;
  const reviewFile = flags.review ? flags.review : reviewPaths(file).json;
  let review;
  try { review = JSON.parse(readText(reviewFile, 'Review file')); } catch (e) {
    if (e instanceof UsageError) throw e;
    throw new VerifyError('bad-review', `${reviewFile} is not valid JSON: ${e.message}`);
  }
  const { options } = settingsFor(file, flags);
  if (flags.original) options.original = readDocument(flags.original, 'Original file').text;
  options.force = !!flags.force;
  if (!flags.profile) options.profile = review.profile;
  const result = verifyDocument(review, edited, options);
  const s = result.summary;
  if (flags.json) {
    io.out(JSON.stringify({ file: slash(file), review: slash(reviewFile), summary: s, paragraphs: result.verified.paragraphs, added: result.verified.added, remaining: result.after.issues }, null, 2));
  } else {
    io.out(formatSummary(s, result.verified, { edited: slash(file), review: slash(reviewFile) }));
    const remaining = result.after.issues;
    if (remaining.length) {
      io.out('');
      io.out(`Findings after the edit (${remaining.length}):`);
      for (const i of remaining.slice(0, 20)) io.out('  ' + issueLine(i));
      if (remaining.length > 20) io.out(`  ... and ${remaining.length - 20} more. Run stylebound check ${slash(file)} for all of them.`);
    }
  }
  if (flags.html) {
    const out = reviewPaths(file).verifyHtml;
    fs.writeFileSync(out, renderVerifyHtml(review, result, { file: slash(file), reviewFile: slash(reviewFile), generatedAt: new Date().toISOString(), tool }));
    (flags.json ? io.err : io.out)(`Wrote ${slash(out)}.`);
  }
  return s.exitCode ? EXIT.found : EXIT.ok;
}

/**
 * Runs the CLI. io: { out(line), err(line) }. Returns the exit code; never
 * calls process.exit, so tests can run it in-process.
 */
export function main(argv, io = { out: s => console.log(s), err: s => console.error(s) }) {
  try {
    const { positional, flags } = parseArgs(argv);
    if (flags.version) { io.out(`stylebound ${VERSION}`); return EXIT.ok; }
    const [command, file, ...extra] = positional;
    if (flags.help || flags.h || !command) { io.out(HELP); return command || flags.help || flags.h ? EXIT.ok : EXIT.usage; }
    if (!['check', 'export', 'verify'].includes(command)) throw new UsageError(`Unknown command "${command}". Use check, export or verify.`);
    if (!file) throw new UsageError(`stylebound ${command} needs a file.`);
    if (extra.length) throw new UsageError(`Unexpected argument ${extra[0]}. Give one file.`);
    if (command === 'check') return cmdCheck(file, flags, io);
    if (command === 'export') return cmdExport(file, flags, io);
    return cmdVerify(file, flags, io);
  } catch (e) {
    if (e instanceof VerifyError) { io.err(`Verify refused: ${e.message}`); return EXIT.refused; }
    if (e instanceof UsageError || e instanceof ConfigError) { io.err(e.message); return EXIT.usage; }
    if (/glossary|not valid JSON|unknown profile/.test(e.message)) { io.err(e.message); return EXIT.usage; }
    throw e;
  }
}
