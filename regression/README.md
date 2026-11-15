# Lossless regression set

`paragraphs.json` holds 84 paragraphs of software documentation, each with a hand-written **fact checklist** and an auto-extracted **must-keep** list (numbers, code, names, negations, conditions, modals, quantifiers). Licence: MIT, the same as the rest of the repository.

Sources:

- 28 paragraphs from a sample guide (`acme-tasks-guide-with-errors.md`). They contain style errors on purpose. The set tests that a style edit keeps every fact, not that the text is clean.
- 12 paragraphs from the OSS Writing Style Guide's own examples.
- 26 paragraphs written for this set, covering procedures, descriptions, UI strings, error messages, warnings and release notes about Stylebound itself.
- 18 paragraphs from the generated trial documents (`trial/docs`), listed in `trial.json` (chunk 2.6): every planted "should", every UI string with placeholders, and each paragraph where an agent edit nearly lost a fact or the verifier raised a false alarm. Their fact checklists come from `trial/docs/answer-key.json`. Numbered steps keep their list marker, because a step's first sentence is judged as an instruction.

How the gate works (`npm run gate`, plan chunk 1.11; edits in `edits.json`):

1. For each paragraph, the core library extracts the must-keep list (`packages/core/src/mustkeep.mjs`). It must match the list stored here: the Python extractor in `build_regression.py` is the reference, and `npm run regress` reports the parity. A fix to one extractor is made in both.
2. A simulated "good" edit (split sentences, swap listed words, fix punctuation) is applied. The verifier must report 0 missing items and every fact on the checklist must still be present (checked by a reviewer once, then frozen as the expected result).
3. A set of "bad" edits (drop a number, weaken a modal, remove a negation, delete a condition) is applied. The verifier must catch every one.
4. A release is blocked if step 2 loses any fact or step 3 misses any bad edit.

## How to add paragraphs

`paragraphs.json` is generated. Never edit it by hand: each paragraph carries a SHA-256 hash of its text, and `npm run regress` fails if the text and the hash disagree.

1. Open `build_regression.py` and add an `add(...)` call in the right section: the source label, the kind (`description`, `procedure`, `ui` or `release-note`), the paragraph text exactly as written, and a fact checklist.
2. Keep the fact checklist short: two to five facts a reader would be harmed by losing.
3. Use only your own writing, or text under a license that lets you republish it under MIT. Never text from a third-party specification and nothing from the public STE skill repositories.
4. Rebuild: `python -I regression/build_regression.py` (use `python3` on Linux and macOS). The script extracts the must-keep list and writes the hash.
5. Run `npm run regress`. It must print the new count and `0 failures`.
6. Update the expected count (84 today) in `tests/regression/load.test.mjs`, `tests/regression/gate.test.mjs` and `tests/core/mustkeep.test.mjs`.

Add real paragraphs from your own documents as they become available, once they are free of confidential content.

## The gate today

`edits.json` holds, for each paragraph, a hand-written good edit (a plain rewrite that keeps every fact) and the bad edits made from it: drop a number, weaken a modal, delete a negation, delete a condition, drop a code span or placeholder. List markers are numbering, not content, so they are not dropped. `npm run gate -- --write-edits` rebuilds the bad edits after a good edit changes; a test fails if they are out of date.

The gate exports each paragraph as its own document with the strict-plain profile, then verifies the edits: every good edit must lose nothing (a change a finding asked for is allowed), and every bad edit must be caught. It prints, for example, `84 good edits: 0 lost; 112 bad edits: 112 caught`. A second line runs the 10 paragraphs with the most bad edits through the DOCX path (written to a .docx by the test-only writer, read back by the core's reader) and must also lose nothing: `DOCX path: 10 good edits: 0 lost; 32 bad edits: 32 caught`.

When you add a paragraph, add its good edit to `edits.json`, check it against the fact checklist, and rebuild the bad edits.
