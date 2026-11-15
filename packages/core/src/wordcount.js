/*
 * Plain-English word counting for sentence-length limits. A code span, a
 * path, an option such as --profile, a number with its unit (5 MB, 30
 * seconds) and a hyphenated word each count as one word. Text in parentheses
 * counts as one word in the outer sentence. No DOM, no dependencies.
 *
 *   countWordsPlain(text)  -> number
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StyleboundWordcount = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MASK = String.fromCharCode(0xe000); // the engine's stand-in for code, URLs and tags
  const ONE = String.fromCharCode(0xe001);  // a span that counts as one word

  // Units of measure that join the number before them into one word.
  const UNITS = new Set([
    'b', 'kb', 'mb', 'gb', 'tb', 'kib', 'mib', 'gib', 'tib', 'byte', 'bytes', 'bit', 'bits',
    'kbps', 'mbps', 'gbps', 'hz', 'khz', 'mhz', 'ghz', 'px', 'pt', 'em', 'rem', 'dpi',
    'ms', 's', 'sec', 'secs', 'second', 'seconds', 'min', 'mins', 'minute', 'minutes',
    'h', 'hr', 'hrs', 'hour', 'hours', 'day', 'days', 'week', 'weeks', 'month', 'months', 'year', 'years',
    '%', 'percent', 'mm', 'cm', 'm', 'km', 'in', 'ft', 'kg', 'g', 'v', 'w', 'kw', 'degrees'
  ]);
  const NUMBER = /^[+-]?\d[\d,.]*%?$/;
  const PAREN = new RegExp('(^|[\\s"\'])\\([^()]*\\)', 'g');
  const CODE = /`[^`\n]*`/g;
  const MASKED = new RegExp(MASK + '+', 'g');
  const LEAD = new RegExp('^[^\\w%' + ONE + ']+');
  const TRAIL = new RegExp('[^\\w%' + ONE + ']+$');
  const COUNTS = new RegExp('[A-Za-z0-9' + ONE + ']');

  function strip(tok) {
    return tok.replace(LEAD, '').replace(TRAIL, '');
  }

  function countWordsPlain(text) {
    let s = String(text || '');
    // Parenthetical text (not "file(s)" or "run()"): one word.
    let prev;
    do { prev = s; s = s.replace(PAREN, '$1' + ONE); } while (s !== prev);
    // Code spans and masked spans: one word.
    s = s.replace(CODE, ' ' + ONE + ' ').replace(MASKED, ' ' + ONE + ' ');
    // Em and en dashes separate words; a hyphen inside a word does not.
    s = s.replace(/[–—]/g, ' ');
    const toks = s.split(/\s+/).map(strip).filter(t => COUNTS.test(t));
    let n = 0;
    for (let i = 0; i < toks.length; i++) {
      n++;
      if (NUMBER.test(toks[i]) && i + 1 < toks.length && UNITS.has(toks[i + 1].toLowerCase())) i++;
    }
    return n;
  }

  return { countWordsPlain: countWordsPlain, UNITS: UNITS };
}));
