# Trial log

One row per document and profile for each run of `node scripts/trial.mjs --log`. Caught counts planted issues in scope for the profile (base: base and base+overlay; strict-plain: also overlay). Possible false positives are findings outside every planted snippet; 2.3 and 2.4 judge them in `trial/judgements.json`.

| Date | Document | Profile | Words | Findings | Caught | Missed | Possible FPs | Findings per rule |
|---|---|---|---|---|---|---|---|---|
| 2026-10-15 | 01-readme.md | base | 466 | 16 | 5/7 | 2 | 7 | unexpanded-acronym 3, passive-voice 2, use-contractions 2, semicolon 2, wordy-phrases 1, soft-intensifiers 1, you-can 1, sentence-length 1, exclamation-point 1, please-sorry-oops 1, important-to-note 1 |
| 2026-10-15 | 01-readme.md | strict-plain | 466 | 37 | 10/11 | 1 | 18 | no-contractions 6, perfect-tense 4, plain-sentence-length 3, one-instruction 3, unexpanded-acronym 3, passive-in-procedure 3, passive-voice 2, condition-first 2, one-term-per-concept 2, semicolon 2, wordy-phrases 1, soft-intensifiers 1, modal-should 1, you-can 1, exclamation-point 1, please-sorry-oops 1, important-to-note 1 |
| 2026-10-15 | 02-install-upgrade-guide.md | base | 432 | 12 | 1/4 | 3 | 8 | use-contractions 4, heading-title-case 3, semicolon 2, passive-voice 2, sentence-length 1 |
| 2026-10-15 | 02-install-upgrade-guide.md | strict-plain | 432 | 31 | 11/12 | 1 | 15 | passive-in-procedure 6, one-instruction 4, no-contractions 4, heading-title-case 3, semicolon 2, modal-should 2, plain-sentence-length 2, perfect-tense 2, passive-voice 2, one-term-per-concept 2, modal-may 1, condition-first 1 |
| 2026-10-15 | 03-release-notes.md | base | 346 | 11 | 4/6 | 2 | 5 | ticket-first-entry 2, stacked-headings 1, exclamation-point 1, you-can 1, filler-intensifiers 1, wordy-phrases 1, numerals-in-prose 1, unexpanded-acronym 1, us-spelling 1, use-contractions 1 |
| 2026-10-15 | 03-release-notes.md | strict-plain | 346 | 20 | 9/11 | 2 | 8 | no-contractions 5, ticket-first-entry 2, stacked-headings 1, exclamation-point 1, you-can 1, filler-intensifiers 1, wordy-phrases 1, numerals-in-prose 1, perfect-tense 1, progressive-tense 1, unexpanded-acronym 1, us-spelling 1, passive-in-procedure 1, modal-may 1, modal-should 1 |
| 2026-10-15 | 04-api-reference.md | base | 448 | 10 | 3/6 | 3 | 6 | sentence-length 2, use-contractions 2, semicolon 2, stacked-headings 1, all-caps-emphasis 1, unexpanded-acronym 1, table-intro-colon 1 |
| 2026-10-15 | 04-api-reference.md | strict-plain | 448 | 18 | 5/8 | 3 | 9 | no-contractions 4, modal-should 3, plain-sentence-length 2, one-term-per-concept 2, semicolon 2, modal-may 1, stacked-headings 1, all-caps-emphasis 1, unexpanded-acronym 1, table-intro-colon 1 |
| 2026-10-15 | 05-troubleshooting.md | base | 402 | 14 | 8/9 | 1 | 5 | use-contractions 2, numerals-in-prose 2, something-went-wrong 2, click-here 2, announcing-sentences 1, please-sorry-oops 1, filler-intensifiers 1, the-user 1, passive-voice 1, sentence-length 1 |
| 2026-10-15 | 05-troubleshooting.md | strict-plain | 402 | 34 | 9/11 | 2 | 19 | no-contractions 7, passive-in-procedure 4, perfect-tense 3, one-instruction 2, one-term-per-concept 2, plain-sentence-length 2, modal-may 2, numerals-in-prose 2, something-went-wrong 2, click-here 2, announcing-sentences 1, please-sorry-oops 1, filler-intensifiers 1, the-user 1, passive-voice 1, progressive-tense 1 |
| 2026-10-15 | 06-ui-strings.md | base | 317 | 12 | 7/9 | 2 | 4 | please-sorry-oops 2, exclamation-point 2, passive-voice 1, are-you-sure 1, future-tense 1, select-not-click 1, something-went-wrong 1, use-contractions 1, latin-abbreviations 1, numerals-in-prose 1 |
| 2026-10-15 | 06-ui-strings.md | strict-plain | 317 | 19 | 10/12 | 2 | 5 | no-contractions 4, one-term-per-concept 2, please-sorry-oops 2, exclamation-point 2, passive-voice 1, are-you-sure 1, future-tense 1, select-not-click 1, perfect-tense 1, modal-should 1, something-went-wrong 1, latin-abbreviations 1, numerals-in-prose 1 |

