/*
 * Checker engine. No DOM access anywhere in this file. Stylebound loads it
 * under Node through index.mjs.
 *
 * Public API (module.exports):
 *   parse(text)                        -> parsed document (lines and blocks)
 *   compileRules(rules)                -> compiled rule set (cached per array)
 *   check(text, rules)                 -> { issues, words, ms, parsed }
 *   createChecker(text, rules)         -> { step(budgetMs), done, finish() } for chunked checking
 *   runSelfTest(rules)                 -> { ok, results, skipTests, timing }
 *   splitSentences(text)               -> [{ start, end }]
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./context.js'), require('./wordcount.js'));
  else root.StyleEngine = factory(root.StyleboundContext, root.StyleboundWordcount);
}(typeof self !== 'undefined' ? self : this, function (context, wordcount) {
  'use strict';

  var MASK = '\uE000'; // stands in for text that is never checked (code, URLs, tags)
  var SEVERITY_RANK = { error: 3, warning: 2, suggestion: 1 };
  var DEFAULT_SCOPE = ['paragraph', 'heading', 'list', 'cell', 'quote'];

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                        */
  /* ------------------------------------------------------------------ */

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function isWordChar(c) { return /[A-Za-z0-9_]/.test(c); }
  function fill(str, start, end, ch) {
    if (end <= start) return str;
    return str.slice(0, start) + new Array(end - start + 1).join(ch) + str.slice(end);
  }
  function countWords(s) {
    var m = s.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g);
    return m ? m.length : 0;
  }
  function matchSpan(m) {
    // A pattern may put the reported span in group 1 (needed where the pattern
    // consumes a context character in front, because lookbehind is avoided).
    if (m.length > 1 && typeof m[1] === 'string') {
      if (m.indices && m.indices[1]) return { start: m.indices[1][0], end: m.indices[1][1] };
      var rel = m[0].lastIndexOf(m[1]);
      if (rel < 0) rel = 0;
      return { start: m.index + rel, end: m.index + rel + m[1].length };
    }
    return { start: m.index, end: m.index + m[0].length };
  }
  function makeRegex(source, flags) {
    var f = flags;
    try { return new RegExp(source, f + 'd'); } catch (e) { return new RegExp(source, f); }
  }

  /* ------------------------------------------------------------------ */
  /* Parsing                                                              */
  /* ------------------------------------------------------------------ */

  var RE_FENCE = /^(\s{0,3})(`{3,}|~{3,})(.*)$/;
  var RE_HEADING = /^(\s{0,3})(#{1,6})(\s+|$)/;
  var RE_LIST = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)/;
  var RE_HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
  var RE_SETEXT_1 = /^\s{0,3}=+\s*$/;
  var RE_SETEXT_2 = /^\s{0,3}-+\s*$/;
  var RE_TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;
  var RE_QUOTE = /^(\s{0,3}>\s?)/;
  var RE_LINK_DEF = /^\s{0,3}\[[^\]]+\]:\s*\S+/;
  var RE_OFF = /<!--\s*style-check\s+off\s*-->/i;
  var RE_ON = /<!--\s*style-check\s+on\s*-->/i;

  // Inline pieces that are never checked, or that are syntax rather than prose.
  var RE_INLINE = new RegExp([
    '(`+)[^`]*?\\1',                                  // 1 code span
    '<!--[\\s\\S]*?-->',                              // 2 html comment on one line
    '!\\[([^\\]]*)\\]\\(([^)]*)\\)',                  // 3 image (alt, path)
    '\\[([^\\]]*)\\]\\(([^)]*)\\)',                   // 4 link (text, url)
    '\\[([^\\]]*)\\]\\[[^\\]]*\\]',                   // 5 reference link (text)
    '<\\/?[A-Za-z][^<>]*>',                           // 6 html tag or autolink
    '\\bhttps?:\\/\\/[^\\s<>()\\]"\']+',              // 7 bare url
    '\\bwww\\.[^\\s<>()\\]"\']+',                     // 8 bare www url
    '&#?[A-Za-z0-9]+;',                               // 9 html entity
    '\\{[A-Za-z_][A-Za-z0-9_.-]*\\}'                 // 10 placeholder such as {filename}
  ].join('|'), 'g');

  function newLine(text, offset) {
    return {
      text: text, offset: offset, kind: 'paragraph', level: 0, checked: true,
      prose: null, syntax: [], unchecked: [], images: [], links: [], cells: null,
      ordered: false, quote: false, listId: 0, contentStart: 0
    };
  }

  // Produces the masked prose string for one line plus the ranges used for rendering.
  function maskInline(line, from) {
    var text = line.text;
    var prose = text, rawm = text;
    var syntax = line.syntax, unchecked = line.unchecked;
    function mark(s, e, kind) {
      if (e <= s) return;
      prose = fill(prose, s, e, kind === 'syntax' ? ' ' : MASK);
      if (kind !== 'syntax') rawm = fill(rawm, s, e, MASK);
      (kind === 'syntax' ? syntax : unchecked).push([s, e]);
    }
    if (from > 0) mark(0, from, 'syntax');
    var re = new RegExp(RE_INLINE.source, 'g');
    re.lastIndex = from;
    var m;
    while ((m = re.exec(text))) {
      if (m.index < from) { re.lastIndex = from; continue; }
      var s = m.index, e = s + m[0].length;
      if (m[0] === '') { re.lastIndex++; continue; }
      if (m[2] !== undefined && m[0].charAt(0) === '!') {
        // image: ![alt](path)
        var altStart = s + 2, altEnd = altStart + m[2].length;
        mark(s, altStart, 'syntax');
        mark(altEnd, e, 'unchecked');
        line.images.push({ altStart: altStart, altEnd: altEnd, start: s, end: e, path: m[3] });
      } else if (m[4] !== undefined) {
        // link: [text](url)
        var tStart = s + 1, tEnd = tStart + m[4].length;
        mark(s, tStart, 'syntax');
        mark(tEnd, tEnd + 2, 'syntax');
        mark(tEnd + 2, e - 1, 'unchecked');
        mark(e - 1, e, 'syntax');
        line.links.push({ start: tStart, end: tEnd, url: m[5].trim().split(/\s+/)[0] });
      } else if (m[6] !== undefined) {
        var rStart = s + 1, rEnd = rStart + m[6].length;
        mark(s, rStart, 'syntax');
        mark(rEnd, e, 'syntax');
      } else {
        mark(s, e, 'unchecked');
      }
    }
    // Emphasis and escape characters are syntax, not prose.
    for (var i = from; i < text.length; i++) {
      var c = text.charAt(i);
      if (prose.charAt(i) !== c) continue;
      if (c === '*' || c === '~') { mark(i, i + 1, 'syntax'); continue; }
      if (c === '\\' && i + 1 < text.length && /[\\`*_{}\[\]()#+\-.!|>~]/.test(text.charAt(i + 1))) { mark(i, i + 1, 'syntax'); continue; }
      if (c === '_') {
        var prev = i > 0 ? text.charAt(i - 1) : ' ', next = i + 1 < text.length ? text.charAt(i + 1) : ' ';
        if (!isWordChar(prev) || !isWordChar(next)) mark(i, i + 1, 'syntax');
      }
    }
    line.prose = prose;
    line.rawm = rawm;
  }

  function classifyLine(line, rest, offset, ctx) {
    // `rest` is the line text after any blockquote prefix; `offset` is where it starts.
    var m;
    if ((m = RE_HEADING.exec(rest))) {
      line.kind = 'heading';
      line.level = m[2].length;
      line.contentStart = offset + m[0].length;
      // trailing #s are syntax
      var trail = /\s+#+\s*$/.exec(rest);
      if (trail && trail.index + offset > line.contentStart) line.syntax.push([offset + trail.index, line.text.length]);
      return;
    }
    if ((m = RE_LIST.exec(rest))) {
      line.kind = 'list';
      line.ordered = /\d/.test(m[2]);
      line.indent = m[1].length;
      line.contentStart = offset + m[0].length;
      // task list checkbox
      var task = /^\[[ xX]\]\s+/.exec(rest.slice(m[0].length));
      if (task) { line.syntax.push([line.contentStart, line.contentStart + task[0].length]); line.contentStart += task[0].length; }
      return;
    }
    if (RE_HR.test(rest)) { line.kind = 'hr'; line.checked = false; return; }
    if (RE_LINK_DEF.test(rest)) { line.kind = 'linkdef'; line.checked = false; return; }
    if (rest.indexOf('|') >= 0 && ctx.nextRest !== null && RE_TABLE_SEP.test(ctx.nextRest) && rest.trim() !== '') {
      line.kind = 'table'; line.header = true; line.contentStart = offset; return;
    }
    if (ctx.inTable && RE_TABLE_SEP.test(rest)) { line.kind = 'table-sep'; line.checked = false; return; }
    if (ctx.inTable && rest.indexOf('|') >= 0) { line.kind = 'table'; line.contentStart = offset; return; }
    line.kind = 'paragraph';
    line.contentStart = offset;
  }

  function parse(text) {
    var raw = text.split('\n');
    var lines = [];
    var offset = 0;
    var i, j;
    for (i = 0; i < raw.length; i++) {
      var t = raw[i].replace(/\r$/, '');
      lines.push(newLine(t, offset));
      offset += raw[i].length + 1;
    }

    var state = { fence: null, fenceIndent: 0, front: false, comment: false, script: false, off: false, inTable: false, lastKind: 'blank', inList: false, listId: 0 };
    var prevNonBlankIdx = -1;

    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      var text0 = line.text;
      var m;

      // YAML front matter at the very top
      if (i === 0 && /^---\s*$/.test(text0)) { state.front = true; line.kind = 'front'; line.checked = false; continue; }
      if (state.front) {
        line.kind = 'front'; line.checked = false;
        if (/^(---|\.\.\.)\s*$/.test(text0)) state.front = false;
        continue;
      }
      // Fenced code
      if (state.fence) {
        line.kind = 'code'; line.checked = false;
        var close = RE_FENCE.exec(text0);
        if (close && close[2].charAt(0) === state.fence.charAt(0) && close[2].length >= state.fence.length && close[3].trim() === '') state.fence = null;
        continue;
      }
      if ((m = RE_FENCE.exec(text0))) {
        state.fence = m[2]; line.kind = 'code'; line.checked = false; state.inTable = false; state.lastKind = 'code';
        continue;
      }
      // Multi-line html comment / script / style
      if (state.comment) {
        line.kind = 'comment'; line.checked = false;
        if (text0.indexOf('-->') >= 0) {
          state.comment = false;
          if (RE_OFF.test(text0)) state.off = true;
          if (RE_ON.test(text0)) state.off = false;
        }
        continue;
      }
      if (state.script) {
        line.kind = 'html'; line.checked = false;
        if (/<\/(script|style)>/i.test(text0)) state.script = false;
        continue;
      }
      if (/^\s*<!--/.test(text0) && text0.indexOf('-->') < 0) { state.comment = true; line.kind = 'comment'; line.checked = false; continue; }
      if (/^\s*<(script|style)\b/i.test(text0) && !/<\/(script|style)>/i.test(text0)) { state.script = true; line.kind = 'html'; line.checked = false; continue; }
      if (/^\s*<!--[\s\S]*-->\s*$/.test(text0)) {
        line.kind = 'comment'; line.checked = false;
        if (RE_OFF.test(text0)) state.off = true;
        if (RE_ON.test(text0)) state.off = false;
        continue;
      }
      if (RE_OFF.test(text0)) state.off = true;

      // Blank line
      if (text0.trim() === '') {
        line.kind = 'blank'; line.checked = false; state.inTable = false; state.lastKind = 'blank';
        continue;
      }

      // Indented code: 4+ spaces or a tab after a blank line, outside a list.
      if (/^( {4,}|\t)/.test(text0) && !state.inList && (state.lastKind === 'blank' || state.lastKind === 'icode')) {
        line.kind = 'code'; line.checked = false; state.lastKind = 'icode';
        continue;
      }
      if (state.lastKind === 'icode' && /^( {4,}|\t)/.test(text0)) { line.kind = 'code'; line.checked = false; continue; }

      // Setext heading underline
      if (state.lastKind === 'paragraph' && prevNonBlankIdx >= 0 && lines[prevNonBlankIdx].kind === 'paragraph' && !lines[prevNonBlankIdx].quote &&
          (RE_SETEXT_1.test(text0) || RE_SETEXT_2.test(text0))) {
        lines[prevNonBlankIdx].kind = 'heading';
        lines[prevNonBlankIdx].level = RE_SETEXT_1.test(text0) ? 1 : 2;
        line.kind = 'setext'; line.checked = false; state.lastKind = 'heading';
        continue;
      }

      // Blockquote prefix
      var rest = text0, restOffset = 0;
      var q = RE_QUOTE.exec(text0);
      if (q) {
        line.quote = true;
        rest = text0.slice(q[0].length); restOffset = q[0].length;
        // nested quotes
        var q2;
        while ((q2 = RE_QUOTE.exec(rest))) { rest = rest.slice(q2[0].length); restOffset += q2[0].length; }
        line.syntax.push([0, restOffset]);
        if (rest.trim() === '') { line.kind = 'blank'; line.checked = false; state.lastKind = 'blank'; state.inTable = false; continue; }
      }

      // Look ahead one line for table detection (strip the same quote prefix)
      var nextRest = null;
      if (i + 1 < lines.length) {
        var nt = lines[i + 1].text;
        if (q) { var nq = RE_QUOTE.exec(nt); nextRest = nq ? nt.slice(nq[0].length) : null; }
        else nextRest = nt;
      }

      classifyLine(line, rest, restOffset, { nextRest: nextRest, inTable: state.inTable });

      if (line.kind === 'table') state.inTable = true;
      else if (line.kind !== 'table-sep') state.inTable = false;

      if (line.kind === 'list') {
        var continues = state.lastKind === 'list' || state.lastKind === 'list-cont' ||
          (state.lastKind === 'blank' && state.inList && state.prevListOrdered === line.ordered);
        line.listId = continues ? state.prevListId : (state.listCounter = (state.listCounter || 0) + 1);
        state.prevListId = line.listId; state.prevListOrdered = line.ordered; state.inList = true;
      } else if (line.kind === 'paragraph' && state.inList && (state.lastKind === 'list' || state.lastKind === 'list-cont' || /^\s{2,}/.test(text0))) {
        line.kind = 'list-cont'; line.listId = state.prevListId; line.ordered = state.prevListOrdered;
      } else {
        state.inList = false; state.prevListId = 0;
      }

      state.lastKind = line.kind;
      prevNonBlankIdx = i;

      if (state.off) line.checked = false;
      if (RE_ON.test(text0)) state.off = false;
    }

    // Inline masking for prose lines
    for (i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (ln.kind === 'paragraph' || ln.kind === 'heading' || ln.kind === 'list' || ln.kind === 'list-cont' || ln.kind === 'table') {
        maskInline(ln, ln.contentStart);
        if (ln.kind === 'table') splitCells(ln);
      } else {
        ln.prose = fill(ln.text, 0, ln.text.length, MASK);
      }
    }

    return { text: text, lines: lines, blocks: buildBlocks(lines) };
  }

  function splitCells(line) {
    var text = line.text, cells = [];
    var start = line.contentStart;
    // skip leading pipe
    var k = start;
    while (k < text.length && text.charAt(k) === ' ') k++;
    if (text.charAt(k) === '|') { line.syntax.push([k, k + 1]); line.prose = fill(line.prose, k, k + 1, ' '); start = k + 1; }
    var cellStart = start;
    for (var i = start; i <= text.length; i++) {
      var c = i < text.length ? text.charAt(i) : '|';
      if (c === '|' && (i === 0 || text.charAt(i - 1) !== '\\') && line.prose.charAt(i) === c || i === text.length) {
        if (i < text.length) { line.syntax.push([i, i + 1]); line.prose = fill(line.prose, i, i + 1, ' '); }
        // trim
        var s = cellStart, e = i;
        while (s < e && /\s/.test(text.charAt(s))) s++;
        while (e > s && /\s/.test(text.charAt(e - 1))) e--;
        if (!(i === text.length && cellStart >= text.length)) cells.push({ start: s, end: e, raw: [cellStart, i] });
        cellStart = i + 1;
      }
    }
    // A trailing empty cell after the closing pipe is not a cell.
    if (cells.length && cells[cells.length - 1].raw[0] >= text.replace(/\s+$/, '').length) cells.pop();
    line.cells = cells;
  }

  function buildBlocks(lines) {
    var blocks = [];
    var i, cur = null;
    function push(b) { if (b) { finalize(b); blocks.push(b); } }
    function finalize(b) {
      var parts = [], rawParts = [], starts = [], pos = 0;
      for (var k = 0; k < b.lineIdx.length; k++) {
        var ln = lines[b.lineIdx[k]];
        var seg = b.ranges ? b.ranges[k] : [ln.contentStart, ln.text.length];
        var piece = ln.prose.slice(seg[0], seg[1]);
        starts.push({ pos: pos, line: b.lineIdx[k], col: seg[0] });
        parts.push(piece);
        rawParts.push((ln.rawm || ln.prose).slice(seg[0], seg[1]));
        pos += piece.length + 1;
      }
      b.text = parts.join('\n');
      b.raw = rawParts.join('\n'); // Markdown syntax kept, unchecked text masked
      b.starts = starts;
      b.checked = b.lineIdx.every(function (ix) { return lines[ix].checked; });
    }
    function start(kind, idx, extra) {
      var b = { kind: kind, lineIdx: [idx], lines: [idx], ranges: null };
      if (extra) for (var k in extra) b[k] = extra[k];
      return b;
    }
    for (i = 0; i < lines.length; i++) {
      var ln = lines[i];
      switch (ln.kind) {
        case 'paragraph':
          if (cur && cur.kind === 'paragraph' && cur.quote === ln.quote) { cur.lineIdx.push(i); cur.lines.push(i); }
          else { push(cur); cur = start(ln.quote ? 'quote' : 'paragraph', i, { quote: ln.quote }); }
          break;
        case 'heading':
          push(cur); cur = null;
          push(start('heading', i, { level: ln.level }));
          break;
        case 'list':
          push(cur);
          cur = start('list', i, { ordered: ln.ordered, listId: ln.listId, quote: ln.quote });
          break;
        case 'list-cont':
          if (cur && cur.kind === 'list') { cur.lineIdx.push(i); cur.lines.push(i); }
          else { push(cur); cur = start('paragraph', i, {}); }
          break;
        case 'table':
          push(cur); cur = null;
          if (ln.cells) {
            for (var c = 0; c < ln.cells.length; c++) {
              var cell = ln.cells[c];
              var cb = start('cell', i, { header: !!ln.header, col: c, cellRaw: cell.raw });
              cb.ranges = [[cell.start, cell.end]];
              push(cb);
            }
          }
          break;
        case 'blank':
          if (cur && cur.kind === 'list') { /* a list item may continue after a blank line */ }
          else { push(cur); cur = null; }
          break;
        default:
          push(cur); cur = null;
      }
      if (ln.kind === 'blank' && cur && cur.kind === 'list') {
        // keep cur only if the next non-blank line continues the same item
        var nx = i + 1;
        while (nx < lines.length && lines[nx].kind === 'blank') nx++;
        if (!(nx < lines.length && lines[nx].kind === 'list-cont')) { push(cur); cur = null; }
      }
      // image alt blocks
      for (var im = 0; im < ln.images.length; im++) {
        var img = ln.images[im];
        var ab = { kind: 'image-alt', lineIdx: [i], lines: [i], ranges: [[img.altStart, img.altEnd]], image: img };
        push(ab);
      }
    }
    push(cur);
    return blocks;
  }

  /* ------------------------------------------------------------------ */
  /* Sentences                                                            */
  /* ------------------------------------------------------------------ */

  var RE_ABBREV = /(?:\b(?:e\.g|i\.e|etc|vs|No|no|Mr|Mrs|Ms|Dr|St|Inc|Ltd|Co|Jr|Sr|approx|fig|Fig|v|ver|a\.m|p\.m|U\.S|U\.K)|\b[A-Z])\.$/;

  function splitSentences(text) {
    var out = [], start = 0, i = 0, n = text.length;
    while (i < n) {
      var c = text.charAt(i);
      if (c === '.' || c === '!' || c === '?') {
        var j = i + 1;
        while (j < n && /[.!?"')\]]/.test(text.charAt(j))) j++;
        var after = text.slice(j, j + 3);
        var before = text.slice(Math.max(start, i - 8), i + 1);
        var boundary = (j >= n) || (/^\s/.test(after) && (j + 1 >= n || /^\s+(?:[A-Z0-9"'(\[*_]|\uE000)/.test(text.slice(j, j + 4)) || /^\s*\n/.test(after)));
        if (boundary && c === '.' && RE_ABBREV.test(before) && !/^\s*\n/.test(after)) boundary = false;
        if (boundary) { out.push({ start: start, end: j }); i = j; while (i < n && /\s/.test(text.charAt(i))) i++; start = i; continue; }
        i = j; continue;
      }
      if (c === '\n' && /^\s*\n/.test(text.slice(i))) { /* paragraph break inside block: unlikely */ }
      i++;
    }
    if (start < n && text.slice(start).trim() !== '') out.push({ start: start, end: n });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Rule compilation                                                     */
  /* ------------------------------------------------------------------ */

  var compiledCache = null;

  function termRegex(terms, caseSensitive) {
    var alts = terms.map(function (t) { return t.match; }).join('|');
    return makeRegex('(?:^|[^A-Za-z0-9_])(' + alts + ')(?![A-Za-z0-9_])', caseSensitive ? 'g' : 'gi');
  }

  // A term as a regex source. With inflect, a one-word term also matches its
  // -s, -ed and -ing forms: "delete" matches deletes, deleted, deleting.
  function inflected(t, inflect) {
    var src = escapeRe(t).replace(/\\ /g, '\\s+');
    if (!inflect || /\s/.test(t)) return src + 's?';
    if (/e$/.test(t)) return src.slice(0, -1) + '(?:e|es|ed|ing)';
    return src + '(?:s|es|ed|ing)?';
  }

  function compileRules(rules) {
    if (compiledCache && compiledCache.source === rules) return compiledCache.compiled;
    var compiled = rules.map(function (rule) {
      var c = { rule: rule, id: rule.id, severity: rule.severity, type: rule.type, scope: rule.scope || DEFAULT_SCOPE, regexes: [], terms: null, exceptions: [] };
      var flags = rule.caseSensitive ? 'g' : 'gi';
      if (rule.type === 'pattern') {
        c.regexes = (rule.patterns || []).map(function (p) { return makeRegex(p, flags + (p.indexOf('^') === 0 || p.indexOf('$') >= 0 || p.indexOf('(?:^') === 0 ? 'm' : '')); });
      } else if (rule.type === 'term-replace' || rule.type === 'term-ban') {
        c.terms = (rule.terms || []).map(function (t) {
          return { re: makeRegex('(?:^|[^A-Za-z0-9_])(' + t.match + ')(?![A-Za-z0-9_])', flags), replace: t.replace, note: t.note || null };
        });
        c.regexes = [termRegex(rule.terms || [], rule.caseSensitive)];
      } else if (rule.type === 'case-exact') {
        c.terms = (rule.terms || []).map(function (t) {
          return { re: makeRegex('(?:^|[^A-Za-z0-9_])(' + escapeRe(t.canonical) + ')(?![A-Za-z0-9_])', 'gi'), canonical: t.canonical };
        });
      } else if (rule.type === 'alternating-terms') {
        var termRe = function (t) {
          return { re: makeRegex('(?:^|[^A-Za-z0-9_])(' + inflected(t, rule.inflect) + ')(?![A-Za-z0-9_])', 'gi'), term: t };
        };
        c.terms = (rule.terms || []).map(termRe);
        c.groups = rule.groups ? rule.groups.map(function (g) { return g.map(termRe); }) : [c.terms];
      }
      if (rule.type === 'heading-case' && rule.names) {
        // Words of product names, brands and glossary names keep their capitals in headings.
        c.names = {};
        rule.names.forEach(function (n) { n.split(/\s+/).forEach(function (w) { c.names[w] = true; }); });
      }
      c.exceptions = (rule.exceptions || []).map(function (x) {
        var src = escapeRe(x).replace(/\\ /g, '\\s+');
        var lead = /^[A-Za-z0-9_]/.test(x) ? '(?:^|[^A-Za-z0-9_])' : '';
        var trail = /[A-Za-z0-9_]$/.test(x) ? '(?![A-Za-z0-9_])' : '';
        return makeRegex(lead + '(' + src + ')' + trail, 'gi');
      });
      return c;
    });
    compiledCache = { source: rules, compiled: compiled };
    return compiled;
  }

  /* ------------------------------------------------------------------ */
  /* Checking                                                             */
  /* ------------------------------------------------------------------ */

  function createChecker(text, rules) {
    var compiled = compileRules(rules);
    var parsed = parse(text);
    var blocks = parsed.blocks;
    var issues = [];
    var seq = 0;
    var cursor = 0;
    var t0 = now();

    var ctx = { parsed: parsed, issues: issues, compiled: compiled, exceptionCache: {} };

    function emit(c, block, start, end, extra) {
      if (end <= start) end = start + 1;
      var loc = locate(block, start), locEnd = locate(block, end);
      var ln = parsed.lines[loc.line];
      var docStart = ln.offset + loc.col;
      var lnEnd = parsed.lines[locEnd.line];
      var docEnd = lnEnd.offset + locEnd.col;
      var found = text.slice(docStart, docEnd);
      var issue = {
        id: ++seq, ruleId: c.id, rule: c.rule, severity: c.severity, heuristic: !!c.rule.heuristic,
        line: loc.line + 1, col: loc.col + 1, endLine: locEnd.line + 1, endCol: locEnd.col + 1,
        start: docStart, end: docEnd, text: found, replacement: null, blockKind: block.kind
      };
      if (extra) for (var k in extra) issue[k] = extra[k];
      issues.push(issue);
      return issue;
    }

    function step(budgetMs) {
      var deadline = now() + (budgetMs || 1e9);
      while (cursor < blocks.length) {
        var b = blocks[cursor++];
        if (b.checked && b.text.trim() !== '') checkBlock(b, compiled, ctx, emit);
        if (now() > deadline) break;
      }
      return cursor >= blocks.length;
    }

    function finish() {
      while (!step()) { /* drain */ }
      documentChecks(parsed, compiled, ctx, emit);
      issues.sort(function (a, b) { return a.start - b.start || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.id - b.id; });
      var words = 0;
      for (var i = 0; i < parsed.lines.length; i++) {
        var ln = parsed.lines[i];
        if (ln.kind === 'code' || ln.kind === 'front' || ln.kind === 'comment' || ln.kind === 'html') continue;
        words += countWords(ln.prose.replace(/\uE000+/g, ' '));
      }
      return { issues: issues, words: words, ms: now() - t0, parsed: parsed, rulesChecked: compiled.length };
    }

    return { step: step, finish: finish, get done() { return cursor >= blocks.length; }, total: blocks.length, get cursor() { return cursor; } };
  }

  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  function locate(block, pos) {
    var starts = block.starts, k = 0;
    for (var i = 0; i < starts.length; i++) { if (starts[i].pos <= pos) k = i; else break; }
    return { line: starts[k].line, col: starts[k].col + (pos - starts[k].pos) };
  }

  function inScope(c, block) {
    var kind = block.kind;
    if (kind === 'image-alt') return c.scope.indexOf('image-alt') >= 0;
    if (c.scope.indexOf(kind) >= 0) return true;
    if (kind === 'list' && block.ordered && c.scope.indexOf('step') >= 0) return true;
    return false;
  }

  function exceptionRanges(c, block, ctx) {
    if (!c.exceptions.length) return null;
    var key = c.id + ':' + block.lineIdx[0] + ':' + (block.col || 0) + ':' + block.kind;
    if (ctx.exceptionCache[key]) return ctx.exceptionCache[key];
    var ranges = [];
    for (var i = 0; i < c.exceptions.length; i++) {
      var re = c.exceptions[i]; re.lastIndex = 0; var m;
      while ((m = re.exec(block.text))) { var sp = matchSpan(m); ranges.push(sp); if (m[0] === '') re.lastIndex++; }
    }
    ctx.exceptionCache[key] = ranges;
    return ranges;
  }
  function excepted(ranges, s, e) {
    if (!ranges) return false;
    for (var i = 0; i < ranges.length; i++) if (s < ranges[i].end && e > ranges[i].start) return true;
    return false;
  }
  function overlapsMask(block, s, e) {
    return block.text.slice(s, e).indexOf(MASK) >= 0;
  }

  function checkBlock(block, compiled, ctx, emit) {
    for (var r = 0; r < compiled.length; r++) {
      var c = compiled[r];
      if (!inScope(c, block)) continue;
      switch (c.type) {
        case 'pattern': runPatterns(c, block, ctx, emit); break;
        case 'term-replace': case 'term-ban': runTerms(c, block, ctx, emit); break;
        case 'case-exact': runCaseExact(c, block, ctx, emit); break;
        case 'repeated-word': runRepeated(c, block, ctx, emit); break;
        case 'sentence-length': runSentenceLength(c, block, ctx, emit); break;
        case 'paragraph-length': runParagraphLength(c, block, ctx, emit); break;
        case 'sentence-start-numeral': runSentenceStartNumeral(c, block, ctx, emit); break;
        case 'numerals-in-prose': runNumerals(c, block, ctx, emit); break;
        case 'heading-case': runHeadingCase(c, block, ctx, emit); break;
        case 'sentence-length-context': runSentenceLengthContext(c, block, ctx, emit); break;
        case 'paragraph-sentences': runParagraphSentences(c, block, ctx, emit); break;
        case 'one-instruction': runOneInstruction(c, block, ctx, emit); break;
        case 'condition-first': runConditionFirst(c, block, ctx, emit); break;
        default: break; // document-level types are handled in documentChecks
      }
    }
  }

  function runPatterns(c, block, ctx, emit) {
    var exc = exceptionRanges(c, block, ctx);
    // A rule with "context": "procedure" only matches inside instructions.
    var only = c.rule.context === 'procedure' ? procedureSpans(block) : null;
    if (only && !only.length) return;
    for (var i = 0; i < c.regexes.length; i++) {
      var re = c.regexes[i]; re.lastIndex = 0; var m, guard = 0;
      var subject = c.rule.matchRaw ? block.raw : block.text;
      while ((m = re.exec(subject)) && guard++ < 5000) {
        if (m[0] === '') { re.lastIndex++; continue; }
        var sp = matchSpan(m);
        if (excepted(exc, sp.start, sp.end) || overlapsMask(block, sp.start, sp.end)) continue;
        if (only && !excepted(only, sp.start, sp.start + 1)) continue;
        if (c.rule.mainClause && inSubordinateClause(block, sp.start)) continue;
        emit(c, block, sp.start, sp.end, { replacement: c.rule.replacement || null });
      }
    }
  }

  function applyCase(found, replacement) {
    if (!replacement) return replacement;
    if (found === found.toUpperCase() && found.length > 1 && /[A-Z]/.test(found)) return replacement;
    if (/^[A-Z]/.test(found) && /^[a-z]/.test(replacement)) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    return replacement;
  }

  function runTerms(c, block, ctx, emit) {
    var exc = exceptionRanges(c, block, ctx);
    for (var i = 0; i < c.terms.length; i++) {
      var t = c.terms[i]; var re = t.re; re.lastIndex = 0; var m, guard = 0;
      while ((m = re.exec(block.text)) && guard++ < 5000) {
        if (m[0] === '') { re.lastIndex++; continue; }
        var sp = matchSpan(m);
        if (excepted(exc, sp.start, sp.end) || overlapsMask(block, sp.start, sp.end)) continue;
        var found = block.text.slice(sp.start, sp.end);
        var extra = { replacement: c.type === 'term-replace' ? applyCase(found, t.replace) : '' };
        if (t.note) extra.detail = t.note;
        emit(c, block, sp.start, sp.end, extra);
      }
    }
  }

  function atSentenceStart(block, pos) {
    var before = block.text.slice(0, pos).replace(/[\s\uE000]+$/, '');
    if (before === '') return true;
    return /[.!?:\n]["')\]]*$/.test(before) || /\n\s*$/.test(block.text.slice(0, pos));
  }

  function runCaseExact(c, block, ctx, emit) {
    var exc = exceptionRanges(c, block, ctx);
    for (var i = 0; i < c.terms.length; i++) {
      var t = c.terms[i]; var re = t.re; re.lastIndex = 0; var m, guard = 0;
      while ((m = re.exec(block.text)) && guard++ < 5000) {
        if (m[0] === '') { re.lastIndex++; continue; }
        var sp = matchSpan(m);
        var found = block.text.slice(sp.start, sp.end);
        if (found === t.canonical) continue;
        if (excepted(exc, sp.start, sp.end) || overlapsMask(block, sp.start, sp.end)) continue;
        if (sp.start > 0 && block.text.charAt(sp.start - 1) === '.') continue; // file extension
        if (c.rule.allowSentenceStart) {
          var capFirst = t.canonical.charAt(0).toUpperCase() + t.canonical.slice(1);
          if (found === capFirst && (atSentenceStart(block, sp.start) || block.kind === 'heading' || block.kind === 'cell')) continue;
        }
        emit(c, block, sp.start, sp.end, { replacement: t.canonical });
      }
    }
  }

  var RE_REPEAT = /\b([A-Za-z]+)\s+\1\b/gi;
  function runRepeated(c, block, ctx, emit) {
    var exc = exceptionRanges(c, block, ctx);
    var re = new RegExp(RE_REPEAT.source, 'gi'); var m;
    while ((m = re.exec(block.text))) {
      if (m[1].length < 2 && !/^[ai]$/i.test(m[1])) continue;
      var s = m.index, e = s + m[0].length;
      if (excepted(exc, s, e) || overlapsMask(block, s, e)) continue;
      // Avoid "the the" across a line break that starts a new sentence or marker.
      if (/\n/.test(m[0]) && /^[A-Z]/.test(m[0].split(/\s+/)[1])) continue;
      // "and _and so on_": the second word is a quoted or emphasized term, not a slip.
      if (block.raw && /[*_`"]/.test(block.raw.slice(s, e))) continue;
      emit(c, block, s, e, { replacement: m[1] });
    }
  }

  function runSentenceLength(c, block, ctx, emit) {
    var max = c.rule.maxWords || 30;
    var sents = splitSentences(block.text);
    for (var i = 0; i < sents.length; i++) {
      var s = sents[i];
      var words = countWords(block.text.slice(s.start, s.end).replace(/\uE000+/g, ' '));
      if (words > max) emit(c, block, s.start, s.end, { detail: words + ' words' });
    }
  }

  function runParagraphLength(c, block, ctx, emit) {
    var max = c.rule.maxWords || 150;
    var words = countWords(block.text.replace(/\uE000+/g, ' '));
    if (words > max) emit(c, block, 0, block.text.length, { detail: words + ' words' });
  }

  /* ------------------------------------------------------------------ */
  /* Strict-plain overlay (rules/06-strict-plain-*.json)                  */
  /* ------------------------------------------------------------------ */

  // A numbered list item: every sentence in it is procedure text.
  function isStep(block) {
    return block.kind === 'list' && !!block.ordered;
  }

  // Sentences of a block, split once and shared by the overlay rules.
  function sentencesOf(block) {
    if (!block.plainSentences) block.plainSentences = splitSentences(block.text);
    return block.plainSentences;
  }

  // The parts of a block that are instructions: all of a numbered step, or
  // the instruction sentences of any other block. Ranges, as excepted() reads them.
  // In a numbered step the first sentence is the step itself, even when it is
  // written as a statement; later sentences count only if they are instructions
  // (owner decision after the 2.5 precision gate).
  function procedureSpans(block) {
    if (!block.plainProcedure) {
      block.plainProcedure = sentencesOf(block).filter(function (s, n) {
        return (n === 0 && isStep(block)) || context.isInstruction(block.text.slice(s.start, s.end));
      });
    }
    return block.plainProcedure;
  }

  // True when pos sits in a subordinate clause of its sentence ("after the files
  // are copied", "to see what will be uploaded"). A "that" clause after "make
  // sure" is the content of the instruction, so "that" does not count.
  var RE_SUBORDINATE = /\b(?:because|so|after|before|when|whenever|while|until|unless|if|which|who|whom|whose|what|where|to see|to check)\b[^.;:!?]*$/i;
  function inSubordinateClause(block, pos) {
    var sents = sentencesOf(block);
    for (var i = 0; i < sents.length; i++) {
      if (sents[i].start <= pos && pos < sents[i].end) return RE_SUBORDINATE.test(block.text.slice(sents[i].start, pos));
    }
    return false;
  }

  function runSentenceLengthContext(c, block, ctx, emit) {
    var procMax = c.rule.maxWordsProcedure || 20, descMax = c.rule.maxWordsDescription || 25;
    // A numbered step is procedure text throughout; elsewhere each sentence is judged on its own (trial 2.4).
    var procBlock = isStep(block);
    var sents = sentencesOf(block);
    for (var i = 0; i < sents.length; i++) {
      var s = sents[i];
      var seg = block.text.slice(s.start, s.end);
      var instruction = procBlock || context.isInstruction(seg);
      var max = instruction ? procMax : descMax;
      var words = wordcount.countWordsPlain(seg);
      if (words > max) emit(c, block, s.start, s.end, { detail: words + ' words, limit ' + max + (instruction ? ' for an instruction' : ' for a description') });
    }
  }

  function runParagraphSentences(c, block, ctx, emit) {
    var max = c.rule.maxSentences || 6;
    var n = sentencesOf(block).length;
    if (n > max) emit(c, block, 0, block.text.length, { detail: n + ' sentences, limit ' + max });
  }

  // "and", "and then", "then" or a semicolon, followed by a lowercase word.
  var RE_NEXT_STEP = /(?:\band(?:\s+then)?|\bthen|;)\s+(?=[a-z])/g;
  // Fixed pairs that name one action.
  var ONE_ACTION = /^(?:press and hold|drag and drop|click and drag|copy and paste|cut and paste|find and replace|search and replace|point and click)$/;

  function runOneInstruction(c, block, ctx, emit) {
    var sents = sentencesOf(block);
    for (var i = 0; i < sents.length; i++) {
      var s = sents[i], seg = block.text.slice(s.start, s.end);
      if (!context.isInstruction(seg)) continue;
      var re = new RegExp(RE_NEXT_STEP.source, 'g'), m;
      while ((m = re.exec(seg))) {
        var rest = seg.slice(m.index + m[0].length);
        var verb = (/^[a-z][a-z-]*/.exec(rest) || [''])[0];
        var prev = (/([A-Za-z]+)\s*,?\s*$/.exec(seg.slice(0, m.index)) || ['', ''])[1].toLowerCase();
        if (ONE_ACTION.test(prev + ' and ' + verb)) continue;
        if (!context.isInstruction(rest)) continue;
        var start = s.start + m.index, end = start + m[0].length + verb.length;
        if (overlapsMask(block, start, end)) continue;
        emit(c, block, start, end);
        break;
      }
    }
  }

  var RE_CONDITION = /\s(if|when|unless)\s/gi;
  // "Check if ..." asks whether; "the time when ..." names a time. Neither is a condition.
  var WHETHER_BEFORE = /\b(?:check|verify|confirm|see|test|ask|know|decide|determine|out|sure|whether|tell|show|find|learn)\s*$/i;
  var TIME_BEFORE = /\b(?:date|time|times|day|days|moment|point|hour|minute|week|month|year|period)\s*$/i;

  function runConditionFirst(c, block, ctx, emit) {
    var sents = sentencesOf(block);
    for (var i = 0; i < sents.length; i++) {
      var s = sents[i], seg = block.text.slice(s.start, s.end);
      if (!context.isInstruction(seg) || context.hasOpeningClause(seg)) continue;
      var re = new RegExp(RE_CONDITION.source, 'gi'), m;
      while ((m = re.exec(seg))) {
        var kw = m[1].toLowerCase(), before = seg.slice(0, m.index);
        if (kw === 'if' && WHETHER_BEFORE.test(before)) continue;
        if (kw === 'when' && TIME_BEFORE.test(before)) continue;
        var start = s.start + m.index + 1;
        var end = s.start + seg.replace(/[.!?"')\]\s]+$/, '').length;
        if (end <= start || overlapsMask(block, start, start + kw.length)) break;
        emit(c, block, start, end);
        break;
      }
    }
  }

  function runSentenceStartNumeral(c, block, ctx, emit) {
    var sents = splitSentences(block.text);
    for (var i = 0; i < sents.length; i++) {
      var s = sents[i];
      var seg = block.text.slice(s.start, s.end);
      var m = /^[\s"'(\[]*(\d+(?:[.,]\d+)*)(?=[\s,;:]|$)/.exec(seg);
      if (!m) continue;
      if (/^(?:19|20)\d\d$/.test(m[1])) continue; // a year is left alone
      var start = s.start + m[0].length - m[1].length;
      if (overlapsMask(block, start, start + m[1].length)) continue;
      emit(c, block, start, start + m[1].length);
    }
  }

  var UNIT_WORDS = /^(?:seconds?|secs?|s|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|yrs?|ms|milliseconds?|microseconds?|ns|[KMGTP]i?B|bytes?|bits?|kb|mb|gb|tb|px|pixels?|pt|em|rem|percent|%|a\.m\.|p\.m\.|am|pm|AM|PM|°|degrees?|mm|cm|m|km|kg|g|lbs?|in|inch(?:es)?|ft|feet|x|×|times|fps|[kMG]?Hz|dpi|[kMG]?bps|v|volts?|w|watts?|USD|EUR|GBP|dollars?|cents?)$/;
  var CONTEXT_WORDS = /(?:^|\s)(?:version|versions|v|ver|step|steps|chapter|section|page|pages|figure|fig|table|port|level|line|lines|part|phase|tier|option|item|row|column|key|code|error|http|status|build|release|sprint|q|quarter|id|number|no|#|\+|×|x|rule|rules|note|item|iteration|round|grade|type|group|channel|slot|tab|lane|zone|rank|position|stage|layer|generation|gen|api|series|model|revision|rev|patch|issue|ticket|pr)\s*$/i;

  function runNumerals(c, block, ctx, emit) {
    var text = block.text;
    var sents = splitSentences(text);
    var re = /(?:^|[^\d.,:/\-+$#€£¥%\uE000A-Za-z])(\d)(?![\d.,:/%\-A-Za-z])/g;
    for (var i = 0; i < sents.length; i++) {
      var s = sents[i], seg = text.slice(s.start, s.end);
      if (/\b\d{2,}\b/.test(seg.replace(/\b(?:19|20)\d\d\b/g, ''))) continue; // mixed sizes: numerals throughout
      re.lastIndex = 0; var m;
      while ((m = re.exec(seg))) {
        var sp = matchSpan(m);
        var abs = s.start + sp.start;
        var before = seg.slice(0, sp.start);
        var afterWord = /^\s*([^\s.,;:!?)"']+)/.exec(seg.slice(sp.end));
        if (afterWord && UNIT_WORDS.test(afterWord[1])) continue;
        if (CONTEXT_WORDS.test(before)) continue;
        if (/[\s(]$/.test(before) === false && before !== '') continue;
        // Inside quotation marks the number is probably a quoted UI string, where numerals are right.
        if ((before.match(/"/g) || []).length % 2 === 1) continue;
        if (overlapsMask(block, abs, abs + 1)) continue;
        emit(c, block, abs, abs + 1, { replacement: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][+m[1]] });
      }
    }
  }

  var SMALL_WORDS = /^(?:a|an|the|and|but|or|nor|for|so|yet|as|at|by|in|of|on|to|up|via|vs|per|from|into|with|over|than|that|this|is|be|are|was|were)$/i;
  var KNOWN_PROPER = /^(?:GitHub|Salesforce|Slack|Jira|macOS|Windows|Linux|Android|Chrome|Firefox|Safari|Edge|Markdown|English|Acme|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|Q[1-4]|Ctrl|Cmd|Alt|Shift|Enter|Esc|Tab|Unicode|Node|Python|Java|JavaScript|TypeScript|Docker|Kubernetes|Google|Microsoft|Apple|Amazon|AWS|Azure|Mac|PC|iOS|iPhone|iPad|Internet|Wi-Fi|Bluetooth|USB|Ethernet|North|South|East|West|American|European|Asian|African|US|UK|EU|I)$/;

  function runHeadingCase(c, block, ctx, emit) {
    var text = block.text.replace(/\uE000+/g, ' ');
    var tokens = [], re = /[A-Za-z][A-Za-z'’.-]*/g, m;
    while ((m = re.exec(text))) tokens.push({ w: m[0], i: m.index });
    if (tokens.length < 3) return;
    if (block.level === 1) return; // a page title may be the title of a published work, which takes title case
    var caps = 0, considered = 0;
    for (var k = 1; k < tokens.length; k++) {
      var w = tokens[k].w;
      var afterColon = /:\s*$/.test(text.slice(0, tokens[k].i));
      if (afterColon) continue;
      if (w === w.toUpperCase()) continue;                 // acronym
      if (/^[a-z]/.test(w)) { considered++; continue; }
      if (/[a-z][A-Z]/.test(w)) continue;                  // internal capitals, probably a name
      if (KNOWN_PROPER.test(w)) continue;
      if (c.names && c.names[w]) continue;                 // a configured name
      considered++;
      caps++;
    }
    if (caps >= 2 && caps >= Math.ceil(considered * 0.5)) {
      var start = tokens[0].i, end = tokens[tokens.length - 1].i + tokens[tokens.length - 1].w.length;
      emit(c, block, start, end);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Document-level checks                                                */
  /* ------------------------------------------------------------------ */

  function documentChecks(parsed, compiled, ctx, emit) {
    var blocks = parsed.blocks, lines = parsed.lines;
    var byType = {};
    compiled.forEach(function (c) { (byType[c.type] = byType[c.type] || []).push(c); });

    function blockOf(lineIdx, kind) {
      for (var i = 0; i < blocks.length; i++) if (blocks[i].lineIdx[0] === lineIdx && blocks[i].kind === kind) return blocks[i];
      return null;
    }

    // Headings
    if (byType['heading-structure']) {
      var heads = blocks.filter(function (b) { return b.kind === 'heading' && b.checked; });
      var h1 = 0, prevLevel = 0;
      for (var i = 0; i < heads.length; i++) {
        var h = heads[i];
        var span = [0, h.text.length];
        byType['heading-structure'].forEach(function (c) {
          var check = c.rule.check;
          if (check === 'multiple-h1' && h.level === 1 && h1 >= 1) emit(c, h, span[0], span[1]);
          if (check === 'level-skip' && prevLevel > 0 && h.level > prevLevel + 1) emit(c, h, span[0], span[1]);
          if (check === 'stacked' && i > 0) {
            // stacked: no non-blank, non-heading line between this heading and the previous one
            var prevIdx = heads[i - 1].lineIdx[0], cur = h.lineIdx[0], gap = false;
            for (var k = prevIdx + 1; k < cur; k++) { var kk = lines[k].kind; if (kk !== 'blank' && kk !== 'setext' && kk !== 'comment') { gap = true; break; } }
            if (!gap) emit(c, h, span[0], span[1]);
          }
        });
        if (h.level === 1) h1++;
        prevLevel = h.level;
      }
    }

    // Lists
    if (byType['list-structure']) {
      var lists = {};
      blocks.forEach(function (b) { if (b.kind === 'list' && b.checked) (lists[b.listId] = lists[b.listId] || []).push(b); });
      Object.keys(lists).forEach(function (id) {
        var items = lists[id], first = items[0];
        byType['list-structure'].forEach(function (c) {
          var check = c.rule.check, max = c.rule.maxItems || 7;
          if (check === 'too-long' && !first.ordered && items.length > max) emit(c, first, 0, first.text.length, { detail: items.length + ' items' });
          if (check === 'long-numbered' && first.ordered && items.length > max) emit(c, first, 0, first.text.length, { detail: items.length + ' steps' });
          if (check === 'single-numbered' && first.ordered && items.length === 1) emit(c, first, 0, first.text.length);
        });
      });
    }

    // Tables
    if (byType['table-structure']) {
      byType['table-structure'].forEach(function (c) {
        if (c.rule.check === 'blank-cell') {
          blocks.forEach(function (b) {
            if (b.kind !== 'cell' || !b.checked || b.header) return;
            if (b.text.replace(/\s/g, '') === '') {
              // Report the raw cell span so the underline has somewhere to sit.
              var ln = lines[b.lineIdx[0]];
              var raw = b.cellRaw, s = raw[0], e = raw[1];
              var fake = { kind: 'cell', text: ln.prose.slice(s, e) || ' ', starts: [{ pos: 0, line: b.lineIdx[0], col: s }], lineIdx: b.lineIdx };
              emit(c, fake, 0, Math.max(1, e - s));
            }
          });
        }
        if (c.rule.check === 'intro-colon') {
          for (var i = 0; i < blocks.length - 1; i++) {
            var b = blocks[i];
            if (b.kind !== 'paragraph' || !b.checked) continue;
            // next non-image block
            var j = i + 1; while (j < blocks.length && blocks[j].kind === 'image-alt') j++;
            if (j < blocks.length && blocks[j].kind === 'cell' && /:\s*$/.test(b.text)) {
              var pos = b.text.lastIndexOf(':');
              emit(c, b, pos, pos + 1, { replacement: '.' });
            }
          }
        }
      });
    }

    // Duplicate links per section
    if (byType['duplicate-link']) {
      byType['duplicate-link'].forEach(function (c) {
        var seen = {};
        for (var i = 0; i < lines.length; i++) {
          var ln = lines[i];
          if (ln.kind === 'heading') { seen = {}; continue; }
          if (!ln.checked) continue;
          for (var k = 0; k < ln.links.length; k++) {
            var lk = ln.links[k];
            if (!lk.url) continue;
            var key = lk.url.toLowerCase();
            if (seen[key]) {
              var fake = { kind: 'paragraph', text: ln.prose.slice(lk.start, lk.end), starts: [{ pos: 0, line: i, col: lk.start }], lineIdx: [i] };
              emit(c, fake, 0, lk.end - lk.start);
            } else seen[key] = true;
          }
        }
      });
    }

    // Empty alt text
    if (byType['empty-alt']) {
      byType['empty-alt'].forEach(function (c) {
        for (var i = 0; i < lines.length; i++) {
          var ln = lines[i];
          if (!ln.checked) continue;
          for (var k = 0; k < ln.images.length; k++) {
            var im = ln.images[k];
            if (im.altEnd === im.altStart) {
              var fake = { kind: 'image-alt', text: ln.text.slice(im.start, im.end), starts: [{ pos: 0, line: i, col: im.start }], lineIdx: [i] };
              emit(c, fake, 0, im.end - im.start);
            }
          }
        }
      });
    }

    // Acronyms without an expansion anywhere in the document
    if (byType['unexpanded-acronym']) {
      byType['unexpanded-acronym'].forEach(function (c) {
        var known = {};
        (c.rule.knownAcronyms || []).forEach(function (a) { known[a] = true; });
        var all = parsed.text;
        var expanded = {};
        var re1 = /\(([A-Z][A-Z0-9]{1,6})s?\)/g, m;
        while ((m = re1.exec(all))) expanded[m[1]] = true;
        var re2 = /\b([A-Z][A-Z0-9]{1,6})\s*\(/g;
        while ((m = re2.exec(all))) expanded[m[1]] = true;
        var reported = {};
        for (var b = 0; b < blocks.length; b++) {
          var blk = blocks[b];
          if (!blk.checked || blk.kind === 'image-alt') continue;
          var re = /(?:^|[^A-Za-z0-9_\uE000./\-])([A-Z][A-Z0-9]{1,6})(s?)(?![A-Za-z0-9_])/g;
          while ((m = re.exec(blk.text))) {
            var ac = m[1];
            if (!/[A-Z]{2}/.test(ac)) continue;
            if (known[ac] || known[ac + m[2]] || expanded[ac] || reported[ac]) continue;
            reported[ac] = true;
            var sp = matchSpan(m);
            emit(c, blk, sp.start, sp.end + m[2].length);
          }
        }
      });
    }

    // Alternating generic terms
    if (byType['alternating-terms']) {
      byType['alternating-terms'].forEach(function (c) { c.groups.forEach(function (group) {
        var firsts = [], distinct = 0;
        for (var t = 0; t < group.length; t++) {
          var term = group[t], first = null;
          for (var b = 0; b < blocks.length && !first; b++) {
            var blk = blocks[b];
            if (!blk.checked || blk.kind === 'image-alt') continue;
            var exc = exceptionRanges(c, blk, ctx);
            term.re.lastIndex = 0; var m;
            while ((m = term.re.exec(blk.text))) {
              var sp = matchSpan(m);
              if (excepted(exc, sp.start, sp.end) || overlapsMask(blk, sp.start, sp.end)) continue;
              // "bot" inside "chatbot" is already excluded by the boundary; "AI assistant" vs "assistant" alone is not counted
              first = { block: blk, start: sp.start, end: sp.end }; break;
            }
          }
          if (first) { first.term = term.term; firsts.push(first); distinct++; }
        }
        if (distinct >= 2) {
          firsts.forEach(function (f) {
            var others = firsts.filter(function (o) { return o !== f; }).map(function (o) { return '"' + o.term + '"'; });
            emit(c, f.block, f.start, f.end, { detail: 'also used: ' + others.join(', ') });
          });
        }
      }); });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Convenience                                                          */
  /* ------------------------------------------------------------------ */

  function check(text, rules) {
    var ch = createChecker(text, rules);
    return ch.finish();
  }

  /* ------------------------------------------------------------------ */
  /* Self-test                                                            */
  /* ------------------------------------------------------------------ */

  var SKIP_CASES = [
    { name: 'fenced code block', text: 'Intro line.\n\n```\nthe user should click here — e.g. utilize it; really!\n```\n' },
    { name: 'indented code block', text: 'Intro line.\n\n    the user should click here — e.g. utilize it; really!\n' },
    { name: 'inline code', text: 'Run `the user click here — e.g. utilize; really!` now.\n' },
    { name: 'bare URL', text: 'See https://example.com/the-user/click-here;e.g.--utilize now.\n' },
    { name: 'link target', text: 'See [the docs](https://example.com/click-here;e.g.--utilize) now.\n' },
    { name: 'HTML tag and attributes', text: 'Open <a href="click-here;e.g." title="the user — utilize">it</a> now.\n' },
    { name: 'HTML comment', text: 'Text.\n<!-- the user should click here — e.g. utilize it; really! -->\nMore text.\n' },
    { name: 'YAML front matter', text: '---\ntitle: the user should click here — e.g. utilize; really!\n---\n\nBody text.\n' },
    { name: 'image path', text: 'See the screen.\n\n![The sharing tab](images/the-user--click-here;e.g.utilize.png)\n' },
    { name: 'style-check off and on', text: 'Fine text.\n\n<!-- style-check off -->\n\nThe user should click here — e.g. utilize it; really!\n\n<!-- style-check on -->\n\nFine text again.\n' },
    { name: 'HTML entity', text: 'Projects &amp; tasks sync.\n' }
  ];

  function runSelfTest(rules) {
    var results = [], failures = 0;
    rules.forEach(function (rule) {
      var ex = rule.examples || {};
      (ex.flag || []).forEach(function (t) {
        var got = check(t + '\n', rules).issues.map(function (i) { return i.ruleId; });
        var ok = got.indexOf(rule.id) >= 0;
        if (!ok) failures++;
        results.push({ ruleId: rule.id, kind: 'flag', text: t, ok: ok, got: got });
      });
      (ex.pass || []).forEach(function (t) {
        var got = check(t + '\n', rules).issues.filter(function (i) { return i.ruleId === rule.id; }).map(function (i) { return i.text; });
        var ok = got.length === 0;
        if (!ok) failures++;
        results.push({ ruleId: rule.id, kind: 'pass', text: t, ok: ok, got: got });
      });
    });
    var skipTests = SKIP_CASES.map(function (sc) {
      var got = check(sc.text, rules).issues;
      var ok = got.length === 0;
      if (!ok) failures++;
      return { name: sc.name, ok: ok, got: got.map(function (i) { return i.ruleId + ':' + JSON.stringify(i.text); }) };
    });
    // Timing: a long, repetitive document of roughly 10,000 words.
    var para = 'The dashboard refreshes every 5 minutes, so your team sees the latest numbers. When you select Save, the dialog closes. ' +
      'Archived projects, those older than a year, are read-only. Select Export to download the report as a CSV file. ' +
      'The connector retries a failed request and logs the result. If the connector can\'t reach the sync API for 30 seconds, it saves your changes locally. ' +
      'The user should click here to utilize the feature — it is really powerful; e.g. the login page.\n\n';
    var long = '';
    while (countWords(long) < 10000) long += '## Section heading\n\n' + para + '- First item\n- Second item\n\n';
    var t0 = now();
    var res = check(long, rules);
    var ms = now() - t0;
    var timing = { words: res.words, ms: Math.round(ms), issues: res.issues.length, ok: ms < 500 };
    if (!timing.ok) failures++;
    return { ok: failures === 0, failures: failures, results: results, skipTests: skipTests, timing: timing };
  }

  return {
    parse: parse,
    compileRules: compileRules,
    check: check,
    createChecker: createChecker,
    runSelfTest: runSelfTest,
    splitSentences: splitSentences,
    countWords: countWords,
    MASK: MASK,
    SEVERITY_RANK: SEVERITY_RANK
  };
}));
