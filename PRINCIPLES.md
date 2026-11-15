# Stylebound: product ideology and long-term guidelines

Stylebound checks technical writing against a small set of plain-English rules, hands the fixes to any person or agent, and proves that no fact was lost. It stays small on purpose.

## Ideology

1. **Minimal first.** Build the smallest thing that proves the idea. The MVP is a command-line tool with one HTML report and an agent skill.
2. **Add only on evidence.** A feature or rule earns its place by a measured need, not by being possible.
3. **Deterministic, no AI inside.** The tool checks, exports and verifies. Any model runs outside it.
4. **Lossless before pretty.** A rewrite that loses a number, a condition or a "not" is a failure, however good it reads.
5. **Precision over coverage.** A rule that is often wrong gets every rule ignored. Fewer, surer rules win.
6. **Ours and open.** Our own code and our own wording, under an open licence. Nothing copied from ASD-STE100 or from other people's skills.

## Long-term development guidelines

### Rules

- **Add a rule only with tests.** Every rule ships with at least one example it flags and one it passes, in the self-test.
- **Keep default-on rules precise.** A strict-plain rule stays on by default only at 90% precision or higher on the trial answer key. Otherwise it becomes opt-in or is removed.
- **Delete rules with high false-positive rates.** Do it through review, never silently.
- **Review every removal.** No rule is removed or demoted without the owner's approval. Each removal is recorded in `rules/dropped.json` and shown in `docs/RULES-DROPPED.html`. A test fails if a rule disappears without a record.
- **Respect the rule budget.** A soft cap on default-on rules (150 to start, set by measurement) triggers a review. It is a prompt to prune, not a hard wall.

### Product and code

- **Keep one config file.** All settings live in `stylebound.config.json`. Never build a settings screen that duplicates it.
- **Keep zero runtime network code.** The tool makes no network calls. A test proves it.
- **Freeze the export format early.** The review export is a contract. Change it only with a version bump.
- **No plug-ins.** They are hard to maintain and add complexity. Extend the core directly or not at all.
- **Rules ship with releases.** There is no update channel.
- **Build fresh.** Other projects may be read for understanding. Nothing is copied.
- **Cross-platform by default.** CI runs on Windows, Linux and macOS. No hard-coded paths or line endings.

### Process

- **One chunk at a time.** A chunk closes only when every deliverable is tested and verified. The next one starts with the owner's approval.
- **Remove before adding.** When something new is proposed, first ask what it replaces.
- **Write it down.** Record decisions in the repository, not in memory: for example, every rule removal goes into `rules/dropped.json`.

Rules dropped so far, and why, are in `rules/dropped.json` and `docs/RULES-DROPPED.html`. Work planned beyond the MVP is in the owner's plan, which is not part of this repository.
