# Core API, version 0.1

`packages/core/index.mjs` is the entry point of the core library. Types are in `packages/core/index.d.mts`. The API is frozen at version 0.1. A change to a shape or a function signature needs a new `apiVersion` and an update to this file. New functions may be added without a version change.

The core takes text and returns data. It reads no files except its own rule files, and it makes no network calls.

```js
import { check, parse, compileRules, runSelfTest, rules, meta, apiVersion } from './packages/core/index.mjs';

const result = check(text);              // { issues, blocks, words, rulesChecked, ms }
const { blocks } = parse(text);          // the same blocks, without checking
```

## Functions and values

| Name | Returns | Notes |
|---|---|---|
| `check(text, options?)` | `CheckResult` | `options.config`: the parsed `stylebound.config.json` (see "Config"). `options.profile`: `base` or `strict-plain`; it overrides the config. `options.rules` replaces the built-in rules. `options.glossary`: project glossary entries from `parseGlossary`. |
| `parseGlossary(text, label?)` | `{ entries, problems }` | Parses a glossary CSV. `problems` name the line. |
| `starterGlossary` | `GlossaryEntry[]` | The rows of `packages/core/glossary/starter.csv`. |
| `exportReview(text, options?)` | `{ json, markdown, result }` | Checks the text and builds the review export (format version 1, `docs/review.schema.json`). Extra options: `file`, `generatedAt`. |
| `verify(review, edited, options?)` | `VerifyResult` | Compares an edited text with its review. See `docs/VERIFY.md`. Throws a `VerifyError` (`hash-mismatch`, `bad-review`). |
| `verifyDocument(review, edited, options?)` | `{ verified, diffs, after, summary }` | `verify`, plus a word diff for each changed paragraph, a check of the edited text with the review's profile, and the summary. |
| `wordDiff(before, after)` | `DiffRun[]` | Word-level diff: equal, delete and insert runs. |
| `formatSummary(summary, verified, names?)` | string | The summary as terminal text. |
| `renderCheckHtml(text, result, info?)`, `renderVerifyHtml(review, verifyResult, info?)` | string | Self-contained HTML reports: inline CSS, no external resources, all text escaped. The check report has one inline script (severity filter, keep or dismiss pop-ups, copy or export of a prompt); its findings are embedded as JSON with every `<` escaped. The verify report has no script. |
| `cleanChoices(raw, docName?)`, `reportRun(html)`, `choicesFile(docName, run)`, `findingId(key)` | object or null, number, string, string | Skip choices that carry over between check runs: `<name>.style-choices-<run>.json`, one line that the agent saves next to the document (Task 2 of the prompt): `{"stylebound":"choices","v":2,"doc":…,"run":…,"skipRules":[rule ids],"skip":[finding ids]}`. A finding id is a short hash of `rule|text|occurrence`. `check --html` applies the newest file and continues the run number. |
| `promptText(data, skipRules, skipIds)`, `promptIntro(limits)`, `promptLimits(profile, thresholds?)` | object, string[], object | The prompt of the check report's copy and export buttons. The report runs the same `promptText` in the browser. |
| `documentNames(text)` | string[] | The names that `check` finds in the text itself: bold labels, and capitalized phrases that appear at least twice mid-sentence and never in lower case. `heading-title-case` keeps their capitals. |
| `docxToMarkdown(buffer)` | `{ markdown, blocks }` | Reads a .docx file (never writes it) into a Markdown view; `blocks` map lines back to DOCX paragraphs and styles. See `docs/DOCX-LIMITS.md`. Pass `blocks` as `options.docx` to `exportReview` to name DOCX paragraphs in the review Markdown. |
| `extractMustKeep(text)` | `MustKeep` | Numbers, code and placeholders, names, negations, conditions, modals and quantifiers. |
| `validateConfig(raw, ruleIds)` | `ResolvedConfig` | Throws a `ConfigError` whose `problems` list every problem in plain words. |
| `parse(text)` | `{ text, blocks }` | Same blocks as `check` returns. |
| `compileRules(ruleSet?)` | compiled rules | The engine caches per array, so pass the same array again to reuse it. |
| `runSelfTest(ruleSet?)` | `SelfTestResult` | Runs every rule's flag and pass examples, the skip-region cases and a 500 ms timing test. |
| `rules` | `Rule[]` | Every built-in rule from `src/rules/NN-*.json`, in file order, for all profiles. |
| `profiles` | `Profile[]` | `['base', 'strict-plain']`. |
| `rulesFor(profile?, ruleSet?)` | `Rule[]` | The rules that run for a profile. See "Profiles" below. |
| `meta` | `Meta` | Guide title and the severity mapping from `src/rules/meta.json`. |
| `classify(block)` | `'procedure'`, `'description'` or `'other'` | Needs only `kind`, `prose` and `ordered`. See "Context" below. |
| `isInstruction(text)` | boolean | True when the text starts with a command, after an optional opening clause. |
| `countWordsPlain(text)` | number | Word count for sentence-length limits. See "Word counting" below. |
| `apiVersion` | `'0.1'` | |

