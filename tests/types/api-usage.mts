// Compile-only: uses the public API the way the CLI will. Checked by `npm run typecheck`, never run.
import { exportReview, verify, verifyDocument, formatSummary, wordDiff, VerifyError, apiVersion, check, parse, compileRules, runSelfTest, rules, meta, classify, isInstruction, countWordsPlain, profiles, rulesFor, validateConfig, ConfigError, DEFAULT_THRESHOLDS } from '../../packages/core/index.mjs';
import type { Review, VerifyResult, ParagraphStatus, Issue, Block, CheckResult, Rule, Severity, BlockKind, Context, Profile, Config, ResolvedConfig } from '../../packages/core/index.mjs';

const version: '0.1' = apiVersion;
const result: CheckResult = check('The user should click here.\n', { rules });
const first: Issue | undefined = result.issues[0];
if (first) {
  const block: Block | undefined = result.blocks[first.blockId];
  const kind: BlockKind = first.blockKind;
  const sev: Severity = first.severity;
  const span: string = result.blocks.length ? first.text.slice(0, first.end - first.start) : '';
  const fix: string = first.replacement ?? first.fix;
  void [block?.source, kind, sev, span, fix, first.detail?.length];
}
const parsed = parse('# Title\n');
const headings: Block[] = parsed.blocks.filter(b => b.kind === 'heading' && (b.level ?? 0) >= 1);
const subset: Rule[] = rules.filter(r => r.severity === 'error');
const compiled = compileRules(subset);
const ids: string[] = compiled.map(c => c.id);
const ok: boolean = runSelfTest().ok && meta.guide.title.length > 0;
void [version, headings, ids, ok];

const contexts: Context[] = parsed.blocks.map(b => classify(b));
const plain: Context = classify({ kind: 'paragraph', prose: 'Select Save.' });
const words: number = countWordsPlain('Run `demosync` now.') + (isInstruction('Select Save.') ? 1 : 0);
void [contexts, plain, words];

const strict: Profile = 'strict-plain';
const strictResult: CheckResult = check('Restart the service if the sync stops.', { profile: strict });
const overlay: Rule[] = rulesFor(strict).filter(r => r.profiles?.includes('strict-plain'));
const names: Profile[] = profiles;
void [strictResult, overlay, names];
// @ts-expect-error unknown profile name
check('x', { profile: 'strict' });

// @ts-expect-error check takes a string, not a Buffer-like object
check({ length: 1 });
// @ts-expect-error severity is a closed set
const bad: Severity = 'info';
void bad;

const config: Config = { profile: 'strict-plain', thresholds: { instructionWords: 18 }, brands: ['GitHub'] };
const resolved: ResolvedConfig = validateConfig(config, rules.map(r => r.id));
const limit: number = resolved.thresholds.descriptionWords + DEFAULT_THRESHOLDS.paragraphSentences;
const withConfig: CheckResult = check('Text.', { config });
try { validateConfig({}, []); } catch (e) { if (e instanceof ConfigError) { const p: string[] = e.problems; void p; } }
void [limit, withConfig];
// @ts-expect-error thresholds are numbers
const badConfig: Config = { thresholds: { instructionWords: '20' } };
void badConfig;

const exported = exportReview('Select Save.', { profile: 'strict-plain', file: 'a.md' });
const rev: Review = exported.json;
const verified: VerifyResult = verify(rev, 'Select Save.', { force: false });
const firstStatus: ParagraphStatus | undefined = verified.paragraphs[0]?.status;
try { verify(rev, 'x'); } catch (e) { if (e instanceof VerifyError) { const code: 'hash-mismatch' | 'bad-review' = e.code; void code; } }
void [firstStatus, exported.markdown.length];

const vd = verifyDocument(rev, 'Select Save now.', { profile: 'strict-plain' });
const summaryText: string = formatSummary(vd.summary, vd.verified, { edited: 'a.md' });
const exit: 0 | 1 = vd.summary.exitCode;
const runs = wordDiff('a b', 'a c').map(r => r.op);
void [summaryText, exit, runs];
