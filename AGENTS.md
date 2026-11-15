# Notes for AI coding agents

Read the README first, in particular its section for AI coding agents. It covers the setup, the tests, the check, export, edit and verify loop, and the actions that need approval.

In short:

- Stylebound needs Node.js 22 or later. It has no dependencies, so npm downloads nothing.
- Set it up with `npm install --offline`. Then run `npm test`. All 182 tests must pass.
- Check a file with `npx stylebound check <file> --profile strict-plain`. Exit code 1 means that the file has error findings.
- Outside the repository, install the command with `npm install -g stylebound@next`. Then run `stylebound` instead of `npx stylebound`.
- To fix a document, follow `skills/stylebound/SKILL.md`.
- Get approval before you publish to npm or push to a Git host.
- Don't commit. Leave your changes uncommitted for the maintainer, who commits them.
- Never add `Co-Authored-By`, "Generated with" or any other AI-attribution line to a commit, pull request or file, and don't set author or committer information.
