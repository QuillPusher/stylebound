# How the verifier works

`verify(review, edited, options)` compares an edited document with the review export it was made from. It never changes a file. The CLI runs it as `stylebound verify` (chunk 1.12).

## Inputs

- `review`: the parsed `<doc>.style-review.json`. Each paragraph carries its original text, its SHA-256 and its must-keep items, so the review alone describes the original.
- `edited`: the edited document text.
- `options.original`: the original text, when the caller still has it. If its SHA-256 differs from `originalSha256`, the verifier refuses with a `hash-mismatch` error, because the review was made from a different version.
- `options.force`: verify anyway after a hash mismatch; the result has `hashMismatch: true`.

A review whose paragraph text no longer matches its own SHA-256 was edited by hand; the verifier refuses it the same way.

## Alignment

1. The edited document is split into paragraphs the same way as the export: every block with text (paragraph, heading, list item, quote, table cell, alt text).
2. Each paragraph becomes a set of lowercase words, with contractions written out ("don't" becomes "do not").
3. An order-preserving alignment maximizes the total Dice similarity, `2 × shared words / (words in A + words in B)`. A step is a match (one to one), a split (one original paragraph to up to three edited ones) or a merge (up to three to one). A step needs a similarity of at least **0.35** (`MATCH_THRESHOLD`).
4. In a gap between two matched steps, unmatched original and edited paragraphs pair up in order when there are as many of each (up to three). This catches a sentence rewritten in place with few shared words.
5. Paragraphs still left over are paired across the document, best first, when their similarity is at least **0.5** (`MOVE_THRESHOLD`). These are marked `moved`.

A paragraph's must-keep items never include the alt text of an image inside it; the alt text is its own image-alt paragraph.

The thresholds are first values. The trial (chunks 2.3 and 2.4) and the regression gate (1.11) test them.

## Comparison

For each original paragraph, every must-keep item must appear in the edited text mapped to it:

- Code spans and placeholders must appear exactly.
- Other items are compared in lowercase, with contractions written out and spaces collapsed, and must not be glued to a letter or digit ("not" is not found inside "notify").
- Modals are compared by strength: must (with shall, have to, need to, required, will) > should > can > may (with might). A modal replaced by one of the same strength is kept.

## Statuses

| Status | Meaning |
|---|---|
| `unchanged` | The paragraph is identical. |
| `ok` | The text changed and every item is kept. |
| `missing` | One or more items are gone (`missing` lists them). |
| `changed` | A modal changed strength (`changed` lists it). Treated like a loss. |
| `changed-expected` | An item changed because a finding asked for it: a modal-should, modal-may, future-tense, stacked-hedges or promised-outcomes finding flagged that word. Reported for review, not as a loss. |
| `removed` | The paragraph is gone, and it had no must-keep items (for example, a deleted filler opener). |
| `new` | An edited paragraph with no original (listed in `added`). |

The overall `status` is `loss` when any item is missing, `changed` when a modal changed without a finding, and `ok` otherwise. The CLI exits with code 1 for `loss` and `changed`.

## Known limits

The verifier catches items that disappear. It cannot see a change in meaning that keeps every word, so a person still reads the diff.
