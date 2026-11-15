/*
 * Verify summary (plan chunk 1.10): the counts a person needs after an edit,
 * as JSON and as terminal text. The HTML report (chunk 1.13) is the full view.
 */

/**
 * verified: the result of verify(); before: the review's findings; after: the
 * issues found by checking the edited document with the same profile.
 */
export function summarize(verified, before, after) {
  const count = status => verified.paragraphs.filter(p => p.status === status).length;
  const items = verified.paragraphs.flatMap(p => p.changed);
  const byRule = {};
  for (const f of before) (byRule[f.ruleId] = byRule[f.ruleId] || { before: 0, after: 0 }).before++;
  for (const f of after) (byRule[f.ruleId] = byRule[f.ruleId] || { before: 0, after: 0 }).after++;
  return {
    status: verified.status,
    exitCode: verified.status === 'ok' ? 0 : 1,
    hashMismatch: verified.hashMismatch,
    paragraphs: {
      checked: verified.paragraphs.length,
      unchanged: count('unchanged'),
      ok: count('ok'),
      missing: count('missing'),
      changed: count('changed'),
      changedExpected: count('changed-expected'),
      removed: count('removed'),
      added: verified.added.length
    },
    items: {
      missing: verified.paragraphs.reduce((n, p) => n + p.missing.length, 0),
      changed: items.filter(c => !c.expected).length,
      changedExpected: items.filter(c => c.expected).length
    },
    findings: { before: before.length, after: after.length, byRule }
  };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const lines = p => (p.lines[0] === p.lines[1] ? `line ${p.lines[0]}` : `lines ${p.lines[0]} to ${p.lines[1]}`);

/** The summary as plain terminal text. */
export function formatSummary(summary, verified, names = {}) {
  const s = summary;
  const out = [];
  out.push(`Verified ${names.edited || 'the edited document'} against ${names.review || 'the review'} (profile ${verified.profile}).`);
  if (s.hashMismatch) out.push('Warning: the hashes did not match; verified with --force.');
  const p = s.paragraphs;
  out.push(`Paragraphs: ${p.checked} checked, ${p.unchanged} unchanged, ${p.ok} changed with every item kept, ${p.missing} with missing items, ${p.changed} with changed modals, ${p.changedExpected} changed as a finding asked, ${p.removed} removed, ${p.added} new.`);
  out.push(`Must-keep items: ${s.items.missing} missing, ${s.items.changed} changed, ${s.items.changedExpected} changed as a finding asked.`);
  out.push(`Findings: ${s.findings.before} before the edit, ${s.findings.after} after.`);
  const problems = verified.paragraphs.filter(x => x.missing.length || x.changed.length);
  if (problems.length) {
    out.push('', 'Paragraphs to review:');
    for (const x of problems) {
      const parts = [
        ...x.missing.map(m => `missing ${m.kind.replace(/s$/, '')} "${m.item}"`),
        ...x.changed.map(c => `${c.expected ? 'changed as asked' : 'changed'} ${c.kind.replace(/s$/, '')} "${c.from}"${c.to.length ? ` to "${c.to.join('", "')}"` : ''}${c.ruleId ? ` (${c.ruleId})` : ''}`)
      ];
      out.push(`  ${x.id} (original ${lines(x)}): ${parts.join('; ')}`);
    }
  }
  const verdict = s.status === 'ok' ? 'OK: no must-keep item was lost.'
    : s.status === 'loss' ? `LOSS: ${plural(s.items.missing, 'must-keep item')} missing.`
      : `CHANGED: ${plural(s.items.changed, 'modal')} changed strength.`;
  out.push('', `${verdict} Exit code ${s.exitCode}.`);
  return out.join('\n');
}
