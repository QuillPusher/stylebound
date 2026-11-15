# Stylebound

Stylebound checks technical writing against a small set of plain-English rules. It exports the findings so that any person or agent can fix them. Then it verifies that no fact was lost. There is no AI inside the tool.

Status: release candidate 1.0.0-rc.1. It is not yet published to npm; install the release candidate from the GitHub Release (see Install the stylebound command). It was developed and tested on Windows. The checks that still need a run on Linux and macOS are listed in `docs/PLATFORM-TESTS.md`.

## Quick start

Stylebound runs on Windows, macOS and Linux. It needs Node.js 22 or later and npm, which comes with Node.js. It has no other dependencies. The commands below work in PowerShell, Command Prompt, bash and zsh.

1. Check the Node.js version:

   ```
   node -v
   ```

   The version must be `v22` or later. If Node.js is missing or older, install the current LTS version from `https://nodejs.org`. On macOS and Linux, nvm is another way to install it.
2. Get the repository. Clone it from its Git host, or from a Git bundle file (see [Another machine](#another-machine)):

   ```
   git clone <repository URL or bundle file> stylebound
   cd stylebound
   ```

3. Link the two workspace packages. npm downloads nothing, because there are no dependencies:

   ```
   npm install --offline
   ```

4. Run the tests. All 182 tests must pass:

   ```
   npm test
   ```

5. Check the sample file:

   ```
   npx stylebound check regression/sample.md --profile strict-plain
   ```

   The command lists the findings. It ends with exit code 1, because some findings are errors. That result is correct.

### Install the stylebound command

Install the command from npm for your user. You need no repository for this:

```
npm install -g https://github.com/QuillPusher/stylebound/releases/download/v1.0.0-rc.1/stylebound-1.0.0-rc.1.tgz
stylebound --version
```

This is release candidate 1.0.0-rc.1, attached to the GitHub Release v1.0.0-rc.1. To remove the command again, run `npm uninstall -g stylebound`.

On macOS and Linux, do not use `sudo` for a global install. If npm reports a permission error, install Node.js with nvm. Then run the install command again.

To install the command from the repository instead, for example to try your own changes, build the package. Then install the tarball:

```
npm run build:npm
npm install -g ./release/1.0.0-rc.1/stylebound-1.0.0-rc.1.tgz
```

Inside the repository, `npx stylebound` works without an install, and so does `node packages/cli/bin/stylebound.mjs`.

## Try it on a trial document

The `trial/docs` folder holds six practice documents about a made-up product called Demo Sync. Each document has style problems on purpose, and `trial/docs/answer-key.json` lists them. Try Stylebound on these documents before you use it on your own documents.

Work on a copy in a different folder. The tests read the documents in `trial/docs`, and Stylebound writes its output files next to the document that it checks.

These steps use the `stylebound` command, so do the steps in [Install the stylebound command](#install-the-stylebound-command) first. The example uses `02-install-upgrade-guide.md`. Any of the six documents works.

1. Open a terminal in the repository folder.
2. Copy the document to a new folder next to the repository. Then go to that folder.

   In PowerShell, bash or zsh:

   ```
   mkdir ../stylebound-trial
   cp trial/docs/02-install-upgrade-guide.md ../stylebound-trial/
   cd ../stylebound-trial
   ```

   In Command Prompt:

   ```
   mkdir ..\stylebound-trial
   copy trial\docs\02-install-upgrade-guide.md ..\stylebound-trial\
   cd ..\stylebound-trial
   ```

3. Check the document with the base rules:

   ```
   stylebound check 02-install-upgrade-guide.md
   ```

   Each line of the output is one finding: the line and column, the severity, the rule and the text that the rule found. The last line gives the totals: `12 findings (2 error, 3 warning, 7 suggestion)`. The command ends with exit code 1, because some findings are errors.
4. Check the document with the stricter rules. The `--html` option also writes an HTML report:

   ```
   stylebound check 02-install-upgrade-guide.md --profile strict-plain --html
   ```

   The strict-plain profile finds 31 problems in this document. To read the findings in a web browser, open `02-install-upgrade-guide.style-check.html`. In the report:

   - To show the findings of one severity only, select its button above the document. To show all findings again, select the button with the total.
   - To choose what the agent changes, use the four small buttons right after each finding. The check mark (Fix) puts the finding in the prompt. The double check mark does the same for every finding of the same rule. The X (Skip) leaves the finding out, and the double X skips every finding of the same rule. With no choice, a finding is fixed. To undo, select the button again. To see the full finding with the same four choices, select the highlight. To hide the small buttons, clear the "Show buttons on every finding" checkbox.
   - To give the findings to an AI agent, use one of the two prompt buttons below the document. One button copies the prompt, and the other saves it as a text file. The prompt starts with fixed instructions. Then it lists the findings by paragraph, without the skipped findings.
   - The prompt has two tasks for the agent: edit the document, then save one short line as a file next to it, for example `02-install-upgrade-guide.style-choices-1.json`. That line lists only what you skipped. The next `check --html` applies it, so skipped findings stay skipped. If the file is missing, the report says so, and you skip those findings again.
5. Compare the findings with the answer key. In the repository, open `trial/docs/answer-key.json`. Find the entry for `02-install-upgrade-guide.md`. Each item in its `seeded` list is one planted problem. `snippet` is the exact text, `issue` tells what is wrong, and `layer` tells which rules must find it:

   | `layer` | Which rules find the problem |
   |---|---|
   | `base` | The base rules, which both profiles use. |
   | `overlay` | Only the strict-plain profile. |
   | `base+overlay` | A base rule and a strict-plain rule. |
   | `none` | No rule. Only a person or an agent can find it. |

   The `facts` list tells what the document must still say after an edit.
6. Export the review files:

   ```
   stylebound export 02-install-upgrade-guide.md --profile strict-plain
   ```

   Stylebound writes `02-install-upgrade-guide.style-review.md` and `02-install-upgrade-guide.style-review.json`. The `.md` file gives the instructions for the edit and the findings in each paragraph. Do not change the two review files.
7. Open `02-install-upgrade-guide.md` in a text editor, and fix some of the findings. For example, in the first paragraph, change `is not supported; you must upgrade` to `is not supported. You must upgrade`.
8. To see how `verify` finds a lost fact, make one mistake on purpose. In the "Before You Begin" section, change `200 MB` to `20 MB`. Then save the file with the same name.
9. Verify the edit. The `--html` option also writes an HTML report:

   ```
   stylebound verify 02-install-upgrade-guide.md --html
   ```

   The output tells you about the lost number:

   ```
   Paragraphs to review:
     p5 (original line 10): missing number "200 MB"

   LOSS: 1 must-keep item missing. Exit code 1.
   ```

   The findings after the edit are 30, because the semicolon is gone. To read the full report in a web browser, open `02-install-upgrade-guide.style-verify.html`.
10. Change `20 MB` back to `200 MB`. Save the file. Run the `verify` command again. Now the output tells you `OK: no must-keep item was lost. Exit code 0.`
11. When you finish, delete the `stylebound-trial` folder.

An AI coding agent can do the export, the edit and the verify steps for you. Ask it to follow `skills/stylebound/SKILL.md` on the copy of the document.

## Use the CLI

```
stylebound check guide.md                       # list the findings (exit code 1 if any is an error)
stylebound check guide.md --profile strict-plain --json
stylebound export guide.md                      # write guide.style-review.json and guide.style-review.md
stylebound verify guide.md                      # after the edit: what was lost, what changed, what is left
stylebound verify guide.md --html               # also write guide.style-verify.html (check --html writes guide.style-check.html)
```

Markdown, plain text and .docx files work. A .docx file is read, never written: findings name its paragraph and style, and you edit it in Word (see `docs/DOCX-LIMITS.md`). With no setup, the tool leaves Word structure alone. It skips the table of contents, the title page and chapter headings. It also skips figure and section numbers, bold UI labels, and names that the document always capitalizes.

The loop: `export` writes the review files next to the document. You, or any agent, edit the document from `guide.style-review.md` and save it over the original. `verify` then checks every must-keep item of every paragraph (numbers, code, placeholders, names, negations, conditions, modals, quantifiers) and lists the findings that remain.

Settings come from the nearest `stylebound.config.json` (see `docs/API.md`, "Config").

| Exit code | Meaning |
|---|---|
| `0` | Success. |
| `1` | Errors found (`check`), or a lost or changed item (`verify`). |
| `2` | A usage or input problem. |
| `3` | `verify` refused: a hash mismatch, or not a review file. |

In the repository, write `npx stylebound` instead of `stylebound`, or install the command first (see [Install the stylebound command](#install-the-stylebound-command)).

## For AI coding agents

This section is for an AI coding agent that sets up, tests or uses Stylebound for a person. It has everything that you need. `AGENTS.md` points here.

1. Do the first four steps of [Quick start](#quick-start). Report the test result to the person who asked.
2. To check a document, run `npx stylebound check <file>` in the repository. After the install, run `stylebound check <file>`. Add `--profile strict-plain` for the stricter rules. Exit code 1 means that the document has error findings. It does not mean that the tool failed.
3. To fix a document, follow `skills/stylebound/SKILL.md`. It has four steps: export, edit only what the review asks, verify with `--html`, and report. Do not change the review files.
4. Stylebound writes its output files next to the document: `<name>.style-review.json`, `<name>.style-review.md`, `<name>.style-check.html` and `<name>.style-verify.html`.
5. Get approval before you publish to npm, push to a Git host, or change the rules. The tests, the build and the pack test need no network.
6. For a test pass on Linux or macOS, follow `docs/PLATFORM-TESTS.md`. Write the results in its table.

## Testing and feedback

Stylebound is shared with researchers who test it on their own machines. These results help most:

- Findings on your own documents: findings that are wrong, and problems that the rules miss.
- The export, edit and verify loop: any must-keep item that `verify` failed to catch, and any false alarm.
- A full test pass on Linux or macOS, written in the table in `docs/PLATFORM-TESTS.md`.
- .docx files saved by Word, Google Docs or other word processors (see `docs/DOCX-LIMITS.md`).

Send your results to the owner of the repository, for example as an issue on its Git host.

## Run the tests

Node 22 or later. There are no dependencies to install.

```
npm test           # run the unit tests, every rule's own examples and the type check
npm run scan       # fail if forbidden third-party content is in the repository
npm run typecheck  # type-check the API with a TypeScript copy already on the machine
npm run golden     # rewrite tests/fixtures/sample.issues.json after an intended change
npm run rules:lock # add new rule ids to rules/RULE-IDS.lock (it never removes one)
npm run rules:report  # rebuild docs/RULES-DROPPED.html from rules/dropped.json
npm run bench      # check time and findings per 100 words
npm run gate       # regression gate: good edits lose nothing, bad edits are caught
npm run regress    # regression set integrity and extractor parity
npm run build:npm  # stage the npm package and pack it into release/<version>/ (offline, nothing published)
npm run test:pack  # install that tarball into a temporary prefix, offline, and run it from outside the repository
```

Development is tested on Windows. What still needs a check on Linux and macOS is listed in `docs/PLATFORM-TESTS.md`.

## Move, copy or clone

Follow these steps to move or copy the repository, or to set it up on another machine.

### What to leave out

When you copy the repository, leave out these two folders. The setup steps make both again.

| Leave out | Why |
|---|---|
| `node_modules/` | It holds only links to the two workspace packages. The links point to the old absolute path. |
| `release/` | `npm run build:npm` makes it again. |

Git leaves both out of a bundle or a clone, because they are in `.gitignore`.

### After a move or a copy

Do these steps in the new folder:

1. Link the two workspace packages again. This command only makes the links. npm downloads nothing.

   ```
   npm install --offline
   ```

2. Run the tests.

   ```
   npm test
   ```

3. Make the release folder again.

   ```
   npm run build:npm
   ```

### Another machine

The other machine needs Node.js 22 or later, and Git.

Carry the repository as a Git bundle, not as a ZIP file. A ZIP file can lose the executable bit on the command file, `packages/cli/bin/stylebound.mjs`. A bundle holds only committed work, so commit first.

1. Commit your work.
2. In the repository folder, make the bundle:

   ```
   git bundle create stylebound.bundle --all
   ```

3. Copy `stylebound.bundle` to the other machine.
4. On the other machine, make the repository from the bundle:

   ```
   git clone stylebound.bundle stylebound
   ```

5. Go to the new `stylebound` folder. Then do the steps in [After a move or a copy](#after-a-move-or-a-copy).

For a Linux machine, follow [the Linux guide](docs/LINUX-GUIDE.md): section 2, option B, and then section 4.

Store only the bundle in a cloud folder, such as OneDrive, Google Drive, Dropbox or a similar service. Never keep the working repository in a cloud folder.

### On Linux or macOS: Make the command file executable

Linux and macOS run a file directly only when its executable bit is on. The command file `packages/cli/bin/stylebound.mjs` needs this bit to run as `./packages/cli/bin/stylebound.mjs`. Windows cannot set the bit, so Git records it for the file (mode `100755`). A clone keeps the bit. A ZIP file, a plain copy of the folder, or a new Git repository made on Windows can lose it.

People who install Stylebound with npm do not need these steps, and neither do people who run `node packages/cli/bin/stylebound.mjs`.

To check the bit and fix it, do these steps in the repository folder:

1. Show the permissions of the command file:

   ```
   ls -l packages/cli/bin/stylebound.mjs
   ```

   The permissions must include an `x`, for example `-rwxr-xr-x`. A "Permission denied" error when you run `./packages/cli/bin/stylebound.mjs` also means that the bit is missing.
2. If the `x` is missing, turn the bit on:

   ```
   chmod +x packages/cli/bin/stylebound.mjs
   ```

When you make a new Git repository on Windows, record the bit before the first commit. Then every clone gets it.

1. After `git add -A`, run this command:

   ```
   git update-index --chmod=+x packages/cli/bin/stylebound.mjs
   ```

2. Check the result:

   ```
   git ls-files -s packages/cli/bin/stylebound.mjs
   ```

   The output must start with `100755`.

### npm settings on each machine

You set up `npm login` and the npm `cafile` setting on each machine. npm keeps them in your user settings, not in the repository. They stay when you move the repository on the same machine. On another machine, set them up again.

The tests and the build need no network. If npm reports a certificate error when it connects to the registry, a proxy on your network probably signs connections with its own certificate. Ask your IT team for its root certificate. Then run `npm config set cafile <path to the root certificate>`.

## Layout

| Folder | Contents |
|---|---|
| `packages/core` | Core library: parser, rules, checker. Entry point `index.mjs`, API in `docs/API.md`. The starter glossary is `glossary/starter.csv`. |
| `packages/cli` | The command-line tool: `bin/stylebound.mjs`, with config and glossary loading in `src/`. |
| `skills/stylebound/` | The agent skill: how an AI coding agent runs the check, export, edit and verify loop. |
| `rules/` | `RULE-IDS.lock`, `dropped.json` and `budget.json`: every rule id, every approved removal, and the cap on default-on rules. |
| `regression/` | 84-paragraph lossless regression set (66 written for it, 18 from the trial), its edits and gate, and the sample file. |
| `trial/` | The field trial: six generated documents about a fictional product with an answer key (`docs/`), one agent edit that a test reads (`runs/`), the judgements of each finding, the trial log, and the precision gate. |
| `examples/` | One sample of each output file, made from `regression/sample.md`. |
| `scripts/` | Repository tools: the forbidden-content scan, the regression and precision runners, and the npm build (`build-npm.mjs`, `pack-check.mjs`). |
| `tests/` | Unit and end-to-end tests (`npm test`). |
| `.github/` | A CI workflow for Windows, Linux and macOS, and a pull request checklist. |
| `docs/` | `API.md` (core API), `VERIFY.md` (how the verifier works), `DOCX-LIMITS.md`, `PLATFORM-TESTS.md` (Linux and macOS test list), `LINUX-GUIDE.md` (test on Linux or macOS), `NPM-README.md` (the README inside the npm package), the JSON schemas, and `RULES-DROPPED.html`. |

At the top level: `AGENTS.md` (pointer for AI coding agents), `PRINCIPLES.md` and `LICENSE`. `.gitignore` lists the files that stay on your machine.

Principles: [PRINCIPLES.md](PRINCIPLES.md). Some comments and records name a chunk of work, for example "chunk 2.6". The chunks belong to the development plan, which is not part of this repository.

Stylebound is based on the principles of plain and controlled technical English.

## License

MIT (see `LICENSE`). The license covers the whole repository. This includes the `stylebound` command, the core library in `packages/core`, the rules, the trial documents (`trial/docs`) and the regression set (`regression/`). The core library has its own copy of the same license (`packages/core/LICENSE`).

You can reuse any part under the MIT terms, including the trial documents and the regression set as test data. Include the copyright notice and the license text in all copies or substantial parts. The trial documents and the regression set are not part of the npm package.
