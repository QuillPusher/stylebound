# Linux and macOS test list

Development and testing run on Windows only, by owner decision (2026-10-14). The code is written as if it were tested on Linux and macOS too, and this file tracks everything that still needs a check there. Chunk 3.3 works through the whole list in one pass, after the Windows work is complete.

Every chunk adds its own items. Nothing is removed from the list until it passes on both systems or the owner approves an exception.

## Portability rules for every chunk

- Build paths with `path.join`, `path.resolve` or `fileURLToPath`. Never hard-code `/` or `\` separators or drive letters.
- Read text as UTF-8 and accept LF and CRLF input. Offsets count the input as given. Write LF.
- Match file-name case exactly in imports and fixture paths. Linux file systems are case-sensitive; Windows and macOS usually are not.
- npm scripts use only `node` commands joined by `&&`. No `rm`, `cp`, `VAR=value` prefixes or shell globs; put that logic in a Node script.
- No `process.platform` checks. If one is ever needed, it lives in one documented module.
- Temporary files go under `os.tmpdir()` and are removed by the test that made them.
- Executable scripts start with `#!/usr/bin/env node`. A CLI entry file needs the executable bit in git (`git update-index --chmod=+x <file>`), because Windows cannot set it.
- No network calls.

## How to run the pass (chunk 3.3)

1. Get a Linux environment (WSL, a VM, or the CI workflow on a push) and a Mac (or the CI workflow). Without GitHub, follow docs/LINUX-GUIDE.md: section 2, option B (a Git bundle of the repository), then section 4.
2. Clone the repository with Node 22 or later. Run `npm test`, `npm run scan`, `npm run typecheck`, `npm run build:npm`, `npm run test:pack`, and every later command listed below.
3. Work through the table. In each platform column, write `pass` or `fail`, with the date and the Node version. Record each failure in the table, and fix it with a test that reproduces it.

## Items