## Issue

```json
{
  "ruleId": "wordy-phrases",
  "severity": "warning",
  "heuristic": false,
  "message": "This phrase means the same as a shorter one. Every word should do work.",
  "fix": "Use the short form from the guide's table.",
  "replacement": "to",
  "detail": null,
  "text": "in order to",
  "start": 226,
  "end": 237,
  "line": 9,
  "col": 18,
  "endLine": 9,
  "endCol": 29,
  "blockId": 4,
  "blockKind": "paragraph"
}
```

| Field | Meaning |
|---|---|
| `ruleId` | The rule that fired. |
| `severity` | `error`, `warning` or `suggestion`. |
| `heuristic` | True when the rule can only approximate the guideline. |
| `message`, `fix` | The rule's explanation and how to fix it. |
| `replacement` | Suggested text. `null`: no suggestion. Empty string: remove or reword, as `fix` says. |
| `detail` | Extra context, such as `"34 words"`, or `null`. |
| `text` | The flagged text, exactly as in the input: `input.slice(start, end)`. |
| `start`, `end` | Offsets into the input string in UTF-16 code units (JavaScript string indices). `end` is exclusive. Offsets count every character of the input, including `\r` and a byte order mark. |
| `line`, `col`, `endLine`, `endCol` | 1-based positions of `start` and `end`. |
| `blockId` | Index into `blocks`. |
| `blockKind` | The kind of that block. |

Issues are sorted by `start`, then by severity (error first).

## Block

```json
{
  "id": 4,
  "kind": "paragraph",
  "start": 209,
  "end": 258,
  "line": 9,
  "endLine": 9,
  "source": "Create a project in order to group related tasks.",
  "prose": "Create a project in order to group related tasks.",
  "checked": true
}
```

| Field | Meaning |
|---|---|
| `id` | Index in `blocks`. Stable for the same input text. |
| `kind` | `paragraph`, `quote`, `heading`, `list` (one list item), `cell` (one table cell) or `image-alt`. |
| `start`, `end` | Offsets of the block's text in the input. For a list item, `start` is after the list marker. |
| `line`, `endLine` | 1-based first and last line. |
| `source` | `input.slice(start, end)`, with Markdown kept. |
| `prose` | The text the rules see: code, URLs and HTML tags are replaced by U+E000, and lines are joined by `\n`. |
| `checked` | False inside a `<!-- style-check off -->` region. |
| `level` | Headings only: 1 to 6. |
| `ordered`, `listId` | List items only. Items of one list share a `listId`. |
| `header`, `column` | Table cells only. `column` is 0-based. |

Code blocks, front matter, HTML blocks and comments are not blocks.

## CheckResult

| Field | Meaning |
|---|---|
| `issues` | `Issue[]` |
| `blocks` | `Block[]` |
| `words` | Words of prose in the document. |
| `rulesChecked` | Number of rules run. |
| `ms` | Time taken. Not stable between runs; never compare it in tests. |

## Context

`classify(block)` decides how a block reads:

- `other`: headings, table cells and alt text.
- `procedure`: an item in a numbered list, or a paragraph, list item or quote whose first sentence is an instruction.
- `description`: everything else.

