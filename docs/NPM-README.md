# Stylebound

Stylebound checks technical writing against plain-English rules. It exports the findings so that any person or agent can fix them, and then it verifies that no fact was lost. There is no AI inside the tool, and it never connects to the network.

It reads Markdown, plain text and .docx files. A .docx file is read, never written.

## Install

You need Node.js 22 or later on Windows, macOS or Linux. The package has no dependencies.

```
npm install -g stylebound@next
```

Until version 1.0.0 is published, the package is a release candidate under the `next` tag. From 1.0.0 on, `npm install -g stylebound` installs the current version. Check the install with `stylebound --version`.

## Use

```
stylebound check guide.md                       # list the findings (exit code 1 if any is an error)
stylebound check guide.md --profile strict-plain --json
stylebound check guide.md --html                # also write guide.style-check.html, a self-contained report
stylebound export guide.md                      # write guide.style-review.json and guide.style-review.md
stylebound verify guide.md                      # after the edit: what was lost, what changed, what is left
stylebound verify guide.md --html               # also write guide.style-verify.html
```

The loop has three steps:

1. `export` writes the review files next to the document. The Markdown review lists every finding with its paragraph, and the instructions for whoever edits.
2. You, or any agent, edit the document from the review and save it over the original.
3. `verify` checks that every must-keep item of every paragraph is still there. These items are numbers, code, placeholders, names, negations, conditions, modals and quantifiers. It also lists the findings that remain.

For a .docx file, findings name the paragraph and its style, for example `paragraph 14 (heading 2), line 31`. Edit the file in Word or another DOCX editor. Keep the styles. Save the file as .docx. `verify` reads it the same way.

With no setup, the checker leaves document structure alone. It skips the table of contents, the title, the subtitle and chapter headings. It also skips numbers that label something ("Figure 3", "Section 5.2"), bold UI labels, and names that the document always capitalizes.

## The HTML report and the prompt

`check --html` writes a report that opens in any browser, with no network. Hover over a highlight to see its rule. Next to each finding are four small buttons, named Fix, Fix all similar, Skip and Skip all similar. A finding with no choice is fixed.

The report then makes a prompt for any AI agent, with a copy button and an export button. The prompt lists the changes to make, place by place, without the skipped findings. Its last task asks the agent to save one short line as `<name>.style-choices-<run>.json` next to the document. The next `check --html` reads that file, so skipped findings stay skipped from run to run.

## Profiles and settings

- `base`: the rules of the OSS Writing Style Guide (122 rules).
- `strict-plain`: the base rules plus plain-language rules for technical documents. They limit sentence length (20 words in instructions, 25 in descriptions) and paragraph length (six sentences). They ask for one instruction per step, the condition before the instruction, and preferred terms from a glossary. They flag perfect and progressive tense, passive voice in procedures, contractions, and the weak modal verbs that the rules `modal-should` and `modal-may` name.

Settings come from the nearest `stylebound.config.json` above the document, or from `--config FILE`. The config file sets the profile, thresholds, rules to enable or disable, lines to ignore, product names, brands and a glossary file. The starter glossary ships with the package.

Exit codes:

- `0`: success.
- `1`: errors found (check), or a lost or changed item (verify).
- `2`: a usage or input problem.
- `3`: verify refused, because the hash differs or the file is not a review.

## Use from a program

The package also exports the core API for Node.js, with type declarations:

```js
import { check, exportReview, verifyDocument } from 'stylebound';
const result = check(text, { profile: 'strict-plain' });
```

## Agent skill

The repository holds an agent skill that runs the export, edit and verify loop end to end. It is not part of this package.

## Limits

- The rules are pattern checks. They find common problems and miss others. They do not judge meaning.
- `verify` compares text, not facts. It catches lost numbers, names, negations, conditions and similar items. It cannot tell whether a rewrite is still true.
- DOCX: headers, footers, footnotes, comments, text boxes and image alt text are not read.

Stylebound is based on the principles of plain and controlled technical English.

## License

MIT, for the whole package (see `LICENSE`). The core library in `packages/core` has its own copy of the same license (`packages/core/LICENSE`).
