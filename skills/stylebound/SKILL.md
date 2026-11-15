---
name: stylebound
description: Check a Markdown document with the Stylebound CLI, fix the findings without losing any fact, and verify the edit. Use when the user asks to check, plain-English, simplify, or tighten a document with Stylebound or the strict-plain profile, or to apply or verify a .style-review file.
---

# Stylebound: check, fix, verify

Stylebound checks a document against plain-English rules, writes a review file, and after the edit proves that no must-keep item was lost: numbers, code spans, placeholders, names, negations, conditions, modals and quantifiers. Stylebound has no AI in it. You make the edits; Stylebound checks your work.

## 1. Find the CLI

Run `stylebound --version`. If that fails, ask the person whether to install the command with `npm install -g stylebound@next`, then run `stylebound --version` again. Inside the Stylebound repository, `npx stylebound` and `node <repo>/packages/cli/bin/stylebound.mjs` also work. Below, `stylebound` means whichever works.

## 2. Export the review

```
stylebound export <file> --profile strict-plain
```

Use the profile the user asks for. Without one, leave out `--profile`: the config file decides, else `base`. Export writes two files next to the document: `<name>.style-review.md` (for you) and `<name>.style-review.json` (for the verifier). Do not edit either file.

## 3. Edit the document

Read `<name>.style-review.md`. Its Instructions section is the contract; follow it exactly:

1. Fix only the findings listed below.
2. Never delete or change a must-keep item.
3. Split long sentences instead of cutting words.
4. Keep every condition, negation, number, name and code span.
5. Do not touch code blocks, paths, UI labels or quoted error text.
6. Leave paragraphs without findings as they are.
7. Save the result over the original file. Do not rename it.

For each paragraph in the review, the "Must keep" line lists the items that must still be in your version of that paragraph. Each finding gives the rule, the flagged text, the reason and the fix; use the suggested replacement when there is one.

Judgement calls:

- **should**: if the action is required, write "must". If it is optional, say so ("Optional: rotate your keys every 90 days"). If the sentence states expected behaviour, state the behaviour ("The service starts"). The verifier reports this change for review, so say which you chose.
- **may**: "can" with the person or thing that acts ("Admins can delete old snapshots") for permission or ability; for possibility, say when it happens.
- **Condition after the instruction**: move the whole condition to the front; keep every word of it.
- **Two instructions in one sentence**: split them, as separate sentences or numbered steps.
- **Heuristic findings** (one-instruction, condition-first, tense, passive) can be wrong. If a fix would change the meaning, leave the text and list the finding in your report.
- Never add a fact, a number or a promise that the original did not have.

## 4. Verify

```
stylebound verify <file> --html
```

- Exit code 0: no must-keep item was lost.
- Exit code 1: read "Paragraphs to review" in the output. Put each missing item back, or undo the changed modal, then verify again. Repeat until the exit code is 0 or you can explain each remaining item to the user.
- Exit code 3: the review does not match the document. Export again and redo the edit.
- Exit code 2: a usage or config problem; the message says what to fix.

## 5. Report to the user

Give, in a few lines:

- Findings before and after the edit, from the verify output.
- Each item "changed as a finding asked" (for example, should to must), so a person can confirm it.
- Findings you left on purpose, and why.
- The path of `<name>.style-verify.html`, the side-by-side report.
