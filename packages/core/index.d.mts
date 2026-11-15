// Types for the Stylebound core API, version 0.1. The JSON shapes are described in docs/API.md.

export declare const apiVersion: '0.1';

export type Severity = 'error' | 'warning' | 'suggestion';

export type BlockKind = 'paragraph' | 'quote' | 'heading' | 'list' | 'cell' | 'image-alt';

export type Profile = 'base' | 'strict-plain';

export type RuleType =
  | 'pattern' | 'term-replace' | 'term-ban' | 'alternating-terms' | 'case-exact'
  | 'empty-alt' | 'heading-case' | 'numerals-in-prose' | 'sentence-start-numeral'
  | 'repeated-word' | 'sentence-length' | 'paragraph-length' | 'unexpanded-acronym'
  | 'heading-structure' | 'list-structure' | 'table-structure' | 'duplicate-link'
  | 'sentence-length-context' | 'paragraph-sentences' | 'one-instruction' | 'condition-first';

export interface Rule {
  id: string;
  name: string;
  severity: Severity;
  type: RuleType;
  /** Where the rule comes from in the style guide. */
  source: { section: string; quote: string };
  message: string;
  fix: string;
  /** Text the rule must flag and text it must pass; run by the self-test. */
  examples: { flag?: string[]; pass?: string[] };
  exceptions: string[];
  caseSensitive?: boolean;
  heuristic?: boolean;
  /** Block kinds the rule runs on. Default: paragraph, heading, list, cell, quote. */
  scope?: string[];
  patterns?: string[];
  terms?: Array<string | { match?: string; replace?: string; canonical?: string; note?: string | null }>;
  /** alternating-terms: several synonym groups in one rule. */
  groups?: string[][];
  /** alternating-terms: also match -s, -ed and -ing forms of one-word terms. */
  inflect?: boolean;
  /** heading-case: names whose words keep their capitals. */
  names?: string[];
  replacement?: string;
  check?: string;
  maxWords?: number;
  maxItems?: number;
  knownAcronyms?: string[];
  allowSentenceStart?: boolean;
  matchRaw?: boolean;
  /** Profiles the rule runs in. Absent: every profile. */
  profiles?: Profile[];
  /** 'opt-in' rules run only when enabled. Absent: on. */
  default?: 'on' | 'opt-in';
  /** Rule ids this rule switches off when it runs. */
  replaces?: string[];
  maxWordsProcedure?: number;
  maxWordsDescription?: number;
  maxSentences?: number;
  /** 'procedure': a pattern rule that matches only in instruction sentences and the first sentence of a numbered step. */
  context?: 'procedure';
  /** With context 'procedure': skip matches in a subordinate clause (after because, when, if, to see, ...). */
  mainClause?: boolean;
}

export interface Meta {
  guide: { title: string; version: string; rulesGenerated: string };
  severityMapping: Record<Severity, string>;
}

export interface Issue {
  ruleId: string;
  severity: Severity;
  heuristic: boolean;
  message: string;
  fix: string;
  /** Suggested text. null: no suggestion. Empty string: remove or reword, see fix. */
  replacement: string | null;
  /** Extra context, such as "34 words". */
  detail: string | null;
  /** The flagged text, exactly as it appears in the input. */
  text: string;
  /** Offsets into the input string (UTF-16 code units); end is exclusive. */
  start: number;
  end: number;
  /** 1-based positions. */
  line: number;
  col: number;
  endLine: number;
  endCol: number;
  /** Index into CheckResult.blocks. */
  blockId: number;
  blockKind: BlockKind;
}

export interface Block {
  /** Index in the blocks array; stable for the same input text. */
  id: number;
  kind: BlockKind;
  /** Offsets of the block's text in the input string; end is exclusive. */
  start: number;
  end: number;
  /** 1-based first and last line. */
  line: number;
  endLine: number;
  /** The input text from start to end, Markdown kept. */
  source: string;
  /** The text the rules see: code, URLs and tags replaced by U+E000, lines joined by \n. */
  prose: string;
  /** False inside a style-check off region. */
  checked: boolean;
  level?: number;
  ordered?: boolean;
  listId?: number;
  header?: boolean;
  column?: number;
}

