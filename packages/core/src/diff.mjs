/*
 * Word diff (plan chunk 1.10): the longest common subsequence of word,
 * space and punctuation tokens, as equal, delete and insert runs.
 */

const MAX_TOKENS = 3000; // above this, show the paragraph as replaced rather than diff it

/** Words, runs of spaces and single punctuation marks. Joining the tokens gives the text back. */
export function tokenize(text) {
  return String(text).match(/[A-Za-z0-9'’_-]+|\s+|[^A-Za-z0-9'’_\s-]/g) || [];
}

/**
 * Diffs two texts word by word. Returns runs [{ op: 'equal' | 'delete' | 'insert', text }];
 * joining the equal and delete runs gives `before`, the equal and insert runs give `after`.
 */
export function wordDiff(before, after) {
  const a = tokenize(before), b = tokenize(after);
  if (a.length * b.length > MAX_TOKENS * MAX_TOKENS / 4 || a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    return merge([{ op: 'delete', text: before }, { op: 'insert', text: after }]);
  }
  // lcs[i][j]: length of the LCS of a[i..] and b[j..].
  const n = a.length, m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const runs = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { runs.push({ op: 'equal', text: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) runs.push({ op: 'delete', text: a[i++] });
    else runs.push({ op: 'insert', text: b[j++] });
  }
  while (i < n) runs.push({ op: 'delete', text: a[i++] });
  while (j < m) runs.push({ op: 'insert', text: b[j++] });
  return merge(tidy(runs));
}

// A lone space kept as "equal" between two changes reads badly; fold it into them.
function tidy(runs) {
  const out = [];
  for (let k = 0; k < runs.length; k++) {
    const r = runs[k];
    const prev = runs[k - 1], next = runs[k + 1];
    if (r.op === 'equal' && /^\s+$/.test(r.text) && prev && next && prev.op !== 'equal' && next.op !== 'equal') {
      out.push({ op: 'delete', text: r.text }, { op: 'insert', text: r.text });
    } else out.push(r);
  }
  return out;
}

function merge(runs) {
  const out = [];
  for (const r of runs) {
    if (!r.text) continue;
    // Keep deletes before inserts within one change, so the diff reads "old, then new".
    const last = out[out.length - 1];
    if (last && last.op === r.op) last.text += r.text;
    else if (last && r.op === 'delete' && last.op === 'insert' && out[out.length - 2] && out[out.length - 2].op === 'delete') {
      out[out.length - 2].text += r.text;
    } else out.push({ ...r });
  }
  return out;
}

/** The two sides of a diff: { before, after }. */
export function sides(runs) {
  return {
    before: runs.filter(r => r.op !== 'insert').map(r => r.text).join(''),
    after: runs.filter(r => r.op !== 'delete').map(r => r.text).join('')
  };
}
