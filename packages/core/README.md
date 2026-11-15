# stylebound-core

The Stylebound core library: the parser, the rules and the checker, plus export and verify. The command-line tool in `packages/cli` uses it, and it ships in the npm package.

License: MIT (see `LICENSE`), the same as the rest of Stylebound.

- `index.mjs` is the entry point, and `index.d.mts` has its types. The API is in `docs/API.md` at the repository root.
- `src/engine.js` is the checker. It uses `src/context.js` and `src/wordcount.js`.
- `src/load-rules.js` loads the rule files in `src/rules/`.
- `glossary/starter.csv` is the starter glossary.

Every rule has examples that it must flag and examples that it must pass. Run the tests from the repository root:

```
npm test
```