export interface Thresholds {
  /** Most words in an instruction sentence. Default 20. */
  instructionWords: number;
  /** Most words in a description sentence. Default 25. */
  descriptionWords: number;
  /** Most sentences in a paragraph. Default 6. */
  paragraphSentences: number;
}

/** The contents of stylebound.config.json. Every setting is optional. */
export interface Config {
  $schema?: string;
  profile?: Profile;
  thresholds?: Partial<Thresholds>;
  /** Opt-in rules to turn on. */
  enable?: string[];
  /** Rules to switch off. */
  ignore?: string[];
  /** Path to the project glossary (CSV), relative to the config file. */
  glossary?: string;
  /** Your product names, with their exact casing. */
  productNames?: string[];
  /** Third-party brand names, with their exact casing. */
  brands?: string[];
}

/** A validated config with every default filled in. */
export interface ResolvedConfig {
  profile: Profile;
  thresholds: Thresholds;
  enable: string[];
  ignore: string[];
  glossary: string | null;
  productNames: string[];
  brands: string[];
}

export declare class ConfigError extends Error {
  /** One plain sentence per problem. */
  problems: string[];
}

export interface CheckOptions {
  /** Default: the config's profile, else 'base'. 'strict-plain' adds the overlay rules. */
  profile?: Profile;
  /** Rule set to choose from. Default: the built-in rules. */
  rules?: Rule[];
  /** The parsed stylebound.config.json. It is validated; an invalid config throws a ConfigError. */
  config?: Config;
  /** Project glossary entries from parseGlossary. They extend the starter glossary (strict-plain). */
  glossary?: GlossaryEntry[];
}

export interface GlossaryEntry {
  term: string;
  preferred: string;
  pos: '' | 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | 'name';
  note: string;
  /** 1-based line in the CSV file. */
  line: number;
  /** replacement: term and preferred differ. name: pos is name. */
  kind: 'replacement' | 'name';
}

export interface CheckResult {
  issues: Issue[];
  blocks: Block[];
  words: number;
  rulesChecked: number;
  /** Time taken in milliseconds. Not stable between runs. */
  ms: number;
}

export interface ParseResult {
  text: string;
  blocks: Block[];
}

export interface SelfTestResult {
  ok: boolean;
  failures: number;
  results: Array<{ ruleId: string; kind: 'flag' | 'pass'; text: string; ok: boolean; got: string[] }>;
  skipTests: Array<{ name: string; ok: boolean; got: string[] }>;
  timing: { words: number; ms: number; issues: number; ok: boolean };
}

/** Compiled rules. The shape is internal to the engine. */
export type CompiledRules = ReadonlyArray<{ readonly id: string }>;

/** Context of a block: procedure (tells the reader to act), description, or other (heading, cell, alt text). */
export type Context = 'procedure' | 'description' | 'other';

export declare const rules: Rule[];
export declare const profiles: Profile[];
export declare function rulesFor(profile?: Profile, ruleSet?: Rule[]): Rule[];
export declare const meta: Meta;
export declare function check(text: string, options?: CheckOptions): CheckResult;
export declare function parse(text: string): ParseResult;
export declare function compileRules(ruleSet?: Rule[]): CompiledRules;
export declare function runSelfTest(ruleSet?: Rule[]): SelfTestResult;
export declare function classify(block: Pick<Block, 'kind' | 'prose' | 'ordered'>): Context;
export declare function isInstruction(text: string): boolean;
export declare function countWordsPlain(text: string): number;
export declare const CONFIG_KEYS: string[];
export declare const DEFAULT_THRESHOLDS: Readonly<Thresholds>;
/** Throws a ConfigError listing every problem. ruleIds: the ids that enable and ignore may name. */
export declare function validateConfig(raw: unknown, ruleIds: string[]): ResolvedConfig;
export declare const starterGlossary: GlossaryEntry[];
export declare function parseGlossary(text: string, label?: string): { entries: GlossaryEntry[]; problems: string[] };