| # | Added in | What to check | Why it could differ | Linux | macOS |
|---|---|---|---|---|---|
| 1 | 0.1 | `npm test`: `tests/core/rule-examples.test.mjs` runs 133 rules and 440 examples, and all pass | Fresh checkout; `.gitattributes` forces LF line endings | not run | not run |
| 2 | 0.1 | `regression/sample.md` gives 50 issues (`tests/baseline.test.js`) | Line endings and file encoding after checkout | not run | not run |
| 3 | 0.1 | `npm run scan` passes, and the scanner tests create and delete their temporary folders | Temporary folder paths (`/tmp`, `/var/folders` on macOS); path separators in relative paths | not run | not run |
| 4 | 0.1 | Removed with the legacy inspector, owner approved 2026-11-15. (Was: `npm run build` writes `packages/core/oss-writing-style-guide-inspector.html`.) | — | removed | removed |
| 5 | 0.1 | The CI workflow `.github/workflows/ci.yml` runs green on ubuntu-latest and macos-latest | Never run; needs a push | not run | not run |
| 6 | 0.2 | Facade tests pass: golden file, same issues as the frozen baseline `tests/fixtures/sample.baseline.json`, CRLF and byte order mark cases | Line endings; sort order; temp paths | not run | not run |
| 7 | 0.2 | `node --test` with no arguments finds every `*.test.js` and `*.test.mjs` file | Test discovery patterns differ between Node versions | not run | not run |
| 8 | 0.2 | `npm run typecheck` finds TypeScript: an installed package, `TYPESCRIPT_PATH`, or the VS Code bundle (`/usr/share/code`, `/Applications/Visual Studio Code.app`). If none is found it prints "skipped". | Install paths are guessed, not seen | not run | not run |
| 9 | 0.2 | Everything above on Node 22, the oldest supported version (on Windows too) | Development uses Node 24 | not run | not run |
| 10 | 0.3 | `npm run regress` prints `66 paragraphs, 0 failures` | SHA-256 of UTF-8 text; JSON read with LF endings | not run | not run |
| 11 | 0.3 | `python3 -I regression/build_regression.py` rebuilds `paragraphs.json` byte for byte | The command is `python3` there; output must stay LF | not run | not run |
| 12 | 1.1 | Classifier and word-count tests pass (`tests/core/context.test.mjs`, `tests/core/wordcount.test.mjs`) | Typographic quotes and dashes in the source files must load as UTF-8 | not run | not run |
| 13 | 1.2 | The engine loads `context.js` and `wordcount.js` with `require` relative to its own folder | Module resolution of relative paths | not run | not run |
| 14 | 1.2 | Removed with the legacy inspector, owner approved 2026-11-15. (Was: `tests/core/inspector.test.js`: the built page's engine runs as a plain script.) | — | removed | removed |
| 15 | 1.2 | Overlay tests, and the self-test timing stays under 500 ms on 10,000 words | Slower CI machines | not run | not run |
| 16 | 1.3 | Overlay B tests, including the typographic apostrophe (’) in the rule patterns | UTF-8 regex source loaded from JSON | not run | not run |
| 17 | 1.3 | `node --test --test-concurrency=1` is accepted by Node 22 | Flag support by version | not run | not run |
| 18 | 1.4 | Governance tests pass; `npm run rules:lock` and `npm run rules:report` leave no diff on a clean checkout | Line endings in RULE-IDS.lock and the generated HTML | not run | not run |
| 19 | 1.4 | `npm run bench`: strict-plain on 10,000 words stays under 500 ms; record the numbers | Machine speed; this is the reference for the budget | not run | not run |
| 20 | 1.5 | `findConfig` walks up to the file-system root (`/`) and stops; config tests pass | Root detection with `path.dirname`; `/tmp` may have a parent config | not run | not run |
| 21 | 1.5 | A config file named `Stylebound.config.json` (wrong case) is not found on Linux | Case-sensitive file names | not run | n/a |
| 22 | 1.6 | Glossary tests pass; `starter.csv` loads from the core package folder | CSV with CRLF or LF after checkout; path to the CSV | not run | not run |
| 23 | 1.6 | CLI glossary loader resolves a relative path like `terms/project.csv` from the config folder | Path separators | not run | not run |
| 24 | 1.7 | `npm run regress` prints `extractor parity 66/66`; `python3 -I regression/build_regression.py` still rebuilds the JSON byte for byte | Python 3 version on the system; regex lookbehind support in Node | not run | not run |
| 25 | 1.8 | Export tests pass and `examples/` stay byte-identical after `npm run examples` on a fresh checkout | SHA-256 of LF text; JSON key order | not run | not run |
| 26 | 1.9 | Verifier tests pass, including the CRLF case | Line endings in edited files written by other tools | not run | not run |
| 27 | 1.10 | Summary golden files match (`tests/fixtures/verify-summary.*`) | Line endings in the golden text file | not run | not run |
| 28 | 1.11 | `npm run gate` prints `66 good edits: 0 lost; 72 bad edits: 72 caught`; the CRLF gate test passes | Line endings; regex lookbehind in Node | not run | not run |
| 29 | 1.12 | `packages/cli/bin/stylebound.mjs` is executable after checkout (`ls -l`), and `./packages/cli/bin/stylebound.mjs --help` runs through the shebang | Executable bit set from Windows with `git update-index --chmod=+x` | not run | not run |
| 30 | 1.12 | `npm install --offline` then `npx stylebound --help`; CLI e2e tests pass | Workspace links are symlinks on Linux and macOS | not run | not run |
| 31 | 1.12 | Review files are written next to the document with LF line endings; `originalFile` uses forward slashes | Path separators | not run | not run |
| 32 | 1.13 | `examples/sample.style-check.html` and `sample.style-verify.html` open from disk in Safari (macOS) and Firefox or Chromium (Linux): highlights, hover titles, side-by-side diff, dark mode | Browser rendering; only checked in Edge on Windows | not run | not run |
| 33 | 2.5 | `npm run precision` gives the same table as on Windows; `npm run trial` gives the same counts | Sort order and line endings of the trial documents | not run | not run |
| 34 | 2.6 | `npm run regress` prints `84 paragraphs, 0 failures; extractor parity 84/84`; `npm run gate` prints `84 good edits: 0 lost; 112 bad edits: 112 caught`; `python3` rebuild of `paragraphs.json` reads `regression/trial.json` | Python's Unicode regex on the placeholder and UI strings | not run | not run |
| 35 | 3.1 | DOCX tests pass; `npm run fixtures:docx` rebuilds the six fixtures byte for byte | zlib output must be identical across platforms for the byte check | not run | not run |
| 36 | 3.1 | Owner check: a .docx saved by Word (Windows and macOS), LibreOffice and Google Docs reads with the same text and structure | Real-world DOCX variety; only test-written files are checked | not run | not run |
| 37 | 3.2 | DOCX verify tests pass, and `npm run gate` prints the DOCX path line with 0 lost | zlib and file paths in temporary folders | not run | not run |
| 38 | 3.4 | `npm run build:npm` then `npm run test:pack`: the tarball installs with `npm install -g --offline --prefix <temp>`, the command is `<prefix>/bin/stylebound` (not `stylebound.cmd`), the package is under `<prefix>/lib/node_modules/stylebound`, and all 13 checks pass, including the executable bit on the installed bin file | The global prefix layout differs from Windows; the bin needs the executable bit after install from the tarball; npm is found through `npm_execpath` or the shell | not run | not run |
| 39 | 3.4 | `npm pack` on Linux or macOS lists the same 39 files as `release/1.0.0-rc.1/npm-contents.txt`; note whether the tarball SHA-256 matches the Windows one in SHA256SUMS.txt | File modes inside the tarball can differ by platform, which changes the sum but not the contents | not run | not run |
| 40 | 3.4 | `tests/scripts/build-npm.test.mjs` passes (staged copy gives the same findings as the repository CLI) | Temporary folders and path separators in the staged copy | not run | not run |
| 41 | report | Open a `check --html` report from disk in Firefox and Chrome (Linux), and in Safari and Chrome (macOS): hover shows the rule at once; Fix, Fix all similar, Skip and Skip all similar change the highlight and the count; the severity filter works | Browser support for the inline script, `:has()` and SVG icons; local-file security rules | not run | not run |
| 42 | report | In the same browsers, Copy Suggested Changes as a Prompt fills the clipboard, and Export saves `<name>.style-prompt.txt`, for a report opened from disk | Clipboard access and downloads for local files differ between browsers | not run | not run |
| 43 | report | `tests/cli/choices.test.mjs` passes: `check --html` reads `<name>.style-choices-<run>.json` next to the document and says how to go on when it is missing | Case-sensitive file names; directory listing order | not run | not run |
| 44 | report | `tests/core/docx-structure.test.mjs` passes: the table of contents, title and heading levels of a .docx | Zip and XML reading of the test-only writer | not run | not run |
| 45 | GitHub Release | `npm install -g https://github.com/QuillPusher/stylebound/releases/download/v1.0.0-rc.1/stylebound-1.0.0-rc.1.tgz --prefix <temp>` installs the release asset, and `<prefix>/bin/stylebound --version` prints `stylebound 1.0.0-rc.1` | The release-asset install makes the bin link and sets its executable bit, not the local tarball test | not run | not run |