`isInstruction(text)` skips leading markup, a "Please", and one opening clause that ends in a comma ("If the sync fails, ...", "To change the schedule, ..."). The text is an instruction when the next word is a command verb from the list in `src/context.js`, or "Do not", "Don't", "Never" or "Make sure". It is not an instruction when that verb is followed by a lowercase noun such as "settings" or "results", by "is", "can" or a similar word, or by a third-person verb ("Sync runs every hour"). A capitalized word after the verb is read as a UI label: "Open Settings" is an instruction.

Known limits: only the first sentence decides, so a paragraph that describes first and instructs later is a description. A feature list written as bare verbs ("Export reports in common formats") reads as instructions.

## Word counting

`countWordsPlain(text)` counts words the way a reader does:

- A code span, a masked span (code, URLs and tags in `prose`), a path, an option such as `--profile`, an email address and a hyphenated word each count as one word.
- A number followed by a unit (`5 MB`, `30 seconds`, `10 %`) counts as one word.
- Text in parentheses counts as one word. `file(s)` and `run()` are single words.
- Em and en dashes separate words; punctuation on its own does not count.

## Profiles

- `base`: the OSS Writing Style Guide rules (122).
- `strict-plain`: the base rules plus the strict-plain overlay (`src/rules/06-strict-plain-*.json`).

A rule with a `profiles` list runs only in those profiles; a rule without one runs in every profile. A rule with `default: "opt-in"` runs only when enabled (configuration arrives in chunk 1.5). A rule's `replaces` list switches off the rules it supersedes: in strict-plain, `plain-sentence-length` replaces the base `sentence-length`. An unknown profile name throws an error that lists the valid names. A pattern rule with `context: "procedure"` matches only inside a procedure block or an instruction sentence (see "Context").

## Config

All settings live in one file, `stylebound.config.json`. The CLI finds the nearest one, starting in the document's folder and going up; the core never reads files and takes the parsed object as `options.config`. The schema is `docs/config.schema.json` (config version 1, frozen).

```json
{
  "$schema": "./docs/config.schema.json",
  "profile": "strict-plain",
  "thresholds": { "instructionWords": 20, "descriptionWords": 25, "paragraphSentences": 6 },
  "enable": [],
  "ignore": ["em-dash"],
  "glossary": "glossary/project.csv",
  "productNames": ["Demo Sync"],
  "brands": ["GitHub", "macOS"]
}
```

| Setting | Default | Meaning |
|---|---|---|
| `profile` | `base` | `base` or `strict-plain`. |
| `thresholds` | 20, 25, 6 | Most words in an instruction sentence and in a description sentence, and most sentences in a paragraph. Used by the strict-plain overlay. |
| `enable` | none | Opt-in rules to turn on. |
| `ignore` | none | Rules to switch off. A rule cannot be in both lists. |
| `glossary` | none | Path to the project glossary (CSV), relative to the config file. See "Glossary". |
| `productNames`, `brands` | none | Names with their exact casing; other casings are flagged by `brand-casing`. |

An unknown setting, a wrong type, a threshold out of range, an unknown rule id or a duplicate is an error. The message lists every problem, one per line.

## Glossary

A glossary is a CSV file with the header `term,preferred,pos,note`. `pos` is noun, verb, adjective, adverb, phrase, name, or empty. Each row is one of two kinds:

| Kind | How to write it | What the checker does |
|---|---|---|
| Replacement | `term` and `preferred` differ | `glossary-preferred` flags the term and suggests the preferred word; the note becomes the issue's `detail`. |
| Name | `pos` is `name`, `preferred` is empty | `brand-casing` flags other casings; `heading-title-case` leaves the name's capitals alone. |

A row with synonyms separated by ` | ` is rejected: synonym groups were dropped with the `one-term-per-concept` rule after the precision gate (see `docs/RULES-DROPPED.html`).

The starter glossary (`packages/core/glossary/starter.csv`, MIT, written for this project) has 43 replacements. It has no names: names belong to each project. A project glossary, named by `glossary` in the config, adds rows; a project row wins over a starter row with the same term. The `glossary-preferred` rule runs in the strict-plain profile; names (from the glossary, `productNames` and `brands`) apply in every profile.

Placeholders such as `{filename}` are masked like code, so no rule checks the words inside them.