/** Items a rewrite of a paragraph must keep. Lists are sorted and unique, except numbers (in order). */
export interface MustKeep {
  numbers: string[];
  /** Code spans with their backticks, and {placeholders}. */
  code: string[];
  names: string[];
  negations: string[];
  conditions: string[];
  modals: string[];
  quantifiers: string[];
}
export type MustKeepKind = keyof MustKeep;
export declare const MUST_KEEP_KEYS: MustKeepKind[];
export declare function extractMustKeep(text: string): MustKeep;
/** Lowercase, straight apostrophes, single spaces, no trailing punctuation. */
export declare function normalizeItem(item: string): string;
export declare function mustKeepItems(keep: MustKeep): Array<{ kind: MustKeepKind; item: string }>;

/** A parsed <doc>.style-review.json, format version 1 (docs/review.schema.json). */
export interface Review {
  version: 1;
  generatedAt: string;
  tool: string;
  originalFile: string;
  originalSha256: string;
  profile: Profile;
  instructions: string[];
  rules: Array<{ id: string; name: string; says: string }>;
  paragraphs: Array<{ id: string; kind: BlockKind; lines: [number, number]; sha256: string; text: string; mustKeep: MustKeep }>;
  findings: Array<{
    paragraphId: string; line: number; col: number; start: number; end: number; text: string;
    ruleId: string; severity: Severity; message: string; fix: string; replacement: string | null; detail: string | null;
  }>;
}

export declare const REVIEW_VERSION: 1;
export declare const tool: string;
export declare function exportReview(text: string, options?: CheckOptions & { file?: string; generatedAt?: string; docx?: DocxBlock[] }):
  { json: Review; markdown: string; result: CheckResult };
export declare function renderReviewMarkdown(review: Review): string;

export type ParagraphStatus = 'unchanged' | 'ok' | 'missing' | 'changed' | 'changed-expected' | 'removed';

export interface ParagraphResult {
  id: string;
  lines: [number, number];
  findings: number;
  status: ParagraphStatus;
  editedIds: string[];
  editedLines: [number, number] | null;
  missing: Array<{ kind: MustKeepKind; item: string }>;
  changed: Array<{ kind: MustKeepKind; from: string; to: string[]; expected: boolean; ruleId: string | null }>;
  moved: boolean;
  split?: boolean;
  merged?: boolean;
  /** The original was empty (a blank table cell): nothing to keep. */
  empty?: boolean;
  score?: number;
}

export interface VerifyResult {
  version: 1;
  originalFile: string;
  profile: Profile;
  hashMismatch: boolean;
  status: 'ok' | 'changed' | 'loss';
  paragraphs: ParagraphResult[];
  added: Array<{ id: string; lines: [number, number]; status: 'new'; text: string }>;
  editedSha256: string;
}

export declare class VerifyError extends Error {
  code: 'hash-mismatch' | 'bad-review';
}
export declare const VERIFY_VERSION: 1;
export declare const MATCH_THRESHOLD: number;
export declare const MOVE_THRESHOLD: number;
export declare function verify(review: Review, edited: string, options?: { original?: string; force?: boolean }): VerifyResult;

export type DiffRun = { op: 'equal' | 'delete' | 'insert'; text: string };
/** Word-level diff: joining equal and delete runs gives before; equal and insert runs give after. */
export declare function wordDiff(before: string, after: string): DiffRun[];