## End-to-end runs (strict-plain): export, agent edit with the skill, verify

The edited document 06 is in `trial/runs/`, because a test reads it. The other edited documents, review files and verify reports were kept as development records outside this repository. Facts were checked by hand against `answer-key.json`. Judgements are in `trial/judgements.json`.

| Date | Document | Findings before | After | Facts kept | Verifier: missing | Changed as asked | Verifier false alarms | Verifier missed losses |
|---|---|---|---|---|---|---|---|---|
| 2026-10-15 | 01-readme.md | 37 | 7 | 8 of 8 | 1 | 1 | 1 ("while" used as a contrast) | 0 |
| 2026-10-15 | 02-install-upgrade-guide.md | 31 | 2 | 9 of 9 | 1 | 3 | 1 ("must be installed" became the imperative "Install") | 0 |
| 2026-10-15 | 03-release-notes.md | 20 | 4 | 9 of 9 | 0 | 2 | 0 | 0 |
| 2026-10-15 | 01-readme.md | base | 466 | 14 | 5/7 | 2 | 5 | passive-voice 2, use-contractions 2, important-to-note 2, semicolon 2, wordy-phrases 1, soft-intensifiers 1, you-can 1, sentence-length 1, exclamation-point 1, please-sorry-oops 1 |
| 2026-10-15 | 01-readme.md | strict-plain | 466 | 34 | 10/11 | 1 | 15 | no-contractions 6, perfect-tense 4, plain-sentence-length 3, one-instruction 3, passive-voice 2, condition-first 2, passive-in-procedure 2, important-to-note 2, one-term-per-concept 2, semicolon 2, wordy-phrases 1, soft-intensifiers 1, modal-should 1, you-can 1, exclamation-point 1, please-sorry-oops 1 |
| 2026-10-15 | 02-install-upgrade-guide.md | base | 432 | 12 | 1/4 | 3 | 8 | use-contractions 4, heading-title-case 3, semicolon 2, passive-voice 2, sentence-length 1 |
| 2026-10-15 | 02-install-upgrade-guide.md | strict-plain | 432 | 28 | 11/12 | 1 | 12 | passive-in-procedure 4, one-instruction 4, no-contractions 4, heading-title-case 3, semicolon 2, modal-should 2, perfect-tense 2, passive-voice 2, one-term-per-concept 2, plain-sentence-length 1, modal-may 1, condition-first 1 |
| 2026-10-15 | 03-release-notes.md | base | 346 | 13 | 5/6 | 1 | 5 | marketing-words 2, ticket-first-entry 2, stacked-headings 1, exclamation-point 1, you-can 1, filler-intensifiers 1, wordy-phrases 1, numerals-in-prose 1, unexpanded-acronym 1, us-spelling 1, use-contractions 1 |
| 2026-10-15 | 03-release-notes.md | strict-plain | 346 | 22 | 10/11 | 1 | 8 | no-contractions 5, marketing-words 2, ticket-first-entry 2, stacked-headings 1, exclamation-point 1, you-can 1, filler-intensifiers 1, wordy-phrases 1, numerals-in-prose 1, perfect-tense 1, progressive-tense 1, unexpanded-acronym 1, us-spelling 1, passive-in-procedure 1, modal-may 1, modal-should 1 |
| 2026-10-15 | 04-api-reference.md | base | 448 | 10 | 4/6 | 2 | 5 | sentence-length 2, use-contractions 2, semicolon 2, stacked-headings 1, important-to-note 1, all-caps-emphasis 1, table-intro-colon 1 |
| 2026-10-15 | 04-api-reference.md | strict-plain | 448 | 18 | 6/8 | 2 | 8 | no-contractions 4, modal-should 3, plain-sentence-length 2, one-term-per-concept 2, semicolon 2, modal-may 1, stacked-headings 1, important-to-note 1, all-caps-emphasis 1, table-intro-colon 1 |
| 2026-10-15 | 05-troubleshooting.md | base | 402 | 14 | 8/9 | 1 | 5 | use-contractions 2, numerals-in-prose 2, something-went-wrong 2, click-here 2, announcing-sentences 1, please-sorry-oops 1, filler-intensifiers 1, the-user 1, passive-voice 1, sentence-length 1 |
| 2026-10-15 | 05-troubleshooting.md | strict-plain | 402 | 34 | 9/11 | 2 | 19 | no-contractions 7, passive-in-procedure 4, perfect-tense 3, one-instruction 2, one-term-per-concept 2, plain-sentence-length 2, modal-may 2, numerals-in-prose 2, something-went-wrong 2, click-here 2, announcing-sentences 1, please-sorry-oops 1, filler-intensifiers 1, the-user 1, passive-voice 1, progressive-tense 1 |
| 2026-10-15 | 06-ui-strings.md | base | 317 | 13 | 8/9 | 1 | 4 | please-sorry-oops 2, exclamation-point 2, passive-voice 1, are-you-sure 1, future-tense 1, select-not-click 1, something-went-wrong 1, idioms 1, use-contractions 1, latin-abbreviations 1, numerals-in-prose 1 |
| 2026-10-15 | 06-ui-strings.md | strict-plain | 317 | 20 | 11/12 | 1 | 5 | no-contractions 4, one-term-per-concept 2, please-sorry-oops 2, exclamation-point 2, passive-voice 1, are-you-sure 1, future-tense 1, select-not-click 1, perfect-tense 1, modal-should 1, something-went-wrong 1, idioms 1, latin-abbreviations 1, numerals-in-prose 1 |

