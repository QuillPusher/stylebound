/*
 * Glossary: one term per concept (plan chunk 1.6). A glossary is a CSV file
 * with the columns term, preferred, pos and note. Each row is one of:
 *
 *   replacement  term and preferred differ: flag the term, suggest the preferred word
 *   name         pos is "name": the exact casing of a product or brand name
 *
 * Synonym groups ("check | verify") were dropped with the one-term-per-concept
 * rule after the precision gate in chunk 2.5.
 *
 * The starter glossary (glossary/starter.csv) is written for this project and
 * is under the core's MIT license. No DOM, no dependencies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StyleboundGlossary = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const COLUMNS = ['term', 'preferred', 'pos', 'note'];
  const POS = ['', 'noun', 'verb', 'adjective', 'adverb', 'phrase', 'name'];

  // One CSV record per line; fields may be quoted, and quotes inside are doubled.
  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false, line = 1, rowLine = 1;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else { field += ch; if (ch === '\n') line++; }
      } else if (ch === '"' && field === '') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push({ line: rowLine, cells: row });
        row = []; field = ''; line++; rowLine = line;
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push({ line: rowLine, cells: row }); }
    return rows.filter(r => r.cells.some(c => c.trim() !== ''));
  }

  /** Parses glossary CSV text into { entries, problems }; problems name the line. */
  function parseGlossary(text, label) {
    const where = label || 'glossary';
    const src = String(text || '');
    const rows = parseCsv(src.charCodeAt(0) === 0xfeff ? src.slice(1) : src);
    const problems = [];
    if (!rows.length) return { entries: [], problems: [where + ': the file is empty; the first line must be: ' + COLUMNS.join(',')] };
    const header = rows[0].cells.map(c => c.trim().toLowerCase());
    if (header.join(',') !== COLUMNS.join(',')) {
      return { entries: [], problems: [where + ': the first line must be: ' + COLUMNS.join(',')] };
    }
    const entries = [];
    const seen = {};
    for (const r of rows.slice(1)) {
      const at = where + ' line ' + r.line + ': ';
      if (r.cells.length !== COLUMNS.length) { problems.push(at + 'expected 4 fields (' + COLUMNS.join(', ') + '), found ' + r.cells.length + '.'); continue; }
      const e = { term: r.cells[0].trim(), preferred: r.cells[1].trim(), pos: r.cells[2].trim().toLowerCase(), note: r.cells[3].trim(), line: r.line };
      if (!e.term) { problems.push(at + 'term is empty.'); continue; }
      if (POS.indexOf(e.pos) < 0) { problems.push(at + 'pos must be one of ' + POS.filter(Boolean).join(', ') + ', or empty.'); continue; }
      if (e.term.indexOf('|') >= 0) { problems.push(at + 'synonym groups ("a | b") are not supported; write one row per term with its preferred word.'); continue; }
      e.kind = e.pos === 'name' ? 'name' : 'replacement';
      if (e.kind === 'replacement' && (!e.preferred || e.preferred.toLowerCase() === e.term.toLowerCase())) {
        problems.push(at + 'preferred must name a different word.');
        continue;
      }
      const key = e.term.toLowerCase();
      if (seen[key]) { problems.push(at + 'the term "' + e.term + '" is already on line ' + seen[key] + '.'); continue; }
      seen[key] = r.line;
      entries.push(e);
    }
    return { entries: entries, problems: problems };
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /**
   * Turns glossary entries into rule data: term-replace terms and names. Later
   * entries override earlier ones with the same term, so a project glossary
   * can override the starter.
   */
  function toRuleData(entries) {
    const byTerm = {};
    entries.forEach(e => { byTerm[e.term.toLowerCase()] = e; });
    const all = Object.keys(byTerm).map(k => byTerm[k]);
    return {
      terms: all.filter(e => e.kind === 'replacement').map(e => ({
        match: escapeRe(e.term).replace(/\s+/g, '\\s+'), replace: e.preferred, note: e.note || null
      })),
      names: all.filter(e => e.kind === 'name').map(e => e.term)
    };
  }

  return { parseGlossary: parseGlossary, toRuleData: toRuleData, COLUMNS: COLUMNS };
}));
