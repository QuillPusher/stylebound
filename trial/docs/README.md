# Trial documents (generated)

Six realistic technical documents for the CLI trial in phase 3 of the plan. They replace the owner's real documents, so the trial uses no proprietary or brand information.

- **Fictional product.** "Demo Sync" is a made-up file-sync tool with a CLI (`demosync`), a server API and a desktop app. Platform names (Windows, macOS, Linux) appear only where an install guide needs them.
- **Licence.** MIT, the same as the rest of the repository (see `LICENSE` at the top level). Every paragraph may go into the public regression set.
- **Written to be realistic.** Each document mixes clean paragraphs with the kinds of problems the rules target. It is dense with facts that must survive an edit: numbers, limits, defaults, code, flags, negations, conditions and placeholders.

| File | Kind | Words | Planted issues | Facts |
|---|---|---|---|---|
| 01-readme.md | README | 540 | 13 | 8 |
| 02-install-upgrade-guide.md | Procedure | 474 | 15 | 9 |
| 03-release-notes.md | Release notes | 380 | 11 | 9 |
| 04-api-reference.md | API reference | 566 | 11 | 10 |
| 05-troubleshooting.md | Troubleshooting | 443 | 13 | 9 |
| 06-ui-strings.md | UI strings and errors | 369 | 13 | 10 |

## Answer key

`answer-key.json` lists, per document:

- `seeded`: each planted issue as an exact snippet, what is wrong, and which layer should catch it (`base`, `overlay`, or `none` for issues no planned rule covers).
- `facts`: what a reader must still know after any edit. The trial and the regression gate check these.
- `gaps`: known problems no rule targets, so the trial measures the limits honestly.

## Baseline on 14 October 2026 (before rule tuning, base profile)

```
75 findings across the six documents
76 planted issues: 41 labelled base, 35 overlay or none
28 of the 41 base-labelled issues caught on that date
```

The 13 base misses are the first evidence for chunk 3.2. Some are real rule gaps, for example HTTP methods inside code-formatted lines or future passives. Others may be labels in this key that expect too much of a base rule. Chunk 3.2 decides which.

## Bias warning

The same author wrote these documents and the rules, so the planted issues favour what the rules already look for. To offset this, the documents also contain clean paragraphs, the unplanned findings count as possible false positives, and the `gaps` list records problems no rule catches. If real, non-confidential documents become available later, add them as a second trial set.