export interface VerifySummary {
  status: 'ok' | 'changed' | 'loss';
  exitCode: 0 | 1;
  hashMismatch: boolean;
  paragraphs: { checked: number; unchanged: number; ok: number; missing: number; changed: number; changedExpected: number; removed: number; added: number };
  items: { missing: number; changed: number; changedExpected: number };
  findings: { before: number; after: number; byRule: Record<string, { before: number; after: number }> };
}
export declare function summarize(verified: VerifyResult, before: Review['findings'], after: Issue[]): VerifySummary;
export declare function formatSummary(summary: VerifySummary, verified: VerifyResult, names?: { edited?: string; review?: string }): string;
export declare function verifyDocument(review: Review, edited: string, options?: CheckOptions & { original?: string; force?: boolean }):
  { verified: VerifyResult; diffs: Record<string, DiffRun[]>; after: CheckResult; summary: VerifySummary };

/** One self-contained HTML file: the document with findings highlighted, a severity filter, a pop-up to keep or dismiss each finding, and buttons that copy or save the findings that are not dismissed as a prompt for an AI agent. One inline script; nothing loads from elsewhere. */
export declare function renderCheckHtml(text: string, result: CheckResult, info?: { file?: string; profile?: string; generatedAt?: string; tool?: string; run?: number; choices?: unknown; choicesFrom?: string; choicesNote?: string; thresholds?: { instructionWords?: number; descriptionWords?: number; paragraphSentences?: number } }): string;
/** Skip choices from <name>.style-choices-<run>.json (lean format v2, or the first format), checked and cleaned; null if not usable for this document. */
export declare function cleanChoices(raw: unknown, docName?: string): { doc: string; run: number; skipRules: string[]; skip: string[] } | null;
/** A short, stable id for a finding: a hash of "rule|text|occurrence". */
export declare function findingId(key: string): string;
/** The prompt that the check report's copy and export buttons make, from the report data and the skipped rules and finding ids. */
export declare function promptText(data: unknown, skipRules: string[], skipIds: string[]): { text: string; count: number; places: number; choices: string };
/** The fixed first part of the prompt, with the sentence limits of the profile. */
export declare function promptIntro(limits: { instruction: number | null; other: number; sentences: number | null }): string[];
/** The sentence limits that the prompt names, for a profile and optional config thresholds. */
export declare function promptLimits(profile?: string, thresholds?: { instructionWords?: number; descriptionWords?: number; paragraphSentences?: number }): { instruction: number | null; other: number; sentences: number | null };
/** Names that the text itself shows to be names: bold labels, and capitalized phrases that appear at least twice mid-sentence and never in lower case. */
export declare function documentNames(text: string): string[];
/** The run number of an earlier check report; 0 if it has none. */
export declare function reportRun(html: string): number;
/** The choices file name for a document and run, for example guide.style-choices-2.json. */
export declare function choicesFile(docName: string, run: number): string;
/** One self-contained HTML file: summary, then each changed paragraph side by side with a word diff, then the findings left. */
export declare function renderVerifyHtml(review: Review, result: ReturnType<typeof verifyDocument>, info?: { file?: string; reviewFile?: string; generatedAt?: string; tool?: string }): string;

/** A DOCX paragraph that starts a block of the Markdown view. */
export interface DocxBlock {
  /** 1-based paragraph number in the .docx, in document order, table cells included. */
  paragraph: number;
  /** Lowercase style name, such as "heading 2" or "normal". */
  style: string;
  kind: 'heading' | 'paragraph' | 'list' | 'step' | 'table' | 'code';
  /** 1-based line in the Markdown view. */
  line: number;
}
export declare class DocxError extends Error {}
/** Reads a .docx file (never writes it) into Markdown for the checker, with a map back to its paragraphs. */
export declare function docxToMarkdown(file: Uint8Array): { markdown: string; blocks: DocxBlock[] };
/** The DOCX paragraph that a Markdown line belongs to. */
export declare function paragraphAt(blocks: DocxBlock[], line: number): DocxBlock | null;
