# DOCX support and its limits

Stylebound reads .docx files and never writes them. `stylebound check` and `stylebound export` turn a .docx file into a Markdown view, check that view, and name the DOCX paragraph and its style for each finding, for example `paragraph 14 (heading 2), line 31`. You edit the .docx in Word or another DOCX editor; `stylebound verify` reads the edited file the same way and compares it with the review. `--original` also accepts the original .docx.

The reader is part of the core and has no dependencies: a small ZIP reader on Node's built-in zlib and a WordprocessingML reader (`packages/core/src/zip.mjs`, `packages/core/src/docx.mjs`). Nothing is downloaded.

## What is read

| In the .docx | In the Markdown view |
|---|---|
| Title style | `#` heading: the only top-level heading |
| Subtitle style | A plain line under the title |
| Paragraph in a heading style (by style name, outline level, or a style based on one; any language) | `#` to `######` heading. When the document has a title, or more than one Heading 1, every heading moves one level down (Heading 1 becomes `##`), so chapters do not count as extra titles. |
| Table of contents, table of figures and index (TOC and index styles, or a content control that Word marks as a table of contents) | One HTML comment, `<!-- Table of contents (not checked): ... -->`. Word builds these entries from the headings, so they are not checked. |
| Numbered list paragraph (decimal, letter or roman numbering) | `1.` step, numbered per list and level |
| Bulleted list paragraph | `-` item, indented by level |
| Paragraph in a code style (Code, Source Code, HTML Preformatted) | Lines of a fenced code block |
| Run in a code character style or a monospace font | `` `code` `` |
| Bold run | `**bold**` |
| Table | Markdown table; the first row is the header; cell paragraphs are joined with a space |
| Tracked insertions | Included as text |
| Tracked deletions | Left out |
| Hyperlinks, smart tags, simple fields, content controls | Their text |
| Tabs and line breaks | A space, and a line break inside the paragraph |

Paragraph numbers count every paragraph in document order, including empty ones and the paragraphs inside table cells, so they match what Word shows when you count paragraphs.

## What the checker leaves alone

These rules apply to every document, not only to .docx files:

- **Numbers that label something:** a number after "Figure", "Table", "Section", "Chapter", "Step", "Appendix", "Page", "Version" and similar words is a label, not a number to spell out.
- **Bold text:** bold marks a UI label or a defined term, which an edit must not change. Findings inside bold text are not reported. The same label without bold, for example in a caption, is left alone too.
- **Names:** a capitalized phrase that appears at least twice in the middle of a sentence and never in lower case (for example "Demo Sync"), and every bold label, is a name. Headings keep its capitals.

## Known limits

- **Not read:** headers, footers, footnotes, endnotes, comments, text boxes, shapes, charts, SmartArt, and the alt text of images. Their text is not checked.
- **Formatting:** italic, underline, colours and highlighting are not carried over. A bold run that is also code stays both (`**`code`**`).
- **Links:** the link text is checked; the target address is not shown.
- **Lists:** list numbering that restarts or continues in unusual ways may be numbered differently in the Markdown view; the numbers are syntax and do not change the findings.
- **Tables:** merged cells and nested tables are read as plain cells; a cell with several paragraphs becomes one line.
- **Fields:** a complex field (table of contents, cross-reference) shows its last calculated text, if Word saved it, and nothing otherwise.
- **Files:** password-protected, encrypted, ZIP64 (very large) and strict Open XML files are not supported; the CLI says so and exits with code 2.

## Checked so far

The six trial documents, converted to .docx by the test-only writer in `tests/helpers/docx-writer.mjs`, give the same findings as their Markdown sources (`tests/core/docx.test.mjs`). Files saved by Word, LibreOffice and Google Docs are not yet in the tests; adding one of each is an item for the owner (docs/PLATFORM-TESTS.md).