## After the 2.4 tuning

The rows dated after the tuning above are the rescored trial. A fresh export of each original document, verified against the same agent edits:

| Date | Document | Findings before | After | Verifier: missing | Changed as asked | False alarms |
|---|---|---|---|---|---|---|
| 2026-10-15 | 01-readme.md | 34 | 4 | 0 | 1 | 0 |
| 2026-10-15 | 02-install-upgrade-guide.md | 28 | 2 | 0 | 4 | 0 |
| 2026-10-15 | 03-release-notes.md | 22 | 6 | 0 | 2 | 0 |
| 2026-10-15 | 04-api-reference.md | 18 | 6 | 0 | 4 | 0 |
| 2026-10-15 | 05-troubleshooting.md | 34 | 5 | 0 | 1 | 0 |
| 2026-10-15 | 06-ui-strings.md | 20 | 3 | 0 | 5 | 0 |
| 2026-10-15 | 01-readme.md | base | 515 | 14 | 5/7 | 2 | 5 | passive-voice 2, use-contractions 2, important-to-note 2, semicolon 2, wordy-phrases 1, soft-intensifiers 1, you-can 1, sentence-length 1, exclamation-point 1, please-sorry-oops 1 |
| 2026-10-15 | 01-readme.md | strict-plain | 515 | 31 | 11/12 | 1 | 12 | no-contractions 6, perfect-tense 4, plain-sentence-length 3, one-instruction 3, passive-voice 2, condition-first 2, important-to-note 2, semicolon 2, wordy-phrases 1, soft-intensifiers 1, modal-should 1, you-can 1, exclamation-point 1, please-sorry-oops 1, plain-paragraph-sentences 1 |
| 2026-10-15 | 02-install-upgrade-guide.md | base | 475 | 12 | 1/4 | 3 | 8 | use-contractions 4, heading-title-case 3, semicolon 2, passive-voice 2, sentence-length 1 |
| 2026-10-15 | 02-install-upgrade-guide.md | strict-plain | 475 | 31 | 17/18 | 1 | 9 | passive-in-procedure 4, one-instruction 4, no-contractions 4, condition-first 4, heading-title-case 3, semicolon 2, modal-should 2, perfect-tense 2, passive-voice 2, plain-sentence-length 1, modal-may 1, progressive-tense 1, glossary-preferred 1 |
| 2026-10-15 | 03-release-notes.md | base | 401 | 13 | 5/6 | 1 | 5 | marketing-words 2, ticket-first-entry 2, stacked-headings 1, exclamation-point 1, you-can 1, filler-intensifiers 1, wordy-phrases 1, numerals-in-prose 1, unexpanded-acronym 1, us-spelling 1, use-contractions 1 |
| 2026-10-15 | 03-release-notes.md | strict-plain | 401 | 23 | 12/13 | 1 | 7 | no-contractions 5, marketing-words 2, ticket-first-entry 2, stacked-headings 1, exclamation-point 1, you-can 1, filler-intensifiers 1, wordy-phrases 1, numerals-in-prose 1, perfect-tense 1, progressive-tense 1, unexpanded-acronym 1, us-spelling 1, modal-may 1, modal-should 1, glossary-preferred 1, plain-paragraph-sentences 1 |
| 2026-10-15 | 04-api-reference.md | base | 538 | 12 | 4/6 | 2 | 6 | use-contractions 3, sentence-length 2, semicolon 2, stacked-headings 1, important-to-note 1, all-caps-emphasis 1, table-intro-colon 1, passive-voice 1 |
| 2026-10-15 | 04-api-reference.md | strict-plain | 538 | 22 | 11/13 | 2 | 7 | no-contractions 4, modal-should 3, plain-sentence-length 2, semicolon 2, passive-in-procedure 2, modal-may 1, stacked-headings 1, important-to-note 1, all-caps-emphasis 1, table-intro-colon 1, condition-first 1, passive-voice 1, glossary-preferred 1, plain-paragraph-sentences 1 |
| 2026-10-15 | 05-troubleshooting.md | base | 480 | 14 | 8/9 | 1 | 5 | use-contractions 2, numerals-in-prose 2, something-went-wrong 2, click-here 2, announcing-sentences 1, please-sorry-oops 1, filler-intensifiers 1, the-user 1, passive-voice 1, sentence-length 1 |
| 2026-10-15 | 05-troubleshooting.md | strict-plain | 480 | 35 | 14/16 | 2 | 14 | no-contractions 7, progressive-tense 6, perfect-tense 3, one-instruction 2, plain-sentence-length 2, modal-may 2, numerals-in-prose 2, something-went-wrong 2, click-here 2, announcing-sentences 1, please-sorry-oops 1, filler-intensifiers 1, the-user 1, passive-voice 1, plain-paragraph-sentences 1, glossary-preferred 1 |
| 2026-10-15 | 06-ui-strings.md | base | 364 | 13 | 8/9 | 1 | 4 | please-sorry-oops 2, exclamation-point 2, passive-voice 1, are-you-sure 1, future-tense 1, select-not-click 1, something-went-wrong 1, idioms 1, use-contractions 1, latin-abbreviations 1, numerals-in-prose 1 |
| 2026-10-15 | 06-ui-strings.md | strict-plain | 364 | 20 | 12/14 | 2 | 5 | no-contractions 4, please-sorry-oops 2, exclamation-point 2, passive-voice 1, are-you-sure 1, future-tense 1, select-not-click 1, perfect-tense 1, modal-should 1, something-went-wrong 1, idioms 1, latin-abbreviations 1, numerals-in-prose 1, glossary-preferred 1, plain-paragraph-sentences 1 |
